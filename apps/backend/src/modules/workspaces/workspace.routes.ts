import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireWorkspace, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../lib/errors.js';
import { auditLog } from '../../lib/activity.js';

const router = Router();

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  companyName: z.string().max(160).optional(),
  timezone: z.string().max(60).optional(),
  currency: z.string().length(3).optional(),
  replySignature: z.string().max(500).optional(),
  autoReplyEnabled: z.boolean().optional(),
  autoReplyTemplate: z.string().max(2000).optional(),
  logoUrl: z.string().url().optional().nullable(),
});

// GET /api/workspaces - list workspaces for the current user
router.get('/workspaces', authenticate, async (req, res, next) => {
  try {
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId: req.user!.id, isActive: true },
      include: {
        workspace: {
          select: {
            id: true, name: true, slug: true, companyName: true, timezone: true, currency: true, logoUrl: true, billingTier: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json({
      workspaces: memberships.map((m) => ({ ...m.workspace, role: m.role })),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/workspaces/:workspaceId - current workspace details + settings
router.get('/workspaces/:workspaceId', authenticate, requireWorkspace, async (req, res, next) => {
  try {
    const [workspace, members, numbers, account] = await Promise.all([
      prisma.workspace.findUnique({ where: { id: req.ws!.workspaceId } }),
      prisma.workspaceMember.count({ where: { workspaceId: req.ws!.workspaceId } }),
      prisma.whatsappNumber.findMany({ where: { workspaceId: req.ws!.workspaceId } }),
      prisma.whatsappAccount.findFirst({ where: { workspaceId: req.ws!.workspaceId } }),
    ]);
    const settings = await prisma.workspaceSetting.upsert({
      where: { workspaceId: req.ws!.workspaceId },
      update: {},
      create: { workspaceId: req.ws!.workspaceId },
    });
    res.json({
      workspace,
      settings,
      members: members,
      numbers,
      whatsappConfigured: !!(account?.accessToken && account?.phoneNumberId),
      whatsappStatus: account?.status ?? 'disconnected',
      webhookConfigured: account?.webhookConfigured ?? false,
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/workspaces/:workspaceId - update workspace
router.patch(
  '/workspaces/:workspaceId',
  authenticate,
  requireWorkspace,
  requireRole('OWNER', 'ADMIN'),
  validate(updateSchema),
  async (req, res, next) => {
    try {
      const data: Record<string, unknown> = {};
      const body = req.body as Record<string, unknown>;
      if (body.name !== undefined) data.name = body.name;
      if (body.companyName !== undefined) data.companyName = body.companyName;
      if (body.timezone !== undefined) data.timezone = body.timezone;
      if (body.currency !== undefined) data.currency = body.currency;
      if (body.logoUrl !== undefined) data.logoUrl = body.logoUrl;

      const [workspace, settings] = await Promise.all([
        prisma.workspace.update({ where: { id: req.ws!.workspaceId }, data }),
        prisma.workspaceSetting.upsert({
          where: { workspaceId: req.ws!.workspaceId },
          update: {
            replySignature: body.replySignature as string | undefined,
            autoReplyEnabled: body.autoReplyEnabled as boolean | undefined,
            autoReplyTemplate: body.autoReplyTemplate as string | undefined,
          },
          create: { workspaceId: req.ws!.workspaceId },
        }),
      ]);

      await auditLog({
        workspaceId: req.ws!.workspaceId,
        userId: req.user!.id,
        action: 'workspace.updated',
        entityType: 'workspace',
        entityId: req.ws!.workspaceId,
        ipAddress: req.ip,
      });

      res.json({ workspace, settings });
    } catch (err) {
      next(err);
    }
  },
);

export default router;