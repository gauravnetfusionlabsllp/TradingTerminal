import { useEffect, useMemo, useRef, useState } from 'react';
import { LineStyle, type IChartApi, type ISeriesApi, type SeriesType } from 'lightweight-charts';
import {
  useMt5Positions, useMt5Orders, useMt5Quotes,
  useMt5MarketOrder, useMt5PendingOrder, useMt5ClosePosition, useMt5CancelOrder, useMt5ReplaceOrder, useMt5ModifyPosition,
  type Mt5Order, type Mt5Position, type Mt5PendingType, type Mt5Quote,
} from '../../api/hooks/use-mt5';
import { useAppStore } from '../../stores/use-app-store';
import { fmtPrice, liveProfit } from '../trading/mt5-trading';
import { snap, pendingTypesAt, levelSide, levelsError, shortTags } from '../../lib/chart-trading';
import { useChartColors, alpha } from '../../lib/theme';

type Side = 'BUY' | 'SELL';
type Field = 'entry' | 'sl' | 'tp';

/** One horizontal level drawn on the chart. Drafts (SL/TP for the next order) have neither `pos` nor `ord`.
 *  `title` says what the line is ('SL', 'SELL 0.01', 'BUY LIMIT 0.1'); tag and P&L are added when it's drawn. */
interface Level {
  id: string;
  price: number;
  field: Field;
  title: string;
  /** Theme token, resolved to a colour when the line is drawn */
  color: LineColor;
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
  /** Show the one-click BUY / SELL strip (the header toggle) */
  oneClick?: boolean;
  /** A drawing tool is active: chart clicks place the drawing, so trading stands down */
  drawing?: boolean;
  /** "Reset chart" at the bottom of the right-click menu */
  onReset?: () => void;
}

export interface MenuItem { label: string; onClick: () => void; danger?: boolean; divider?: boolean }

