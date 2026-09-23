// Live FIX ticks → candles. Pure (no imports) so scripts/check-live-candles.mts can assert it.
// Bars and buckets share one clock: real UTC seconds (MT5 server-time bar opens minus the server offset).

export interface Bar { timestamp: number; open: number; high: number; low: number; close: number; volume: number }

/**
 * Candle start for a live tick. `undefined` = ignore it (REST fallback quotes carry no `ts`, and the bridge replays
 * possibly weeks-old snapshots on subscribe); `null` = server offset still unknown, so just update the newest bar.
 */
export function tickBucket(tsMs: number | undefined, offset: number | null, tfSec: number, nowMs: number) {
  if (!tsMs || nowMs - tsMs > 60_000) return undefined;
  if (offset == null) return null;
  return Math.floor((tsMs / 1000 + offset) / tfSec) * tfSec - offset;
}

/** Fold one bid into the live tail (bars at or after the newest fetched bar); rolls a new bar on a later bucket. */
export function foldTick(tail: Bar[], lastBase: Bar, bid: number, bucket: number | null): Bar[] {
  const live = tail.filter((b) => b.timestamp >= lastBase.timestamp);
  const cur = live[live.length - 1] ?? lastBase;
  const t = bucket ?? cur.timestamp;
  if (t < cur.timestamp) return live;
  if (t > cur.timestamp) return [...live, { timestamp: t, open: bid, high: bid, low: bid, close: bid, volume: 0 }];
  const bar = { ...cur, high: Math.max(cur.high, bid), low: Math.min(cur.low, bid), close: bid };
  return live.length ? [...live.slice(0, -1), bar] : [bar];
}

/** Fetched bars with the live tail laid over their right edge (tail wins where they overlap). */
export function mergeLive(base: Bar[], tail: Bar[]): Bar[] {
  const lastT = base.length ? base[base.length - 1].timestamp : -Infinity;
  const live = tail.filter((b) => b.timestamp >= lastT);
  return live.length ? [...base.filter((b) => b.timestamp < live[0].timestamp), ...live] : base;
}
