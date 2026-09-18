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

  // Verify database connectivity
  try {
    await prisma.$queryRaw`SELECT 1`;
    logger.info('Database connected');
  } catch (err) {
    logger.error({ err }, 'Database connection failed — is PostgreSQL running?');
    process.exit(1);
  }

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