import { useEffect, useMemo, useRef, useState } from 'react';
import { LineStyle, type IChartApi, type ISeriesApi, type SeriesType } from 'lightweight-charts';
import {
  useMt5Positions, useMt5Orders, useMt5Quotes,
  useMt5MarketOrder, useMt5PendingOrder, useMt5ClosePosition, useMt5CancelOrder, useMt5ReplaceOrder, useMt5ModifyPosition,
  type Mt5Order, type Mt5Position, type Mt5PendingType, type Mt5Quote,
} from '../../api/hooks/use-mt5';
import { useAppStore } from '../../stores/use-app-store';
import { fmtPrice, liveProfit } from '../trading/mt5-trading';
import {
  snap, pendingTypesAt, pendingTypeFor, levelSide, levelsError, pips, pipText, typeName, draftEntry, draftRef,
} from '../../lib/chart-trading';
import { useChartColors, alpha } from '../../lib/theme';
import { TradeChips, type Chip, type Zone } from './trade-chips';

type Side = 'BUY' | 'SELL';
type Field = 'entry' | 'sl' | 'tp';

/** One horizontal level on the chart: a position's or pending order's entry / SL / TP, or the order draft's. */
interface Level {
  id: string;
  price: number;
  field: Field;
  /** Theme token, resolved to a colour when drawn */
  color: LineColor;
  style: LineStyle;
  drag: boolean;
  pos?: Mt5Position;
  ord?: Mt5Order;
  /** The order being prepared, shared with the ticket */
  draft?: boolean;
}

