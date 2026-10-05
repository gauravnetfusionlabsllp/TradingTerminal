import { env } from './config/env.js';
import { createApp } from './app.js';
import { startWebSocketServer } from './services/websocket/ws-server.js';
import { startMarketFeed, stopMarketFeed } from './services/market-feed.js';
import { startTradeFeed, stopTradeFeed } from './services/trade-feed.js';
import { startAlertEvaluator } from './services/alerts/alert-evaluator.js';
import { startStockTracker, stopStockTracker } from './services/stocks/stock-tracker.js';
import { seedDatabase } from './lib/seed.js';
import { backupDatabase } from './lib/gcs-backup.js';
import { startCalendarTracker, stopCalendarTracker } from './services/calendar/calendar-tracker.js';
import { startInsiderTracker, stopInsiderTracker } from './services/stocks/insider-tracker.js';
import { prisma } from './lib/prisma.js';

for (const key of ['JWT_SECRET', 'MT5_BRIDGE_API_KEY'] as const) {
  if (env[key]) continue;
  if (process.env.NODE_ENV === 'production') {
    console.error(`[Server] FATAL: ${key} is required in production`);
    process.exit(1);
  }
  console.warn(`[Server] WARNING: ${key} is not set${key === 'JWT_SECRET' ? ' — using a random secret, logins reset on restart' : ' — MT5 login and trading will fail'}`);
}

const app = createApp();
const intervals: ReturnType<typeof setInterval>[] = [];

const server = app.listen(env.PORT, async () => {
  // Keep-alive > Cloud Run's 60s idle timeout
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;

  console.log(`[Server] HTTP server running on port ${env.PORT}`);

  try {
    await seedDatabase();
  } catch (err) {
    console.error('[Server] Database seeding failed:', err);
  }

  startWebSocketServer(server);
  startMarketFeed();
  startAlertEvaluator();
  startTradeFeed();
  startStockTracker();
  startCalendarTracker();
  startInsiderTracker();

  // Periodic database backup to GCS (adaptive: normal interval when active, 60min when idle)
  if (env.GCS_BUCKET) {
    const activeIntervalMs = env.GCS_BACKUP_INTERVAL_MINUTES * 60 * 1000;
    const idleIntervalMs = 60 * 60 * 1000; // 60 min when no users
    let lastBackupTime = Date.now();
    intervals.push(setInterval(() => {
      const { getClientCount } = require('./services/websocket/ws-server.js');
      const interval = getClientCount() > 0 ? activeIntervalMs : idleIntervalMs;
      if (Date.now() - lastBackupTime >= interval) {
        lastBackupTime = Date.now();
        backupDatabase();
      }
    }, activeIntervalMs));
    console.log(`[GCS] Backup scheduled every ${env.GCS_BACKUP_INTERVAL_MINUTES}min (active) / 60min (idle)`);
  }

  console.log('[Server] All services started');
});

// ── Graceful Shutdown ──
async function shutdown(signal: string) {
  console.log(`\n[Server] ${signal} received — shutting down gracefully...`);
  // Stop all service trackers
  stopStockTracker();
  stopCalendarTracker();
  stopInsiderTracker();
  stopMarketFeed();
  stopTradeFeed();
  // Clear additional tracked intervals
  for (const id of intervals) clearInterval(id);
  intervals.length = 0;

  server.close(async () => {
    try {
      // Final backup before shutdown to prevent data loss
      if (env.GCS_BUCKET) {
        console.log('[Server] Running final database backup...');
        await backupDatabase();
      }
      await prisma.$disconnect();
      console.log('[Server] Database disconnected');
    } catch (err) {
      console.error('[Server] Error during shutdown:', err);
    }
    process.exit(0);
  });
  // Force exit after 10s if graceful shutdown hangs
  setTimeout(() => {
    console.error('[Server] Forced exit after timeout');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Catch unhandled errors to prevent silent crashes
process.on('unhandledRejection', (reason) => {
  console.error('[Server] Unhandled rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[Server] Uncaught exception:', err);
  // Give the server a moment to log, then exit
  setTimeout(() => process.exit(1), 1000);
});
