import { Router } from 'express';
import { ensureCrumb, getQuotes } from '../services/stocks/yahoo-finance.js';

const YAHOO_API = 'https://query1.finance.yahoo.com';
const YAHOO_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

interface PivotPointsCache {
  data: PivotPointsData;
  timestamp: number;
}

interface PivotPointsData {
  symbol: string;
  currentPrice: number;
  previousHigh: number;
  previousLow: number;
  previousClose: number;
  previousOpen: number;
  methods: {
    classic: { pivot: number; r1: number; r2: number; r3: number; s1: number; s2: number; s3: number };
    fibonacci: { pivot: number; r1: number; r2: number; r3: number; s1: number; s2: number; s3: number };
    camarilla: { r1: number; r2: number; r3: number; r4: number; s1: number; s2: number; s3: number; s4: number };
    woodie: { pivot: number; r1: number; r2: number; s1: number; s2: number };
    demark: { r1: number; s1: number };
  };
}

const cache = new Map<string, PivotPointsCache>();
const CACHE_TTL = 5 * 60_000; // 5 minutes

/** 7 significant digits: FX keeps its pips (1.139602), indices and crypto their cents (84250.60). */
function roundPrice(n: number): number {
  return +n.toPrecision(7);
}

function calculatePivotPoints(O: number, H: number, L: number, C: number): PivotPointsData['methods'] {
  const range = H - L;

  // Classic
  const classicP = (H + L + C) / 3;
  const classic = {
    pivot: roundPrice(classicP),
    r1: roundPrice(2 * classicP - L),
    r2: roundPrice(classicP + range),
    r3: roundPrice(H + 2 * (classicP - L)),
    s1: roundPrice(2 * classicP - H),
    s2: roundPrice(classicP - range),
    s3: roundPrice(L - 2 * (H - classicP)),
  };

  // Fibonacci
  const fibP = (H + L + C) / 3;
  const fibonacci = {
    pivot: roundPrice(fibP),
    r1: roundPrice(fibP + 0.382 * range),
    r2: roundPrice(fibP + 0.618 * range),
    r3: roundPrice(fibP + 1.000 * range),
    s1: roundPrice(fibP - 0.382 * range),
    s2: roundPrice(fibP - 0.618 * range),
    s3: roundPrice(fibP - 1.000 * range),
  };

  // Camarilla
  const camarilla = {
    r1: roundPrice(C + 1.1 * range / 12),
    r2: roundPrice(C + 1.1 * range / 6),
    r3: roundPrice(C + 1.1 * range / 4),
    r4: roundPrice(C + 1.1 * range / 2),
    s1: roundPrice(C - 1.1 * range / 12),
    s2: roundPrice(C - 1.1 * range / 6),
    s3: roundPrice(C - 1.1 * range / 4),
    s4: roundPrice(C - 1.1 * range / 2),
  };

  // Woodie
  const woodieP = (H + L + 2 * C) / 4;
  const woodie = {
    pivot: roundPrice(woodieP),
    r1: roundPrice(2 * woodieP - L),
    r2: roundPrice(woodieP + range),
    s1: roundPrice(2 * woodieP - H),
    s2: roundPrice(woodieP - range),
  };

  // DeMark
  let X: number;
  if (C < O) {
    X = H + 2 * L + C;
  } else if (C > O) {
    X = 2 * H + L + C;
  } else {
    X = H + L + 2 * C;
  }
  const demark = {
    r1: roundPrice(X / 2 - L),
    s1: roundPrice(X / 2 - H),
  };

  return { classic, fibonacci, camarilla, woodie, demark };
}

const router = Router();

// GET /api/pivot-points/:symbol
router.get('/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();

    // Check cache
    const cached = cache.get(symbol);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return res.json(cached.data);
    }

    // Fetch 5-day daily OHLC via chart API
    const auth = await ensureCrumb();
    const crumbParam = auth ? `&crumb=${encodeURIComponent(auth.crumb)}` : '';
    const headers: Record<string, string> = { 'User-Agent': YAHOO_UA };
    if (auth) headers['Cookie'] = auth.cookie;

    const chartUrl = `${YAHOO_API}/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d${crumbParam}`;
    const chartResp = await fetch(chartUrl, { headers });

    if (!chartResp.ok) {
      return res.status(502).json({ error: 'Failed to fetch OHLC data from upstream' });
    }

    const chartData = (await chartResp.json()) as any;
    const result = chartData?.chart?.result?.[0];
    if (!result) {
      return res.status(404).json({ error: 'No chart data available for symbol' });
    }

    const timestamps: number[] = result.timestamp || [];
    const quotes = result.indicators?.quote?.[0] || {};
    const meta = result.meta || {};

    if (timestamps.length < 2) {
      return res.status(404).json({ error: 'Insufficient trading data for pivot calculation' });
    }

    // Previous completed trading day = second-to-last bar with full OHLC. Yahoo's daily series has null bars
    // (holidays, and FX's open "today" row before the live one), so the raw second-to-last is often empty.
    // ponytail: on a weekend this still skips Friday's finished session — use meta.currentTradingPeriod if that matters
    const full = timestamps.map((_, i) => i)
      .filter((i) => [quotes.open, quotes.high, quotes.low, quotes.close].every((a) => a?.[i] != null));
    if (full.length < 2) {
      return res.status(404).json({ error: 'Insufficient trading data for pivot calculation' });
    }
    const prevIdx = full[full.length - 2];
    const prevOpen = quotes.open?.[prevIdx] ?? null;
    const prevHigh = quotes.high?.[prevIdx] ?? null;
    const prevLow = quotes.low?.[prevIdx] ?? null;
    const prevClose = quotes.close?.[prevIdx] ?? null;

    if (prevOpen == null || prevHigh == null || prevLow == null || prevClose == null) {
      return res.status(404).json({ error: 'Previous day OHLC data incomplete' });
    }

    // Get current price from meta or latest data point
    let currentPrice = meta.regularMarketPrice ?? null;
    if (currentPrice == null) {
      // Try the last data point's close
      const lastIdx = timestamps.length - 1;
      currentPrice = quotes.close?.[lastIdx] ?? prevClose;
    }

    // Fallback: try getQuotes for current price
    if (currentPrice == null) {
      try {
        const quoteData = await getQuotes([symbol]);
        if (quoteData.length > 0 && quoteData[0].price) {
          currentPrice = quoteData[0].price;
        }
      } catch {
        // Use previous close as last resort
        currentPrice = prevClose;
      }
    }

    const methods = calculatePivotPoints(prevOpen, prevHigh, prevLow, prevClose);

    const data: PivotPointsData = {
      symbol,
      currentPrice: roundPrice(currentPrice),
      previousHigh: roundPrice(prevHigh),
      previousLow: roundPrice(prevLow),
      previousClose: roundPrice(prevClose),
      previousOpen: roundPrice(prevOpen),
      methods,
    };

    // Cache result
    cache.set(symbol, { data, timestamp: Date.now() });

    res.json(data);
  } catch (err: any) {
    console.error('[PivotPoints] Error calculating pivot points:', err?.message || err);
    res.status(500).json({ error: 'Failed to calculate pivot points' });
  }
});

export default router;