interface Props {
  chart: IChartApi;
  series: ISeriesApi<SeriesType>;
  el: HTMLDivElement;
  symbol: string;
  precision: number;
  readOnly: boolean;
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

type LineColor = 'buy' | 'sell' | 'orange' | 'bullish';
/** Text on a raised chip in the line's colour — buy blue isn't AA as text, so it reads in accent-ink */
const INK = { buy: 'accent-ink', sell: 'bearish', orange: 'orange', bullish: 'bullish' } as const;
const HIT_PX = 5;
const LEVEL_KEY = { entry: 'price', sl: 'stopLoss', tp: 'takeProfit' } as const;
const sideOf = (o: Mt5Order): Side => (o.type.startsWith('BUY') ? 'BUY' : 'SELL');
const sideColor = (s: Side): LineColor => (s === 'BUY' ? 'buy' : 'sell');
const errMsg = (err: unknown) => (err instanceof Error ? err.message : 'Failed');
const signed = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(2)}`;
/** The price a position closes at: SL / TP must sit either side of it (BUY closes at bid, SELL at ask) */
const closeRef = (p: Mt5Position, q?: Mt5Quote) => (q ? (p.side === 'BUY' ? q.bid : q.ask) : p.currentPrice);
const stopLine = (owner: string, field: 'sl' | 'tp', price: number, drag: boolean, ref: Pick<Level, 'pos' | 'ord' | 'draft'>): Level => ({
  id: `${owner}:${field}`, price, field, color: field === 'sl' ? 'orange' : 'bullish', style: LineStyle.Dashed, drag, ...ref,
});
/** Replace the level with the same id (or add it) */
const put = (list: Level[], l: Level) => [...list.filter((x) => x.id !== l.id), l];
/** Whose level it is: 'p<ticket>', 'o<ticket>' (matches the store's tradeFocus), 'd' for the draft */
const ownerOf = (l: Level) => l.id.split(':')[0];

/**
 * One-click trading on the price pane: trade bar, chips, right-click / "+" menus, draggable lines, and the preview of
 * the order being prepared in the ticket (the shared draft) — drag its lines here and the ticket follows.
 * Pending orders are moved by cancel + re-place (bridge has no order modify). Position SL / TP use the bridge's
 * modify call: drag the SL / TP line, or an entry chip's TP / SL tab to add one. A position's entry never moves, so it
 * doesn't drag: new SL / TP come only from the tabs.
 */
export function ChartTrading({ chart, series, el, symbol, precision, readOnly, oneClick = true, drawing = false, onReset }: Props) {
  const addLogEntry = useAppStore((s) => s.addLogEntry);
  const colors = useChartColors();
  const focus = useAppStore((s) => s.tradeFocus);
  const draft = useAppStore((s) => s.orderDraft);
  const patchDraft = useAppStore((s) => s.patchDraft);
  // The draft is drawn (and its SL / TP ride on one-click orders) only on its own symbol
  const mine = draft.symbol === symbol;
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
  const blocked = busy || readOnly || drawing;

  const [drag, setDrag] = useState<{ l: Level; price: number } | null>(null);
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

  const { shown, moving } = useMemo(() => {
    let out: Level[] = [];
    const stops = (id: string, sl: number, tp: number, drag: boolean, owner: Pick<Level, 'pos' | 'ord'>) => {
      if (sl) out.push(stopLine(id, 'sl', sl, drag, owner));
      if (tp) out.push(stopLine(id, 'tp', tp, drag, owner));
    };
    for (const p of myPositions) {
      out.push({ id: `p${p.ticket}`, price: p.openPrice, field: 'entry', color: sideColor(p.side), style: LineStyle.Solid, drag: false, pos: p });
      stops(`p${p.ticket}`, p.stopLoss, p.takeProfit, !readOnly, { pos: p });
    }
    for (const o of myOrders) {
      out.push({ id: `o${o.ticket}`, price: o.price, field: 'entry', color: sideColor(sideOf(o)), style: LineStyle.Dashed, drag: !readOnly, ord: o });
      stops(`o${o.ticket}`, o.stopLoss, o.takeProfit, !readOnly, { ord: o });
    }
    if (mine && !readOnly) {
      const entry = draft.side ? draftEntry(draft, quote) : 0;
      if (draft.side && entry) {
        out.push({ id: 'd', price: entry, field: 'entry', color: sideColor(draft.side), style: LineStyle.Solid, drag: true, draft: true });
      }
      // Without a side they're the next one-click order's levels: dotted
      const style = draft.side ? LineStyle.Dashed : LineStyle.Dotted;
      if (draft.sl) out.push({ ...stopLine('d', 'sl', draft.sl, true, { draft: true }), style });
      if (draft.tp) out.push({ ...stopLine('d', 'tp', draft.tp, true, { draft: true }), style });
    }
    if (held) out = put(out, held);
    let moving: string | null = null;
    if (drag) {
      out = put(out, { ...drag.l, price: drag.price });
      moving = drag.l.id;
    }
    return { shown: out, moving };
  }, [myPositions, myOrders, draft, mine, drag, held, readOnly, quote]);

  // Hovered trade (here or in a panel) comes forward, every other line stays in place, quieter — nothing is ever
  // hidden. A focus with no line here (another symbol, a row closed while hovered) changes nothing.
  const owners = useMemo(() => new Set(shown.map(ownerOf)), [shown]);
  const hovered = focus && owners.has(focus) ? focus : null;
  const front = drag ? ownerOf(drag.l) : hovered;
  // Whose zone and handle rail are drawn: the trade in front, else the armed draft
  const litOwner = front ?? (mine && draft.side ? 'd' : null);

  useEffect(() => {
    const isFront = (l: Level) => !front || ownerOf(l) === front;
    const ordered = front ? [...shown].sort((a, b) => Number(isFront(a)) - Number(isFront(b))) : shown; // front last = on top
    // The chip is the label: lines keep only their axis price
    const lines = ordered.map((l) => {
      const c = colors[l.color];
      return isFront(l)
        ? series.createPriceLine({
          price: l.price, color: c, lineWidth: ownerOf(l) === litOwner ? 2 : 1, lineStyle: l.style, axisLabelVisible: true, title: '',
        })
        : series.createPriceLine({
          price: l.price, color: alpha(c, 0.5), lineWidth: 1, lineStyle: l.style, title: '',
          axisLabelVisible: true, axisLabelColor: colors.raised, axisLabelTextColor: colors[INK[l.color]],
        });
    });
    // On unmount the parent may already have removed the chart
    return () => lines.forEach((pl) => { try { series.removePriceLine(pl); } catch { /* chart gone */ } });
  }, [series, shown, front, litOwner, colors]);

  const zone = useMemo<Zone | null>(() => {
    const e = litOwner && shown.find((l) => l.id === litOwner);
    if (!e) return null;
    const at = (f: 'sl' | 'tp') => shown.find((l) => l.id === `${litOwner}:${f}`)?.price;
    return { entry: e.price, sl: at('sl'), tp: at('tp'), color: colors[e.color] };
  }, [shown, litOwner, colors]);

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
    const v = Number(draft.volume);
    if (!(v > 0)) setError('Enter a lot size');
    return v > 0 ? v : 0;
  };
  // The draft's SL / TP go out with the next one-click order on its symbol, then clear
  const nextLevels = () => (mine ? { sl: draft.sl, tp: draft.tp } : { sl: 0, tp: 0 });
  const sent = () => { if (mine) patchDraft({ side: null, sl: 0, tp: 0 }); };

  const market = async (side: Side) => {
    const v = volume();
    if (!v || !quote) return;
    const { sl, tp } = nextLevels();
    const bad = levelsError(side, side === 'BUY' ? quote.bid : quote.ask, sl, tp);
    if (bad) return setError(bad);
    if (await run(`${side} ${v} ${symbol} @ MKT`, () => marketOrder.mutateAsync({ symbol, side, volume: v, stopLoss: sl, takeProfit: tp }))) sent();
  };

  const pending = async (orderType: Mt5PendingType, price: number) => {
    const v = volume();
    if (!v) return;
    const { sl, tp } = nextLevels();
    const bad = levelsError(orderType.startsWith('BUY') ? 'BUY' : 'SELL', price, sl, tp);
    if (bad) return setError(bad);
    if (await run(`${orderType} ${v} ${symbol} @ ${fmtPrice(price)}`, () =>
      pendingOrder.mutateAsync({ symbol, volume: v, orderType, price, stopLoss: sl, takeProfit: tp }))) sent();
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

  const close = (p: Mt5Position) => run(`CLOSE #${p.ticket} ${symbol}`, () => closePosition.mutateAsync({ ticket: p.ticket }));
  const cancel = (o: Mt5Order) => run(`CANCEL #${o.ticket} ${symbol}`, () => cancelOrder.mutateAsync({ ticket: o.ticket }));

  const drop = (l: Level, price: number) => {
    if (l.pos) {
      if (l.field !== 'entry') modify(l.pos, { [LEVEL_KEY[l.field]]: price }, { ...l, price });
    } else if (l.ord) replace(l.ord, { [LEVEL_KEY[l.field]]: price }, { ...l, price });
    // The draft's market entry dragged off the market becomes a pending order there (limit or stop by side)
    else if (l.field === 'entry') patchDraft({ kind: 'PENDING', price });
    else patchDraft(l.field === 'sl' ? { sl: price } : { tp: price });
  };

  const priceAt = (y: number) => {
    const p = y <= (chart.panes()[0]?.getHeight() ?? Infinity) ? series.coordinateToPrice(y) : null;
    return p == null ? null : snap(p, precision);
  };

  // Mouse handlers live for the chart's lifetime; they read current state through this ref, and hand the chips
  // their way into the same drag / focus logic (the chips sit above `el`, so its listeners never see them)
  const live = useRef({ shown, focus, blocked, precision, drop });
  live.current = { shown, focus, blocked, precision, drop };
  const hands = useRef<{ grab: (l: Level, clientY: number) => void; hover: (owner: string | null) => void } | null>(null);

  useEffect(() => {
    let grab = false;
    let start: { l: Level; y: number } | null = null;
    const top = () => el.getBoundingClientRect().top;
    const yOf = (e: MouseEvent) => e.clientY - top();
    // Indicator panes sit below the price pane in the same element: a y down there is no price and no line
    const onPricePane = (y: number) => y <= (chart.panes()[0]?.getHeight() ?? Infinity);
    const priceAtY = (y: number) => {
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
    let focused: string | null = null;
    const setFocus = (owner: string | null) => {
      if (owner === focused) return;
      focused = owner;
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
      const p = priceAtY(yOf(e));
      if (start && p != null) setDrag({ l: start.l, price: p });
    };
    const onUp = (e: MouseEvent) => {
      window.removeEventListener('mousemove', onDrag);
      const s = start;
      start = null;
      setDrag(null);
      setGrab(false);
      // Released off the chart: the leave during the drag was skipped
      if (!el.contains(e.target as Node)) setFocus(null);
      const p = priceAtY(yOf(e));
      if (s && p != null && Math.abs(yOf(e) - s.y) >= 3) live.current.drop(s.l, p);
    };
    const begin = (l: Level, clientY: number) => {
      if (!draggable(l)) return;
      start = { l, y: clientY - top() };
      window.addEventListener('mousemove', onDrag);
      window.addEventListener('mouseup', onUp, { once: true });
    };
    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const l = hit(yOf(e));
      if (l) begin(l, e.clientY);
    };
    const onMenu = (e: MouseEvent) => {
      e.preventDefault();
      const y = yOf(e);
      const price = live.current.blocked ? null : priceAtY(y);
      setMenu({ x: e.clientX - el.getBoundingClientRect().left, y, price, line: price == null ? undefined : hit(y) });
    };
    hands.current = { grab: begin, hover: setFocus };

    el.addEventListener('mousemove', onHover);
    el.addEventListener('mouseleave', onLeave);
    el.addEventListener('mousedown', onDown);
    el.addEventListener('contextmenu', onMenu);
    return () => {
      hands.current = null;
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

  const levelOf = (id: string) => shown.find((l) => l.id === id);

  const chips = shown.map((l): Chip => {
    const owner = ownerOf(l);
    const { pos: p, ord: o } = l;
    const side: Side = p?.side ?? (o ? sideOf(o) : draft.side ?? 'BUY');
    const vol = String(p?.volume ?? o?.volume ?? draft.volume);
    const tag = p || o ? ` · #${(p ?? o)!.ticket}` : '';
    const base = {
      id: l.id, price: l.price, color: colors[l.color], ink: colors[INK[l.color]], vol, drag: l.drag && !blocked,
      lit: owner === litOwner, dim: !!front && owner !== front, tabs: [] as ('tp' | 'sl')[],
    };

    if (l.field === 'entry') {
      // Unset SL / TP: a tab to drag one out
      const tabs = blocked ? [] : (['tp', 'sl'] as const).filter((f) => !levelOf(`${owner}:${f}`));
      if (p) {
        const pnl = quote ? liveProfit(p, closeRef(p, quote)) : p.profit;
        return {
          ...base, entry: true, tabs, value: signed(pnl), tone: pnl >= 0 ? 'up' : 'down',
          tip: [`${typeName(p.side)} ${vol} · ${signed(pnl)}`, `Open ${fmtPrice(p.openPrice)}${tag}`],
          onX: readOnly ? undefined : () => close(p), xLabel: `Close #${p.ticket} ${p.side} ${vol}`,
        };
      }
      if (o) {
        return {
          ...base, entry: true, tabs, value: typeName(o.type),
          tip: [`${typeName(o.type)} ${vol}`, `Price ${fmtPrice(o.price)}${tag}`],
          onX: readOnly ? undefined : () => cancel(o), xLabel: `Cancel #${o.ticket} ${typeName(o.type)}`,
        };
      }
      // The draft: a market order just shows its size; a pending one (or one being dragged off the market) its type
      const pendingNow = draft.kind === 'PENDING' || moving === 'd';
      const type = pendingNow && quote ? pendingTypeFor(side, l.price, quote.bid, quote.ask) : null;
      return {
        ...base, entry: true, tabs, value: pendingNow ? (type ? typeName(type) : 'At market') : undefined,
        tip: [`${typeName(type ?? side)} ${vol} · not sent yet`, `${pendingNow ? 'Price' : 'Market'} ${fmtPrice(l.price)}`],
        onX: () => patchDraft({ side: null }), xLabel: 'Cancel order',
      };
    }

    const name = l.field === 'sl' ? 'Stop loss' : 'Take profit';
    const entry = levelOf(owner)?.price;
    const dist = entry ? pipText(pips(side, entry, l.price, precision)) : '';
    const unset = l.field === 'sl' ? { stopLoss: 0 } : { takeProfit: 0 };
    const at = `Price ${fmtPrice(l.price)}${tag}`;
    if (p) {
      const pnl = liveProfit(p, l.price);
      return {
        ...base, entry: false, value: signed(pnl), tip: [`${name} ${dist} · ${signed(pnl)}`, at],
        onX: readOnly ? undefined : () => modify(p, unset), xLabel: `Remove ${name.toLowerCase()} #${p.ticket}`,
      };
    }
    if (o) {
      return {
        ...base, entry: false, value: dist, tip: [`${name} ${dist}`, at],
        onX: readOnly ? undefined : () => replace(o, unset), xLabel: `Remove ${name.toLowerCase()} #${o.ticket}`,
      };
    }
    return {
      ...base, entry: false, value: draft.side && dist ? dist : 'next order', tip: [`${name} ${draft.side ? dist : '· next order'}`, at],
      onX: () => patchDraft(l.field === 'sl' ? { sl: 0 } : { tp: 0 }), xLabel: `Remove ${name.toLowerCase()}`,
    };
  });

  const items: MenuItem[] = [];
  if (menu && menu.price != null) {
    const { line: l } = menu;
    const price = menu.price;
    const at = fmtPrice(price);
    if (l?.pos) {
      const p = l.pos;
      items.push({ label: `Close #${p.ticket} ${p.side} ${p.volume}`, danger: true, onClick: () => close(p) });
      if (p.stopLoss) items.push({ label: `Remove SL #${p.ticket}`, onClick: () => modify(p, { stopLoss: 0 }) });
      if (p.takeProfit) items.push({ label: `Remove TP #${p.ticket}`, onClick: () => modify(p, { takeProfit: 0 }) });
    } else if (l?.ord) {
      const o = l.ord;
      items.push({ label: `Cancel #${o.ticket} ${o.type.replace('_', ' ')}`, danger: true, onClick: () => cancel(o) });
      if (o.stopLoss) items.push({ label: `Remove SL #${o.ticket}`, onClick: () => replace(o, { stopLoss: 0 }) });
      if (o.takeProfit) items.push({ label: `Remove TP #${o.ticket}`, onClick: () => replace(o, { takeProfit: 0 }) });
    } else if (l?.draft) {
      if (l.field === 'entry') items.push({ label: 'Cancel order', onClick: () => patchDraft({ side: null }) });
      else {
        const f = l.field;
        items.push({ label: `Remove ${f.toUpperCase()}${draft.side ? '' : ' (next order)'}`, onClick: () => patchDraft(f === 'sl' ? { sl: 0 } : { tp: 0 }) });
      }
    } else {
      if (quote) {
        for (const t of pendingTypesAt(price, quote.bid, quote.ask)) {
          items.push({ label: `${t.replace('_', ' ')} ${draft.volume} @ ${at}`, onClick: () => pending(t, price) });
        }
      }
      if (mine && draft.side) {
        // The armed order's own SL / TP: whichever this price can be
        const f = levelSide(draft.side, draftRef(draft, quote), price);
        items.push({ label: `Order ${f.toUpperCase()} → ${at}`, onClick: () => patchDraft(f === 'sl' ? { sl: price } : { tp: price }) });
      } else {
        items.push({ label: `Set SL @ ${at} (next order)`, onClick: () => patchDraft({ symbol, sl: price }) });
        items.push({ label: `Set TP @ ${at} (next order)`, onClick: () => patchDraft({ symbol, tp: price }) });
      }
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
      <TradeChips
        chart={chart}
        series={series}
        colors={colors}
        chips={chips}
        zone={zone}
        dragging={moving}
        plus={blocked || drag ? null : (y) => {
          const price = priceAt(y);
          if (price != null) setMenu({ x: el.clientWidth - chart.priceScale('right').width() - 208, y: y + 12, price });
        }}
        onGrab={(id, tab, clientY) => {
          const l = levelOf(id);
          if (l) hands.current?.grab(tab ? stopLine(ownerOf(l), tab, l.price, true, { pos: l.pos, ord: l.ord, draft: l.draft }) : l, clientY);
        }}
        onHover={(id) => {
          const l = id ? levelOf(id) : undefined;
          hands.current?.hover(l?.pos || l?.ord ? ownerOf(l) : null);
        }}
        onMenu={(id, e) => {
          const r = el.getBoundingClientRect();
          const l = levelOf(id);
          setMenu({ x: e.clientX - r.left, y: e.clientY - r.top, price: blocked || !l ? null : l.price, line: l });
        }}
      />

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
            type="number" step="0.01" min="0.01" value={draft.volume} onChange={(e) => patchDraft({ volume: e.target.value })} aria-label="Lots"
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
