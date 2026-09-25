import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { getHistory } from '../services/stocks/yahoo-finance.js';

const YAHOO_SEARCH = 'https://query1.finance.yahoo.com/v1/finance/search';
// Yahoo tickers: AMZN, BRK-B, 0700.HK, ^GSPC, EURUSD=X, GC=F
const SYMBOL_RE = /^[A-Z0-9.\-=^]{1,12}$/;

const router = Router();

const listTracked = () =>
  prisma.trackedStock.findMany({
    where: { source: { in: ['default', 'watchlist'] } },
    orderBy: { addedAt: 'asc' },
    take: 500,
  });

// Today's 5-minute closes per symbol. The promise itself is cached, so concurrent viewers share one Yahoo call
// and a failure (null) is also held for the TTL instead of being retried on every request.
const SPARK_TTL = 60_000;
const sparkCache = new Map<string, { at: number; p: Promise<number[] | null> }>();

function spark(symbol: string) {
  const hit = sparkCache.get(symbol);
  if (hit && Date.now() - hit.at < SPARK_TTL) return hit.p;
  const p = getHistory(symbol, { range: '1d', interval: '5m' }).then((bars) => {
    const closes = bars.map((b) => b.close).filter((c): c is number => typeof c === 'number');
    return closes.length > 1 ? closes : null;
  });
  sparkCache.set(symbol, { at: Date.now(), p });
  return p;
}

// GET /api/watchlist - watchlist (default + user-added), public for reading
router.get('/', async (req, res) => {
  try {
    const tracked = await listTracked();

    const symbols = tracked.map((t) => t.symbol);
    const quotes = await prisma.stockQuote.findMany({
      where: { symbol: { in: symbols } },
    });

    const quoteMap = new Map(quotes.map((q) => [q.symbol, q]));

    const result = tracked.map((t) => ({
      symbol: t.symbol,
      name: t.name,
      source: t.source,
      quote: quoteMap.get(t.symbol) || null,
    }));

    res.json(result);
  } catch (err) {
    console.error('[Watchlist] Error:', err);
    res.status(500).json({ error: 'Failed to fetch watchlist' });
  }
});

// POST /api/watchlist - add ticker (requires auth)
router.post('/', requireAuth, async (req, res) => {
  try {
    const { symbol } = req.body;
    if (!symbol || typeof symbol !== 'string') {
      return res.status(400).json({ error: 'Symbol is required' });
    }

    const sym = symbol.toUpperCase().trim();
    if (!SYMBOL_RE.test(sym)) {
      return res.status(400).json({ error: 'Invalid symbol format' });
    }

    const existing = await prisma.trackedStock.findUnique({ where: { symbol: sym } });
    if (existing) {
      // If it was ai-recommended, promote to watchlist
      if (existing.source === 'ai-recommended') {
        await prisma.trackedStock.update({
          where: { symbol: sym },
          data: { source: 'watchlist' },
        });
      }
      return res.json({ symbol: sym, added: true });
    }

    await prisma.trackedStock.create({
      data: { symbol: sym, name: sym, source: 'watchlist' },
    });

    res.json({ symbol: sym, added: true });
  } catch (err) {
    console.error('[Watchlist] Error adding:', err);
    res.status(500).json({ error: 'Failed to add symbol' });
  }
});

// GET /api/watchlist/spark - { SYMBOL: today's 5-minute closes | null }
router.get('/spark', async (_req, res) => {
  try {
    const symbols = (await listTracked()).map((t) => t.symbol);
    const series = await Promise.all(symbols.map(spark));
    res.json(Object.fromEntries(symbols.map((s, i) => [s, series[i]])));
  } catch (err) {
    console.error('[Watchlist] Spark error:', err);
    res.status(500).json({ error: 'Failed to fetch sparklines' });
  }
});

// GET /api/watchlist/search?q=... - search Yahoo Finance for ticker suggestions
// NOTE: Must be defined BEFORE /:symbol to prevent Express from matching "search" as a symbol
router.get('/search', async (req, res) => {
  try {
    const q = (req.query.q as string || '').trim();
    if (q.length < 1 || q.length > 100) return res.json([]);

    const url = `${YAHOO_SEARCH}?q=${encodeURIComponent(q)}&quotesCount=8&newsCount=0&listsCount=0`;
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(10_000),
    });

    if (!resp.ok) return res.json([]);
    const data = (await resp.json()) as any;
    const quotes = (data?.quotes || [])
      .filter((q: any) => q.symbol && ['EQUITY', 'ETF', 'CRYPTOCURRENCY', 'INDEX', 'CURRENCY', 'FUTURE'].includes(q.quoteType))
      .map((q: any) => ({
        symbol: q.symbol,
        name: q.shortname || q.longname || q.symbol,
        type: q.quoteType,
        exchange: q.exchDisp || q.exchange || '',
      }));

    res.json(quotes);
  } catch (err: any) {
    console.error('[Watchlist] Search error:', err?.message || err);
    const isTimeout = err?.name === 'AbortError' || err?.name === 'TimeoutError';
    res.status(isTimeout ? 503 : 500).json({ error: 'Search temporarily unavailable' });
  }
});

// DELETE /api/watchlist/:symbol - remove ticker (requires auth)
router.delete('/:symbol', requireAuth, async (req, res) => {
  try {
    const sym = String(req.params.symbol).toUpperCase().trim();
    if (!SYMBOL_RE.test(sym)) return res.status(400).json({ error: 'Invalid symbol format' });

    await prisma.trackedStock.deleteMany({ where: { symbol: sym } });
    await prisma.stockQuote.deleteMany({ where: { symbol: sym } });

    res.json({ symbol: sym, removed: true });
  } catch (err) {
    console.error('[Watchlist] Error removing:', err);
    res.status(500).json({ error: 'Failed to remove symbol' });
  }
});

export default router;
