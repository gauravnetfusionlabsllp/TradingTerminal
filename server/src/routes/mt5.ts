import { AsyncLocalStorage } from 'node:async_hooks';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { requireAuth, requireTrader } from '../middleware/auth.js';
import { lastQuote } from '../services/market-feed.js';

// ── Bridge client ──

export class HttpError extends Error {
  constructor(public status: number, message: string, public body?: object) {
    super(message);
  }
}

// Time the current request spent waiting on the bridge, summed over every bridge() call it makes.
// ponytail: a request awaiting another request's in-flight cached() bridge promise counts that wait as node time (rare, 60s cache)
const bridgeTime = new AsyncLocalStorage<{ ms: number }>();

/** Calls the MT5 bridge. Throws HttpError carrying a status fit to return to our own client. */
export async function bridge<T = any>(path: string, body?: unknown): Promise<T> {
  let res: globalThis.Response;
  let data: any;
  const t = performance.now();
  try {
    res = await fetch(`${env.MT5_BRIDGE_URL}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'X-API-Key': env.MT5_BRIDGE_API_KEY, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      // Bridge serializes trades behind one lock and polls up to 8s for confirmation
      signal: AbortSignal.timeout(30_000),
    });
    data = await res.json().catch(() => null);
  } catch (err: any) {
    console.error(`[MT5] Bridge unreachable ${path.split('?')[0]}:`, err?.message);
    throw new HttpError(503, 'Trading server unavailable');
  } finally {
    const store = bridgeTime.getStore();
    if (store) store.ms += performance.now() - t;
  }

  if (res.ok) return data as T;
  if (res.status >= 500 || res.status === 429) throw new HttpError(503, 'Trading server unavailable');
  if (res.status === 401 || res.status === 403) {
    console.error(`[MT5] Bridge rejected our API key (${res.status}) — check MT5_BRIDGE_API_KEY`);
    throw new HttpError(502, 'Trading server error');
  }
  // 400 / 404 / 422 carry a message meant for the user; 422 TradeResults are passed along too
  throw new HttpError(res.status, data?.error || data?.message || data?.title || `Bridge returned ${res.status}`, data ?? undefined);
}

// Short-lived shared cache; storing the promise also coalesces concurrent identical requests
const cache = new Map<string, { at: number; value: Promise<unknown> }>();
function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as Promise<T>;
  const value = fn();
  cache.set(key, { at: Date.now(), value });
  value.catch(() => cache.delete(key));
  return value;
}

// ── Symbols ──

interface AllowedSymbol { symbol: string; tradeMode: string }

export async function allowedSymbols(login: number): Promise<AllowedSymbol[]> {
  return cached(`symbols:${login}`, 60_000, async () =>
    (await bridge<{ symbols: AllowedSymbol[] }>(`/api/trade/allowed-symbols/${login}`)).symbols ?? []);
}

async function requireSymbol(login: number, symbol: string, buy?: boolean): Promise<AllowedSymbol> {
  const s = (await allowedSymbols(login)).find((x) => x.symbol === symbol);
  if (!s) throw new HttpError(403, `${symbol} is not tradable on this account`);
  if (buy !== undefined && (
    s.tradeMode === 'TRADE_CLOSEONLY' ||
    (buy && s.tradeMode === 'TRADE_SHORTONLY') ||
    (!buy && s.tradeMode === 'TRADE_LONGONLY')
  )) {
    throw new HttpError(403, `${symbol} is ${s.tradeMode.replace('TRADE_', '').toLowerCase()} on this account`);
  }
  return s;
}

// ── Chart ──
// The bridge only serves M1 bars (MT5 Manager ChartRequest has no timeframe), so every interval is folded here.
// Bars are fetched one server-time day per call using from/to — never a whole range in one request.

export interface Bar { time: string; open: number; high: number; low: number; close: number; tickVolume: number; volume: number }
export interface Candle { time: number; open: number; high: number; low: number; close: number; volume: number }

export const TIMEFRAMES = { M1: 60, M3: 180, M5: 300, M15: 900, M30: 1800, H1: 3600, H4: 14_400 } as const;
export type Timeframe = keyof typeof TIMEFRAMES;

/** Folds ascending M1 candles into `tfSec` buckets (tfSec divides a day, so buckets never cross day chunks). */
export function aggregateBars(m1: Candle[], tfSec: number): Candle[] {
  const out: Candle[] = [];
  for (const b of m1) {
    const time = Math.floor(b.time / tfSec) * tfSec;
    const last = out[out.length - 1];
    if (last?.time === time) {
      last.high = Math.max(last.high, b.high);
      last.low = Math.min(last.low, b.low);
      last.close = b.close;
      last.volume += b.volume;
    } else {
      out.push({ ...b, time });
    }
  }
  return out;
}

const DAY = 86_400;
const PAGE_DAY_BUDGET = 30; // max day-chunks one chart request may touch (~30 days: an H4 page is ~130 candles)
const EMPTY_DAYS_STOP = 14; // this many empty days in a row = start of history
const CHUNK_CONCURRENCY = 4; // bridge allows 20 req/s per IP; a day-chunk call takes ~400ms
// ponytail: in-memory LRU of M1 day-chunks (~150KB each), move to Redis/disk if many symbols
const DAY_CACHE_MAX = 200;

// Bar times and from/to are MT5 server time (≈ UTC+3 here) labelled as UTC. Learned from live bars so we never
// ask for a not-yet-started "tomorrow" — an empty window costs 2.9s (bridge retries) and returns 422.
let serverOffset: number | null = null;
const nowSec = () => Math.floor(Date.now() / 1000);
const latestServerTime = () => nowSec() + (serverOffset ?? 14 * 3600); // until learned: latest possible timezone

// Only called with the newest M1 bar of a symbol ticking on the FIX feed right now. An old day's or a closed market's
// last bar also lands on the 30-min grid ~13% of the time — that once taught -158h, hiding today and freezing live candles.
function learnOffset(bars: Candle[]) {
  const last = bars[bars.length - 1]?.time;
  if (last === undefined) return;
  const guess = Math.round((last - nowSec()) / 1800) * 1800;
  if (Math.abs(last - (nowSec() + guess)) < 120) serverOffset = guess; // only trust a bar from the last ~2 min
}

const tickingNow = (symbol: string) => {
  const q = lastQuote(symbol);
  return !!q && Date.now() - q.ts < 60_000; // bridge replays old snapshots on subscribe, so check age
};

const dayCache = new Map<string, { expires: number; value: Promise<Candle[]> }>();

/** M1 candles for server-time day [d, d+86399]. Closed days are cached until evicted, live ones briefly. */
function loadDay(symbol: string, d: number): Promise<Candle[]> {
  const key = `${symbol}:${d}`;
  const hit = dayCache.get(key);
  if (hit && hit.expires > Date.now()) {
    dayCache.delete(key); // LRU: re-insert as most recent
    dayCache.set(key, hit);
    return hit.value;
  }

  const value = bridge<{ bars: Bar[] }>(`/api/market/chart/${encodeURIComponent(symbol)}?from=${d}&to=${d + DAY - 1}`)
    .then((data) => (data.bars ?? []).map((b) => ({
      time: Date.parse(b.time) / 1000, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.tickVolume || b.volume || 0,
    })))
    .catch((err) => {
      // 422 = no bars in the window (weekend, holiday, future) — an empty day, not a failure
      if (err instanceof HttpError && err.status === 422) return [] as Candle[];
      throw err;
    });
  const entry = { expires: Infinity, value };
  dayCache.delete(key); // an expired entry must move to the LRU tail, not keep its old position
  dayCache.set(key, entry);
  if (dayCache.size > DAY_CACHE_MAX) dayCache.delete(dayCache.keys().next().value!);

  value.then((bars) => {
    const closed = d + DAY + 12 * 3600 <= nowSec(); // over in every timezone → immutable
    entry.expires = closed ? Infinity : Date.now() + (bars.length ? 15_000 : 300_000);
  }, () => dayCache.delete(key));
  return value;
}

/** Up to `limit` candles older than `before` (server time), walking back one day-chunk at a time. */
async function chartPage(symbol: string, tfSec: number, before: number, limit: number) {
  let day = Math.floor((Math.min(before, latestServerTime() + 1) - 1) / DAY) * DAY;
  const chunks: Candle[][] = []; // newest first
  let count = 0;
  let scanned = 0;
  let emptyRun = 0;
  let newestM1: Candle[] | undefined;

  while (count < limit && scanned < PAGE_DAY_BUDGET && emptyRun < EMPTY_DAYS_STOP) {
    // Only as many days as the remaining candles likely need — each extra (e.g. weekend) day can cost 2.9s
    const need = Math.ceil(((limit - count) * tfSec) / DAY) + 1;
    const days = Array.from({ length: Math.min(CHUNK_CONCURRENCY, need, PAGE_DAY_BUDGET - scanned) }, (_, i) => day - i * DAY);
    const results = await Promise.all(days.map((d) => loadDay(symbol, d)));
    for (const m1 of results) {
      if (!newestM1 && m1.length) newestM1 = m1;
      scanned++;
      day -= DAY;
      const candles = aggregateBars(m1, tfSec).filter((c) => c.time < before);
      if (!candles.length) {
        emptyRun++;
        continue;
      }
      emptyRun = 0;
      chunks.push(candles);
      count += candles.length;
    }
  }

  if (before === Infinity && newestM1 && tickingNow(symbol)) learnOffset(newestM1);
  const history = chunks.reverse().flat().slice(-limit);
  return { history, hasMore: emptyRun < EMPTY_DAYS_STOP };
}

// ── Validation ──

const symbolField = z.string().min(1).max(32);
const volumeField = z.number().positive().max(1000);
const levelField = z.number().nonnegative().default(0); // SL / TP, 0 = none
const commentField = z.string().max(31).optional();
const ticketField = z.number().int().positive();

const MarketOrder = z.object({
  symbol: symbolField,
  side: z.enum(['BUY', 'SELL']),
  volume: volumeField,
  stopLoss: levelField,
  takeProfit: levelField,
  comment: commentField,
});
const PendingOrder = z.object({
  symbol: symbolField,
  orderType: z.enum(['BUY_LIMIT', 'SELL_LIMIT', 'BUY_STOP', 'SELL_STOP']),
  volume: volumeField,
  price: z.number().positive(),
  stopLoss: levelField,
  takeProfit: levelField,
  comment: commentField,
});
const ClosePosition = z.object({ ticket: ticketField, volume: volumeField.optional() });
const CancelOrder = z.object({ ticket: ticketField });
const ReplaceOrder = z.object({ ticket: ticketField, price: z.number().positive(), stopLoss: levelField, takeProfit: levelField });
// Omitted = leave unchanged, 0 = remove the level
const ModifyPosition = z.object({ ticket: ticketField, stopLoss: z.number().nonnegative().optional(), takeProfit: z.number().nonnegative().optional() })
  .refine((o) => o.stopLoss !== undefined || o.takeProfit !== undefined, 'Provide stopLoss and/or takeProfit');
const HistoryDays = z.coerce.number().int().min(1).max(90);

// ponytail: bridge truncates (ulong)(volume*10000) — 0.57 becomes 0.5699. Remove once the bridge uses Math.Round.
const lots = (v: number) => v + 1e-9;

// ── Routes ──

const router = Router();
router.use(requireAuth);

type Handler = (req: Request) => Promise<unknown>;
const h = (fn: Handler) => async (req: Request, res: Response) => {
  const timing = { ms: 0 };
  // Server-Timing shows in DevTools → Network → Timing; trade POSTs are also logged
  const send = (status: number, body: unknown) => {
    const total = performance.now() - (res.locals.t0 ?? performance.now());
    const node = total - timing.ms;
    res.setHeader('Server-Timing', `node;dur=${node.toFixed(1)}, bridge;dur=${timing.ms.toFixed(1)}`);
    if (req.method === 'POST') {
      console.log(`[MT5] ${req.user?.mt5Login} POST ${req.path} ${status} — total ${total.toFixed(0)}ms (bridge ${timing.ms.toFixed(0)}ms, node ${node.toFixed(0)}ms)`);
    }
    res.status(status).json(body);
  };
  try {
    send(200, await bridgeTime.run(timing, () => fn(req)));
  } catch (err) {
    if (err instanceof HttpError) {
      send(err.status, { ...err.body, error: err.message });
    } else if (err instanceof z.ZodError) {
      const issue = err.issues[0];
      send(400, { error: issue ? `${issue.path.join('.') || 'body'}: ${issue.message}` : 'Invalid request' });
    } else {
      console.error('[MT5]', (err as Error)?.message);
      send(500, { error: 'Internal error' });
    }
  }
};

// Every bridge call uses the login from the verified JWT — never from the request.
router.get('/symbols', h(async (req) => ({ symbols: await allowedSymbols(req.user!.mt5Login) })));

router.get('/quotes', h(async (req) => {
  interface Tick { symbol: string; bid: number; ask: number; last: number }
  const allowed = new Set((await allowedSymbols(req.user!.mt5Login)).map((s) => s.symbol));
  const symbols = String(req.query.symbols ?? '').split(',').filter((s) => allowed.has(s)).slice(0, 30);
  const quotes: Tick[] = [];
  // Fallback only — clients use the realtime FIX feed (ws-server.ts) while it's live.
  // Polled 5 at a time to respect the MT5 bridge's 20 req/s per-IP limit.
  for (let i = 0; i < symbols.length; i += 5) {
    const batch = await Promise.all(symbols.slice(i, i + 5).map((s) =>
      cached(`tick:${s}`, 2_000, () => bridge<Tick>(`/api/market/tick/${encodeURIComponent(s)}`)).catch(() => null)));
    // Bridge answers unknown/idle symbols with zeros instead of 404
    quotes.push(...batch.filter((q): q is Tick => !!q && (q.bid > 0 || q.ask > 0)));
  }
  return { quotes };
}));

router.get('/chart/:symbol', h(async (req) => {
  const symbol = String(req.params.symbol);
  const tf = (Object.hasOwn(TIMEFRAMES, String(req.query.tf)) ? req.query.tf : 'M5') as Timeframe;
  const limit = Math.min(Math.max(Number(req.query.limit) || 300, 1), 1000);
  const before = Number(req.query.before) > 0 ? Number(req.query.before) : Infinity; // server-time epoch
  await requireSymbol(req.user!.mt5Login, symbol);
  const page = await chartPage(symbol, TIMEFRAMES[tf], before, limit);
  // offset lets the client bucket live (UTC) ticks into server-time candles
  return { symbol, tf, offset: serverOffset, ...page };
}));

router.get('/positions', h((req) => bridge(`/api/trade/positions/${req.user!.mt5Login}`)));
router.get('/orders', h((req) => bridge(`/api/trade/orders/${req.user!.mt5Login}`)));

// Executed deals over the last `days`. Deal times and from/to are MT5 server time, like chart bars.
// ponytail: until serverOffset is learned (first live chart load) the fallback shifts the window up to 11h late
router.get('/history/deals', h((req) => {
  const login = req.user!.mt5Login;
  const days = HistoryDays.parse(req.query.days ?? 7);
  const to = latestServerTime() + 60;
  return cached(`deals:${login}:${days}`, 5_000, () => bridge(`/api/trade/history/deals/${login}?from=${to - days * DAY}&to=${to}`));
}));

// Trade calls are never retried: a 422 "not created in 8s" can still mean the order filled.
router.post('/market-order', requireTrader, h(async (req) => {
  const o = MarketOrder.parse(req.body);
  const login = req.user!.mt5Login;
  await requireSymbol(login, o.symbol, o.side === 'BUY');
  console.log(`[MT5] ${login} market ${o.side} ${o.volume} ${o.symbol}`);
  return bridge('/api/trade/market-order', { ...o, login, volume: lots(o.volume) });
}));

router.post('/pending-order', requireTrader, h(async (req) => {
  const o = PendingOrder.parse(req.body);
  const login = req.user!.mt5Login;
  await requireSymbol(login, o.symbol, o.orderType.startsWith('BUY'));
  console.log(`[MT5] ${login} pending ${o.orderType} ${o.volume} ${o.symbol} @ ${o.price}`);
  return bridge('/api/trade/pending-order', { ...o, login, volume: lots(o.volume) });
}));

router.post('/close-position', requireTrader, h(async (req) => {
  const { ticket, volume } = ClosePosition.parse(req.body);
  const login = req.user!.mt5Login;
  console.log(`[MT5] ${login} close #${ticket}${volume ? ` ${volume}` : ''}`);
  // Bridge verifies the position belongs to this login
  return bridge('/api/trade/close-position', { login, ticket, volume: volume === undefined ? null : lots(volume) });
}));

