import { Router } from 'express';
import { ensureCrumb } from '../services/stocks/yahoo-finance.js';

const router = Router();

const YAHOO_API = 'https://query2.finance.yahoo.com';
const YAHOO_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

// ── Sector → representative peer tickers ──

const SECTOR_PEERS: Record<string, string[]> = {
  'Technology': ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'META', 'AVGO', 'ADBE', 'CRM'],
  'Healthcare': ['UNH', 'JNJ', 'LLY', 'PFE', 'ABBV', 'MRK', 'TMO', 'ABT'],
  'Financial Services': ['JPM', 'BAC', 'GS', 'MS', 'V', 'MA', 'BLK', 'SCHW'],
  'Consumer Cyclical': ['AMZN', 'TSLA', 'HD', 'NKE', 'MCD', 'SBUX', 'LOW', 'TJX'],
  'Industrials': ['CAT', 'HON', 'UPS', 'RTX', 'GE', 'BA', 'MMM', 'DE'],
  'Communication Services': ['GOOGL', 'META', 'DIS', 'NFLX', 'CMCSA', 'T', 'VZ', 'TMUS'],
  'Consumer Defensive': ['PG', 'KO', 'PEP', 'WMT', 'COST', 'PM', 'CL', 'MDLZ'],
  'Energy': ['XOM', 'CVX', 'COP', 'SLB', 'EOG', 'MPC', 'PSX', 'OXY'],
  'Basic Materials': ['LIN', 'APD', 'ECL', 'SHW', 'FCX', 'NEM', 'NUE', 'DOW'],
  'Real Estate': ['PLD', 'AMT', 'EQIX', 'SPG', 'PSA', 'O', 'WELL', 'DLR'],
  'Utilities': ['NEE', 'DUK', 'SO', 'D', 'AEP', 'SRE', 'EXC', 'XEL'],
};

// ── Types ──

interface ValuationMetrics {
  pe: number | null;
  forwardPE: number | null;
  pb: number | null;
  ps: number | null;
  peg: number | null;
  evEbitda: number | null;
  debtEquity: number | null;
  roe: number | null;
  dividendYield: number | null;
  marketCap: number | null;
}

interface PeerEntry {
  symbol: string;
  name: string;
  metrics: ValuationMetrics;
}

interface RelativeValuationResponse {
  target: {
    symbol: string;
    name: string;
    sector: string;
    metrics: ValuationMetrics;
  };
  peers: PeerEntry[];
  sectorMedians: ValuationMetrics;
}

// ── Cache ──

const cache = new Map<string, { data: RelativeValuationResponse; ts: number }>();
const TTL = 15 * 60_000; // 15 minutes

// ── Helpers ──

function median(values: number[]): number | null {
  const valid = values.filter((v) => v != null && isFinite(v));
  if (valid.length === 0) return null;
  valid.sort((a, b) => a - b);
  const mid = Math.floor(valid.length / 2);
  return valid.length % 2 !== 0 ? valid[mid] : (valid[mid - 1] + valid[mid]) / 2;
}

function extractMetricsFromQuoteSummary(result: Record<string, unknown>): ValuationMetrics {
  const sd = (result.summaryDetail || {}) as Record<string, { raw?: number }>;
  const ks = (result.defaultKeyStatistics || {}) as Record<string, { raw?: number }>;
  const fd = (result.financialData || {}) as Record<string, { raw?: number }>;

  return {
    pe: sd.trailingPE?.raw ?? null,
    forwardPE: sd.forwardPE?.raw ?? null,
    pb: ks.priceToBook?.raw ?? null,
    ps: sd.priceToSalesTrailing12Months?.raw ?? null,
    peg: ks.pegRatio?.raw ?? null,
    evEbitda: ks.enterpriseToEbitda?.raw ?? null,
    debtEquity: fd.debtToEquity?.raw ?? null,
    roe: fd.returnOnEquity?.raw ?? null,
    dividendYield: sd.dividendYield?.raw ?? null,
    marketCap: sd.marketCap?.raw ?? null,
  };
}

