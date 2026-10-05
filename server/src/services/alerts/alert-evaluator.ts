import { prisma } from '../../lib/prisma.js';
import * as feed from '../market-feed.js';
import { sendToLogin } from '../websocket/ws-server.js';
import { checkAlert } from './alert-types.js';

/**
 * Evaluates enabled price alerts on every MT5 tick from the FIX feed (market-feed.ts).
 * Alert symbols stay subscribed upstream even when no browser has them open.
 * Alerts are one-shot: firing disables them; the user re-arms with the toggle.
 */

interface LiveAlert { id: number; name: string; type: string; symbol: string; condition: any; login: number }

const STALE_MS = 60_000; // bridge replays its cached snapshot on subscribe — can be weeks old, never fire on it

let bySymbol = new Map<string, LiveAlert[]>();
const subscribed = new Set<string>();
let syncing: Promise<void> = Promise.resolve();

async function load() {
  const rows = await prisma.alert.findMany({
    where: { enabled: true, symbol: { not: null }, type: { in: ['price_cross', 'price_change_pct'] } },
    include: { user: { select: { mt5Login: true } } },
  });
  const next = new Map<string, LiveAlert[]>();
  for (const r of rows) {
    const login = Number(r.user?.mt5Login);
    if (!login) continue;
    let condition: any;
    try {
      condition = JSON.parse(r.condition);
    } catch {
      continue;
    }
    const list = next.get(r.symbol!) ?? [];
    list.push({ id: r.id, name: r.name, type: r.type, symbol: r.symbol!, condition, login });
    next.set(r.symbol!, list);
  }
  for (const s of next.keys()) if (!subscribed.has(s)) { subscribed.add(s); feed.acquire(s); }
  for (const s of subscribed) if (!next.has(s)) { subscribed.delete(s); feed.release(s); }
  bySymbol = next;
}

/** Reload enabled alerts from the DB. Call after any alert write. Never rejects. */
// ponytail: full reload per change — fine for hundreds of alerts; go incremental if it grows
export function syncAlerts(): Promise<void> {
  return (syncing = syncing
    .then(load) // serialized: overlapping reloads would double-acquire feed symbols
    .catch((err) => console.error('[AlertEvaluator] sync failed:', err instanceof Error ? err.message : err)));
}

async function fire(a: LiveAlert, message: string, bid: number) {
  // Drop from memory now so the next tick can't fire it again before the DB write lands
  bySymbol.set(a.symbol, (bySymbol.get(a.symbol) ?? []).filter((x) => x.id !== a.id));
  try {
    // Compare-and-set on `enabled` so a concurrent reload/tick can't record the same trigger twice
    const trigger = await prisma.$transaction(async (tx) => {
      const { count } = await tx.alert.updateMany({ where: { id: a.id, enabled: true }, data: { enabled: false } });
      return count ? tx.alertTrigger.create({ data: { alertId: a.id, message, value: String(bid) } }) : null;
    });
    if (!trigger) return;
    sendToLogin(a.login, 'alert-triggered', {
      alertId: a.id,
      alertName: a.name,
      type: a.type,
      symbol: a.symbol,
      message,
      value: String(bid),
      triggeredAt: trigger.createdAt,
    });
    console.log(`[AlertEvaluator] Alert triggered: ${a.name} - ${message}`);
  } catch (err) {
    console.error(`[AlertEvaluator] Error firing alert ${a.id}:`, err instanceof Error ? err.message : err);
  } finally {
    syncAlerts(); // releases the feed symbol if this was its last alert
  }
}

function onQuote(q: feed.Quote) {
  const list = bySymbol.get(q.symbol);
  if (!list?.length || Date.now() - q.ts > STALE_MS) return;
  for (const a of list) {
    const message = checkAlert(a.type, a.condition, a.symbol, q.bid);
    if (message) fire(a, message, q.bid);
  }
}

export function startAlertEvaluator() {
  feed.quoteListeners.add(onQuote);
  syncAlerts();
}
