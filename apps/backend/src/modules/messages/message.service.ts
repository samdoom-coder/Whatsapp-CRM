import { prisma } from '../../lib/prisma.js';
import { getProvider } from '../whatsapp/provider.js';
import { emitToWorkspace } from '../../realtime/socket.js';
import { logActivity } from '../../lib/activity.js';
import { ApiError } from '../../lib/errors.js';
import { triggerAutomation } from '../../automation/engine.js';
import { logError } from '../../lib/logger.js';

export const publicMessage = (m: any) => ({
  ...m,
  attachments: m.attachments ?? [],
});

// ---------- Outbound (agent → customer) ----------

export async function sendOutboundMessage(params: {
  workspaceId: string;
  conversationId: string;
  agentId: string;
  body: string;
  messageType?: string;
  mediaUrl?: string;
  mimeType?: string;
  fileName?: string;
  templateName?: string;
  templateLanguage?: string;
  templateVariables?: string[];
}) {
  const conversation = await prisma.conversation.findFirst({
    where: { id: params.conversationId, workspaceId: params.workspaceId },
    include: { contact: true, number: true },
  });
  if (!conversation) throw ApiError.notFound('Conversation not found');
  if (!conversation.contact) throw ApiError.badRequest('Conversation has no customer');

  const provider = getProvider();

  let externalMessageId: string | undefined;
  let status = 'sent';

  try {
    if (params.templateName) {
      const result = await provider.sendTemplate(
        conversation.contact.phone,
        params.templateName,
        params.templateLanguage ?? 'en',
        params.templateVariables,
      );
      externalMessageId = result.externalMessageId;
    } else if (params.mediaUrl) {
      const result = await provider.sendMessage(conversation.contact.phone, params.body ?? '', {
        mediaUrl: params.mediaUrl,
        mediaType: inferMediaType(params.mimeType ?? ''),
        fileName: params.fileName,
      });
      externalMessageId = result.externalMessageId;
    } else {
      const result = await provider.sendMessage(conversation.contact.phone, params.body);
      externalMessageId = result.externalMessageId;
    }
  } catch (err) {
    logError('message.send_outbound', err, { conversationId: params.conversationId });
    status = 'failed';
  }

  const message = await prisma.message.create({
    data: {
      workspaceId: params.workspaceId,
      conversationId: params.conversationId,
      senderType: 'agent',
      senderId: params.agentId,
      externalMessageId,
      messageType: params.templateName ? 'template' : params.messageType ?? 'text',
      body: params.body,
      mediaUrl: params.mediaUrl,
      mimeType: params.mimeType,
      status,
      sentAt: status === 'failed' ? null : new Date(),
      metadata: params.templateName ? { templateName: params.templateName } : undefined,
    },
    include: { attachments: true },
  });

  await prisma.conversation.update({
    where: { id: params.conversationId },
    data: { lastMessageAt: new Date(), lastMessageText: params.body || '📎 Attachment' },
  });
  await prisma.contact.update({
    where: { id: conversation.contactId },
    data: { lastActivityAt: new Date() },
  });

  await logActivity({
    workspaceId: params.workspaceId,
    type: 'message_sent',
    title: params.body ? `Message sent to ${conversation.contact.name}` : `Attachment sent to ${conversation.contact.name}`,
    actorId: params.agentId,
    contactId: conversation.contactId,
    conversationId: params.conversationId,
    metadata: { preview: params.body?.slice(0, 120) },
  });

  emitToWorkspace(params.workspaceId, 'message:new', publicMessage(message));

  if (status === 'failed') {
    emitToWorkspace(params.workspaceId, 'conversation:updated', { id: params.conversationId, lastMessageText: '⚠️ Message failed to send' });
  }

  // Simulate provider delivery -> read for demo provider
  if (status === 'sent') {
    const { simulateDelivery } = await import('../whatsapp/demo.simulator.js');
    simulateDelivery(params.workspaceId, conversationId2(conversation), message.id, externalMessageId);
  }

  return publicMessage(message);
}

function conversationId2(c: any) {
  return c.id;
}

// Used by automation send_template action
export async function sendOutboundFromAutomation(
  workspaceId: string,
  conversation: { id: string; contactId: string; contact: { phone: string; name: string } },
  templateName: string,
) {
  const provider = getProvider();
  const template = await prisma.messageTemplate.findFirst({
    where: { workspaceId, name: templateName },
  });
  const body = template ? template.body : `[${templateName}]`;
  const result = await provider.sendTemplate(conversation.contact.phone, templateName, template?.language ?? 'en', []);
  const message = await prisma.message.create({
    data: {
      workspaceId,
      conversationId: conversation.id,
      senderType: 'agent',
      messageType: 'template',
      body,
      externalMessageId: result.externalMessageId,
      status: 'sent',
      sentAt: new Date(),
      metadata: { templateName, automation: true },
    },
    include: { attachments: true },
  });
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date(), lastMessageText: body },
  });
  emitToWorkspace(workspaceId, 'message:new', publicMessage(message));
  return message;
}

