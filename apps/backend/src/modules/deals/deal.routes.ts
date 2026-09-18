import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireWorkspace } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../lib/errors.js';
import { logActivity, auditLog } from '../../lib/activity.js';
import { emitToWorkspace } from '../../realtime/socket.js';

const router = Router();

export const PIPELINE_STAGES = ['New Lead', 'Contacted', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'];

export const STAGE_PROBABILITY: Record<string, number> = {
  'New Lead': 10,
  Contacted: 20,
  Qualified: 40,
  Proposal: 60,
  Negotiation: 80,
  Won: 100,
  Lost: 0,
};

const createSchema = z.object({
  name: z.string().min(1).max(200),
  contactId: z.string().uuid().optional().nullable(),
  value: z.coerce.number().nonnegative().default(0),
  stage: z.string().max(60).default('New Lead'),
  probability: z.number().int().min(0).max(100).optional(),
  expectedCloseDate: z.string().datetime().optional().nullable(),
  assignedToId: z.string().uuid().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  tags: z.array(z.string()).optional(),
});

const updateSchema = createSchema.partial();

const include = {
  contact: { select: { id: true, name: true, phone: true, avatarUrl: true, email: true, company: true } },
  assignedTo: { select: { id: true, name: true, avatarUrl: true } },
  tags: { select: { id: true, name: true, color: true } },
} as const;

const publicDeal = (d: any) => ({ ...d, value: Number(d.value), tags: d.tags ?? [] });

// GET /api/deals
router.get('/workspaces/:workspaceId/deals', authenticate, requireWorkspace, async (req, res, next) => {
  try {
    const wsId = req.ws!.workspaceId;
    const where: Record<string, unknown> = { workspaceId: wsId };
    if (req.query.stage) where.stage = req.query.stage;
    if (req.query.assignedToId) where.assignedToId = req.query.assignedToId;
    if (req.query.search) where.name = { contains: req.query.search as string, mode: 'insensitive' };

    const [allDeals, grouped] = await Promise.all([
      prisma.deal.findMany({ where, include, orderBy: { updatedAt: 'desc' } }),
      Promise.all(
        PIPELINE_STAGES.map((stage) =>
          prisma.deal.findMany({
            where: { ...where, stage },
            include,
            orderBy: { updatedAt: 'desc' },
          }),
        ),
      ),
    ]);

    const pipeline = PIPELINE_STAGES.map((stage, idx) => ({
      stage,
      items: grouped[idx].map(publicDeal),
      value: grouped[idx].reduce((s, d) => s + Number(d.value), 0),
      count: grouped[idx].length,
    }));

    const totals = allDeals.reduce(
      (acc, d) => {
        acc.totalValue += Number(d.value);
        acc.weightedValue += Number(d.value) * ((d.probability ?? STAGE_PROBABILITY[d.stage] ?? 0) / 100);
        if (d.stage === 'Won') acc.wonValue += Number(d.value);
        if (d.stage === 'Lost') acc.lostValue += Number(d.value);
        return acc;
      },
      { totalValue: 0, weightedValue: 0, wonValue: 0, lostValue: 0 },
    );

    res.json({ pipeline, totals, items: allDeals.map(publicDeal) });
  } catch (err) {
    next(err);
  }
});

// GET /api/deals/:dealId
router.get('/workspaces/:workspaceId/deals/:dealId', authenticate, requireWorkspace, async (req, res, next) => {
  try {
    const deal = await prisma.deal.findFirst({
      where: { id: req.params.dealId, workspaceId: req.ws!.workspaceId },
      include: {
        ...include,
        contact: { include: { conversations: { orderBy: { lastMessageAt: 'desc' } } } },
        tasks: { include: { assignedTo: { select: { id: true, name: true } } }, orderBy: { dueDate: 'asc' } },
        activities: { orderBy: { createdAt: 'desc' }, take: 50, include: { actor: { select: { id: true, name: true } } } },
      },
    });
    if (!deal) throw ApiError.notFound('Deal not found');
    res.json(publicDeal(deal));
  } catch (err) {
    next(err);
  }
});

// POST /api/deals
router.post('/workspaces/:workspaceId/deals', authenticate, requireWorkspace, validate(createSchema), async (req, res, next) => {
  try {
    const wsId = req.ws!.workspaceId;
    const body = req.body as z.infer<typeof createSchema>;

    if (body.contactId) {
      const contact = await prisma.contact.findFirst({ where: { id: body.contactId, workspaceId: wsId } });
      if (!contact) throw ApiError.badRequest('Contact not found in this workspace');
    }

    const deal = await prisma.deal.create({
      data: {
        workspaceId: wsId,
        name: body.name,
        contactId: body.contactId,
        value: body.value,
        stage: body.stage,
        probability: body.probability ?? STAGE_PROBABILITY[body.stage] ?? 0,
        expectedCloseDate: body.expectedCloseDate ? new Date(body.expectedCloseDate) : undefined,
        assignedToId: body.assignedToId,
        notes: body.notes,
        ...(body.tags?.length ? { tags: { connect: await ensureTags(wsId, body.tags) } } : {}),
      },
      include,
    });

    await logActivity({
      workspaceId: wsId,
      type: 'deal_created',
      title: `Deal created: ${deal.name}`,
      description: `₹${Number(deal.value).toLocaleString('en-IN')}`,
      actorId: req.user!.id,
      contactId: body.contactId ?? undefined,
      dealId: deal.id,
    });
    await auditLog({ workspaceId: wsId, userId: req.user!.id, action: 'deal.created', entityType: 'deal', entityId: deal.id });
    emitToWorkspace(wsId, 'deal:created', publicDeal(deal));

    const { triggerAutomation } = await import('../../automation/engine.js');
    triggerAutomation(wsId, 'deal_created', { workspaceId: wsId, dealId: deal.id, contactId: body.contactId, stage: body.stage }).catch(() => {});

    res.status(201).json(publicDeal(deal));
  } catch (err) {
    next(err);
  }
});

// PATCH /api/deals/:dealId - supports kanban drag-and-drop stage moves
router.patch('/workspaces/:workspaceId/deals/:dealId', authenticate, requireWorkspace, validate(updateSchema), async (req, res, next) => {
  try {
    const wsId = req.ws!.workspaceId;
    const dealId = req.params.dealId;
    const deal = await prisma.deal.findFirst({ where: { id: dealId, workspaceId: wsId } });
    if (!deal) throw ApiError.notFound('Deal not found');

    const body = req.body as z.infer<typeof updateSchema>;
    const { tags, ...rest } = body;
    const data: Record<string, unknown> = { ...rest };
    if (rest.value !== undefined && rest.value !== null) data.value = rest.value;
    if (rest.expectedCloseDate) data.expectedCloseDate = new Date(rest.expectedCloseDate);

    if (body.stage) {
      data.stage = body.stage;
      if (body.stage === 'Won' && deal.stage !== 'Won') {
        data.wonAt = new Date();
        data.lostAt = null;
        data.lostReason = null;
      }
      if (body.stage === 'Lost' && deal.stage !== 'Lost') {
        data.lostAt = new Date();
        data.wonAt = null;
      }
    }

    if (tags) {
      await prisma.deal.update({ where: { id: dealId }, data: { tags: { set: [] } } });
      data.tags = { connect: await ensureTags(wsId, tags) };
    }

    const updated = await prisma.deal.update({ where: { id: dealId }, data, include });

    if (body.stage && body.stage !== deal.stage) {
      const type = body.stage === 'Won' ? 'deal_won' : body.stage === 'Lost' ? 'deal_lost' : 'deal_stage_changed';
      await logActivity({
        workspaceId: wsId,
        type,
        title: body.stage === 'Won' ? `Deal won: ${deal.name}` : body.stage === 'Lost' ? `Deal lost: ${deal.name}` : `Deal moved to ${body.stage}: ${deal.name}`,
        description: `₹${Number(updated.value).toLocaleString('en-IN')}`,
        actorId: req.user!.id,
        contactId: deal.contactId ?? undefined,
        dealId,
        metadata: { from: deal.stage, to: body.stage },
      });
      emitToWorkspace(wsId, 'deal:updated', publicDeal(updated));
      const { triggerAutomation } = await import('../../automation/engine.js');
      triggerAutomation(wsId, 'deal_stage_changed', { workspaceId: wsId, dealId, contactId: deal.contactId, stage: body.stage, from: deal.stage }).catch(() => {});
    }

    await auditLog({ workspaceId: wsId, userId: req.user!.id, action: 'deal.updated', entityType: 'deal', entityId: dealId });

    res.json(publicDeal(updated));
  } catch (err) {
    next(err);
  }
});

// DELETE /api/deals/:dealId
router.delete('/workspaces/:workspaceId/deals/:dealId', authenticate, requireWorkspace, async (req, res, next) => {
  try {
    const deal = await prisma.deal.findFirst({ where: { id: req.params.dealId, workspaceId: req.ws!.workspaceId } });
    if (!deal) throw ApiError.notFound('Deal not found');
    await prisma.deal.delete({ where: { id: deal.id } });
    await auditLog({ workspaceId: req.ws!.workspaceId, userId: req.user!.id, action: 'deal.deleted', entityType: 'deal', entityId: deal.id });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Ensure tags exist and return ids for connecting
async function ensureTags(workspaceId: string, names: string[]) {
  const ids: string[] = [];
  for (const name of names) {
    const tag = await prisma.tag.upsert({
      where: { workspaceId_name: { workspaceId, name } },
      update: {},
      create: { workspaceId, name },
    });
    ids.push(tag.id);
  }
  return ids.map((id) => ({ id }));
}

export default router;