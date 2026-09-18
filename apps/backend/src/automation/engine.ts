import { prisma } from '../lib/prisma.js';
import { emitToWorkspace } from '../realtime/socket.js';
import { logError } from '../lib/logger.js';

export interface AutomationContext {
  workspaceId: string;
  contactId?: string | null;
  conversationId?: string | null;
  leadId?: string | null;
  dealId?: string | null;
  messageId?: string | null;
  [key: string]: unknown;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Evaluates the `conditions` JSON: [{ field, op, value }] all must pass
function matchConditions(conditions: unknown, ctx: AutomationContext): boolean {
  if (!conditions || !Array.isArray(conditions) || conditions.length === 0) return true;
  return conditions.every((cond) => {
    const { field, op, value } = cond as { field: string; op: string; value: unknown };
    const actual = (ctx as Record<string, unknown>)[field];

    switch (op) {
      case 'eq': return actual === value || String(actual) === String(value);
      case 'neq': return actual !== value && String(actual) !== String(value);
      case 'gt': return Number(actual) > Number(value);
      case 'lt': return Number(actual) < Number(value);
      case 'contains':
        return typeof actual === 'string' && actual.toLowerCase().includes(String(value).toLowerCase());
      case 'in':
        return Array.isArray(value) && (value as unknown[]).includes(actual);
      default: return true;
    }
  });
}

async function runAction(workspaceId: string, action: { type: string; value?: any }, ctx: AutomationContext): Promise<void> {
  const contactId = ctx.contactId ?? null;
  const conversationId = ctx.conversationId ?? null;

  switch (action.type) {
    case 'assign_user': {
      const userId = action.value;
      if (!userId) return;
      if (conversationId) {
        await prisma.conversation.update({ where: { id: conversationId }, data: { assignedToId: userId } });
        emitToWorkspace(workspaceId, 'conversation:updated', { id: conversationId, assignedToId: userId });
      }
      if (contactId) {
        await prisma.contact.update({ where: { id: contactId }, data: { assignedToId: userId } });
      }
      await prisma.activity.create({
        data: { workspaceId, type: 'agent_assigned', title: 'Assigned automatically by automation', actorId: userId, contactId, conversationId, metadata: { automation: true } },
      });
      break;
    }
    case 'add_tag': {
      const tagName = action.value;
      if (!tagName || !contactId) return;
      const tag = await prisma.tag.upsert({
        where: { workspaceId_name: { workspaceId, name: tagName } },
        update: {},
        create: { workspaceId, name: tagName },
      });
      await prisma.contactTag.upsert({
        where: { contactId_tagId: { contactId, tagId: tag.id } },
        update: {},
        create: { contactId, tagId: tag.id },
      });
      break;
    }
    case 'create_task': {
      const { title, dueInHours, priority } = action.value ?? {};
      if (!title) return;
      const dueDate = dueInHours ? new Date(Date.now() + Number(dueInHours) * 3600_000) : null;
      await prisma.task.create({
        data: { workspaceId, title, priority: priority ?? 'medium', dueDate, contactId, conversationId },
      });
      break;
    }
    case 'change_lead_status': {
      const status = action.value;
      if (!status || !ctx.leadId) return;
      await prisma.lead.update({ where: { id: ctx.leadId as string }, data: { status } });
      if (contactId) await prisma.contact.update({ where: { id: contactId }, data: { leadStatus: status } });
      break;
    }
    case 'send_template': {
      const templateName = action.value;
      if (!templateName || !conversationId) return;
      const conversation = await prisma.conversation.findUnique({ where: { id: conversationId }, include: { contact: true } });
      if (conversation) {
        const { sendOutboundFromAutomation } = await import('../modules/messages/message.service.js');
        sendOutboundFromAutomation(workspaceId, conversation, templateName).catch((e) => logError('automation.send_template', e));
      }
      break;
    }
    case 'add_note': {
      const body = action.value;
      if (!body) return;
      await prisma.note.create({
        data: { workspaceId, contactId, conversationId, authorId: typeof ctx.actorId === 'string' ? ctx.actorId : undefined, body },
      });
      break;
    }
    case 'create_deal': {
      const { name, value } = action.value ?? {};
      if (!name || !contactId) return;
      await prisma.deal.create({
        data: { workspaceId, contactId, name, value: value ?? 0, stage: 'New Lead' },
      });
      break;
    }
    default:
      break;
  }
}

export async function triggerAutomation(workspaceId: string, triggerType: string, ctx: AutomationContext): Promise<void> {
  try {
    const automations = await prisma.automation.findMany({
      where: { workspaceId, triggerType, isEnabled: true },
      take: 50,
    });
    for (const automation of automations) {
      const passed = matchConditions(automation.conditions, ctx);
      if (!passed) continue;

      const actions = (automation.actions as Array<{ type: string; value?: any }>) ?? [];
      let error: string | null = null;
      try {
        for (const action of actions) {
          await runAction(workspaceId, action, ctx);
        }
      } catch (e) {
        error = e instanceof Error ? e.message : 'Automation action failed';
        logError('automation.run', e, { automationId: automation.id });
      }

      await prisma.automation.update({
        where: { id: automation.id },
        data: { runCount: { increment: 1 }, lastRunAt: new Date() },
      });
      await prisma.automationRun.create({
        data: {
          automationId: automation.id,
          workspaceId,
          status: error ? 'error' : 'success',
          error,
          context: ctx as any,
        },
      });
    }
  } catch (e) {
    logError('automation.trigger', e, { triggerType, workspaceId });
  }
}

export const automationSleep = sleep;