// v7 /quote lacks PEG, EV/EBITDA, D/E, ROE, P/S — every row (target + peers) needs quoteSummary.
async function fetchSummary(
  symbol: string,
  auth: { crumb: string; cookie: string },
): Promise<{ name: string; sector: string | null; metrics: ValuationMetrics } | null> {
  const modules = 'summaryDetail,defaultKeyStatistics,financialData,assetProfile,price';
  const url = `${YAHOO_API}/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}&crumb=${encodeURIComponent(auth.crumb)}`;
  const resp = await fetch(url, { headers: { 'User-Agent': YAHOO_UA, Cookie: auth.cookie } });
  if (!resp.ok) {
    console.error(`[RelativeValuation] quoteSummary returned ${resp.status} for ${symbol}`);
    return null;
  }
  const data = (await resp.json()) as { quoteSummary?: { result?: Array<Record<string, unknown>> } };
  const result = data?.quoteSummary?.result?.[0];
  if (!result) return null;
  const price = (result.price || {}) as Record<string, unknown>;
  const profile = (result.assetProfile || {}) as Record<string, unknown>;
  const metrics = extractMetricsFromQuoteSummary(result);
  metrics.marketCap ??= (price.marketCap as { raw?: number } | undefined)?.raw ?? null;
  return {
    name: (price.shortName as string) || (price.longName as string) || symbol,
    sector: (profile.sector as string) || null,
    metrics,
  };
}

function computeSectorMedians(entries: PeerEntry[]): ValuationMetrics {
  const keys: (keyof ValuationMetrics)[] = [
    'pe', 'forwardPE', 'pb', 'ps', 'peg', 'evEbitda',
    'debtEquity', 'roe', 'dividendYield', 'marketCap',
  ];
  const result: Record<string, number | null> = {};
  for (const key of keys) {
    const vals = entries
      .map((e) => e.metrics[key])
      .filter((v): v is number => v != null && isFinite(v));
    result[key] = median(vals);
  }
  return result as unknown as ValuationMetrics;
}

// ── Route ──

router.get('/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();

    // Check cache
    const cached = cache.get(symbol);
    if (cached && Date.now() - cached.ts < TTL) {
      return res.json(cached.data);
    }

    // Step 1: Fetch quoteSummary for the target symbol
    const auth = await ensureCrumb();
    if (!auth) {
      return res.status(503).json({ error: 'Relative valuation temporarily unavailable' });
    }

    const target = await fetchSummary(symbol, auth);
    if (!target) {
      if (cached) return res.json(cached.data);
      return res.status(404).json({ error: 'Symbol not found' });
    }

    const sector = target.sector || 'Technology';
    const companyName = target.name;
    const targetMetrics = target.metrics;

    // Step 2: Peers from sector map (excluding target), fetched in parallel
    const peerSymbols = (SECTOR_PEERS[sector] || SECTOR_PEERS['Technology']).filter((s) => s !== symbol);
    const peerResults = await Promise.all(
      peerSymbols.map((s) => fetchSummary(s, auth).catch(() => null)),
    );
    const peers: PeerEntry[] = [];
    peerResults.forEach((p, i) => {
      if (p) peers.push({ symbol: peerSymbols[i], name: p.name, metrics: p.metrics });
    });

    // Step 5: Compute sector medians (include target in the median computation)
    const targetEntry: PeerEntry = { symbol, name: companyName, metrics: targetMetrics };
    const allEntries = [targetEntry, ...peers];
    const sectorMedians = computeSectorMedians(allEntries);

    const response: RelativeValuationResponse = {
      target: {
        symbol,
        name: companyName,
        sector,
        metrics: targetMetrics,
      },
      peers,
      sectorMedians,
    };

    cache.set(symbol, { data: response, ts: Date.now() });
    res.json(response);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[RelativeValuation] Error:', message);
    const cached = cache.get(req.params.symbol?.toUpperCase());
    if (cached) return res.json(cached.data);
    res.status(500).json({ error: 'Failed to fetch relative valuation data' });
  }
});

export default router;