export function inferMediaType(mime: string): 'image' | 'video' | 'audio' | 'document' | 'sticker' {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return 'document';
}

// ---------- Internal notes (never sent to WhatsApp) ----------

export async function createInternalNote(params: {
  workspaceId: string;
  conversationId: string;
  authorId: string;
  body: string;
}) {
  const message = await prisma.message.create({
    data: {
      workspaceId: params.workspaceId,
      conversationId: params.conversationId,
      senderType: 'system',
      senderId: params.authorId,
      messageType: 'internal_note',
      body: params.body,
      status: 'sent',
    },
    include: { attachments: true },
  });

  await prisma.note.create({
    data: {
      workspaceId: params.workspaceId,
      conversationId: params.conversationId,
      contactId: (await prisma.conversation.findUnique({ where: { id: params.conversationId } }))?.contactId,
      authorId: params.authorId,
      body: params.body,
    },
  });

  await logActivity({
    workspaceId: params.workspaceId,
    type: 'note_created',
    title: 'Internal note added',
    description: params.body.slice(0, 200),
    actorId: params.authorId,
    conversationId: params.conversationId,
  });

  emitToWorkspace(params.workspaceId, 'message:new', publicMessage(message));
  return publicMessage(message);
}

// ---------- Inbound (customer → business) ----------

export async function handleIncomingMessages(
  workspaceId: string,
  messages: Array<{
    externalMessageId: string;
    from: string;
    to: string;
    type: string;
    body?: string;
    mediaUrl?: string;
    mimeType?: string;
    timestamp?: number;
    context?: { from?: string; id?: string };
  }>,
) {
  for (const inbound of messages) {
    try {
      const existing = await prisma.message.findUnique({ where: { externalMessageId: inbound.externalMessageId } });
      if (existing) continue; // idempotency

      // Resolve or create contact
      let contact = await prisma.contact.findUnique({ where: { phone: inbound.from } });
      if (!contact || contact.workspaceId !== workspaceId) {
        if (contact && contact.workspaceId !== workspaceId) {
          throw new Error('Phone number belongs to another workspace');
        }
        contact = await prisma.contact.create({
          data: {
            workspaceId,
            name: `Customer ${inbound.from.slice(-4)}`,
            phone: inbound.from,
            source: 'WhatsApp',
            leadStatus: 'New',
            leadScore: 5,
            customerType: 'Lead',
            lastActivityAt: new Date(),
          },
        });
        await logActivity({
          workspaceId,
          type: 'contact_created',
          title: `New contact via WhatsApp: ${contact.name}`,
          contactId: contact.id,
          metadata: { phone: inbound.from },
        });
        await triggerAutomation(workspaceId, 'contact_created', { workspaceId, contactId: contact.id });
      }

      // Resolve or create conversation
      const number = await prisma.whatsappNumber.findFirst({ where: { workspaceId, phoneNumber: inbound.to } }).catch(() => null);
      let conversation = await prisma.conversation.findFirst({
        where: { workspaceId, contactId: contact.id },
        orderBy: { lastMessageAt: 'desc' },
      });

      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: {
            workspaceId,
            contactId: contact.id,
            numberId: number?.id ?? null,
            channel: 'whatsapp',
            status: 'open',
            unreadCount: 1,
            lastMessageAt: new Date(inbound.timestamp ?? Date.now()),
          },
        });
        await logActivity({
          workspaceId,
          type: 'conversation_started',
          title: `Conversation started with ${contact.name}`,
          contactId: contact.id,
          conversationId: conversation.id,
        });
        await triggerAutomation(workspaceId, 'new_conversation', { workspaceId, contactId: contact.id, conversationId: conversation.id });
      }

      const message = await prisma.message.create({
        data: {
          workspaceId,
          conversationId: conversation.id,
          senderType: 'customer',
          externalMessageId: inbound.externalMessageId,
          messageType: inbound.type === 'text' ? 'text' : inbound.type,
          body: inbound.body,
          mediaUrl: inbound.mediaUrl,
          mimeType: inbound.mimeType,
          status: 'read', // inbound messages are already read by the customer
          readAt: new Date(),
          createdAt: new Date(inbound.timestamp ?? Date.now()),
          sentAt: new Date(inbound.timestamp ?? Date.now()),
          metadata: inbound.context ? { replyTo: inbound.context } : undefined,
        },
        include: { attachments: true },
      });

      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          unreadCount: { increment: 1 },
          lastMessageAt: new Date(),
          lastMessageText: inbound.body ?? '📎 Media',
          status: conversation.status === 'archived' ? 'open' : conversation.status,
        },
      });
      await prisma.contact.update({
        where: { id: contact.id },
        data: { lastActivityAt: new Date(), leadStatus: contact.leadStatus === 'New' ? 'Contacted' : contact.leadStatus },
      });

      // Lead scoring
      const scoreDelta = scoreMessage(inbound.body ?? '');
      if (scoreDelta !== 0) {
        await prisma.contact.update({ where: { id: contact.id }, data: { leadScore: { increment: scoreDelta } } });
        const lead = await prisma.lead.findFirst({ where: { workspaceId, contactId: contact.id } });
        if (lead) {
          await prisma.lead.update({ where: { id: lead.id }, data: { score: { increment: scoreDelta } } });
        }
      }

      await logActivity({
        workspaceId,
        type: 'message_received',
        title: `Message received from ${contact.name}`,
        description: inbound.body?.slice(0, 150),
        contactId: contact.id,
        conversationId: conversation.id,
        metadata: { preview: inbound.body?.slice(0, 120) },
      });

      await triggerAutomation(workspaceId, 'new_message', { workspaceId, contactId: contact.id, conversationId: conversation.id, messageId: message.id });

      emitToWorkspace(workspaceId, 'message:new', publicMessage(message));
      emitToWorkspace(workspaceId, 'conversation:updated', {
        id: conversation.id,
        unreadCount: conversation.unreadCount + 1,
        lastMessageAt: new Date(),
        lastMessageText: inbound.body ?? '📎 Media',
      });
      emitToWorkspace(workspaceId, 'notification:new', {
        type: 'new_message',
        title: `New message from ${contact.name}`,
        body: inbound.body?.slice(0, 100),
        link: `/inbox/${conversation.id}`,
        data: { contactId: contact.id, conversationId: conversation.id },
      });
    } catch (err) {
      logError('inbound.message', err, { workspaceId });
    }
  }
}

