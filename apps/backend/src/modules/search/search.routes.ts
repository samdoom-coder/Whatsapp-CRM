import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireWorkspace } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { prisma } from '../../lib/prisma.js';

const router = Router();

const searchSchema = z.object({
  q: z.string().min(1).max(120),
  limit: z.coerce.number().int().min(1).max(20).default(5),
});

// GET /api/search?q=... - global search across the workspace
router.get('/workspaces/:workspaceId/search', authenticate, requireWorkspace, validate(searchSchema, 'query'), async (req, res, next) => {
  try {
    const wsId = req.ws!.workspaceId;
    const q = (req.query.q as string).trim();
    const limit = Number(req.query.limit) || 5;

    if (!q) return res.json({ contacts: [], conversations: [], deals: [], leads: [], tasks: [], messages: [] });

    const [contacts, conversations, deals, leads, tasks, messages] = await Promise.all([
      prisma.contact.findMany({
        where: {
          workspaceId: wsId,
          OR: [{ name: { contains: q, mode: 'insensitive' } }, { phone: { contains: q } }, { email: { contains: q, mode: 'insensitive' } }, { company: { contains: q, mode: 'insensitive' } }],
        },
        include: { tags: { include: { tag: { select: { id: true, name: true, color: true } } } } },
        take: limit,
      }),
      prisma.conversation.findMany({
        where: { workspaceId: wsId, contact: { is: { OR: [{ name: { contains: q, mode: 'insensitive' } }, { phone: { contains: q } }] } } },
        include: { contact: { select: { id: true, name: true, phone: true, avatarUrl: true } } },
        take: limit,
      }),
      prisma.deal.findMany({
        where: { workspaceId: wsId, OR: [{ name: { contains: q, mode: 'insensitive' } }, { contact: { is: { name: { contains: q, mode: 'insensitive' } } } }] },
        include: { contact: { select: { id: true, name: true } } },
        take: limit,
      }),
      prisma.lead.findMany({
        where: { workspaceId: wsId, OR: [{ name: { contains: q, mode: 'insensitive' } }, { phone: { contains: q } }] },
        take: limit,
      }),
      prisma.task.findMany({
        where: { workspaceId: wsId, title: { contains: q, mode: 'insensitive' } },
        include: { contact: { select: { id: true, name: true } } },
        take: limit,
      }),
      prisma.message.findMany({
        where: { workspaceId: wsId, senderType: 'customer', body: { contains: q, mode: 'insensitive' }, messageType: { not: 'internal_note' } },
        include: { conversation: { select: { id: true, contact: { select: { id: true, name: true, avatarUrl: true } } } } },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
    ]);

    res.json({
      contacts: contacts.map((c) => ({ ...c, tags: c.tags.map((t) => t.tag), type: 'contact' })),
      conversations: conversations.map((c) => ({ ...c, type: 'conversation' })),
      deals: deals.map((d) => ({ ...d, value: Number(d.value), type: 'deal' })),
      leads: leads.map((l) => ({ ...l, type: 'lead' })),
      tasks: tasks.map((t) => ({ ...t, type: 'task' })),
      messages: messages.map((m) => ({ ...m, type: 'message' })),
    });
  } catch (err) {
    next(err);
  }
});

export default router;