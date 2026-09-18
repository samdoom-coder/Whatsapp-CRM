import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireWorkspace, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../lib/errors.js';
import { getProvider } from './provider.js';
import { auditLog } from '../../lib/activity.js';

const router = Router();

// GET /api/whatsapp - connection status
router.get('/workspaces/:workspaceId/whatsapp', authenticate, requireWorkspace, async (req, res, next) => {
  try {
    const wsId = req.ws!.workspaceId;
    const account = await prisma.whatsappAccount.findFirst({ where: { workspaceId: wsId }, include: { numbers: true } });
    res.json({
      configured: !!(account?.accessToken && account?.phoneNumberId),
      status: account?.status ?? 'disconnected',
      webhookConfigured: account?.webhookConfigured ?? false,
      account: account
        ? { id: account.id, businessAccountId: account.businessAccountId, phoneNumberId: account.phoneNumberId, numbers: account.numbers }
        : null,
      provider: getProvider().name,
      webhookUrl: req.get('host') ? `https://${req.get('host')}/api/webhooks/whatsapp` : '/api/webhooks/whatsapp',
      verifyToken: process.env.WHATSAPP_VERIFY_TOKEN ?? 'my-webhook-verify-token',
      isDemo: getProvider().isDemo,
    });
  } catch (err) {
    next(err);
  }
});

const configureSchema = z.object({
  businessAccountId: z.string().min(1),
  phoneNumberId: z.string().min(1),
  accessToken: z.string().min(1),
});

// POST /api/whatsapp/configure - store production credentials (never returned to client)
router.post('/workspaces/:workspaceId/whatsapp/configure', authenticate, requireWorkspace, requireRole('OWNER', 'ADMIN'), validate(configureSchema), async (req, res, next) => {
  try {
    const wsId = req.ws!.workspaceId;
    const body = req.body;

    const existing = await prisma.whatsappAccount.findFirst({ where: { workspaceId: wsId } });
    const account = existing
      ? await prisma.whatsappAccount.update({
          where: { id: existing.id },
          data: {
            businessAccountId: body.businessAccountId,
            phoneNumberId: body.phoneNumberId,
            accessToken: body.accessToken,
            status: 'connected',
            webhookConfigured: true,
          },
        })
      : await prisma.whatsappAccount.create({
          data: {
            workspaceId: wsId,
            businessAccountId: body.businessAccountId,
            phoneNumberId: body.phoneNumberId,
            accessToken: body.accessToken,
            webhookVerifyToken: process.env.WHATSAPP_VERIFY_TOKEN ?? 'my-webhook-verify-token',
            status: 'connected',
            webhookConfigured: true,
          },
        });

    // upsert the number
    const existingNumber = await prisma.whatsappNumber.findUnique({ where: { phoneNumber: body.phoneNumberId } });
    if (!existingNumber) {
      await prisma.whatsappNumber.create({
        data: { workspaceId: wsId, accountId: account.id, phoneNumber: body.phoneNumberId, displayName: 'Business WhatsApp', isPrimary: true, status: 'active' },
      });
    }

    await auditLog({ workspaceId: wsId, userId: req.user!.id, action: 'whatsapp.configured', entityType: 'whatsapp_account', entityId: account.id });
    res.json({ ok: true, configured: true, status: 'connected' });
  } catch (err) {
    next(err);
  }
});

// POST /api/whatsapp/disconnect
router.post('/workspaces/:workspaceId/whatsapp/disconnect', authenticate, requireWorkspace, requireRole('OWNER', 'ADMIN'), async (req, res, next) => {
  try {
    const wsId = req.ws!.workspaceId;
    const account = await prisma.whatsappAccount.findFirst({ where: { workspaceId: wsId } });
    if (account) {
      await prisma.whatsappAccount.update({ where: { id: account.id }, data: { status: 'disconnected', webhookConfigured: false } });
    }
    await auditLog({ workspaceId: wsId, userId: req.user!.id, action: 'whatsapp.disconnected' });
    res.json({ ok: true, status: 'disconnected' });
  } catch (err) {
    next(err);
  }
});

export default router;