import type { Request, Response, NextFunction } from 'express';
import { verifySession } from '../lib/jwt.js';
import { requireWorkspaceMembership } from '../lib/authz.js';
import { ApiError } from '../lib/errors.js';

declare module 'express-serve-static-core' {
  interface Request {
    user?: { id: string; email: string; name: string };
    ws?: {
      workspaceId: string;
      role: 'OWNER' | 'ADMIN' | 'MANAGER' | 'AGENT';
      workspace: { name: string; slug: string; companyName: string; timezone: string; currency: string };
    };
  }
}

export const authenticate = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw ApiError.unauthorized('Missing authentication token');
    const token = header.slice(7);
    const payload = await verifySession(token);
    if (!payload) throw ApiError.unauthorized('Invalid or expired token');

    const user = await prisma().user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) throw ApiError.unauthorized('Account is inactive');

    req.user = { id: user.id, email: user.email, name: user.name };
    next();
  } catch (err) {
    next(err);
  }
};

import { prisma as _prisma } from '../lib/prisma.js';
const prisma = () => _prisma;

export const requireWorkspace = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw ApiError.unauthorized();
    const workspaceId = req.params.workspaceId ?? req.header('x-workspace-id');
    if (!workspaceId) throw ApiError.badRequest('Workspace required');

    const ctx = await requireWorkspaceMembership(req.user.id, workspaceId);
    if (!ctx) throw ApiError.forbidden('You do not have access to this workspace');
    req.ws = ctx;
    next();
  } catch (err) {
    next(err);
  }
};

export const requireRole =
  (...roles: Array<'OWNER' | 'ADMIN' | 'MANAGER' | 'AGENT'>) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.ws) return next(ApiError.unauthorized());
    if (!roles.includes(req.ws.role)) {
      return next(ApiError.forbidden('Insufficient permissions for this action'));
    }
    next();
  };