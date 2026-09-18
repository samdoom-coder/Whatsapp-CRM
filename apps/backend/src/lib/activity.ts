import { prisma } from './prisma.js';
import type { Prisma } from '@prisma/client';

interface ActivityInput {
  workspaceId: string;
  type: string;
  title: string;
  description?: string;
  actorId?: string | null;
  contactId?: string | null;
  conversationId?: string | null;
  dealId?: string | null;
  metadata?: Prisma.InputJsonValue;
}

export async function logActivity(input: ActivityInput) {
  try {
    await prisma.activity.create({
      data: {
        workspaceId: input.workspaceId,
        type: input.type,
        title: input.title,
        description: input.description,
        actorId: input.actorId,
        contactId: input.contactId,
        conversationId: input.conversationId,
        dealId: input.dealId,
        metadata: input.metadata ?? undefined,
      },
    });
  } catch (err) {
    // Activity logging must never break the primary operation
    console.error('[activity] failed to log', err);
  }
}

interface AuditInput {
  workspaceId?: string | null;
  userId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string;
}

export async function auditLog(input: AuditInput) {
  try {
    await prisma.auditLog.create({
      data: {
        workspaceId: input.workspaceId ?? null,
        userId: input.userId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: input.metadata ?? undefined,
        ipAddress: input.ipAddress,
      },
    });
  } catch (err) {
    console.error('[audit] failed to log', err);
  }
}