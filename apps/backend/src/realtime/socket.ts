import { Server as SocketServer } from 'socket.io';
import type { Server as HttpServer } from 'http';
import { verifySession } from '../lib/jwt.js';
import { requireWorkspaceMembership } from '../lib/authz.js';

let io: SocketServer | null = null;

export function initSocket(httpServer: HttpServer) {
  io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL ?? '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token ?? socket.handshake.headers?.authorization?.replace('Bearer ', '');
      if (!token) return next(new Error('unauthorized'));
      const payload = await verifySession(token);
      if (!payload) return next(new Error('unauthorized'));
      const user = await prisma().user.findUnique({ where: { id: payload.sub }, select: { id: true, name: true, email: true } });
      if (!user) return next(new Error('unauthorized'));
      socket.data.user = user;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', async (socket) => {
    const user = socket.data.user as { id: string; name: string; email: string };
    socket.join(`user:${user.id}`);
    // join workspace rooms based on membership
    try {
      const memberships = await prisma().workspaceMember.findMany({
        where: { userId: user.id, isActive: true },
        select: { workspaceId: true },
      });
      memberships.forEach((m) => socket.join(`ws:${m.workspaceId}`));
    } catch {
      // ignore
    }
  });

  return io;
}

export function getIO() {
  return io;
}

export function emitToWorkspace(workspaceId: string, event: string, data: unknown) {
  io?.to(`ws:${workspaceId}`).emit(event, data);
}

export function emitToUser(userId: string, event: string, data: unknown) {
  io?.to(`user:${userId}`).emit(event, data);
}

import { prisma as _prisma } from '../lib/prisma.js';
const prisma = () => _prisma;