router.post('/modify-position', requireTrader, h(async (req) => {
  const o = ModifyPosition.parse(req.body);
  const login = req.user!.mt5Login;
  console.log(`[MT5] ${login} modify #${o.ticket} SL ${o.stopLoss ?? '='} TP ${o.takeProfit ?? '='}`);
  // Bridge verifies the position belongs to this login; an omitted level is left unchanged
  return bridge('/api/trade/modify-position', { login, ...o });
}));

router.post('/cancel-order', requireTrader, h(async (req) => {
  const { ticket } = CancelOrder.parse(req.body);
  const login = req.user!.mt5Login;
  // Bridge cancels by ticket alone — confirm the order is this account's first
  const { orders } = await bridge<{ orders?: { ticket: number }[] }>(`/api/trade/orders/${login}`);
  if (!orders?.some((o) => o.ticket === ticket)) throw new HttpError(404, `Order #${ticket} not found`);
  console.log(`[MT5] ${login} cancel #${ticket}`);
  return bridge('/api/trade/cancel-order', { login, ticket });
}));

// ponytail: bridge has no order-modify — cancel + re-place (new ticket, not atomic). Swap for a bridge modify call when one exists.
// Cancel first: a failed re-place loses the order, the other way round could leave two live orders.
router.post('/replace-order', requireTrader, h(async (req) => {
  const { ticket, ...levels } = ReplaceOrder.parse(req.body);
  const login = req.user!.mt5Login;
  const { orders } = await bridge<{ orders?: { ticket: number; symbol: string; type: string; volume: number }[] }>(`/api/trade/orders/${login}`);
  const o = orders?.find((x) => x.ticket === ticket);
  if (!o) throw new HttpError(404, `Order #${ticket} not found`);
  const orderType = PendingOrder.shape.orderType.parse(o.type);
  await requireSymbol(login, o.symbol, orderType.startsWith('BUY'));
  console.log(`[MT5] ${login} replace #${ticket} ${orderType} ${o.volume} ${o.symbol} @ ${levels.price}`);
  await bridge('/api/trade/cancel-order', { login, ticket });
  try {
    return await bridge('/api/trade/pending-order', { login, symbol: o.symbol, orderType, volume: lots(o.volume), ...levels });
  } catch (err) {
    const e = err instanceof HttpError ? err : new HttpError(500, 'Internal error');
    throw new HttpError(e.status, `Order #${ticket} was cancelled but the new order failed: ${e.message}`, e.body);
  }
}));

export default router;
