import { useEffect, useMemo } from 'react';
import { create } from 'zustand';
import { useQuery, useInfiniteQuery, useMutation, useQueryClient, keepPreviousData, type QueryClient } from '@tanstack/react-query';
import { api } from '../client';
import { useAuthStore } from '../../stores/use-auth-store';
import { sendWs } from '../../realtime/socket';
import { applyPosition, applyOrder, applyDeal, pnlRate } from '../../lib/trade-events';

export interface Mt5Symbol { symbol: string; tradeMode: 'TRADE_FULL' | 'TRADE_LONGONLY' | 'TRADE_SHORTONLY' | 'TRADE_CLOSEONLY' | string }
export interface Mt5Quote { symbol: string; bid: number; ask: number; ts?: number } // ts (epoch ms) only on live FIX quotes
export interface Mt5Candle { time: number; open: number; high: number; low: number; close: number; volume: number }
export interface Mt5Position {
  ticket: number; symbol: string; side: 'BUY' | 'SELL'; volume: number; openPrice: number; currentPrice: number;
  stopLoss: number; takeProfit: number; profit: number; swap: number; openTime: string;
}
export interface Mt5Order {
  ticket: number; symbol: string; type: string; volume: number; price: number;
  stopLoss: number; takeProfit: number; setupTime: string;
}
/** An executed trade. `time` is MT5 server time labelled as UTC, like positions' openTime. */
export interface Mt5Deal {
  ticket: number; orderTicket: number; positionId: number; symbol: string; action: 'BUY' | 'SELL';
  entry: 'IN' | 'OUT' | 'INOUT' | 'OUT_BY' | string; volume: number; price: number;
  profit: number; commission: number; swap: number; fee: number; time: string; comment: string;
}
export interface Mt5TradeResult { success: boolean; orderTicket: number; dealTicket: number; price: number; retcode: number; message: string }

// Server folds bridge M1 bars into these (bridge has no timeframe param). D1 waits on bridge-side aggregation.
export const TF_SECONDS = { M1: 60, M3: 180, M5: 300, M15: 900, M30: 1800, H1: 3600, H4: 14_400 } as const;
export type Mt5Timeframe = keyof typeof TF_SECONDS;
interface Mt5ChartPage { history: Mt5Candle[]; hasMore: boolean; offset: number | null }
export type Mt5PendingType = 'BUY_LIMIT' | 'SELL_LIMIT' | 'BUY_STOP' | 'SELL_STOP';

const useLoggedIn = () => !!useAuthStore((s) => s.user);

// Prices stream from the FXCubic FIX feed; positions / orders / deals from the bridge's trade hub (both via /ws).
// REST fetches on mount and after a stream gap; polling only runs while a stream is down. The chart is still polled.

export function useMt5Symbols() {
  return useQuery({
    queryKey: ['mt5', 'symbols'],
    queryFn: () => api.get<{ symbols: Mt5Symbol[] }>('/mt5/symbols').then((d) => d.symbols),
    enabled: useLoggedIn(),
    staleTime: 60_000,
  });
}

// ── Realtime quotes ──
// The server relays the FXCubic FIX feed over /ws; use-ws.ts writes batches into this store.

/** `live`: FIX price feed up. `trades`: bridge trade-event stream up for this account (positions / orders / deals). */
export const useMt5Live = create<{ quotes: Record<string, Mt5Quote>; live: boolean; trades: boolean }>(
  () => ({ quotes: {}, live: false, trades: false }),
);

// How many mounted components want each symbol; the server is only told on 0→1 and 1→0
const wanted = new Map<string, number>();
export const wantedMt5Symbols = () => [...wanted.keys()];

function acquire(symbols: string[]) {
  const fresh = symbols.filter((s) => {
    const n = wanted.get(s) ?? 0;
    wanted.set(s, n + 1);
    return n === 0;
  });
  if (fresh.length) sendWs({ type: 'mt5-subscribe', symbols: fresh });
}

function release(symbols: string[]) {
  const gone = symbols.filter((s) => {
    const n = (wanted.get(s) ?? 1) - 1;
    if (n > 0) wanted.set(s, n);
    else wanted.delete(s);
    return n <= 0;
  });
  if (gone.length) sendWs({ type: 'mt5-unsubscribe', symbols: gone });
}

/** Live bid/ask keyed by symbol. Falls back to REST polling of the MT5 bridge while the FIX feed is down. */
export function useMt5Quotes(symbols: string[]) {
  const key = symbols.join(',');
  const loggedIn = useLoggedIn();
  const live = useMt5Live((s) => s.live);
  const liveQuotes = useMt5Live((s) => s.quotes);

  useEffect(() => {
    if (!loggedIn || !key) return;
    const list = key.split(',');
    acquire(list);
    return () => release(list);
  }, [key, loggedIn]);

  const fallback = useQuery({
    queryKey: ['mt5', 'quotes', key],
    queryFn: () => api.get<{ quotes: Mt5Quote[] }>(`/mt5/quotes?symbols=${encodeURIComponent(key)}`)
      .then((d) => Object.fromEntries(d.quotes.map((q) => [q.symbol, q])) as Record<string, Mt5Quote>),
    enabled: loggedIn && !!key && !live,
    refetchInterval: 3_000,
    placeholderData: keepPreviousData,
  });

  return { data: live ? liveQuotes : fallback.data };
}