/** The chart's right-click menu, placed inside `bounds`; closes on pick, outside click or Escape */
export function ChartMenu({ at, items, bounds, onClose }: {
  at: { x: number; y: number };
  items: MenuItem[];
  bounds: HTMLElement;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) close.current(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close.current(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, []);
  return (
    <div
      ref={ref}
      role="menu"
      className="absolute z-30 min-w-[180px] bg-raised border border-border rounded-sm py-1 text-xs shadow-[0_12px_32px_rgb(0_0_0/0.3)]"
      style={{ left: Math.max(0, Math.min(at.x, bounds.clientWidth - 200)), top: Math.max(0, Math.min(at.y, bounds.clientHeight - items.length * 24 - 16)) }}
    >
      {items.map((it) => (
        <button
          key={it.label}
          role="menuitem"
          onClick={() => { close.current(); it.onClick(); }}
          className={`block w-full text-left px-3 py-1.5 hover:bg-hover ${it.danger ? 'text-bearish' : 'text-fg'} ${it.divider ? 'mt-1 border-t border-border pt-2' : ''}`}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

type LineColor = 'fg' | 'orange' | 'bearish' | 'bullish';
const WHITE: LineColor = 'fg', AMBER: LineColor = 'orange', RED: LineColor = 'bearish', GREEN: LineColor = 'bullish';
const HIT_PX = 5;
const LEVEL_KEY = { entry: 'price', sl: 'stopLoss', tp: 'takeProfit' } as const;
const sideOf = (o: Mt5Order): Side => (o.type.startsWith('BUY') ? 'BUY' : 'SELL');
const errMsg = (err: unknown) => (err instanceof Error ? err.message : 'Failed');
const signed = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(2)}`;
/** The price a position closes at: SL / TP must sit either side of it (BUY closes at bid, SELL at ask) */
const closeRef = (p: Mt5Position, q?: Mt5Quote) => (q ? (p.side === 'BUY' ? q.bid : q.ask) : p.currentPrice);
const stopLine = (owner: string, field: 'sl' | 'tp', price: number, drag: boolean, ref: Pick<Level, 'pos' | 'ord'>): Level => ({
  id: `${owner}:${field}`, price, field, title: field.toUpperCase(),
  color: field === 'sl' ? RED : GREEN, style: LineStyle.Dashed, drag, ...ref,
});
/** Replace the level with the same id (or add it) */
const put = (list: Level[], l: Level) => [...list.filter((x) => x.id !== l.id), l];
/** The position / order a level belongs to: 'p<ticket>', 'o<ticket>' ('d' for drafts) — matches the store's tradeFocus */
const ownerOf = (l: Level) => l.id.split(':')[0];

/**
 * One-click trading on the price pane: trade bar, right-click menus, draggable lines.
 * Pending orders are moved by cancel + re-place (bridge has no order modify). Position SL / TP use the bridge's
 * modify call: drag the SL / TP line, or drag the entry line out to add one (MT5 style); the position never moves.
 */
export function ChartTrading({ chart, series, el, symbol, precision, readOnly, lots, setLots, oneClick = true, drawing = false, onReset }: Props) {
  const addLogEntry = useAppStore((s) => s.addLogEntry);
  const colors = useChartColors();
  const focus = useAppStore((s) => s.tradeFocus);
  const { data: positions } = useMt5Positions();
  const { data: orders } = useMt5Orders();
  const { data: quotes } = useMt5Quotes([symbol]);
  const quote = quotes?.[symbol];
  const marketOrder = useMt5MarketOrder();
  const pendingOrder = useMt5PendingOrder();
  const closePosition = useMt5ClosePosition();
  const cancelOrder = useMt5CancelOrder();
  const replaceOrder = useMt5ReplaceOrder();
  const modifyPosition = useMt5ModifyPosition();
  const busy = [marketOrder, pendingOrder, closePosition, cancelOrder, replaceOrder, modifyPosition].some((m) => m.isPending);

  const [drafts, setDrafts] = useState<{ sl?: number; tp?: number }>({});
  const [drag, setDrag] = useState<{ id: string; price: number } | null>(null);
  // A committed drag keeps showing until a refetch brings the change in (no flash back to the old price)
  const [held, setHeld] = useState<Level | null>(null);
  // price is null off the price pane (axes, indicator panes): the menu then only offers Reset chart
  const [menu, setMenu] = useState<{ x: number; y: number; price: number | null; line?: Level } | null>(null);
  const [error, setError] = useState('');

  // A 5s poll landing while the request is still out carries the old level — only data after it settles counts
  const busyRef = useRef(busy);
  busyRef.current = busy;
  useEffect(() => { if (!busyRef.current) setHeld(null); }, [orders, positions]);

  const myPositions = useMemo(() => (positions ?? []).filter((p) => p.symbol === symbol), [positions, symbol]);
  const myOrders = useMemo(() => (orders ?? []).filter((o) => o.symbol === symbol), [orders, symbol]);

  const shown = useMemo(() => {
    let out: Level[] = [];
    const stops = (id: string, sl: number, tp: number, drag: boolean, owner: Pick<Level, 'pos' | 'ord'>) => {
      if (sl) out.push(stopLine(id, 'sl', sl, drag, owner));
      if (tp) out.push(stopLine(id, 'tp', tp, drag, owner));
    };
    for (const p of myPositions) {
      out.push({
        id: `p${p.ticket}`, price: p.openPrice, field: 'entry', color: WHITE, style: LineStyle.Solid, drag: !readOnly, pos: p,
        title: `${p.side} ${p.volume}`,
      });
      stops(`p${p.ticket}`, p.stopLoss, p.takeProfit, !readOnly, { pos: p });
    }
    for (const o of myOrders) {
      out.push({
        id: `o${o.ticket}`, price: o.price, field: 'entry', color: AMBER, style: LineStyle.Solid, drag: !readOnly, ord: o,
        title: `${o.type.replace('_', ' ')} ${o.volume}`,
      });
      stops(`o${o.ticket}`, o.stopLoss, o.takeProfit, !readOnly, { ord: o });
    }
    if (drafts.sl) out.push({ id: 'd:sl', price: drafts.sl, field: 'sl', title: 'SL next order', color: RED, style: LineStyle.Dotted, drag: true });
    if (drafts.tp) out.push({ id: 'd:tp', price: drafts.tp, field: 'tp', title: 'TP next order', color: GREEN, style: LineStyle.Dotted, drag: true });
    if (held) out = put(out, held);
    const moving = drag && out.find((l) => l.id === drag.id);
    if (moving) {
      const p = moving.pos;
      // Dragging a position's entry pulls out its SL (losing side) or TP (winning side), replacing any existing one
      out = put(out, p && moving.field === 'entry'
        ? stopLine(moving.id, levelSide(p.side, closeRef(p, quote), drag.price), drag.price, true, { pos: p })
        : { ...moving, price: drag.price });
    }
    return out;
  }, [myPositions, myOrders, drafts, drag, held, readOnly, quote]);

  // Shortest ticket ending that tells this symbol's trades apart (none with a single trade): pairs each SL / TP with
  // its entry at a glance, without 9-digit tickets on every line
  const tags = useMemo(() => shortTags([...myPositions, ...myOrders].map((t) => t.ticket)), [myPositions, myOrders]);

  // Price lines sit on the visible main series (a hidden series draws none). The label says what a line is; hovering
  // says whose. At rest: solid chips, 'SL ·597 −0.84'. One trade hovered (here or in a panel): its lines come forward —
  // 2px, P&L, drawn on top — and every other line stays in place, quieter: half-strength, a bare 'SL' / 'TP' /
  // 'SELL 0.01' on a ghost chip. A focus with no line here (another symbol, a row closed while hovered) changes nothing.
  const lit = useMemo(() => shown.some((l) => ownerOf(l) === focus), [shown, focus]);

  useEffect(() => {
    const front = (l: Level) => !lit || ownerOf(l) === focus;
    const tag = (l: Level) => tags.get(l.pos?.ticket ?? l.ord?.ticket ?? NaN);
    // A position's entry shows its floating P&L; its SL / TP the P&L they would lock in — live while dragging
    const pnl = (l: Level) => !l.pos ? undefined
      : signed(l.field !== 'entry' ? liveProfit(l.pos, l.price) : quote ? liveProfit(l.pos, closeRef(l.pos, quote)) : l.pos.profit);
    const full = (l: Level) => [l.title, !lit && tag(l) && `·${tag(l)}`, pnl(l)].filter(Boolean).join(' ');
    const ordered = lit ? [...shown].sort((a, b) => Number(front(a)) - Number(front(b))) : shown; // focused last = on top
    const lines = ordered.map((l) => {
      if (front(l)) {
        return series.createPriceLine({
          price: l.price, color: colors[l.color], lineWidth: lit ? 2 : 1, lineStyle: l.style, axisLabelVisible: true,
          title: full(l),
        });
      }
      // Ghost chip: surface fill with the line's own colour as text (both AA on raised, see check-theme)
      return series.createPriceLine({
        price: l.price, color: alpha(colors[l.color], 0.5), lineWidth: 1, lineStyle: l.style,
        axisLabelVisible: true, axisLabelColor: colors.raised, axisLabelTextColor: colors[l.color],
        title: l.title,
      });
    });
    // On unmount the parent may already have removed the chart
    return () => lines.forEach((pl) => { try { series.removePriceLine(pl); } catch { /* chart gone */ } });
  }, [series, shown, focus, lit, colors, tags, quote]);

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
  const replace = (o: Mt5Order, change: Partial<Record<'price' | 'stopLoss' | 'takeProfit', number>>, hold?: Level) => {
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

  /** Position SL / TP through the bridge's modify call. Only the changed level is sent; 0 removes it. */
  const modify = (p: Mt5Position, change: Partial<Record<'stopLoss' | 'takeProfit', number>>, hold?: Level) => {
    const next = { stopLoss: p.stopLoss, takeProfit: p.takeProfit, ...change };
    const bad = levelsError(p.side, closeRef(p, quote), next.stopLoss, next.takeProfit);
    if (bad) return setError(bad);
    if (hold) setHeld(hold);
    run(`MODIFY #${p.ticket} ${symbol} SL ${fmtPrice(next.stopLoss)} TP ${fmtPrice(next.takeProfit)}`, () =>
      modifyPosition.mutateAsync({ ticket: p.ticket, ...change }));
  };

  const drop = (l: Level, price: number) => {
    if (l.pos) {
      const f = l.field === 'entry' ? levelSide(l.pos.side, closeRef(l.pos, quote), price) : l.field;
      modify(l.pos, { [LEVEL_KEY[f]]: price }, stopLine(`p${l.pos.ticket}`, f, price, true, { pos: l.pos }));
    } else if (l.ord) replace(l.ord, { [LEVEL_KEY[l.field]]: price }, { ...l, price });
    else if (l.field !== 'entry') setDrafts((d) => ({ ...d, [l.field]: price }));
  };

  // Mouse handlers live for the chart's lifetime; they read current state through this ref
  const live = useRef({ shown, focus, blocked: busy || readOnly || drawing, precision, drop });
  live.current = { shown, focus, blocked: busy || readOnly || drawing, precision, drop };

  useEffect(() => {
    let grab = false;
    let start: { l: Level; y: number } | null = null;
    const yOf = (e: MouseEvent) => e.clientY - el.getBoundingClientRect().top;
    // Indicator panes sit below the price pane in the same element: a y down there is no price and no line
    const onPricePane = (y: number) => y <= (chart.panes()[0]?.getHeight() ?? Infinity);
    const priceAt = (y: number) => {
      if (!onPricePane(y)) return null;
      const p = series.coordinateToPrice(y);
      return p == null ? null : snap(p, live.current.precision);
    };
    const hit = (y: number) => {
      if (!onPricePane(y)) return undefined;
      let best: Level | undefined;
      let bestD = HIT_PX + 1;
      for (const l of live.current.shown) {
        const ly = series.priceToCoordinate(l.price);
        if (ly == null) continue;
        // The focused trade wins near-ties, so overlapping lines don't flip the focus back and forth
        const d = Math.abs(ly - y) - (ownerOf(l) === live.current.focus ? 2 : 0);
        if (d < bestD) { best = l; bestD = d; }
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

    // Focus this chart set (null if none): mousemove fires constantly, so the store is only written on change
    let mine: string | null = null;
    const setFocus = (owner: string | null) => {
      if (owner === mine) return;
      mine = owner;
      useAppStore.getState().setTradeFocus(owner);
    };

    const onHover = (e: MouseEvent) => {
      if (start) return;
      const l = hit(yOf(e));
      setGrab(draggable(l));
      setFocus(l?.pos || l?.ord ? ownerOf(l) : null);
    };
    const onLeave = () => { if (!start) { setGrab(false); setFocus(null); } };
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
      // Released off the chart: the leave during the drag was skipped
      if (!el.contains(e.target as Node)) setFocus(null);
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
      const y = yOf(e);
      const price = live.current.blocked ? null : priceAt(y);
      setMenu({ x: e.clientX - el.getBoundingClientRect().left, y, price, line: price == null ? undefined : hit(y) });
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
      setFocus(null);
    };
  }, [chart, series, el]);

  const items: MenuItem[] = [];
  if (menu && menu.price != null) {
    const { line: l } = menu;
    const price = menu.price;
    const at = fmtPrice(price);
    if (l?.pos) {
      const p = l.pos;
      items.push({ label: `Close #${p.ticket} ${p.side} ${p.volume}`, danger: true,
        onClick: () => run(`CLOSE #${p.ticket} ${symbol}`, () => closePosition.mutateAsync({ ticket: p.ticket })) });
      if (p.stopLoss) items.push({ label: `Remove SL #${p.ticket}`, onClick: () => modify(p, { stopLoss: 0 }) });
      if (p.takeProfit) items.push({ label: `Remove TP #${p.ticket}`, onClick: () => modify(p, { takeProfit: 0 }) });
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
      for (const p of myPositions) {
        const f = levelSide(p.side, closeRef(p, quote), price);
        items.push({ label: `#${p.ticket} ${p.side}: ${f.toUpperCase()} → ${at}`, onClick: () => modify(p, { [LEVEL_KEY[f]]: price }) });
      }
      for (const o of myOrders) {
        const f = levelSide(sideOf(o), o.price, price);
        items.push({ label: `#${o.ticket} ${o.type.replace('_', ' ')}: ${f.toUpperCase()} → ${at}`, onClick: () => replace(o, { [LEVEL_KEY[f]]: price }) });
      }
    }
  }
  if (menu && onReset) items.push({ label: 'Reset chart', onClick: onReset, divider: items.length > 0 });

  const btn = 'px-2.5 py-1 font-semibold text-on-accent tabular-nums disabled:opacity-40 disabled:cursor-not-allowed';
  return (
    <>
      {!readOnly && oneClick && (
        <div
          className={`absolute top-1.5 z-20 flex items-stretch text-mini select-none rounded-sm overflow-hidden shadow-[0_4px_16px_rgb(0_0_0/0.25)] transition-opacity duration-100 motion-reduce:transition-none ${
            drawing ? 'opacity-40 pointer-events-none' : ''
          }`}
          aria-disabled={drawing || undefined}
          style={{ right: chart.priceScale('right').width() + 8 }}
        >
          <button onClick={() => market('SELL')} disabled={busy || !quote} className={`${btn} bg-sell hover:bg-sell/90`}>
            SELL {quote ? fmtPrice(quote.bid) : '—'}
          </button>
          <input
            type="number" step="0.01" min="0.01" value={lots} onChange={(e) => setLots(e.target.value)} aria-label="Lots"
            className="w-14 bg-raised border-0 border-y border-border text-center text-fg outline-none"
          />
          <button onClick={() => market('BUY')} disabled={busy || !quote} className={`${btn} bg-buy hover:bg-buy/90`}>
            BUY {quote ? fmtPrice(quote.ask) : '—'}
          </button>
        </div>
      )}

      {busy && (
        <div className="absolute top-9 z-20 text-micro text-orange pointer-events-none" style={{ right: chart.priceScale('right').width() + 8 }}>
          Sending…
        </div>
      )}

      {menu && items.length > 0 && <ChartMenu at={menu} items={items} bounds={el} onClose={() => setMenu(null)} />}

      {error && (
        <div role="alert" className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 max-w-[90%] flex items-center gap-2 px-3 py-1.5 rounded-sm bg-raised border border-bearish/50 text-mini text-bearish shadow-[0_4px_16px_rgb(0_0_0/0.25)]">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-bearish/60 hover:text-bearish" aria-label="Dismiss">✕</button>
        </div>
      )}
    </>
  );
}
