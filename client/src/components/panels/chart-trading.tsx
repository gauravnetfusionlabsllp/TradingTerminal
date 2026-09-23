import { useEffect, useMemo, useRef, useState } from 'react';
import { LineStyle, type IChartApi, type ISeriesApi, type SeriesType } from 'lightweight-charts';
import {
  useMt5Positions, useMt5Orders, useMt5Quotes,
  useMt5MarketOrder, useMt5PendingOrder, useMt5ClosePosition, useMt5CancelOrder, useMt5ReplaceOrder,
  type Mt5Order, type Mt5Position, type Mt5PendingType,
} from '../../api/hooks/use-mt5';
import { useAppStore } from '../../stores/use-app-store';
import { fmtPrice, liveProfit } from '../trading/mt5-trading';
import { snap, pendingTypesAt, levelSide, levelsError } from '../../lib/chart-trading';

type Side = 'BUY' | 'SELL';
type Field = 'entry' | 'sl' | 'tp';

/** One horizontal level drawn on the chart. Drafts (SL/TP for the next order) have neither `pos` nor `ord`. */
interface Level {
  id: string;
  price: number;
  field: Field;
  title: string;
  color: string;
  style: LineStyle;
  drag: boolean;
  pos?: Mt5Position;
  ord?: Mt5Order;
}

interface Props {
  chart: IChartApi;
  series: ISeriesApi<SeriesType>;
  el: HTMLDivElement;
  symbol: string;
  precision: number;
  readOnly: boolean;
  lots: string;
  setLots: (v: string) => void;
}

const WHITE = '#e4e4e7', AMBER = '#f59e0b', RED = '#ef4444', GREEN = '#22c55e';
const HIT_PX = 5;
const LEVEL_KEY = { entry: 'price', sl: 'stopLoss', tp: 'takeProfit' } as const;
const sideOf = (o: Mt5Order): Side => (o.type.startsWith('BUY') ? 'BUY' : 'SELL');
const errMsg = (err: unknown) => (err instanceof Error ? err.message : 'Failed');

/**
 * One-click trading on the price pane: trade bar, right-click menus, draggable pending-order / SL / TP lines.
 * Open positions can't be modified (bridge has no modify call) — their lines are view-only, closable from the menu.
 */
