// Live quote batches → store writes. Pure (no imports) so scripts/check-quote-throttle.mts can assert it.

/**
 * Leading-edge throttle keyed by symbol: a batch is written at once if the last write was ≥ getMs() ago, otherwise it's
 * merged (latest quote per symbol wins) and written when the window closes. getMs() ≤ 0 = off, every batch written.
 */
export function createQuoteThrottle<Q extends { symbol: string }>(
  apply: (quotes: Record<string, Q>) => void,
  getMs: () => number,
) {
  let pending: Record<string, Q> | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let last = -Infinity;

  function flush() {
    clearTimeout(timer);
    timer = undefined;
    last = performance.now();
    const q = pending;
    pending = null;
    if (q) apply(q);
  }

  return (batch: Q[]) => {
    pending ??= {};
    for (const q of batch) pending[q.symbol] = q;
    const wait = last + getMs() - performance.now();
    if (wait <= 0) flush();
    else timer ??= setTimeout(flush, wait);
  };
}