// Simple heuristic lead scoring. Admin-configurable rules later.
function scoreMessage(text: string): number {
  const t = (text ?? '').toLowerCase();
  if (/(price|cost|quote|quotation|pricing)/.test(t)) return 20;
  if (/(demo|trial|free trial|call me|meeting)/.test(t)) return 25;
  if (/(order|buy|purchase|book|subscribe)/.test(t)) return 30;
  if (/(interested|yes|ok,? (send|proceed)|go ahead)/.test(t)) return 15;
  if (/(not interested|no thanks|stop)/.test(t)) return -10;
  return 0;
}

export async function handleStatusUpdates(
  workspaceId: string,
  statuses: Array<{ externalMessageId: string; status: 'sent' | 'delivered' | 'read' | 'failed'; timestamp?: number }>,
) {
  for (const s of statuses) {
    try {
      const message = await prisma.message.findUnique({ where: { externalMessageId: s.externalMessageId } });
      if (!message) continue;
      if (message.workspaceId !== workspaceId) continue;

      const data: Record<string, unknown> = { status: s.status };
      if (s.status === 'delivered') data.deliveredAt = new Date(s.timestamp ?? Date.now());
      if (s.status === 'read') data.readAt = new Date(s.timestamp ?? Date.now());
      if (s.status === 'failed') data.metadata = { ...((message.metadata as Record<string, unknown>) ?? {}), error: 'delivery failed' };

      const updated = await prisma.message.update({ where: { id: message.id }, data, include: { attachments: true } });
      emitToWorkspace(workspaceId, 'message:status', publicMessage(updated));
    } catch (err) {
      logError('status.update', err, { workspaceId });
    }
  }
}

export async function markConversationRead(workspaceId: string, conversationId: string, userId: string) {
  const conversation = await prisma.conversation.findFirst({ where: { id: conversationId, workspaceId } });
  if (!conversation) throw ApiError.notFound('Conversation not found');

  const unread = await prisma.message.findMany({
    where: { conversationId, senderType: 'customer', readAt: null },
    select: { id: true, externalMessageId: true },
  });
  const ids = unread.map((m) => m.id);

  await prisma.$transaction([
    prisma.message.updateMany({ where: { id: { in: ids } }, data: { readAt: new Date(), status: 'read' } }),
    prisma.conversation.update({ where: { id: conversationId }, data: { unreadCount: 0 } }),
  ]);

  if (unread.length) {
    emitToWorkspace(workspaceId, 'conversation:updated', { id: conversationId, unreadCount: 0 });
    // mark as read on provider too
    for (const m of unread) {
      if (m.externalMessageId) {
        getProvider().markAsRead(m.externalMessageId).catch(() => {});
      }
    }
  }

  return { ok: true };
}

// ---------- Conversation listing ----------

export const conversationInclude = {
  contact: {
    select: {
      id: true, name: true, phone: true, avatarUrl: true, leadStatus: true, leadScore: true, customerType: true, company: true,
      tags: { include: { tag: { select: { id: true, name: true, color: true } } } },
    },
  },
  assignedTo: { select: { id: true, name: true, avatarUrl: true } },
  number: { select: { id: true, phoneNumber: true, displayName: true } },
  _count: { select: { messages: true } },
} as const;

export const publicConversation = (c: any) => ({
  ...c,
  contact: c.contact ? { ...c.contact, tags: c.contact.tags?.map((t: any) => t.tag) ?? [] } : null,
});