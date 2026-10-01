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

// Fail fast on unsafe production config — local demo stays permissive.
if (isProd) {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required in production');
  }
  if (config.authSecret.length < 32) {
    throw new Error('AUTH_SECRET must be ≥32 chars in production');
  }
  if (config.authSecret.includes('change-me') || config.authSecret.includes('dev-secret')) {
    console.warn('[config] WARNING: AUTH_SECRET is still the default placeholder — set a random value');
  }
  if (config.demoMode) {
    console.warn('[config] WARNING: DEMO_MODE is on in production — demo traffic + mock AI active');
  }
  if (config.ai.provider !== 'mock' && !config.ai.apiKey) {
    throw new Error(`AI_API_KEY is required when AI_PROVIDER=${config.ai.provider}`);
  }
  const hasWhatsapp = Boolean(
    config.whatsapp.accessToken && config.whatsapp.phoneNumberId && config.whatsapp.businessAccountId,
  );
  if (!hasWhatsapp && !config.demoMode) {
    console.warn('[config] WARNING: no WhatsApp Cloud API credentials and DEMO_MODE=false — inbound disabled');
  }
}