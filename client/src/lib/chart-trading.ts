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

/** A pip: 10 points on 3- and 5-digit quotes (EURUSD 0.0001, USDJPY / XAUUSD 0.01), otherwise one point. */
export const pipSize = (digits: number) => 10 ** -(digits % 2 ? digits - 1 : digits);

/** Signed pips from `entry` to `level` for a trade on `side`, positive on the profit side, to 0.1. */
export const pips = (side: Side, entry: number, level: number, digits: number) =>
  Math.round((((level - entry) * (side === 'BUY' ? 1 : -1)) / pipSize(digits)) * 10) / 10;

/** The SL / TP `n` pips (a distance: sign ignored) from `entry` — TP on the profit side, SL on the loss side. */
export const levelAtPips = (side: Side, field: 'sl' | 'tp', entry: number, n: number, digits: number) =>
  snap(entry + Math.abs(n) * pipSize(digits) * ((side === 'BUY') === (field === 'tp') ? 1 : -1), digits);

/** The pending type a `side` order resting at `price` has to be; null at the market (it would just fill). */
export const pendingTypeFor = (side: Side, price: number, bid: number, ask: number): Mt5PendingType | null =>
  pendingTypesAt(price, bid, ask).find((t) => t.startsWith(side)) ?? null;

interface Draft { side: Side | null; kind: 'MARKET' | 'PENDING'; price: number }
interface Quote { bid: number; ask: number }

/** Where a draft opens: a pending one at its price, a market BUY at the ask, a SELL at the bid. 0 = unknown yet. */
export const draftEntry = (d: Draft, q?: Quote) => (d.kind === 'PENDING' ? d.price : q ? (d.side === 'SELL' ? q.bid : q.ask) : 0);

/** What a draft's SL / TP must bracket (see levelsError): its price if pending, else where it would close (BUY at bid). */
export const draftRef = (d: Draft, q?: Quote) => (d.kind === 'PENDING' ? d.price : q ? (d.side === 'SELL' ? q.ask : q.bid) : 0);

/**
 * Chips hang off one right edge at their line's y. One that would overlap a chip already placed moves left past it.
 * Returns each row's offset from the edge (0 = at the edge, growing leftwards), in input order. Top to bottom.
 */
export function stackChips(rows: { y: number; h: number; w: number }[], gap: number): number[] {
  const placed: { top: number; bottom: number; from: number; to: number }[] = [];
  const out = new Array<number>(rows.length);
  for (const i of rows.map((_, i) => i).sort((a, b) => rows[a].y - rows[b].y)) {
    const { y, h, w } = rows[i];
    const top = y - h / 2, bottom = y + h / 2;
    let x = 0;
    // x only grows, so this settles once it clears every placed chip it shares a row band with
    for (let moved = true; moved;) {
      moved = false;
      for (const p of placed) {
        if (top < p.bottom && bottom > p.top && x < p.to && x + w > p.from) { x = p.to + gap; moved = true; }
      }
    }
    placed.push({ top, bottom, from: x, to: x + w });
    out[i] = x;
  }
  return out;
}

/** −483.4 pips / +12.0 pips */
export const pipText = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(1)} pips`;

/** BUY_LIMIT → 'Buy limit', SELL → 'Sell' */
export const typeName = (t: string) => t[0] + t.slice(1).toLowerCase().replace('_', ' ');