/** Candles in pages: the latest page first, then older ones on demand (`fetchOlder`) as the chart scrolls back. */
export function useMt5Chart(symbol: string, tf: Mt5Timeframe) {
  const q = useInfiniteQuery({
    queryKey: ['mt5', 'chart', symbol, tf],
    queryFn: ({ pageParam }) => api.get<Mt5ChartPage>(
      `/mt5/chart/${encodeURIComponent(symbol)}?tf=${tf}${pageParam ? `&before=${pageParam}` : ''}`,
    ),
    initialPageParam: 0, // 0 = latest; later pages pass the oldest candle time we have (server time)
    getNextPageParam: (last) => (last.hasMore && last.history.length ? last.history[0].time : undefined),
    enabled: useLoggedIn() && !!symbol,
    // Live ticks extend the chart between refetches; older pages are served from the server's day-chunk cache
    refetchInterval: 60_000,
  });
  const pages = q.data?.pages;
  const data = useMemo(() => (pages ? { history: [...pages].reverse().flatMap((p) => p.history) } : undefined), [pages]);
  return {
    data,
    offset: pages?.[0]?.offset ?? null,
    isLoading: q.isLoading,
    error: q.error,
    hasMore: q.hasNextPage,
    // A drag fires range events continuously; don't restart an in-flight page (the default cancels it)
    fetchOlder: () => { q.fetchNextPage({ cancelRefetch: false }); },
    isFetchingOlder: q.isFetchingNextPage,
  };
}

/**
 * Events keep this current. It's still re-fetched because no event fires on price moves and floating P&L is
 * priced from the snapshot: every 5s until a new position can be priced (pnlRate), then every 60s to recalibrate
 * cross-pair P&L and swap. Every 5s while the event stream is down.
 */
export function useMt5Positions() {
  const trades = useMt5Live((s) => s.trades);
  return useQuery({
    queryKey: ['mt5', 'positions'],
    queryFn: () => api.get<{ positions: Mt5Position[] }>('/mt5/positions').then((d) => d.positions ?? []),
    enabled: useLoggedIn(),
    refetchInterval: (q) => (!trades || q.state.data?.some((p) => pnlRate(p) === null) ? 5_000 : 60_000),
  });
}

/** Pending orders — events keep this current; polled only while the event stream is down. */
export function useMt5Orders() {
  const trades = useMt5Live((s) => s.trades);
  return useQuery({
    queryKey: ['mt5', 'orders'],
    queryFn: () => api.get<{ orders: Mt5Order[] }>('/mt5/orders').then((d) => d.orders ?? []),
    enabled: useLoggedIn(),
    refetchInterval: trades ? false : 5_000,
  });
}

/** Deals over the last `days` — events keep this current; polled only while the event stream is down. */
export function useMt5Deals(days: number) {
  const trades = useMt5Live((s) => s.trades);
  return useQuery({
    queryKey: ['mt5', 'deals', days],
    queryFn: () => api.get<{ deals: Mt5Deal[] }>(`/mt5/history/deals?days=${days}`).then((d) => d.deals ?? []),
    enabled: useLoggedIn(),
    refetchInterval: trades ? false : 15_000,
    placeholderData: keepPreviousData,
  });
}

/**
 * Fold one bridge trade event into the cached lists. Only lists something already fetched are touched —
 * the updater returns undefined otherwise, which leaves the cache without an entry nobody is watching.
 */
export function applyTradeEvent(qc: QueryClient, { event, data }: { event: string; data: any }) {
  if (event.startsWith('Position')) qc.setQueryData<Mt5Position[]>(['mt5', 'positions'], (l) => l && applyPosition(l, event, data));
  else if (event.startsWith('Order')) qc.setQueryData<Mt5Order[]>(['mt5', 'orders'], (l) => l && applyOrder(l, event, data));
  else if (event.startsWith('Deal')) qc.setQueriesData<Mt5Deal[]>({ queryKey: ['mt5', 'deals'] }, (l) => l && applyDeal(l, event, data));
}

/** Events aren't replayed after a gap — re-fetch the snapshots, then events resume on top. */
export function resyncTrades(qc: QueryClient) {
  for (const k of ['positions', 'orders', 'deals']) qc.invalidateQueries({ queryKey: ['mt5', k] });
}

/** One mutation per bridge trade call; always refreshes positions + orders + deals (a failed call may still have filled). */
function useMt5Trade<T>(path: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: T) => api.post<Mt5TradeResult>(`/mt5/${path}`, body),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['mt5', 'positions'] });
      qc.invalidateQueries({ queryKey: ['mt5', 'orders'] });
      qc.invalidateQueries({ queryKey: ['mt5', 'deals'] });
    },
  });
}

interface OrderBase { symbol: string; volume: number; stopLoss?: number; takeProfit?: number; comment?: string }
export const useMt5MarketOrder = () => useMt5Trade<OrderBase & { side: 'BUY' | 'SELL' }>('market-order');
export const useMt5PendingOrder = () => useMt5Trade<OrderBase & { orderType: Mt5PendingType; price: number }>('pending-order');
export const useMt5ClosePosition = () => useMt5Trade<{ ticket: number; volume?: number }>('close-position');
export const useMt5CancelOrder = () => useMt5Trade<{ ticket: number }>('cancel-order');
/** Position SL/TP: an omitted level is left unchanged, 0 removes it. */
export const useMt5ModifyPosition = () => useMt5Trade<{ ticket: number; stopLoss?: number; takeProfit?: number }>('modify-position');
/** Cancel + re-place (bridge has no modify) — the order comes back under a new ticket. */
export const useMt5ReplaceOrder = () => useMt5Trade<{ ticket: number; price: number; stopLoss: number; takeProfit: number }>('replace-order');
