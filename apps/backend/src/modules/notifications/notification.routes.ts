import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireWorkspace } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../lib/errors.js';
import { emitToWorkspace } from '../../realtime/socket.js';

const router = Router();

// GET /api/notifications - for current user in current workspace
router.get('/workspaces/:workspaceId/notifications', authenticate, requireWorkspace, async (req, res, next) => {
  try {
    const [items, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { workspaceId: req.ws!.workspaceId, userId: req.user!.id },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      prisma.notification.count({
        where: { workspaceId: req.ws!.workspaceId, userId: req.user!.id, readAt: null },
      }),
    ]);
    res.json({ items, unreadCount });
  } catch (err) {
    next(err);
  }
});

// POST /api/notifications/read-all
router.post('/workspaces/:workspaceId/notifications/read-all', authenticate, requireWorkspace, async (req, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: { workspaceId: req.ws!.workspaceId, userId: req.user!.id, readAt: null },
      data: { readAt: new Date() },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/notifications/:notificationId/read
router.post('/workspaces/:workspaceId/notifications/:notificationId/read', authenticate, requireWorkspace, async (req, res, next) => {
  try {
    const n = await prisma.notification.findFirst({ where: { id: req.params.notificationId, workspaceId: req.ws!.workspaceId, userId: req.user!.id } });
    if (!n) throw ApiError.notFound('Notification not found');
    await prisma.notification.update({ where: { id: n.id }, data: { readAt: new Date() } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export async function notifyUser(params: {
  workspaceId: string;
  userId: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
  data?: Record<string, unknown>;
}) {
  try {
    const notification = await prisma.notification.create({
      data: {
        workspaceId: params.workspaceId,
        userId: params.userId,
        type: params.type,
        title: params.title,
        body: params.body,
        link: params.link,
        data: params.data as any,
      },
    });
    emitToWorkspace(params.workspaceId, 'notification:new', {
      ...notification,
    });
  } catch (err) {
    console.error('[notify]', err);
  }
}

export default router;