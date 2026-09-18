import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { config } from '../../config.js';
import { getProvider } from './provider.js';
import { handleIncomingMessages, handleStatusUpdates } from '../messages/message.service.js';
import { logError } from '../../lib/logger.js';

const router = Router();

// GET /api/webhooks/whatsapp - verification handshake
router.get('/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === config.whatsapp.verifyToken) {
    res.status(200).send(challenge);
  } else {
    res.status(403).send('Verification failed');
  }
});

// POST /api/webhooks/whatsapp - incoming events (raw body)
router.post('/whatsapp', async (req, res) => {
  const provider = getProvider();
  let payload: unknown;

  try {
    payload = JSON.parse((req.body as Buffer).toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'invalid payload' });
  }

  const parsed = provider.parseWebhook(payload);

  // Determine workspace from the phone number id in the payload
  let workspaceId: string | null = null;
  const raw = payload as any;
  const phoneNumberId = raw?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;
  if (phoneNumberId) {
    const number = await prisma.whatsappNumber.findUnique({ where: { phoneNumber: phoneNumberId } });
    workspaceId = number?.workspaceId ?? null;
  }

  if (!workspaceId) {
    // Fall back to first workspace with a configured account
    const account = await prisma.whatsappAccount.findFirst({ where: { status: 'connected' } });
    workspaceId = account?.workspaceId ?? null;
  }

  if (workspaceId) {
    // Store the raw event for observability / replay
    const event = await prisma.webhookEvent.create({
      data: {
        workspaceId,
        source: 'whatsapp',
        eventType: parsed.messages.length ? 'message' : parsed.statuses.length ? 'status' : 'other',
        payload: payload as object,
        idempotencyKey: parsed.messages[0]?.externalMessageId ?? parsed.statuses[0]?.externalMessageId,
      },
    });

    try {
      if (parsed.messages.length) {
        await handleIncomingMessages(workspaceId, parsed.messages);
      }
      if (parsed.statuses.length) {
        await handleStatusUpdates(workspaceId, parsed.statuses);
      }
      await prisma.webhookEvent.update({ where: { id: event.id }, data: { status: 'processed', processedAt: new Date() } });
    } catch (err) {
      await prisma.webhookEvent.update({
        where: { id: event.id },
        data: { status: 'failed', error: err instanceof Error ? err.message : 'unknown' },
      });
      logError('webhook.process', err, { workspaceId });
    }
  }

  // Always ack to avoid retries from the provider
  res.status(200).json({ ok: true });
});

export default router;