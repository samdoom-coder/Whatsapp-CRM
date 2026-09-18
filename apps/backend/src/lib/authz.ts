import { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';

export type ContextUser = {
  id: string;
  email: string;
  name: string;
};

export type WorkspaceContext = {
  workspaceId: string;
  role: 'OWNER' | 'ADMIN' | 'MANAGER' | 'AGENT';
  workspace: { name: string; slug: string; companyName: string; timezone: string; currency: string };
};

export interface AuthedRequest {
  user: ContextUser;
  ws: WorkspaceContext;
}

export const ROLE_RANK: Record<WorkspaceContext['role'], number> = {
  AGENT: 1,
  MANAGER: 2,
  ADMIN: 3,
  OWNER: 4,
};

export const atLeast = (userRole: WorkspaceContext['role'], required: WorkspaceContext['role']) =>
  ROLE_RANK[userRole] >= ROLE_RANK[required];

export async function requireWorkspaceMembership(
  userId: string,
  workspaceId: string,
): Promise<WorkspaceContext | null> {
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    include: { workspace: { select: { name: true, slug: true, companyName: true, timezone: true, currency: true } } },
  });
  if (!member || !member.isActive) return null;
  return {
    workspaceId,
    role: member.role,
    workspace: member.workspace,
  };
}

// Helper to scope Prisma where clauses to a workspace
export const wsWhere = (workspaceId: string) => ({ workspaceId });

export type { Prisma };