import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireWorkspace } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../lib/errors.js';
import { sendOutboundMessage, createInternalNote, publicMessage, markConversationRead } from './message.service.js';
import { emitToWorkspace } from '../../realtime/socket.js';

const router = Router();

const sendSchema = z.object({
  body: z.string().min(1).max(4000),
  messageType: z.string().max(40).optional(),
  templateName: z.string().optional(),
  templateLanguage: z.string().optional(),
  templateVariables: z.array(z.string()).optional(),
});

const noteSchema = z.object({ body: z.string().min(1).max(4000) });

// GET /api/conversations/:conversationId/messages - cursor paginated
router.get('/workspaces/:workspaceId/conversations/:conversationId/messages', authenticate, requireWorkspace, async (req, res, next) => {
  try {
    const wsId = req.ws!.workspaceId;
    const conversationId = req.params.conversationId;
    const conversation = await prisma.conversation.findFirst({ where: { id: conversationId, workspaceId: wsId } });
    if (!conversation) throw ApiError.notFound('Conversation not found');

    const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
    const limit = Math.min(Number(req.query.limit) || 30, 100);

    const messages = await prisma.message.findMany({
      where: { conversationId, workspaceId: wsId },
      include: { attachments: true },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = messages.length > limit;
    const items = messages.slice(0, limit).reverse();

    res.json({
      items: items.map(publicMessage),
      nextCursor: hasMore ? items[0]?.id : null,
      hasMore,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/conversations/:conversationId/messages - send agent reply
router.post('/workspaces/:workspaceId/conversations/:conversationId/messages', authenticate, requireWorkspace, validate(sendSchema), async (req, res, next) => {
  try {
    const message = await sendOutboundMessage({
      workspaceId: req.ws!.workspaceId,
      conversationId: req.params.conversationId,
      agentId: req.user!.id,
      body: req.body.body,
      templateName: req.body.templateName,
      templateLanguage: req.body.templateLanguage,
      templateVariables: req.body.templateVariables,
    });
    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
});

// POST /api/conversations/:conversationId/notes - internal note (never sent)
router.post('/workspaces/:workspaceId/conversations/:conversationId/notes', authenticate, requireWorkspace, validate(noteSchema), async (req, res, next) => {
  try {
    const note = await createInternalNote({
      workspaceId: req.ws!.workspaceId,
      conversationId: req.params.conversationId,
      authorId: req.user!.id,
      body: req.body.body,
    });
    res.status(201).json(note);
  } catch (err) {
    next(err);
  }
});

// POST /api/conversations/:conversationId/read - mark conversation as read
router.post('/workspaces/:workspaceId/conversations/:conversationId/read', authenticate, requireWorkspace, async (req, res, next) => {
  try {
    const result = await markConversationRead(req.ws!.workspaceId, req.params.conversationId, req.user!.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/messages/:messageId (resolved via workspace)
router.get('/workspaces/:workspaceId/messages/:messageId', authenticate, requireWorkspace, async (req, res, next) => {
  try {
    const message = await prisma.message.findFirst({
      where: { id: req.params.messageId, workspaceId: req.ws!.workspaceId },
      include: { attachments: true },
    });
    if (!message) throw ApiError.notFound('Message not found');
    res.json(publicMessage(message));
  } catch (err) {
    next(err);
  }
});

// Retry a failed message
router.post('/workspaces/:workspaceId/messages/:messageId/retry', authenticate, requireWorkspace, async (req, res, next) => {
  try {
    const message = await prisma.message.findFirst({
      where: { id: req.params.messageId, workspaceId: req.ws!.workspaceId },
    });
    if (!message) throw ApiError.notFound('Message not found');
    if (message.status !== 'failed') return res.json({ ok: true, message: publicMessage(message) });

    const retried = await sendOutboundMessage({
      workspaceId: req.ws!.workspaceId,
      conversationId: message.conversationId,
      agentId: req.user!.id,
      body: message.body ?? '',
      mediaUrl: message.mediaUrl ?? undefined,
      mimeType: message.mimeType ?? undefined,
    });
    await prisma.message.delete({ where: { id: message.id } });
    emitToWorkspace(req.ws!.workspaceId, 'message:removed', { id: message.id });
    res.json({ ok: true, message: retried });
  } catch (err) {
    next(err);
  }
});

export default router;