import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireWorkspace } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../lib/errors.js';
import { conversationInclude, publicConversation } from '../messages/message.service.js';
import { emitToWorkspace } from '../../realtime/socket.js';
import { logActivity, auditLog } from '../../lib/activity.js';

const router = Router();

const listSchema = z.object({
  filter: z.enum(['all', 'unread', 'mine', 'unassigned', 'starred', 'leads', 'customers', 'archived']).default('all'),
  search: z.string().optional(),
  agent: z.string().optional(),
  tag: z.string().optional(),
  status: z.string().optional(),
  leadStage: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
});

const updateSchema = z.object({
  status: z.enum(['open', 'closed', 'archived']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  isStarred: z.boolean().optional(),
  assignedToId: z.string().uuid().nullable().optional(),
});

const createSchema = z.object({
  contactId: z.string().uuid(),
  numberId: z.string().uuid().optional().nullable(),
});

// GET /api/conversations - inbox list
router.get('/workspaces/:workspaceId/conversations', authenticate, requireWorkspace, validate(listSchema, 'query'), async (req, res, next) => {
  try {
    const wsId = req.ws!.workspaceId;
    const q = req.query as unknown as z.infer<typeof listSchema>;
    const where: Record<string, unknown> = { workspaceId: wsId };

    switch (q.filter) {
      case 'unread': where.unreadCount = { gt: 0 }; break;
      case 'mine': where.assignedToId = req.user!.id; break;
      case 'unassigned': where.assignedToId = null; where.status = 'open'; break;
      case 'starred': where.isStarred = true; break;
      case 'leads': where.contact = { is: { customerType: 'Lead' } }; break;
      case 'customers': where.contact = { is: { customerType: 'Customer' } }; break;
      case 'archived': where.status = 'archived'; break;
      default: where.status = { not: 'archived' }; break;
    }

    if (q.search) {
      where.contact = {
        is: {
          OR: [{ name: { contains: q.search, mode: 'insensitive' } }, { phone: { contains: q.search } }],
          ...(q.leadStage ? { leadStatus: q.leadStage } : {}),
        },
      };
    } else if (q.leadStage) {
      where.contact = { is: { leadStatus: q.leadStage } };
    }
    if (q.agent) where.assignedToId = q.agent;
    if (q.status && q.status !== 'all') where.status = q.status;
    if (q.tag) where.contact = { is: { tags: { some: { tag: { name: q.tag } } } } };

    const [total, items] = await Promise.all([
      prisma.conversation.count({ where }),
      prisma.conversation.findMany({
        where,
        include: conversationInclude,
        orderBy: [{ lastMessageAt: 'desc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);

    res.json({
      items: items.map(publicConversation),
      total,
      page: q.page,
      pageSize: q.pageSize,
      hasMore: q.page * q.pageSize < total,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/conversations/:conversationId - full conversation detail
router.get('/workspaces/:workspaceId/conversations/:conversationId', authenticate, requireWorkspace, async (req, res, next) => {
  try {
    const conversation = await prisma.conversation.findFirst({
      where: { id: req.params.conversationId, workspaceId: req.ws!.workspaceId },
      include: {
        ...conversationInclude,
        messages: { orderBy: { createdAt: 'desc' }, take: 20, include: { attachments: true } },
      },
    });
    if (!conversation) throw ApiError.notFound('Conversation not found');
    res.json(publicConversation(conversation));
  } catch (err) {
    next(err);
  }
});

// POST /api/conversations - start new conversation with a contact
router.post('/workspaces/:workspaceId/conversations', authenticate, requireWorkspace, validate(createSchema), async (req, res, next) => {
  try {
    const wsId = req.ws!.workspaceId;
    const contact = await prisma.contact.findFirst({ where: { id: req.body.contactId, workspaceId: wsId } });
    if (!contact) throw ApiError.badRequest('Contact not found');

    const existing = await prisma.conversation.findFirst({
      where: { workspaceId: wsId, contactId: contact.id, status: { not: 'archived' } },
    });
    if (existing) return res.json(publicConversation(existing));

    const conversation = await prisma.conversation.create({
      data: {
        workspaceId: wsId,
        contactId: contact.id,
        numberId: req.body.numberId ?? null,
        status: 'open',
        lastMessageAt: new Date(),
      },
      include: conversationInclude,
    });

    await logActivity({
      workspaceId: wsId,
      type: 'conversation_started',
      title: `Conversation started with ${contact.name}`,
      actorId: req.user!.id,
      contactId: contact.id,
      conversationId: conversation.id,
    });

    res.status(201).json(publicConversation(conversation));
  } catch (err) {
    next(err);
  }
});

// PATCH /api/conversations/:conversationId - assign/star/archive/etc
router.patch('/workspaces/:workspaceId/conversations/:conversationId', authenticate, requireWorkspace, validate(updateSchema), async (req, res, next) => {
  try {
    const wsId = req.ws!.workspaceId;
    const conversationId = req.params.conversationId;
    const conversation = await prisma.conversation.findFirst({ where: { id: conversationId, workspaceId: wsId } });
    if (!conversation) throw ApiError.notFound('Conversation not found');

    const body = req.body as z.infer<typeof updateSchema>;
    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data: body,
      include: conversationInclude,
    });

    if ('assignedToId' in body) {
      await logActivity({
        workspaceId: wsId,
        type: 'agent_assigned',
        title: body.assignedToId
          ? `Conversation assigned to agent`
          : 'Conversation unassigned',
        actorId: req.user!.id,
        contactId: conversation.contactId,
        conversationId,
        metadata: { assignedToId: body.assignedToId },
      });
    }
    if (body.isStarred === true) {
      await logActivity({
        workspaceId: wsId,
        type: 'conversation_starred',
        title: 'Conversation starred',
        actorId: req.user!.id,
        conversationId,
      });
    }

    await auditLog({ workspaceId: wsId, userId: req.user!.id, action: 'conversation.updated', entityType: 'conversation', entityId: conversationId });
    emitToWorkspace(wsId, 'conversation:updated', publicConversation(updated));
    res.json(publicConversation(updated));
  } catch (err) {
    next(err);
  }
});

export default router;