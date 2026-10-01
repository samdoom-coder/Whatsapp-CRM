import Redis from 'ioredis';
import { config } from '../config.js';

const globalForRedis = globalThis as unknown as { redis?: Redis };

export const redis =
  globalForRedis.redis ??
  new Redis(config.redisUrl, {
    maxRetriesPerRequest: null,
    lazyConnect: false,
  });

redis.on('error', (err) => {
  // Redis is optional for local dev; log and continue
  if (process.env.NODE_ENV !== 'test') console.error('[redis]', err.message);
});

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis;

export function createBullMQConnection(): Redis {
  const conn = new Redis(config.redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
  conn.on('error', (err) => {
    if (process.env.NODE_ENV !== 'test') console.error('[bullmq-redis]', err.message);
  });
  return conn;
}

export async function redisPing() {
  try {
    await redis.ping();
    return true;
  } catch {
    return false;
  }
}