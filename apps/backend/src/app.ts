import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import RateLimiterRedis from 'rate-limit-redis';
import { redis } from './lib/redis.js';
import { errorHandler, notFoundHandler } from './lib/errors.js';
import { config } from './config.js';

import authRoutes from './modules/auth/auth.routes.js';
import workspaceRoutes from './modules/workspaces/workspace.routes.js';
import contactRoutes from './modules/contacts/contact.routes.js';
import leadRoutes from './modules/leads/lead.routes.js';
import dealRoutes from './modules/deals/deal.routes.js';
import taskRoutes from './modules/tasks/task.routes.js';
import conversationRoutes from './modules/conversations/conversation.routes.js';
import messageRoutes from './modules/messages/message.routes.js';
import templateRoutes from './modules/templates/template.routes.js';
import automationRoutes from './modules/automations/automation.routes.js';
import analyticsRoutes from './modules/analytics/analytics.routes.js';
import dashboardRoutes from './modules/dashboard/dashboard.routes.js';
import notificationRoutes from './modules/notifications/notification.routes.js';
import teamRoutes from './modules/team/team.routes.js';
import whatsappRoutes from './modules/whatsapp/whatsapp.routes.js';
import webhookRoutes from './modules/whatsapp/webhook.routes.js';
import aiRoutes from './modules/ai/ai.routes.js';
import searchRoutes from './modules/search/search.routes.js';
import tagRoutes from './modules/tags/tag.routes.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.use(
    cors({
      origin: config.frontendUrl ?? '*',
      credentials: true,
    }),
  );

  // Webhooks need raw bodies for signature verification
  app.use('/api/webhooks', express.raw({ type: 'application/json' }));

  app.use(express.json({ limit: '5mb' }));

  const limiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
    store: new RateLimiterRedis({
      sendCommand: (...args: string[]) =>
        redis.call.apply(redis, args as unknown as [string, ...(string | Buffer | number)[]]) as Promise<any>,
    }),
  });
  app.use('/api/', limiter);

  app.get('/api/health', (_req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

  app.use('/api/auth', authRoutes);
  app.use('/api', workspaceRoutes);
  app.use('/api', tagRoutes);
  app.use('/api', contactRoutes);
  app.use('/api', leadRoutes);
  app.use('/api', dealRoutes);
  app.use('/api', taskRoutes);
  app.use('/api', conversationRoutes);
  app.use('/api', messageRoutes);
  app.use('/api', templateRoutes);
  app.use('/api', automationRoutes);
  app.use('/api', analyticsRoutes);
  app.use('/api', dashboardRoutes);
  app.use('/api', notificationRoutes);
  app.use('/api', teamRoutes);
  app.use('/api/whatsapp', whatsappRoutes);
  app.use('/api/webhooks', webhookRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api', searchRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}