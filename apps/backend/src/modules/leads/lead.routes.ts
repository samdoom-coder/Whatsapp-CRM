import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireWorkspace } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../lib/errors.js';
import { logActivity, auditLog } from '../../lib/activity.js';

const router = Router();

export const LEAD_STATUSES = ['New', 'Contacted', 'Qualified', 'Unqualified', 'Converted', 'Lost'];
export const LEAD_SOURCES = ['WhatsApp', 'Instagram', 'Facebook', 'Website', 'Referral', 'Campaign', 'Cold Call', 'Other'];

const createSchema = z.object({
  contactId: z.string().uuid(),
  name: z.string().min(1).max(160),
  phone: z.string().min(4).max(30),
  source: z.string().max(80).default('WhatsApp'),
  status: z.enum(['New', 'Contacted', 'Qualified', 'Unqualified', 'Converted', 'Lost']).default('New'),
  score: z.number().int().min(0).max(100).default(0),
  assignedToId: z.string().uuid().optional().nullable(),
  estimatedValue: z.coerce.number().nonnegative().optional().nullable(),
  expectedCloseDate: z.string().datetime().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  tags: z.array(z.string()).optional(),
});

const updateSchema = createSchema.partial();

const listSchema = z.object({
  status: z.string().optional(),
  search: z.string().optional(),
  assignedToId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(100),
});

const include = {
  contact: { select: { id: true, name: true, phone: true, avatarUrl: true, email: true, company: true } },
  assignedTo: { select: { id: true, name: true, avatarUrl: true } },
  tags: { select: { id: true, name: true, color: true } },
} as const;

const publicLead = (l: any) => ({
  ...l,
  estimatedValue: l.estimatedValue === null ? null : Number(l.estimatedValue),
  tags: l.tags ?? [],
});

// GET /api/leads (optionally grouped by status for kanban)
router.get('/workspaces/:workspaceId/leads', authenticate, requireWorkspace, validate(listSchema, 'query'), async (req, res, next) => {
  try {
    const wsId = req.ws!.workspaceId;
    const q = req.query as unknown as z.infer<typeof listSchema>;
    const where: Record<string, unknown> = { workspaceId: wsId };
    if (q.status) where.status = q.status;
    if (q.assignedToId) where.assignedToId = q.assignedToId;
    if (q.search) {
      where.OR = [
        { name: { contains: q.search, mode: 'insensitive' } },
        { phone: { contains: q.search } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.lead.count({ where }),
      prisma.lead.findMany({
        where,
        include,
        orderBy: [{ score: 'desc' }, { createdAt: 'desc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);

    const grouped = LEAD_STATUSES.map((status) => ({
      status,
      items: items.filter((i) => i.status === status).map(publicLead),
    }));

    res.json({ grouped, items: items.map(publicLead), total, page: q.page, pageSize: q.pageSize });
  } catch (err) {
    next(err);
  }
});

// GET /api/leads/:leadId
router.get('/workspaces/:workspaceId/leads/:leadId', authenticate, requireWorkspace, async (req, res, next) => {
  try {
    const lead = await prisma.lead.findFirst({
      where: { id: req.params.leadId, workspaceId: req.ws!.workspaceId },
      include: { ...include, contact: { include: { conversations: { orderBy: { lastMessageAt: 'desc' } }, deals: true } } },
    });
    if (!lead) throw ApiError.notFound('Lead not found');
    res.json(publicLead(lead));
  } catch (err) {
    next(err);
  }
});

// POST /api/leads
router.post('/workspaces/:workspaceId/leads', authenticate, requireWorkspace, validate(createSchema), async (req, res, next) => {
  try {
    const wsId = req.ws!.workspaceId;
    const body = req.body as z.infer<typeof createSchema>;
    const contact = await prisma.contact.findFirst({ where: { id: body.contactId, workspaceId: wsId } });
    if (!contact) throw ApiError.badRequest('Contact not found in this workspace');

    const lead = await prisma.lead.create({
      data: {
        workspaceId: wsId,
        contactId: body.contactId,
        name: body.name,
        phone: body.phone,
        source: body.source,
        status: body.status,
        score: body.score,
        assignedToId: body.assignedToId,
        estimatedValue: body.estimatedValue !== undefined && body.estimatedValue !== null ? body.estimatedValue : undefined,
        expectedCloseDate: body.expectedCloseDate ? new Date(body.expectedCloseDate) : undefined,
        notes: body.notes,
        ...(body.tags?.length ? { tags: { connect: await ensureTags(wsId, body.tags) } } : {}),
      },
      include,
    });

    await prisma.contact.update({ where: { id: body.contactId }, data: { leadStatus: body.status } });

    await logActivity({
      workspaceId: wsId,
      type: 'lead_created',
      title: `Lead created: ${lead.name}`,
      actorId: req.user!.id,
      contactId: body.contactId,
    });
    await auditLog({ workspaceId: wsId, userId: req.user!.id, action: 'lead.created', entityType: 'lead', entityId: lead.id });

    res.status(201).json(publicLead(lead));
  } catch (err) {
    next(err);
  }
});

// PATCH /api/leads/:leadId - supports drag-and-drop status changes
router.patch('/workspaces/:workspaceId/leads/:leadId', authenticate, requireWorkspace, validate(updateSchema), async (req, res, next) => {
  try {
    const wsId = req.ws!.workspaceId;
    const leadId = req.params.leadId;
    const lead = await prisma.lead.findFirst({ where: { id: leadId, workspaceId: wsId } });
    if (!lead) throw ApiError.notFound('Lead not found');

    const body = req.body as z.infer<typeof updateSchema>;
    const { tags, ...rest } = body;
    const data: Record<string, unknown> = { ...rest };
    if (rest.expectedCloseDate) data.expectedCloseDate = new Date(rest.expectedCloseDate);
    if (tags) {
      await prisma.lead.update({ where: { id: leadId }, data: { tags: { set: [] } } });
      data.tags = { connect: await ensureTags(wsId, tags) };
    }

    const updated = await prisma.lead.update({ where: { id: leadId }, data, include });

    if (body.status && body.status !== lead.status) {
      await prisma.contact.update({ where: { id: lead.contactId }, data: { leadStatus: body.status } });
      await logActivity({
        workspaceId: wsId,
        type: 'lead_status_changed',
        title: `Lead status changed: ${lead.name} → ${body.status}`,
        actorId: req.user!.id,
        contactId: lead.contactId,
        metadata: { from: lead.status, to: body.status },
      });
      // trigger automation
      const { triggerAutomation } = await import('../../automation/engine.js');
      triggerAutomation(wsId, 'lead_status_changed', { workspaceId: wsId, leadId, contactId: lead.contactId, status: body.status }).catch(() => {});
    }

    await auditLog({ workspaceId: wsId, userId: req.user!.id, action: 'lead.updated', entityType: 'lead', entityId: leadId });

    res.json(publicLead(updated));
  } catch (err) {
    next(err);
  }
});

// DELETE /api/leads/:leadId
router.delete('/workspaces/:workspaceId/leads/:leadId', authenticate, requireWorkspace, async (req, res, next) => {
  try {
    const lead = await prisma.lead.findFirst({ where: { id: req.params.leadId, workspaceId: req.ws!.workspaceId } });
    if (!lead) throw ApiError.notFound('Lead not found');
    await prisma.lead.delete({ where: { id: lead.id } });
    await auditLog({ workspaceId: req.ws!.workspaceId, userId: req.user!.id, action: 'lead.deleted', entityType: 'lead', entityId: lead.id });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

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