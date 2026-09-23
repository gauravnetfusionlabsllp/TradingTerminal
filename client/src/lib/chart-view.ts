// Keep a lightweight-charts view in place across setData. Pure (no imports) so scripts/check-chart.mts can assert it.

export interface Range { from: number; to: number } // logical (bar-index) range, as getVisibleLogicalRange returns

/**
 * The range to restore after replacing `prevN` bars with `n` bars, `appended` of them new on the right.
 * Measured from the right edge, so older pages prepended on the left never move the view. At the live edge
 * (right edge at or past the newest bar) the view follows new bars; scrolled back, it stays on its bars.
 */
export function keepView(prev: Range, prevN: number, n: number, appended: number): Range {
  const fromRight = prevN - 1 - prev.to;
  const width = prev.to - prev.from;
  const fr = fromRight > 0.5 ? fromRight + appended : fromRight;
  return { from: n - 1 - fr - width, to: n - 1 - fr };
}
