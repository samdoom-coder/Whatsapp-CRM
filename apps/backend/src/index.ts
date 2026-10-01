import http from 'http';
import { createApp } from './app.js';
import { config } from './config.js';
import { prisma } from './lib/prisma.js';
import { initSocket } from './realtime/socket.js';
import { startDemoSimulator } from './modules/whatsapp/demo.simulator.js';
import { logger } from './lib/logger.js';
import { startWorker } from './jobs/worker.js';

async function main() {
  const app = createApp();
  const server = http.createServer(app);

  initSocket(server);

  // Verify database connectivity (retry — postgres can take ~30s on first boot)
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  let connected = false;
  for (let attempt = 1; attempt <= 15; attempt++) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      logger.info('Database connected');
      connected = true;
      break;
    } catch (err) {
      logger.error(
        { attempt },
        `Database connection failed (attempt ${attempt}/15) — retrying in 2s...`,
      );
      if (attempt === 15) {
        logger.error({ err }, 'Database connection failed — is PostgreSQL running?');
        process.exit(1);
      }
      await sleep(2000);
    }
  }
  if (!connected) process.exit(1);

  // Start background worker
  startWorker().catch((err) => logger.error('Worker failed to start', err));

  // Start demo simulator (simulated WhatsApp traffic) when in demo mode
  if (config.demoMode) {
    startDemoSimulator();
    logger.info('Demo simulator enabled — simulated WhatsApp traffic will appear');
  }

  server.listen(config.port, () => {
    logger.info(`Backend listening on http://localhost:${config.port}`);
  });

  const shutdown = async () => {
    logger.info('Shutting down...');
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  logger.error('Fatal startup error', err);
  process.exit(1);
});