// On-chart trading rules. Pure (type-only imports) so scripts/check-chart.mts can assert it.
import type { Mt5PendingType } from '../api/hooks/use-mt5';

type Side = 'BUY' | 'SELL';

/** Round a clicked / dragged price to the symbol's decimals. */
export const snap = (price: number, precision: number) => +price.toFixed(precision);

/** Pending types valid at `price`: one BUY and one SELL (limits sit on the favourable side of the market, stops beyond it). */
export function pendingTypesAt(price: number, bid: number, ask: number): Mt5PendingType[] {
  const out: Mt5PendingType[] = [];
  if (price < ask) out.push('BUY_LIMIT');
  if (price > ask) out.push('BUY_STOP');
  if (price > bid) out.push('SELL_LIMIT');
  if (price < bid) out.push('SELL_STOP');
  return out;
}

/** Which level a price becomes for a trade on `side` around `ref`: below a BUY is its SL, above a SELL is its SL. */
export const levelSide = (side: Side, ref: number, price: number): 'sl' | 'tp' =>
  (side === 'BUY' ? price < ref : price > ref) ? 'sl' : 'tp';

/**
 * SL / TP must bracket `ref` (bid for a market BUY, ask for a market SELL, the order price for a pending order).
 * 0 = not set. The broker's stops level is still enforced server-side.
 */
export function levelsError(side: Side, ref: number, sl: number, tp: number): string | null {
  const buy = side === 'BUY';
  if (sl && (buy ? sl >= ref : sl <= ref)) return `SL must be ${buy ? 'below' : 'above'} ${ref}`;
  if (tp && (buy ? tp <= ref : tp >= ref)) return `TP must be ${buy ? 'above' : 'below'} ${ref}`;
  return null;
}
