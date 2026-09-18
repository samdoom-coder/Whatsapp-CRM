import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireWorkspace } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../lib/errors.js';
import { getAIProvider } from './ai.provider.js';
import type { ConversationTurn } from './ai.provider.js';
import { config } from '../../config.js';

const router = Router();

const summarizeSchema = z.object({
  conversationId: z.string().uuid(),
});

const replySchema = z.object({
  conversationId: z.string().uuid(),
  tone: z.enum(['professional', 'friendly', 'short', 'persuasive']).default('professional'),
  draft: z.string().max(4000).optional(),
});

const classifySchema = z.object({ text: z.string().min(1).max(4000) });

const extractSchema = z.object({ text: z.string().min(1).max(4000) });

async function getTurns(workspaceId: string, conversationId: string): Promise<ConversationTurn[]> {
  const messages = await prisma.message.findMany({
    where: { conversationId, workspaceId, messageType: { not: 'internal_note' }, body: { not: null } },
    orderBy: { createdAt: 'asc' },
    take: 60,
  });
  return messages.map((m) => ({
    sender: m.senderType === 'customer' ? 'customer' : 'agent',
    text: m.body ?? '',
    ts: m.createdAt.getTime(),
  }));
}

// POST /api/ai/summarize
router.post('/summarize', authenticate, requireWorkspace, validate(summarizeSchema), async (req, res, next) => {
  try {
    const conversation = await prisma.conversation.findFirst({ where: { id: req.body.conversationId, workspaceId: req.ws!.workspaceId } });
    if (!conversation) throw ApiError.notFound('Conversation not found');
    const turns = await getTurns(req.ws!.workspaceId, req.body.conversationId);
    const summary = await getAIProvider().summarizeConversation(turns);
    res.json({ summary, provider: getAIProvider().name });
  } catch (err) {
    next(err);
  }
});

// POST /api/ai/reply
router.post('/reply', authenticate, requireWorkspace, validate(replySchema), async (req, res, next) => {
  try {
    const conversation = await prisma.conversation.findFirst({
      where: { id: req.body.conversationId, workspaceId: req.ws!.workspaceId },
      include: { contact: true },
    });
    if (!conversation) throw ApiError.notFound('Conversation not found');
    const turns = await getTurns(req.ws!.workspaceId, req.body.conversationId);
    const context = turns.slice(-10).map((t) => `${t.sender}: ${t.text}`).join('\n');
    const reply = await getAIProvider().generateReply({
      tone: req.body.tone,
      context: req.body.draft ? `${context}\n\nDRAFT: ${req.body.draft}` : context,
      customerName: conversation.contact?.name,
    });
    res.json({ reply, provider: getAIProvider().name });
  } catch (err) {
    next(err);
  }
});

// POST /api/ai/classify
router.post('/classify', authenticate, requireWorkspace, validate(classifySchema), async (req, res, next) => {
  try {
    const result = await getAIProvider().classifyIntent(req.body.text);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/ai/extract
router.post('/extract', authenticate, requireWorkspace, validate(extractSchema), async (req, res, next) => {
  try {
    const result = await getAIProvider().extractCustomerData(req.body.text);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/ai/leads/:leadId/analyze
router.post('/leads/:leadId/analyze', authenticate, requireWorkspace, async (req, res, next) => {
  try {
    const lead = await prisma.lead.findFirst({
      where: { id: req.params.leadId, workspaceId: req.ws!.workspaceId },
      include: { contact: { include: { conversations: { include: { messages: { where: { messageType: { not: 'internal_note' }, body: { not: null } }, orderBy: { createdAt: 'asc' } } } } } } },
    });
    if (!lead) throw ApiError.notFound('Lead not found');

    const turns: ConversationTurn[] = [];
    for (const conv of lead.contact?.conversations ?? []) {
      for (const m of conv.messages) {
        turns.push({ sender: m.senderType === 'customer' ? 'customer' : 'agent', text: m.body ?? '', ts: m.createdAt.getTime() });
      }
    }
    const summary = await getAIProvider().summarizeConversation(turns, 3);
    const result = await getAIProvider().scoreLead({
      name: lead.name,
      summary: summary.join(' '),
      score: lead.score,
    });

    // persist score suggestion
    if (result.temperature === 'Hot' && lead.score < 70) {
      await prisma.lead.update({ where: { id: lead.id }, data: { score: Math.max(lead.score, 70) } });
    }

    res.json({ ...result, summary, provider: getAIProvider().name });
  } catch (err) {
    next(err);
  }
});

export default router;