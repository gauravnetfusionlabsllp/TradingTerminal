import { useEffect, useLayoutEffect, useRef } from 'react';
import type {
  IChartApi, IPrimitivePaneRenderer, IPrimitivePaneView, ISeriesApi, ISeriesPrimitive, MouseEventParams,
  SeriesAttachedParameter, SeriesType, Time,
} from 'lightweight-charts';
import { stackChips } from '../../lib/chart-trading';
import { alpha, type ChartColors } from '../../lib/theme';

/** One trade line's label: `[0.01 | −1.30 | ×]`, hung left of the price axis at its line's height. */
export interface Chip {
  id: string;
  price: number;
  /** Border / fill colour (the line's) and text colour (AA on raised) */
  color: string;
  ink: string;
  /** Entry chips fill their volume segment */
  entry: boolean;
  vol: string;
  value?: string;
  tone?: 'up' | 'down';
  /** Tooltip: what + distance, then price + ticket */
  tip: [string, string];
  /** Unset SL / TP on an entry: drag the tab out to set one */
  tabs: ('tp' | 'sl')[];
  drag: boolean;
  lit: boolean;
  dim: boolean;
  onX?: () => void;
  xLabel: string;
}

/** The lit trade's risk / reward: shaded to its TP and SL, joined by a handle rail near the axis */
export interface Zone { entry: number; sl?: number; tp?: number; color: string }

const CHIP_H = 20;
const AXIS_GAP = 56; // breathing space between the chips and the price axis
const RAIL_X = 34; // handle rail, from the pane's right edge
const PLUS_R = 6; // "+" button's right edge, from the pane's right edge

type Target = Parameters<IPrimitivePaneRenderer['draw']>[0];

/** Draws the zone and rail on the price pane, and re-places the HTML chips on every viewport change */
class Overlay implements ISeriesPrimitive<Time> {
  zone: Zone | null = null;
  colors: { tp: string; sl: string; panel: string } = { tp: '', sl: '', panel: '' };
  private req?: () => void;
  private readonly views: IPrimitivePaneView[];

  constructor(private readonly series: ISeriesApi<SeriesType>, private readonly onViews: () => void) {
    this.views = [
      { zOrder: () => 'bottom', renderer: () => ({ draw: (t: Target) => this.drawZone(t) }) },
      { zOrder: () => 'top', renderer: () => ({ draw: (t: Target) => this.drawRail(t) }) },
    ];
  }

  attached({ requestUpdate }: SeriesAttachedParameter<Time>) { this.req = requestUpdate; }
  detached() { this.req = undefined; }
  update() { this.req?.(); }
  // Called before every redraw — pan, zoom, autoscale, resize, new ticks
  updateAllViews() { this.onViews(); }
  paneViews() { return this.views; }

  private y = (p?: number): number | null => (p ? this.series.priceToCoordinate(p) : null);

  private drawZone(t: Target) {
    const z = this.zone;
    const e = z && this.y(z.entry);
    if (!z || e == null) return;
    t.useMediaCoordinateSpace(({ context: ctx, mediaSize: { width } }) => {
      for (const [p, c, a] of [[z.tp, this.colors.tp, 0.1], [z.sl, this.colors.sl, 0.1]] as const) {
        const y = this.y(p);
        if (y == null) continue;
        ctx.fillStyle = alpha(c, a);
        ctx.fillRect(0, Math.min(e, y), width, Math.abs(y - e));
      }
    });
  }

  private drawRail(t: Target) {
    const z = this.zone;
    if (!z) return;
    const pts = ([[z.tp, this.colors.tp], [z.entry, z.color], [z.sl, this.colors.sl]] as const)
      .map(([p, c]) => ({ y: this.y(p), c }))
      .filter((p): p is { y: number; c: string } => p.y != null);
    if (!pts.length) return;
    t.useMediaCoordinateSpace(({ context: ctx, mediaSize: { width } }) => {
      const x = width - RAIL_X;
      ctx.strokeStyle = z.color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, pts[0].y);
      ctx.lineTo(x, pts[pts.length - 1].y);
      ctx.stroke();
      for (const { y, c } of pts) {
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, 2 * Math.PI);
        ctx.fillStyle = this.colors.panel;
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = c;
        ctx.stroke();
      }
    });
  }
}

const TAB_NAME = { tp: 'take profit', sl: 'stop loss' } as const;

