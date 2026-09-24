// Folds bridge trade events (relayed from its SignalR hub) into the REST snapshots React Query holds.
// Pure (type-only imports) so scripts/check-trade-events.mts can assert it.
import type { Mt5Position, Mt5Order, Mt5Deal } from '../api/hooks/use-mt5';

/**
 * Money per unit of price move, inferred from a REST snapshot (the bridge gives no contract size or FX rate).
 * null until the position has moved far enough from its open to tell — a fresh position's snapshot can't price it.
 */
export function pnlRate(p: Mt5Position): number | null {
  const move = (p.currentPrice - p.openPrice) * (p.side === 'BUY' ? 1 : -1);
  return Math.abs(move) < 1e-9 || Math.abs(p.profit) < 0.1 ? null : p.profit / move;
}

/** Replace in place (rows don't jump), append if new, or remove. Returns `list` itself when nothing changes. */
function byTicket<T extends { ticket: number }>(list: T[], item: T, keep: boolean): T[] {
  const i = list.findIndex((x) => x.ticket === item.ticket);
  if (!keep) return i < 0 ? list : list.filter((_, j) => j !== i);
  if (i < 0) return [...list, item];
  const next = list.slice();
  next[i] = item;
  return next;
}

export const applyPosition = (list: Mt5Position[], event: string, p: Mt5Position) =>
  byTicket(list, p, event !== 'PositionDeleted');

const PENDING = new Set(['BUY_LIMIT', 'SELL_LIMIT', 'BUY_STOP', 'SELL_STOP']);
const DONE = new Set(['CANCELED', 'FILLED', 'REJECTED', 'EXPIRED']);

/**
 * The pending-orders list. Market orders pass through the order system too (STARTED → FILLED in milliseconds),
 * so only pending types are kept; OrderDeleted means it left the system — usually filled, not cancelled.
 */
export function applyOrder(list: Mt5Order[], event: string, o: Mt5Order & { state?: string }) {
  if (!PENDING.has(o.type)) return list;
  return byTicket(list, o, event !== 'OrderDeleted' && !DONE.has(o.state ?? ''));
}

/** Deal events carry no fee (REST history does) — default it so totals never turn NaN. Appends keep REST's ascending order. */
export const applyDeal = (list: Mt5Deal[], event: string, d: Mt5Deal) =>
  byTicket(list, { ...d, fee: d.fee ?? 0 }, event !== 'DealDeleted');