export function ChartTrading({ chart, series, el, symbol, precision, readOnly, lots, setLots }: Props) {
  const addLogEntry = useAppStore((s) => s.addLogEntry);
  const { data: positions } = useMt5Positions();
  const { data: orders } = useMt5Orders();
  const { data: quotes } = useMt5Quotes([symbol]);
  const quote = quotes?.[symbol];
  const marketOrder = useMt5MarketOrder();
  const pendingOrder = useMt5PendingOrder();
  const closePosition = useMt5ClosePosition();
  const cancelOrder = useMt5CancelOrder();
  const replaceOrder = useMt5ReplaceOrder();
  const busy = [marketOrder, pendingOrder, closePosition, cancelOrder, replaceOrder].some((m) => m.isPending);

  const [drafts, setDrafts] = useState<{ sl?: number; tp?: number }>({});
  const [drag, setDrag] = useState<{ id: string; price: number } | null>(null);
  // A committed drag keeps showing until the orders refetch brings the replacement in (no flash back to the old price)
  const [held, setHeld] = useState<{ id: string; price: number } | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; price: number; line?: Level } | null>(null);
  const [error, setError] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setHeld(null), [orders]);

  const myPositions = useMemo(() => (positions ?? []).filter((p) => p.symbol === symbol), [positions, symbol]);
  const myOrders = useMemo(() => (orders ?? []).filter((o) => o.symbol === symbol), [orders, symbol]);

  const shown = useMemo(() => {
    const out: Level[] = [];
    const stops = (id: string, sl: number, tp: number, drag: boolean, owner: Pick<Level, 'pos' | 'ord'>, tag: string) => {
      if (sl) out.push({ id: `${id}:sl`, price: sl, field: 'sl', title: `SL ${tag}`, color: RED, style: LineStyle.Dashed, drag, ...owner });
      if (tp) out.push({ id: `${id}:tp`, price: tp, field: 'tp', title: `TP ${tag}`, color: GREEN, style: LineStyle.Dashed, drag, ...owner });
    };
    for (const p of myPositions) {
      const pnl = quote ? liveProfit(p, p.side === 'BUY' ? quote.bid : quote.ask) : p.profit;
      out.push({
        id: `p${p.ticket}`, price: p.openPrice, field: 'entry', color: WHITE, style: LineStyle.Solid, drag: false, pos: p,
        title: `${p.side} ${p.volume} ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}`,
      });
      stops(`p${p.ticket}`, p.stopLoss, p.takeProfit, false, { pos: p }, `#${p.ticket}`);
    }
    for (const o of myOrders) {
      out.push({
        id: `o${o.ticket}`, price: o.price, field: 'entry', color: AMBER, style: LineStyle.Solid, drag: !readOnly, ord: o,
        title: `${o.type.replace('_', ' ')} ${o.volume} #${o.ticket}`,
      });
      stops(`o${o.ticket}`, o.stopLoss, o.takeProfit, !readOnly, { ord: o }, `#${o.ticket}`);
    }
    if (drafts.sl) out.push({ id: 'd:sl', price: drafts.sl, field: 'sl', title: 'SL next order', color: RED, style: LineStyle.Dotted, drag: true });
    if (drafts.tp) out.push({ id: 'd:tp', price: drafts.tp, field: 'tp', title: 'TP next order', color: GREEN, style: LineStyle.Dotted, drag: true });
    return out.map((l) => (l.id === drag?.id ? { ...l, price: drag.price } : l.id === held?.id ? { ...l, price: held.price } : l));
  }, [myPositions, myOrders, quote, drafts, drag, held, readOnly]);

  // Price lines sit on the visible main series (a hidden series draws none)
  useEffect(() => {
    const lines = shown.map((l) => series.createPriceLine({
      price: l.price, color: l.color, lineWidth: 1, lineStyle: l.style, axisLabelVisible: true, title: l.title,
    }));
    // On unmount the parent may already have removed the chart
    return () => lines.forEach((pl) => { try { series.removePriceLine(pl); } catch { /* chart gone */ } });
  }, [series, shown]);

  const run = async (desc: string, fn: () => Promise<unknown>) => {
    setError('');
    try {
      await fn();
      addLogEntry({ type: 'trade', message: `[MT5] ${desc}` });
      return true;
    } catch (err) {
      // Never auto-retry: a timeout can still mean it went through — positions/orders refresh on settle
      setError(errMsg(err));
      setHeld(null);
      return false;
    }
  };

  const volume = () => {
    const v = Number(lots);
    if (!(v > 0)) setError('Enter a lot size');
    return v > 0 ? v : 0;
  };

  const market = async (side: Side) => {
    const v = volume();
    if (!v || !quote) return;
    const { sl = 0, tp = 0 } = drafts;
    const bad = levelsError(side, side === 'BUY' ? quote.bid : quote.ask, sl, tp);
    if (bad) return setError(bad);
    if (await run(`${side} ${v} ${symbol} @ MKT`, () => marketOrder.mutateAsync({ symbol, side, volume: v, stopLoss: sl, takeProfit: tp }))) setDrafts({});
  };

  const pending = async (orderType: Mt5PendingType, price: number) => {
    const v = volume();
    if (!v) return;
    const { sl = 0, tp = 0 } = drafts;
    const bad = levelsError(orderType.startsWith('BUY') ? 'BUY' : 'SELL', price, sl, tp);
    if (bad) return setError(bad);
    if (await run(`${orderType} ${v} ${symbol} @ ${fmtPrice(price)}`, () =>
      pendingOrder.mutateAsync({ symbol, volume: v, orderType, price, stopLoss: sl, takeProfit: tp }))) setDrafts({});
  };

  /** Bridge has no modify: the server cancels and re-places, so the order comes back under a new ticket. */
  const replace = (o: Mt5Order, change: Partial<Record<'price' | 'stopLoss' | 'takeProfit', number>>, hold?: { id: string; price: number }) => {
    const next = { price: o.price, stopLoss: o.stopLoss, takeProfit: o.takeProfit, ...change };
    if (quote && !pendingTypesAt(next.price, quote.bid, quote.ask).includes(o.type as Mt5PendingType)) {
      return setError(`${o.type.replace('_', ' ')} can't sit at ${fmtPrice(next.price)} with the market at ${fmtPrice(quote.bid)} / ${fmtPrice(quote.ask)}`);
    }
    const bad = levelsError(sideOf(o), next.price, next.stopLoss, next.takeProfit);
    if (bad) return setError(bad);
    if (hold) setHeld(hold);
    const desc = `MODIFY #${o.ticket} @ ${fmtPrice(next.price)} SL ${fmtPrice(next.stopLoss)} TP ${fmtPrice(next.takeProfit)}`;
    run(desc, () => replaceOrder.mutateAsync({ ticket: o.ticket, ...next }));
  };

  const drop = (l: Level, price: number) => {
    if (l.ord) replace(l.ord, { [LEVEL_KEY[l.field]]: price }, { id: l.id, price });
    else if (l.field !== 'entry') setDrafts((d) => ({ ...d, [l.field]: price }));
  };

  // Mouse handlers live for the chart's lifetime; they read current state through this ref
  const live = useRef({ shown, blocked: busy || readOnly, precision, drop });
  live.current = { shown, blocked: busy || readOnly, precision, drop };

  useEffect(() => {
    let grab = false;
    let start: { l: Level; y: number } | null = null;
    const yOf = (e: MouseEvent) => e.clientY - el.getBoundingClientRect().top;
    const priceAt = (y: number) => {
      const p = series.coordinateToPrice(y);
      return p == null ? null : snap(p, live.current.precision);
    };
    const hit = (y: number) => {
      let best: Level | undefined;
      let bestD = HIT_PX + 1;
      for (const l of live.current.shown) {
        const ly = series.priceToCoordinate(l.price);
        if (ly != null && Math.abs(ly - y) < bestD) { best = l; bestD = Math.abs(ly - y); }
      }
      return best;
    };
    const draggable = (l?: Level): l is Level => !!l?.drag && !live.current.blocked;
    // Near a draggable line the chart must not pan, or mousedown would scroll instead of grab
    const setGrab = (on: boolean) => {
      if (on === grab) return;
      grab = on;
      el.style.cursor = on ? 'ns-resize' : '';
      chart.applyOptions({ handleScroll: !on, handleScale: !on });
    };

    const onHover = (e: MouseEvent) => { if (!start) setGrab(draggable(hit(yOf(e)))); };
    const onLeave = () => { if (!start) setGrab(false); };
    const onDrag = (e: MouseEvent) => {
      const p = priceAt(yOf(e));
      if (start && p != null) setDrag({ id: start.l.id, price: p });
    };
    const onUp = (e: MouseEvent) => {
      window.removeEventListener('mousemove', onDrag);
      const s = start;
      start = null;
      setDrag(null);
      setGrab(false);
      const p = priceAt(yOf(e));
      if (s && p != null && Math.abs(yOf(e) - s.y) >= 3) live.current.drop(s.l, p);
    };
    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const l = hit(yOf(e));
      if (!draggable(l)) return;
      start = { l, y: yOf(e) };
      window.addEventListener('mousemove', onDrag);
      window.addEventListener('mouseup', onUp, { once: true });
    };
    const onMenu = (e: MouseEvent) => {
      e.preventDefault();
      if (live.current.blocked) return;
      const y = yOf(e);
      const price = priceAt(y);
      if (price == null) return;
      setMenu({ x: e.clientX - el.getBoundingClientRect().left, y, price, line: hit(y) });
    };

    el.addEventListener('mousemove', onHover);
    el.addEventListener('mouseleave', onLeave);
    el.addEventListener('mousedown', onDown);
    el.addEventListener('contextmenu', onMenu);
    return () => {
      el.removeEventListener('mousemove', onHover);
      el.removeEventListener('mouseleave', onLeave);
      el.removeEventListener('mousedown', onDown);
      el.removeEventListener('contextmenu', onMenu);
      window.removeEventListener('mousemove', onDrag);
      window.removeEventListener('mouseup', onUp);
      el.style.cursor = '';
    };
  }, [chart, series, el]);

  // Close the menu on outside click / Escape
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenu(null); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(null); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [menu]);

  const items: { label: string; onClick: () => void; danger?: boolean }[] = [];
  if (menu) {
    const { price, line: l } = menu;
    const at = fmtPrice(price);
    if (l?.pos) {
      const p = l.pos;
      items.push({ label: `Close #${p.ticket} ${p.side} ${p.volume}`, danger: true,
        onClick: () => run(`CLOSE #${p.ticket} ${symbol}`, () => closePosition.mutateAsync({ ticket: p.ticket })) });
    } else if (l?.ord) {
      const o = l.ord;
      items.push({ label: `Cancel #${o.ticket} ${o.type.replace('_', ' ')}`, danger: true,
        onClick: () => run(`CANCEL #${o.ticket} ${symbol}`, () => cancelOrder.mutateAsync({ ticket: o.ticket })) });
      if (o.stopLoss) items.push({ label: `Remove SL #${o.ticket}`, onClick: () => replace(o, { stopLoss: 0 }) });
      if (o.takeProfit) items.push({ label: `Remove TP #${o.ticket}`, onClick: () => replace(o, { takeProfit: 0 }) });
    } else if (l && l.field !== 'entry') {
      const f = l.field;
      items.push({ label: `Remove ${f.toUpperCase()} (next order)`, onClick: () => setDrafts(({ [f]: _, ...rest }) => rest) });
    } else {
      if (quote) {
        for (const t of pendingTypesAt(price, quote.bid, quote.ask)) {
          items.push({ label: `${t.replace('_', ' ')} ${lots} @ ${at}`, onClick: () => pending(t, price) });
        }
      }
      items.push({ label: `Set SL @ ${at} (next order)`, onClick: () => setDrafts((d) => ({ ...d, sl: price })) });
      items.push({ label: `Set TP @ ${at} (next order)`, onClick: () => setDrafts((d) => ({ ...d, tp: price })) });
      for (const o of myOrders) {
        const f = levelSide(sideOf(o), o.price, price);
        items.push({ label: `#${o.ticket} ${o.type.replace('_', ' ')}: ${f.toUpperCase()} → ${at}`, onClick: () => replace(o, { [LEVEL_KEY[f]]: price }) });
      }
    }
  }

  const btn = 'px-2 py-0.5 font-bold text-white disabled:opacity-40 disabled:cursor-not-allowed';
  return (
    <>
      {!readOnly && (
        <div
          className="absolute top-1 z-20 flex items-stretch text-[10px] font-mono select-none shadow-lg"
          style={{ right: chart.priceScale('right').width() + 8 }}
        >
          <button onClick={() => market('SELL')} disabled={busy || !quote} className={`${btn} bg-red-600/80 hover:bg-red-600`}>
            SELL {quote ? fmtPrice(quote.bid) : '—'}
          </button>
          <input
            type="number" step="0.01" min="0.01" value={lots} onChange={(e) => setLots(e.target.value)} aria-label="Lots"
            className="w-14 bg-black/85 border-y border-white/10 text-center text-white outline-none"
          />
          <button onClick={() => market('BUY')} disabled={busy || !quote} className={`${btn} bg-emerald-600/80 hover:bg-emerald-600`}>
            BUY {quote ? fmtPrice(quote.ask) : '—'}
          </button>
        </div>
      )}

      {busy && (
        <div className="absolute top-7 z-20 text-[9px] font-mono text-amber-400 tracking-widest pointer-events-none" style={{ right: chart.priceScale('right').width() + 8 }}>
          SENDING…
        </div>
      )}

      {menu && items.length > 0 && (
        <div
          ref={menuRef}
          role="menu"
          className="absolute z-30 min-w-[180px] bg-black/95 border border-white/10 py-1 text-[10px] font-mono shadow-xl"
          style={{ left: Math.max(0, Math.min(menu.x, el.clientWidth - 200)), top: Math.max(0, Math.min(menu.y, el.clientHeight - items.length * 24 - 8)) }}
        >
          {items.map((it) => (
            <button
              key={it.label}
              role="menuitem"
              onClick={() => { setMenu(null); it.onClick(); }}
              className={`block w-full text-left px-3 py-1 hover:bg-white/10 ${it.danger ? 'text-red-400' : 'text-white/80'}`}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div role="alert" className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 max-w-[90%] flex items-center gap-2 px-3 py-1 bg-red-950/90 border border-red-500/40 text-[10px] font-mono text-red-300">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-300/60 hover:text-red-300" aria-label="Dismiss">✕</button>
        </div>
      )}
    </>
  );
}