/**
 * Trade chips over the price pane. Positions are written straight onto the elements from the chart's own redraw
 * (no React render per frame); chips that would overlap step left of each other.
 */
export function TradeChips({ chart, series, colors, chips, zone, dragging, plus, onGrab, onHover, onMenu }: {
  chart: IChartApi;
  series: ISeriesApi<SeriesType>;
  colors: ChartColors;
  chips: Chip[];
  zone: Zone | null;
  /** Id of the chip whose line is being dragged: its tooltip stays up */
  dragging: string | null;
  /** The crosshair's "+" (order at this price); null hides it */
  plus: ((y: number) => void) | null;
  onGrab: (id: string, tab: 'tp' | 'sl' | null, clientY: number) => void;
  onHover: (id: string | null) => void;
  onMenu: (id: string, e: React.MouseEvent) => void;
}) {
  const nodes = useRef(new Map<string, HTMLDivElement>());
  const list = useRef(chips);
  list.current = chips;

  const place = () => {
    const paneH = chart.panes()[0]?.getHeight() ?? 0;
    const right = chart.priceScale('right').width() + AXIS_GAP;
    // Read every width before writing any transform: one layout, not one per chip
    const rows = list.current.flatMap((c) => {
      const node = nodes.current.get(c.id);
      return node ? [{ node, y: series.priceToCoordinate(c.price), w: node.offsetWidth }] : [];
    });
    const on = rows.filter((r): r is typeof r & { y: number } => r.y != null && r.y >= 0 && r.y <= paneH);
    const xs = stackChips(on.map((r) => ({ y: r.y, h: CHIP_H + 2, w: r.w })), 4);
    for (const r of rows) r.node.style.visibility = 'hidden';
    on.forEach((r, i) => {
      r.node.style.visibility = '';
      r.node.style.transform = `translate(${-(right + xs[i])}px, ${Math.round(r.y - CHIP_H / 2)}px)`;
    });
  };
  const placeRef = useRef(place);
  placeRef.current = place;

  const overlay = useRef<Overlay | null>(null);
  useEffect(() => {
    const o = new Overlay(series, () => placeRef.current());
    series.attachPrimitive(o);
    overlay.current = o;
    return () => {
      overlay.current = null;
      try { series.detachPrimitive(o); } catch { /* chart gone */ }
    };
  }, [series]);

  useEffect(() => {
    const o = overlay.current;
    if (!o) return;
    o.zone = zone;
    o.colors = { tp: colors.bullish, sl: colors.orange, panel: colors.panel };
    o.update();
  }, [zone, colors]);

  // Text changes widths (and new chips need a place) without a chart redraw
  useLayoutEffect(() => placeRef.current());

  // "+" rides the crosshair just left of the axis; it stays put while hovered, or it would run from the pointer
  const plusEl = useRef<HTMLButtonElement>(null);
  const plusY = useRef(0);
  const plusRef = useRef(plus);
  plusRef.current = plus;
  const on = !!plus;
  useEffect(() => {
    const btn = plusEl.current;
    if (!btn || !on) return;
    let over = false;
    const move = (p: MouseEventParams<Time>) => {
      if (over) return;
      const y = p.point?.y;
      const show = y != null && y <= (chart.panes()[0]?.getHeight() ?? 0) - 8;
      btn.style.visibility = show ? '' : 'hidden';
      if (!show) return;
      plusY.current = y;
      btn.style.transform = `translate(${-(chart.priceScale('right').width() + PLUS_R)}px, ${Math.round(y - 8)}px)`;
    };
    const enter = () => { over = true; };
    const leave = () => { over = false; btn.style.visibility = 'hidden'; };
    btn.addEventListener('mouseenter', enter);
    btn.addEventListener('mouseleave', leave);
    chart.subscribeCrosshairMove(move);
    return () => {
      chart.unsubscribeCrosshairMove(move);
      btn.removeEventListener('mouseenter', enter);
      btn.removeEventListener('mouseleave', leave);
      btn.style.visibility = 'hidden';
    };
  }, [chart, on]);

  // Chip hover through native mouseover / mouseout, not React's onMouseEnter: arriving from the chart canvas, React
  // waits for the canvas's mouseout, which never reaches it — gliding onto a chip would never light its trade
  const layer = useRef<HTMLDivElement>(null);
  const hoverRef = useRef(onHover);
  hoverRef.current = onHover;
  useEffect(() => {
    const box = layer.current;
    if (!box) return;
    const chipOf = (t: EventTarget | null) => (t instanceof Element ? t.closest<HTMLElement>('[data-chip]')?.dataset.chip ?? null : null);
    // Moves inside one chip (between its segments) change nothing; chip to chip is a leave then an enter
    const over = (e: MouseEvent) => { const id = chipOf(e.target); if (id && id !== chipOf(e.relatedTarget)) hoverRef.current(id); };
    const out = (e: MouseEvent) => { const id = chipOf(e.target); if (id && id !== chipOf(e.relatedTarget)) hoverRef.current(null); };
    box.addEventListener('mouseover', over);
    box.addEventListener('mouseout', out);
    return () => { box.removeEventListener('mouseover', over); box.removeEventListener('mouseout', out); };
  }, []);

  const seg = (c: Chip) => ({ borderColor: `color-mix(in srgb, ${c.color} 45%, transparent)` });

  return (
    // display: contents — the chips still position against the chart; this box only hears their hover
    <div ref={layer} className="contents">
      {chips.map((c) => (
        <div
          key={c.id}
          ref={(n) => { if (n) nodes.current.set(c.id, n); else nodes.current.delete(c.id); }}
          role="group"
          aria-label={`${c.tip[0]}, ${c.tip[1]}`}
          onMouseDown={(e) => {
            if (e.button !== 0 || !c.drag) return;
            e.preventDefault();
            onGrab(c.id, null, e.clientY);
          }}
          data-chip={c.id}
          onContextMenu={(e) => { e.preventDefault(); onMenu(c.id, e); }}
          className={`group absolute top-0 right-0 flex items-stretch h-5 rounded-sm border bg-raised text-mini font-mono tabular-nums leading-none whitespace-nowrap select-none shadow-[0_2px_10px_rgb(0_0_0/0.25)] transition-opacity duration-100 motion-reduce:transition-none ${
            c.drag ? 'cursor-ns-resize' : ''
          }`}
          style={{ visibility: 'hidden', borderColor: c.color, color: c.ink, opacity: c.dim ? 0.55 : 1, zIndex: c.lit ? 12 : 11 }}
        >
          <span className="flex items-center px-1.5" style={c.entry ? { background: c.color, color: colors['on-accent'] } : undefined}>
            {c.vol}
          </span>
          {c.value && (
            <span
              className={`flex items-center px-1.5 border-l ${c.tone === 'up' ? 'text-bullish' : c.tone === 'down' ? 'text-bearish' : ''}`}
              style={seg(c)}
            >
              {c.value}
            </span>
          )}
          {c.tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              aria-label={`Drag to set ${TAB_NAME[tab]}`}
              title={`Drag to set ${TAB_NAME[tab]}`}
              onMouseDown={(e) => {
                if (e.button !== 0) return;
                e.preventDefault();
                e.stopPropagation();
                onGrab(c.id, tab, e.clientY);
              }}
              className={`flex items-center px-1.5 border-l text-micro font-bold cursor-ns-resize hover:bg-hover ${tab === 'tp' ? 'text-bullish' : 'text-orange'}`}
              style={seg(c)}
            >
              {tab.toUpperCase()}
            </button>
          ))}
          {c.onX && (
            <button
              type="button"
              aria-label={c.xLabel}
              title={c.xLabel}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={c.onX}
              className="flex items-center px-1.5 border-l cursor-pointer hover:bg-hover"
              style={seg(c)}
            >
              ✕
            </button>
          )}
          <div
            role="tooltip"
            className={`absolute bottom-full right-0 mb-1.5 px-2 py-1 rounded-sm bg-raised border border-border text-fg text-mini leading-snug shadow-[0_4px_16px_rgb(0_0_0/0.3)] pointer-events-none ${
              dragging === c.id ? 'block' : 'hidden group-hover:block'
            }`}
          >
            <div>{c.tip[0]}</div>
            <div className="text-neutral">{c.tip[1]}</div>
          </div>
        </div>
      ))}

      <button
        ref={plusEl}
        type="button"
        aria-label="Order at this price"
        title="Order at this price"
        onClick={() => plusRef.current?.(plusY.current)}
        className="absolute top-0 right-0 z-[13] w-4 h-4 flex items-center justify-center rounded-full border border-neutral/60 bg-raised text-fg text-mini leading-none hover:border-accent hover:text-accent-ink"
        style={{ visibility: 'hidden' }}
      >
        +
      </button>
    </div>
  );
}
