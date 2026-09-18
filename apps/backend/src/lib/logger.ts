import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport:
    process.env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } }
      : undefined,
  base: { service: 'wa-crm-backend' },
});

export const logError = (context: string, err: unknown, meta?: Record<string, unknown>) => {
  logger.error({ context, ...meta, err: err instanceof Error ? { message: err.message, stack: err.stack } : err }, 'error');
};