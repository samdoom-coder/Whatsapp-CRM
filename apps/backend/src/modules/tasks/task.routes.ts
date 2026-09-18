import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireWorkspace } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../lib/errors.js';
import { logActivity, auditLog } from '../../lib/activity.js';
import { emitToWorkspace } from '../../realtime/socket.js';

const router = Router();

export const TASK_STATUSES = ['pending', 'completed', 'cancelled'];
export const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'];

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  type: z.string().max(40).default('follow_up'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  status: z.enum(['pending', 'completed', 'cancelled']).default('pending'),
  dueDate: z.string().datetime().optional().nullable(),
  recurring: z.string().optional().nullable(),
  assignedToId: z.string().uuid().optional().nullable(),
  contactId: z.string().uuid().optional().nullable(),
  dealId: z.string().uuid().optional().nullable(),
  conversationId: z.string().uuid().optional().nullable(),
});

const updateSchema = createSchema.partial();

const include = {
  contact: { select: { id: true, name: true, phone: true, avatarUrl: true } },
  deal: { select: { id: true, name: true, value: true, stage: true } },
  conversation: { select: { id: true, contact: { select: { id: true, name: true, phone: true } } } },
  assignedTo: { select: { id: true, name: true, avatarUrl: true } },
} as const;

const publicTask = (t: any) => ({ ...t, deal: t.deal ? { ...t.deal, value: Number(t.deal.value) } : null });

// GET /api/tasks
router.get('/workspaces/:workspaceId/tasks', authenticate, requireWorkspace, async (req, res, next) => {
  try {
    const wsId = req.ws!.workspaceId;
    const where: Record<string, unknown> = { workspaceId: wsId };
    if (req.query.status) where.status = req.query.status;
    if (req.query.assignedToId) where.assignedToId = req.query.assignedToId;
    if (req.query.priority) where.priority = req.query.priority;
    if (req.query.type) where.type = req.query.type;
    if (req.query.search) where.title = { contains: req.query.search as string, mode: 'insensitive' };
    if (req.query.overdue === 'true') where.dueDate = { lt: new Date() };
    if (req.query.dueToday === 'true') {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      where.dueDate = { gte: start, lt: end };
    }
    if (req.query.upcoming === 'true') where.dueDate = { gt: new Date() };

    const items = await prisma.task.findMany({
      where,
      include,
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
    });
    res.json({ items: items.map(publicTask) });
  } catch (err) {
    next(err);
  }
});

// GET /api/tasks/:taskId
router.get('/workspaces/:workspaceId/tasks/:taskId', authenticate, requireWorkspace, async (req, res, next) => {
  try {
    const task = await prisma.task.findFirst({ where: { id: req.params.taskId, workspaceId: req.ws!.workspaceId }, include });
    if (!task) throw ApiError.notFound('Task not found');
    res.json(publicTask(task));
  } catch (err) {
    next(err);
  }
});

// POST /api/tasks
router.post('/workspaces/:workspaceId/tasks', authenticate, requireWorkspace, validate(createSchema), async (req, res, next) => {
  try {
    const wsId = req.ws!.workspaceId;
    const body = req.body as z.infer<typeof createSchema>;

    if (body.contactId) {
      const contact = await prisma.contact.findFirst({ where: { id: body.contactId, workspaceId: wsId } });
      if (!contact) throw ApiError.badRequest('Contact not found');
    }

    const task = await prisma.task.create({
      data: {
        workspaceId: wsId,
        title: body.title,
        description: body.description,
        type: body.type,
        priority: body.priority,
        status: body.status,
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
        recurring: body.recurring,
        assignedToId: body.assignedToId,
        contactId: body.contactId,
        dealId: body.dealId,
        conversationId: body.conversationId,
      },
      include,
    });

    await logActivity({
      workspaceId: wsId,
      type: 'follow_up_scheduled',
      title: `Task created: ${task.title}`,
      actorId: req.user!.id,
      contactId: body.contactId ?? undefined,
      dealId: body.dealId ?? undefined,
      conversationId: body.conversationId ?? undefined,
      metadata: { dueDate: body.dueDate },
    });
    await auditLog({ workspaceId: wsId, userId: req.user!.id, action: 'task.created', entityType: 'task', entityId: task.id });
    emitToWorkspace(wsId, 'task:created', publicTask(task));

    res.status(201).json(publicTask(task));
  } catch (err) {
    next(err);
  }
});

// PATCH /api/tasks/:taskId
router.patch('/workspaces/:workspaceId/tasks/:taskId', authenticate, requireWorkspace, validate(updateSchema), async (req, res, next) => {
  try {
    const wsId = req.ws!.workspaceId;
    const taskId = req.params.taskId;
    const task = await prisma.task.findFirst({ where: { id: taskId, workspaceId: wsId } });
    if (!task) throw ApiError.notFound('Task not found');

    const body = req.body as z.infer<typeof updateSchema>;
    const data: Record<string, unknown> = { ...body };
    if (body.dueDate) data.dueDate = new Date(body.dueDate);
    if (body.status === 'completed') data.completedAt = new Date();
    if (body.status && body.status !== 'completed') data.completedAt = null;

    const updated = await prisma.task.update({ where: { id: taskId }, data, include });

    if (body.status && body.status !== task.status) {
      await logActivity({
        workspaceId: wsId,
        type: 'task_completed',
        title: body.status === 'completed' ? `Task completed: ${task.title}` : `Task ${body.status}: ${task.title}`,
        actorId: req.user!.id,
        contactId: task.contactId ?? undefined,
        dealId: task.dealId ?? undefined,
      });
      emitToWorkspace(wsId, 'task:updated', publicTask(updated));
    }

    await auditLog({ workspaceId: wsId, userId: req.user!.id, action: 'task.updated', entityType: 'task', entityId: taskId });
    res.json(publicTask(updated));
  } catch (err) {
    next(err);
  }
});

// DELETE /api/tasks/:taskId
router.delete('/workspaces/:workspaceId/tasks/:taskId', authenticate, requireWorkspace, async (req, res, next) => {
  try {
    const task = await prisma.task.findFirst({ where: { id: req.params.taskId, workspaceId: req.ws!.workspaceId } });
    if (!task) throw ApiError.notFound('Task not found');
    await prisma.task.delete({ where: { id: task.id } });
    await auditLog({ workspaceId: req.ws!.workspaceId, userId: req.user!.id, action: 'task.deleted', entityType: 'task', entityId: task.id });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;