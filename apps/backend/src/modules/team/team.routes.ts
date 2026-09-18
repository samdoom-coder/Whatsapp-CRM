import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireWorkspace, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../lib/errors.js';
import { auditLog } from '../../lib/activity.js';

const router = Router();

// GET /api/team - members + performance
router.get('/workspaces/:workspaceId/team', authenticate, requireWorkspace, async (req, res, next) => {
  try {
    const wsId = req.ws!.workspaceId;
    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId: wsId },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true, isActive: true, lastLoginAt: true } } },
      orderBy: { createdAt: 'asc' },
    });

    const performance = await Promise.all(
      members.map(async (m) => {
        const [conversations, unread, messages, leads, wonDeals, revenue] = await Promise.all([
          prisma.conversation.count({ where: { workspaceId: wsId, assignedToId: m.userId } }),
          prisma.conversation.aggregate({
            where: { workspaceId: wsId, assignedToId: m.userId },
            _sum: { unreadCount: true },
          }),
          prisma.message.count({ where: { workspaceId: wsId, senderType: 'agent', senderId: m.userId } }),
          prisma.lead.count({ where: { workspaceId: wsId, assignedToId: m.userId } }),
          prisma.deal.count({ where: { workspaceId: wsId, assignedToId: m.userId, stage: 'Won' } }),
          prisma.deal.aggregate({ where: { workspaceId: wsId, assignedToId: m.userId, stage: 'Won' }, _sum: { value: true } }),
        ]);
        const totalLeads = leads;
        const conversionRate = totalLeads > 0 ? Math.round((wonDeals / totalLeads) * 100) : 0;
        return {
          conversations,
          unread: unread._sum.unreadCount ?? 0,
          messages,
          leads,
          dealsWon: wonDeals,
          revenue: Number(revenue._sum.value ?? 0),
          conversionRate,
        };
      }),
    );

    res.json({ items: members.map((m, i) => ({ ...m, performance: performance[i] })) });
  } catch (err) {
    next(err);
  }
});

const inviteSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  role: z.enum(['OWNER', 'ADMIN', 'MANAGER', 'AGENT']).default('AGENT'),
  password: z.string().min(8).optional(),
});

// POST /api/team/invite - create a team member (Owner/Admin)
router.post('/workspaces/:workspaceId/team', authenticate, requireWorkspace, requireRole('OWNER', 'ADMIN'), validate(inviteSchema), async (req, res, next) => {
  try {
    const wsId = req.ws!.workspaceId;
    const body = req.body as z.infer<typeof inviteSchema>;

    let user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (!user) {
      const passwordHash = await bcryptHash(body.password ?? `welcome123`);
      user = await prisma.user.create({
        data: { name: body.name, email: body.email.toLowerCase(), passwordHash, emailVerifiedAt: new Date() },
      });
    }

    const existing = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: wsId, userId: user.id } },
    });
    if (existing) {
      await prisma.workspaceMember.update({ where: { id: existing.id }, data: { role: body.role, isActive: true } });
    } else {
      await prisma.workspaceMember.create({ data: { workspaceId: wsId, userId: user.id, role: body.role } });
    }

    await auditLog({ workspaceId: wsId, userId: req.user!.id, action: 'user.created', entityType: 'user', entityId: user.id, metadata: { role: body.role } });
    res.status(201).json({ ok: true, user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    next(err);
  }
});

import bcrypt from 'bcryptjs';
const bcryptHash = (pw: string) => bcrypt.hash(pw, 12);

const roleSchema = z.object({ role: z.enum(['OWNER', 'ADMIN', 'MANAGER', 'AGENT']) });

// PATCH /api/team/:memberId/role
router.patch('/workspaces/:workspaceId/team/:memberId/role', authenticate, requireWorkspace, requireRole('OWNER', 'ADMIN'), validate(roleSchema), async (req, res, next) => {
  try {
    const member = await prisma.workspaceMember.findFirst({
      where: { id: req.params.memberId, workspaceId: req.ws!.workspaceId },
    });
    if (!member) throw ApiError.notFound('Team member not found');

    const target = await prisma.workspaceMember.findUnique({ where: { id: member.id }, include: { user: true } });
    if (target?.user?.id === req.user!.id && req.body.role !== 'OWNER') {
      throw ApiError.forbidden('You cannot demote yourself');
    }

    const updated = await prisma.workspaceMember.update({ where: { id: member.id }, data: { role: req.body.role } });
    await auditLog({ workspaceId: req.ws!.workspaceId, userId: req.user!.id, action: 'user.role_changed', entityType: 'user', entityId: member.userId, metadata: { role: req.body.role } });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/team/:memberId - remove member
router.delete('/workspaces/:workspaceId/team/:memberId', authenticate, requireWorkspace, requireRole('OWNER', 'ADMIN'), async (req, res, next) => {
  try {
    const member = await prisma.workspaceMember.findFirst({
      where: { id: req.params.memberId, workspaceId: req.ws!.workspaceId },
      include: { user: true },
    });
    if (!member) throw ApiError.notFound('Team member not found');
    if (member.userId === req.user!.id) throw ApiError.forbidden('You cannot remove yourself');

    await prisma.workspaceMember.delete({ where: { id: member.id } });
    await auditLog({ workspaceId: req.ws!.workspaceId, userId: req.user!.id, action: 'user.removed', entityType: 'user', entityId: member.userId });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;