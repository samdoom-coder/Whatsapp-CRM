import 'dotenv/config';

const num = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && v !== undefined ? n : fallback;
};

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  port: num(process.env.PORT, 4000),
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  databaseUrl: process.env.DATABASE_URL ?? '',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  authSecret: process.env.AUTH_SECRET ?? 'dev-secret-change-me-in-production',
  demoMode: process.env.DEMO_MODE !== 'false',
  demoMessageIntervalMs: num(process.env.DEMO_MESSAGE_INTERVAL_MS, 60000),
  whatsapp: {
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN ?? '',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? '',
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID ?? '',
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN ?? 'my-webhook-verify-token',
  },
  ai: {
    provider: process.env.AI_PROVIDER ?? 'mock',
    apiKey: process.env.AI_API_KEY ?? '',
  },
};

export const isProd = config.env === 'production';