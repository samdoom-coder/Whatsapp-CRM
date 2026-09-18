import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireWorkspace, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../lib/errors.js';
import { auditLog } from '../../lib/activity.js';

const router = Router();

const TRIGGERS = ['new_conversation', 'new_message', 'contact_created', 'lead_created', 'lead_status_changed', 'deal_created', 'deal_stage_changed', 'no_response', 'task_overdue'];

const createSchema = z.object({
  name: z.string().min(1).max(160),
  description: z.string().max(500).optional().nullable(),
  triggerType: z.enum(['new_conversation', 'new_message', 'contact_created', 'lead_created', 'lead_status_changed', 'deal_created', 'deal_stage_changed', 'no_response', 'task_overdue']),
  conditions: z.array(z.object({ field: z.string(), op: z.string(), value: z.any() })).optional(),
  actions: z.array(z.object({ type: z.string(), value: z.any().optional() })).min(1),
  isEnabled: z.boolean().default(true),
});

const updateSchema = createSchema.partial();

// GET /api/automations
router.get('/workspaces/:workspaceId/automations', authenticate, requireWorkspace, async (req, res, next) => {
  try {
    const items = await prisma.automation.findMany({
      where: { workspaceId: req.ws!.workspaceId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { runs: true } } },
    });
    res.json({ items, triggers: TRIGGERS });
  } catch (err) {
    next(err);
  }
});

// GET /api/automations/:automationId/runs
router.get('/workspaces/:workspaceId/automations/:automationId/runs', authenticate, requireWorkspace, async (req, res, next) => {
  try {
    const runs = await prisma.automationRun.findMany({
      where: { automationId: req.params.automationId, workspaceId: req.ws!.workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ items: runs });
  } catch (err) {
    next(err);
  }
});

// POST /api/automations
router.post('/workspaces/:workspaceId/automations', authenticate, requireWorkspace, requireRole('OWNER', 'ADMIN'), validate(createSchema), async (req, res, next) => {
  try {
    const automation = await prisma.automation.create({
      data: {
        workspaceId: req.ws!.workspaceId,
        name: req.body.name,
        description: req.body.description,
        triggerType: req.body.triggerType,
        conditions: req.body.conditions ?? undefined,
        actions: req.body.actions,
        isEnabled: req.body.isEnabled,
      },
    });
    await auditLog({ workspaceId: req.ws!.workspaceId, userId: req.user!.id, action: 'automation.created', entityType: 'automation', entityId: automation.id });
    res.status(201).json(automation);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/automations/:automationId
router.patch('/workspaces/:workspaceId/automations/:automationId', authenticate, requireWorkspace, requireRole('OWNER', 'ADMIN'), validate(updateSchema), async (req, res, next) => {
  try {
    const automation = await prisma.automation.findFirst({ where: { id: req.params.automationId, workspaceId: req.ws!.workspaceId } });
    if (!automation) throw ApiError.notFound('Automation not found');
    const updated = await prisma.automation.update({ where: { id: automation.id }, data: req.body });
    await auditLog({ workspaceId: req.ws!.workspaceId, userId: req.user!.id, action: 'automation.updated', entityType: 'automation', entityId: automation.id });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/automations/:automationId
router.delete('/workspaces/:workspaceId/automations/:automationId', authenticate, requireWorkspace, requireRole('OWNER', 'ADMIN'), async (req, res, next) => {
  try {
    const automation = await prisma.automation.findFirst({ where: { id: req.params.automationId, workspaceId: req.ws!.workspaceId } });
    if (!automation) throw ApiError.notFound('Automation not found');
    await prisma.automation.delete({ where: { id: automation.id } });
    await auditLog({ workspaceId: req.ws!.workspaceId, userId: req.user!.id, action: 'automation.deleted', entityType: 'automation', entityId: automation.id });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;