import { scrapeArticles, createNewsSource } from './neuberg-scraper.js';
import { getClientCount } from '../websocket/ws-server.js';
import type { NewsSource } from './news-source.js';

const POLL_INTERVAL_MS = 60_000; // 60 seconds (halved API calls vs 30s)
const IDLE_POLL_INTERVAL_MS = 5 * 60_000; // 5 minutes when no users connected
let newsSource: NewsSource | null = null;

export function startScraperScheduler() {
  newsSource = createNewsSource();
  if (!newsSource) {
    console.log('[Scheduler] No news source configured — only AI analysis will run');
  } else {
    console.log(`[Scheduler] Polling ${newsSource.name} every ${POLL_INTERVAL_MS / 1000}s`);
  }

  // Run immediately on start
  runScrapeAndAnalyze();

  // Adaptive polling: fast when users connected, slow when idle
  setInterval(() => {
    const interval = getClientCount() > 0 ? POLL_INTERVAL_MS : IDLE_POLL_INTERVAL_MS;
    const elapsed = Date.now() - lastScrapeTime;
    if (elapsed >= interval) {
      runScrapeAndAnalyze();
    }
  }, POLL_INTERVAL_MS); // Check every 60s, but only scrape if interval elapsed
}

let lastScrapeTime = 0;

async function runScrapeAndAnalyze() {
  lastScrapeTime = Date.now();
  try {
    // services/ai (news analysis + clustering) is not in this checkout — restore its calls here if it comes back
    await scrapeArticles(newsSource);
  } catch (err) {
    console.error('[Scheduler] Error in scrape cycle:', err);
  }
}

export { runScrapeAndAnalyze };
