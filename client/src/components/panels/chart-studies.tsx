// Indicators on the Technical Chart: the lazily loaded catalog, per-bar calculation, chart series, legend chips,
// the picker and the settings popover.
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  LineSeries, HistogramSeries, LineStyle, LineType, createSeriesMarkers,
  type IChartApi, type ISeriesApi, type ISeriesMarkersPluginApi, type SeriesMarker, type SeriesType,
  type Time, type UTCTimestamp, type LineWidth,
} from 'lightweight-charts';
import type { IndicatorRegistryEntry, InputConfig } from 'lightweight-charts-indicators';
import { Check, ChevronRight, Eye, EyeOff, PanelBottom, Search, Settings2, Trash2, X } from 'lucide-react';
import type { Bar } from '../../lib/live-candles';
import { SWATCHES, plotKind, digitsFor, markerShape, studyLabel, longName, type PlotKind } from '../../lib/chart-tools';

export type Entry = IndicatorRegistryEntry;

/** One indicator on the chart. `uid` tells two SMAs apart; `inputs` holds only what differs from the defaults. */
export interface Study {
  uid: string;
  id: string;
  inputs: Record<string, unknown>;
  hidden?: boolean;
  plots?: Record<string, { color?: string; hidden?: boolean }>;
}

/** Indicator line colors: clear of green/red (bull/bear) */
export const PALETTE = ['#38bdf8', '#a78bfa', '#f472b6', '#2dd4bf', '#facc15', '#60a5fa', '#e879f9', '#cbd5e1'];

export const DEFAULT_STUDIES: Study[] = [
  { uid: 'sma20', id: 'sma', inputs: { len: 20 }, plots: { plot0: { color: PALETTE[0] } } },
  { uid: 'ema50', id: 'ema', inputs: { length: 50 }, plots: { plot0: { color: PALETTE[1] } } },
];

export const isStudyList = (v: unknown): boolean =>
  Array.isArray(v) && v.every((s) => s && typeof s.uid === 'string' && typeof s.id === 'string' && typeof s.inputs === 'object');

let catalog: Promise<Map<string, Entry>> | null = null;

/** The 457-indicator catalog is ~1.9 MB, so it loads in its own chunk when the chart first opens */
export function useIndicatorRegistry() {
  const [reg, setReg] = useState<Map<string, Entry> | null>(null);
  useEffect(() => {
    let live = true;
    catalog ??= import('lightweight-charts-indicators').then((m) => new Map(m.indicatorRegistry.map((e) => [e.id, e])));
    catalog.then((r) => { if (live) setReg(r); }, () => { catalog = null; });
    return () => { live = false; };
  }, []);
  return reg;
}

const shownPlots = (e: Entry) => e.plotConfig.filter((p) => p.display !== 'none' && p.color !== 'transparent');

/** A new indicator: its first line takes the next unused palette color (histograms keep their per-bar colors) */
export function newStudy(e: Entry, existing: Study[]): Study {
  const first = shownPlots(e)[0];
  const used = new Set(existing.map((s) => s.plots && Object.values(s.plots)[0]?.color));
  const color = PALETTE.find((c) => !used.has(c)) ?? PALETTE[existing.length % PALETTE.length];
  return {
    uid: Math.random().toString(36).slice(2, 10),
    id: e.id,
    inputs: {},
    plots: first && plotKind(first.style) !== 'histogram' ? { [first.id]: { color } } : undefined,
  };
}

// ─── Calculation ───

export interface PlotOut {
  id: string;
  title: string;
  color: string;
  kind: PlotKind;
  width: LineWidth;
  hidden: boolean;
  data: { time: UTCTimestamp; value?: number; color?: string }[];
}

export interface StudyOut {
  study: Study;
  entry: Entry;
  label: string;
  plots: PlotOut[];
  /** 0 = on the price pane; oscillators get panes 1, 2, … in list order (v5 drops a pane once it's empty) */
  pane: number;
  /** Decimals for its own pane (axis and legend), from the size of its values */
  digits: number;
  markers: SeriesMarker<Time>[];
}

interface Result {
  plots?: Record<string, { time: number; value: number | null; color?: string }[]>;
  markers?: { time: number; position: string; shape: string; color: string; text?: string }[];
}

// ponytail: every study recalculates on each live tick; memoize per study if long histories get slow
export function useStudyOutputs(reg: Map<string, Entry> | null, studies: Study[], candles: Bar[]): StudyOut[] {
  return useMemo(() => {
    if (!reg || !candles.length) return [];
    const bars = candles.map((c) => ({ time: c.timestamp, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume }));
    const out: StudyOut[] = [];
    let panes = 0;
    for (const study of studies) {
      const entry = reg.get(study.id);
      if (!entry) continue; // no longer in the catalog
      const inputs = { ...entry.defaultInputs, ...study.inputs };
      let res: Result = {};
      try { res = entry.calculate(bars, inputs) as Result; } catch { /* bad inputs: the legend still shows it, with no lines */ }
      const plots = shownPlots(entry).map((p): PlotOut => {
        const own = study.plots?.[p.id];
        return {
          id: p.id,
          title: p.title,
          color: own?.color ?? p.color,
          kind: plotKind(p.style),
          width: Math.min(4, Math.max(1, p.lineWidth || 1)) as LineWidth,
          hidden: !!own?.hidden,
          // Nulls stay as whitespace so gaps read as gaps; a picked color wins over per-bar colors
          data: (res.plots?.[p.id] ?? []).map((pt) =>
            pt.value == null || !Number.isFinite(pt.value)
              ? { time: pt.time as UTCTimestamp }
              : { time: pt.time as UTCTimestamp, value: pt.value, ...(pt.color && !own?.color ? { color: pt.color } : {}) }),
        };
      });
      const markers = (res.markers ?? []).map((m): SeriesMarker<Time> => ({
        time: m.time as UTCTimestamp,
        position: m.position === 'aboveBar' || m.position === 'belowBar' ? m.position : 'inBar',
        shape: markerShape(m.shape),
        color: m.color,
        text: m.text,
      }));
      let max = 0;
      for (const p of plots) for (const d of p.data) if (d.value != null) max = Math.max(max, Math.abs(d.value));
      const pane = entry.overlay || !plots.length ? 0 : ++panes;
      out.push({ study, entry, label: studyLabel(entry.shortName, entry.inputConfig, inputs), plots, pane, digits: digitsFor(max), markers });
    }
    return out;
  }, [reg, studies, candles]);
}

// ─── Chart series ───

const DASH = { solid: LineStyle.Solid, dashed: LineStyle.Dashed, dotted: LineStyle.Dotted } as const;

const formatOf = (digits: number) => ({ type: 'price' as const, precision: digits, minMove: 10 ** -digits });

function addPlot(chart: IChartApi, p: PlotOut, o: StudyOut): ISeriesApi<SeriesType> {
  const pane = o.pane;
  // Oscillators show their last value on their own axis; overlays don't crowd the price axis
  const common = { color: p.color, priceLineVisible: false, lastValueVisible: pane > 0, ...(pane > 0 ? { priceFormat: formatOf(o.digits) } : {}) };
  if (p.kind === 'histogram') return chart.addSeries(HistogramSeries, common, pane);
  return chart.addSeries(LineSeries, {
    ...common,
    lineWidth: p.width,
    crosshairMarkerVisible: false,
    ...(p.kind === 'step' ? { lineType: LineType.WithSteps } : {}),
    ...(p.kind === 'points' ? { lineVisible: false, pointMarkersVisible: true, pointMarkersRadius: 1.5 } : {}),
  }, pane);
}

/** One chart series per plot, kept in step with `outputs`; pattern markers go on `host` (the visible price series). */
export function useStudySeries(chart: IChartApi | null, host: ISeriesApi<SeriesType> | null, outputs: StudyOut[]) {
  const made = useRef({ chart, all: new Map<string, Map<string, ISeriesApi<SeriesType>>>() });

  useEffect(() => {
    if (!chart) return;
    if (made.current.chart !== chart) made.current = { chart, all: new Map() }; // a new chart has none of the old series
    const { all } = made.current;
    const keep = new Set(outputs.map((o) => o.study.uid));
    for (const [uid, series] of all) {
      if (keep.has(uid)) continue;
      series.forEach((s) => chart.removeSeries(s));
      all.delete(uid);
    }
    for (const o of outputs) {
      let series = all.get(o.study.uid);
      if (!series) {
        series = new Map(o.plots.map((p) => [p.id, addPlot(chart, p, o)]));
        const first = series.values().next().value;
        for (const h of o.entry.hlineConfig ?? []) {
          if (h.display === 'none') continue;
          first?.createPriceLine({
            price: h.price, color: h.color ?? '#787B86', lineWidth: 1, lineStyle: DASH[h.linestyle ?? 'solid'],
            axisLabelVisible: false, title: '',
          });
        }
        all.set(o.study.uid, series);
      }
      for (const p of o.plots) {
        const s = series.get(p.id);
        s?.applyOptions({ visible: !o.study.hidden && !p.hidden, color: p.color, ...(o.pane > 0 ? { priceFormat: formatOf(o.digits) } : {}) });
        s?.setData(p.data);
      }
    }
  }, [chart, outputs]);

  const markers = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  useEffect(() => {
    if (!host) return;
    const m = createSeriesMarkers(host, []);
    markers.current = m;
    return () => {
      markers.current = null;
      try { m.detach(); } catch { /* chart already removed */ }
    };
  }, [host]);
  useEffect(() => {
    const list = outputs.filter((o) => !o.study.hidden).flatMap((o) => o.markers);
    markers.current?.setMarkers(list.sort((a, b) => (a.time as number) - (b.time as number)));
  }, [outputs, host]);
}

/** Each pane's top edge inside `el`, kept fresh as panes are added, removed or resized by their separators */
export function usePaneTops(chart: IChartApi | null, el: HTMLElement | null, panes: number) {
  const [tops, setTops] = useState<number[]>([]);
  useEffect(() => {
    if (!chart || !el) return;
    const measure = () => {
      const base = el.getBoundingClientRect().top;
      const next = chart.panes().map((p) => Math.round((p.getHTMLElement()?.getBoundingClientRect().top ?? base) - base));
      setTops((prev) => (prev.length === next.length && prev.every((v, i) => v === next[i]) ? prev : next));
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    // Pane rows appear on the chart's next frame
    const raf = requestAnimationFrame(() => {
      chart.panes().forEach((p) => { const h = p.getHTMLElement(); if (h) ro.observe(h); });
      measure();
    });
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [chart, el, panes]);
  return tops;
}

// ─── Legend chips ───

interface ChipProps {
  o: StudyOut;
  index: number;
  fmt: (v: number) => string;
  onToggle: () => void;
  onEdit: () => void;
  onRemove: () => void;
}

function IconButton({ label, onClick, big = false, children }: { label: string; onClick: () => void; big?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`${big ? 'w-6 h-6 hover:bg-white/[0.06]' : 'w-4 h-4'} shrink-0 flex items-center justify-center text-white/50 hover:text-white`}
    >
      {children}
    </button>
  );
}

/**
 * A pane's legend: the first `limit` chips, then "+N more". Expanded, it scrolls within `maxHeight` so 30–40 indicators
 * never spill over the chart; the full list with settings lives in the picker's "On chart" section.
 */
export function LegendList({ items, limit, maxHeight, render }: {
  items: StudyOut[];
  limit: number;
  maxHeight: number;
  render: (o: StudyOut, row: number) => React.ReactNode;
}) {
  const [expanded, setOpen] = useState(false);
  const extra = items.length - limit;
  const open = expanded && extra > 0;
  const shown = open || extra <= 0 ? items : items.slice(0, limit);
  return (
    <>
      <div
        className={`flex flex-col items-start gap-0.5 ${
          open ? '-ml-1 pl-1 pr-1 py-0.5 pointer-events-auto overflow-y-auto overscroll-contain no-scrollbar bg-black/80 border border-white/[0.06]' : ''
        }`}
        style={open ? { maxHeight: Math.max(40, maxHeight) } : undefined}
      >
        {shown.map(render)}
      </div>
      {extra > 0 && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="pointer-events-auto h-[18px] -ml-1 px-1 text-mini text-white/55 hover:text-white border border-transparent hover:border-white/[0.06] hover:bg-black/80"
        >
          {open ? 'Show less' : `+${extra} more`}
        </button>
      )}
    </>
  );
}

/** Legend chip: color, name + inputs, the values under the crosshair; eye / settings / remove on hover */
export function StudyChip({ o, index, fmt, onToggle, onEdit, onRemove }: ChipProps) {
  const off = !!o.study.hidden;
  const values = off ? [] : o.plots.filter((p) => !p.hidden).slice(0, 4).map((p) => ({ p, v: p.data[index]?.value }));
  const f = o.pane ? (v: number) => v.toFixed(o.digits) : fmt;
  return (
    <div className="group flex items-center gap-1.5 h-[18px] -ml-1 pl-1 pr-0.5 pointer-events-auto border border-transparent hover:border-white/[0.06] hover:bg-black/80 focus-within:bg-black/80">
      <span className="w-1.5 h-1.5 shrink-0" style={{ background: off ? 'color-mix(in srgb, var(--color-fg) 20%, transparent)' : o.plots[0]?.color ?? 'var(--color-neutral)' }} />
      <button type="button" onClick={onEdit} className={`text-mini hover:text-white ${off ? 'text-white/30 line-through' : 'text-white/75'}`}>
        {o.label}
      </button>
      {values.map(({ p, v }) => v != null && (
        <span key={p.id} className="text-mini tabular-nums" style={{ color: p.color }}>{f(v)}</span>
      ))}
      <span className="flex items-center opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-100 motion-reduce:transition-none">
        <IconButton label={off ? 'Show' : 'Hide'} onClick={onToggle}>{off ? <EyeOff size={11} /> : <Eye size={11} />}</IconButton>
        <IconButton label="Settings" onClick={onEdit}><Settings2 size={11} /></IconButton>
        <IconButton label="Remove" onClick={onRemove}><X size={11} /></IconButton>
      </span>
    </div>
  );
}

// ─── Popover shell (outside click + Escape close) ───

/** Closes on Escape or a mousedown outside `ref` — except on the button that toggles it (marked data-popover-trigger) */
function useDismiss(ref: React.RefObject<HTMLElement | null>, onClose: () => void) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Element;
      if (!ref.current?.contains(t) && !t.closest?.('[data-popover-trigger]')) close.current();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close.current(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [ref]);
}

const field = 'h-6 !py-0 !px-1.5 text-mini !bg-black !border-white/10';

// ─── Picker ───

const CATEGORIES = [
  'Popular', 'Moving Averages', 'Trend', 'Momentum', 'Oscillators', 'Volatility', 'Channels & Bands', 'Volume', 'Candlestick Patterns', 'Community',
] as const;
type Category = (typeof CATEGORIES)[number] | 'On chart';
const CATEGORY_LABEL: Partial<Record<Category, string>> = {
  'Moving Averages': 'Moving averages', 'Channels & Bands': 'Channels & bands', 'Candlestick Patterns': 'Candle patterns',
};
const POPULAR = ['sma', 'ema', 'vwap', 'bb', 'rsi', 'macd', 'stoch', 'atr', 'adx', 'ichimoku', 'supertrend', 'parabolic-sar', 'obv', 'cci'];

interface Row { key: string; name: string; short: string; pane: boolean; entry?: Entry }
const VOLUME_ROW: Row = { key: 'volume', name: 'Volume', short: 'VOL', pane: false };
const rowOf = (e: Entry): Row => ({ key: e.id, name: longName(e.name, e.shortName), short: e.shortName, pane: !e.overlay, entry: e });
const byName = (a: Row, b: Row) => a.name.localeCompare(b.name);

interface PickerProps {
  reg: Map<string, Entry> | null;
  studies: Study[];
  volume: boolean;
  /** Under the Indicators button, in the chart root's coordinates */
  at: { left: number; top: number };
  onAdd: (e: Entry) => void;
  onStudy: (s: Study) => void;
  onRemoveStudy: (uid: string) => void;
  onVolume: (on: boolean) => void;
  /** Clears every indicator, volume included */
  onRemoveAll: () => void;
  onClose: () => void;
}

export function IndicatorPicker({ reg, studies, volume, at, onAdd, onStudy, onRemoveStudy, onVolume, onRemoveAll, onClose }: PickerProps) {
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, onClose);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<Category>('Popular');
  const [active, setActive] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const onChart = studies.length + (volume ? 1 : 0);

  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), 3000);
    return () => clearTimeout(t);
  }, [confirming]);

  const rows = useMemo(() => {
    if (!reg) return [];
    const all = [...reg.values()];
    const needle = q.trim().toLowerCase();
    if (!needle && cat === 'On chart') return [];
    let list: Row[];
    if (needle) {
      // "rsi" puts RSI first: exact short name, then prefixes, then anywhere; standard before community
      const rank = (e: Entry) => {
        const s = e.shortName.toLowerCase(), n = longName(e.name, e.shortName).toLowerCase();
        return (s === needle ? 0 : s.startsWith(needle) || n.startsWith(needle) ? 1 : 2) + (e.group === 'community' ? 3 : 0);
      };
      list = all
        .filter((e) => e.name.toLowerCase().includes(needle) || e.shortName.toLowerCase().includes(needle))
        .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
        .map(rowOf);
    } else if (cat === 'Popular') {
      list = POPULAR.flatMap((id) => (reg.has(id) ? [rowOf(reg.get(id)!)] : []));
    } else if (cat === 'Community') {
      list = all.filter((e) => e.group === 'community').map(rowOf).sort(byName);
    } else {
      list = all.filter((e) => e.group !== 'community' && e.category === cat).map(rowOf).sort(byName);
    }
    const withVolume = needle ? 'volume'.includes(needle) : cat === 'Popular' || cat === 'Volume';
    return withVolume ? [VOLUME_ROW, ...list] : list;
  }, [reg, q, cat]);

  useEffect(() => setActive(0), [q, cat]);
  useEffect(() => {
    document.getElementById(`ind-opt-${active}`)?.scrollIntoView({ block: 'nearest' }); // returns a Promise in newer Chrome: not a cleanup
  }, [active]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of studies) m.set(s.id, (m.get(s.id) ?? 0) + 1);
    return m;
  }, [studies]);

  const pick = (r?: Row) => {
    if (!r) return;
    if (r.entry) onAdd(r.entry);
    else onVolume(!volume);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(rows.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(rows[active]); }
  };

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Indicators"
      className="absolute z-50 w-[min(440px,calc(100%-16px))] flex flex-col bg-zinc-900 border border-white/10 shadow-2xl animate-pop"
      style={{ left: at.left, top: at.top, height: `min(520px, calc(100% - ${at.top + 8}px))` }}
    >
      <div className="flex items-center gap-2 h-9 shrink-0 pl-3 pr-1.5 border-b border-white/[0.06]">
        <Search size={13} className="text-white/35 shrink-0" aria-hidden />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKey}
          placeholder={reg ? `Search ${reg.size} indicators` : 'Search indicators'}
          role="combobox"
          aria-expanded
          aria-controls="ind-list"
          aria-activedescendant={rows.length ? `ind-opt-${active}` : undefined}
          aria-label="Search indicators"
          className="flex-1 min-w-0 h-7 text-xs text-white !bg-transparent !border-0 !p-0 !shadow-none"
        />
        <button type="button" onClick={onClose} aria-label="Close" className="w-6 h-6 flex items-center justify-center text-white/40 hover:text-white">
          <X size={13} />
        </button>
      </div>

      <div className="flex flex-1 min-h-0 @max-lg:flex-col">
        <nav aria-label="Categories" className="w-32 shrink-0 py-1 overflow-y-auto border-r border-white/[0.06] @max-lg:w-auto @max-lg:flex @max-lg:overflow-x-auto @max-lg:py-0 @max-lg:border-r-0 @max-lg:border-b no-scrollbar">
          {(['On chart', ...CATEGORIES] as Category[]).map((c) => {
            const on = !q && c === cat;
            return (
              <button
                key={c}
                type="button"
                onClick={() => { setCat(c); setQ(''); }}
                aria-current={on || undefined}
                className={`relative w-full @max-lg:w-auto shrink-0 flex items-center justify-between gap-2 text-left whitespace-nowrap h-7 px-3 text-mini ${
                  on ? 'text-accent-ink bg-accent/10' : 'text-white/55 hover:text-white hover:bg-white/5'
                } ${c === 'On chart' ? 'mb-1 @max-lg:mb-0 border-b border-white/[0.06] @max-lg:border-b-0 @max-lg:border-r' : ''}`}
              >
                {on && <span className="absolute left-0 top-1 bottom-1 w-0.5 bg-accent @max-lg:top-auto @max-lg:bottom-0 @max-lg:left-1 @max-lg:right-1 @max-lg:w-auto @max-lg:h-0.5" aria-hidden />}
                {CATEGORY_LABEL[c as keyof typeof CATEGORY_LABEL] ?? c}
                {c === 'On chart' && <span className={on ? 'text-accent-ink/70' : 'text-white/35'}>{onChart}</span>}
              </button>
            );
          })}
        </nav>

        {reg && !q.trim() && cat === 'On chart' ? (
          <AppliedList reg={reg} studies={studies} volume={volume} onStudy={onStudy} onRemove={onRemoveStudy} onVolume={onVolume} />
        ) : (
        <ul id="ind-list" role="listbox" aria-label="Indicators" className="flex-1 min-h-0 overflow-y-auto py-1">
          {!reg && <li className="px-3 py-6 text-center text-mini text-white/40">Loading indicators…</li>}
          {reg && !rows.length && <li className="px-3 py-6 text-center text-mini text-white/40">No indicators match "{q.trim()}".</li>}
          {rows.map((r, i) => {
            const n = r.entry ? counts.get(r.key) ?? 0 : volume ? 1 : 0;
            return (
              <li
                key={r.key}
                id={`ind-opt-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(r)}
                className={`flex items-center gap-2 h-[26px] px-3 cursor-pointer text-mini ${i === active ? 'bg-white/[0.06] text-white' : 'text-white/70'}`}
              >
                <span className="w-3 shrink-0 text-accent-ink" aria-label={n ? 'On chart' : undefined}>{n > 0 && <Check size={11} />}</span>
                <span className="flex-1 truncate">{r.name}</span>
                {r.pane && <PanelBottom size={11} className="shrink-0 text-white/25" aria-label="Opens in its own pane" />}
                <span className="w-20 shrink-0 text-right truncate text-white/35">{r.short}{n > 1 ? ` ×${n}` : ''}</span>
              </li>
            );
          })}
        </ul>
        )}
      </div>

      {onChart > 0 && (
        <div className="flex items-center justify-between h-9 shrink-0 pl-1.5 pr-1.5 border-t border-white/[0.06]">
          <button
            type="button"
            onClick={() => { setCat('On chart'); setQ(''); }}
            className={`h-6 px-1.5 text-mini ${!q.trim() && cat === 'On chart' ? 'text-white/40 cursor-default' : 'text-white/50 hover:text-white underline-offset-2 hover:underline'}`}
          >
            {onChart} on chart
          </button>
          <button
            type="button"
            onClick={() => { if (confirming) { onRemoveAll(); setConfirming(false); } else setConfirming(true); }}
            className={`h-6 px-2 flex items-center gap-1.5 text-mini ${confirming ? 'text-white bg-red-600' : 'text-white/50 hover:text-red-400 hover:bg-red-500/10'}`}
          >
            <Trash2 size={12} aria-hidden />
            {confirming ? 'Click again to remove all' : 'Remove all'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Settings ───

const SOURCES = ['open', 'high', 'low', 'close', 'hl2', 'hlc3', 'ohlc4', 'hlcc4'];

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`w-3.5 h-3.5 border flex items-center justify-center ${on ? 'bg-accent/25 border-accent text-accent-ink' : 'border-white/25 hover:border-white/50'}`}
    >
      {on && <Check size={9} strokeWidth={3} />}
    </button>
  );
}

function InputRow({ uid, def, value, onChange }: { uid: string; def: InputConfig; value: unknown; onChange: (v: unknown) => void }) {
  const id = `ind-in-${uid}-${def.id}`;
  let control: React.ReactNode;
  if (def.type === 'int' || def.type === 'float') {
    control = (
      <input
        id={id}
        type="number"
        defaultValue={String(value)}
        min={def.min}
        max={def.max}
        step={def.step ?? (def.type === 'int' ? 1 : 0.1)}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (e.target.value === '' || !Number.isFinite(v)) return;
          if ((def.min != null && v < def.min) || (def.max != null && v > def.max)) return;
          onChange(def.type === 'int' ? Math.round(v) : v);
        }}
        className={`${field} w-20 text-right`}
      />
    );
  } else if (def.type === 'bool') {
    control = <Toggle on={!!value} onChange={onChange} label={def.title ?? def.id} />;
  } else if (def.type === 'source' || def.options?.length) {
    const opts = def.type === 'source' ? SOURCES : def.options!;
    control = (
      <select id={id} value={String(value)} onChange={(e) => onChange(e.target.value)} className={`${field} max-w-[9rem] border`} style={{ colorScheme: 'dark' }}>
        {opts.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  } else {
    control = <input id={id} defaultValue={String(value ?? '')} onChange={(e) => onChange(e.target.value)} className={`${field} w-28`} />;
  }
  return (
    <div className="flex items-center justify-between gap-3 min-h-[28px] px-3">
      <label htmlFor={id} className="text-mini text-white/60 truncate">{def.title ?? def.id}</label>
      {control}
    </div>
  );
}

/** Back to the defaults, keeping the palette color the first line was given when it was added */
function resetStudy(study: Study, entry: Entry): Study {
  const first = shownPlots(entry)[0];
  const keep = first && study.plots?.[first.id]?.color;
  return { ...study, inputs: {}, plots: keep ? { [first.id]: { color: keep } } : undefined };
}

/** Inputs, then one row per line (color + show/hide). Every change applies at once; remount (key) after a reset. */
function SettingsBody({ study, entry, onChange }: { study: Study; entry: Entry; onChange: (s: Study) => void }) {
  const [picking, setPicking] = useState<string | null>(null);
  const inputs = entry.inputConfig.filter((i) => i.type !== 'color');
  const plots = shownPlots(entry).map((p) => ({
    id: p.id,
    title: p.title,
    color: study.plots?.[p.id]?.color ?? p.color,
    hidden: !!study.plots?.[p.id]?.hidden,
  }));
  const setInput = (id: string, v: unknown) => onChange({ ...study, inputs: { ...study.inputs, [id]: v } });
  const setPlot = (id: string, change: { color?: string; hidden?: boolean }) =>
    onChange({ ...study, plots: { ...study.plots, [id]: { ...study.plots?.[id], ...change } } });

  if (!inputs.length && !plots.length) return <p className="px-3 py-3 text-mini text-white/40">This indicator has no settings.</p>;
  return (
    <>
      {inputs.map((def) => (
        <InputRow key={def.id} uid={study.uid} def={def} value={study.inputs[def.id] ?? def.defval} onChange={(v) => setInput(def.id, v)} />
      ))}
      {inputs.length > 0 && plots.length > 0 && <div className="my-1.5 mx-3 border-t border-white/[0.06]" />}
      {plots.map((p) => (
        <div key={p.id}>
          <div className="flex items-center gap-2 min-h-[28px] px-3">
            <button
              type="button"
              aria-label={`${p.title} color`}
              aria-expanded={picking === p.id}
              onClick={() => setPicking(picking === p.id ? null : p.id)}
              className="w-4 h-4 shrink-0 border border-white/20 hover:border-white/50"
              style={{ background: p.color }}
            />
            <span className={`flex-1 truncate text-mini ${p.hidden ? 'text-white/30' : 'text-white/60'}`}>{p.title}</span>
            <IconButton label={p.hidden ? `Show ${p.title}` : `Hide ${p.title}`} onClick={() => setPlot(p.id, { hidden: !p.hidden })}>
              {p.hidden ? <EyeOff size={11} /> : <Eye size={11} />}
            </IconButton>
          </div>
          {picking === p.id && (
            <div className="flex flex-wrap gap-1 px-3 pb-1.5 pl-9">
              {SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  onClick={() => { setPlot(p.id, { color: c }); setPicking(null); }}
                  className={`w-4 h-4 border ${c.toLowerCase() === p.color.toLowerCase() ? 'border-accent' : 'border-transparent hover:border-white/50'}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </>
  );
}

interface SettingsProps {
  o: StudyOut;
  top: number;
  onChange: (s: Study) => void;
  onClose: () => void;
}

/** Settings popover opened from a legend chip */
export function StudySettings({ o, top, onChange, onClose }: SettingsProps) {
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, onClose);
  const [reset, setReset] = useState(0);
  const { study, entry } = o;

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`${o.label} settings`}
      className="absolute z-50 left-2 w-[min(300px,calc(100%-16px))] flex flex-col bg-zinc-900 border border-white/10 shadow-2xl animate-pop"
      style={{ top, maxHeight: `calc(100% - ${top + 8}px)` }}
    >
      <div className="flex items-center gap-2 h-9 shrink-0 pl-3 pr-1.5 border-b border-white/[0.06]">
        <span className="flex-1 truncate text-xs text-white">{longName(entry.name, entry.shortName)}</span>
        <span className="text-mini text-white/35">{entry.shortName}</span>
        <button type="button" onClick={onClose} aria-label="Close" className="w-6 h-6 flex items-center justify-center text-white/40 hover:text-white">
          <X size={13} />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto py-1.5">
        <SettingsBody key={reset} study={study} entry={entry} onChange={onChange} />
      </div>

      <div className="flex items-center justify-between h-9 shrink-0 px-1.5 border-t border-white/[0.06]">
        <button type="button" onClick={() => { onChange(resetStudy(study, entry)); setReset((n) => n + 1); }} className="h-6 px-2 text-mini text-white/50 hover:text-white">
          Reset
        </button>
        <button type="button" onClick={onClose} className="h-6 px-3 text-mini font-bold text-accent-ink border border-accent/40 hover:bg-accent/15">Done</button>
      </div>
    </div>
  );
}

// ─── Picker: "On chart" section ───

/** Every indicator on the chart, in order: hide, remove, or expand one to edit its settings in place */
function AppliedList({ reg, studies, volume, onStudy, onRemove, onVolume }: {
  reg: Map<string, Entry>;
  studies: Study[];
  volume: boolean;
  onStudy: (s: Study) => void;
  onRemove: (uid: string) => void;
  onVolume: (on: boolean) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [reset, setReset] = useState(0);
  // An expanded row near the bottom brings its settings into view
  useEffect(() => {
    if (open) document.getElementById(`applied-${open}`)?.scrollIntoView({ block: 'nearest' }); // a Promise in newer Chrome: not a cleanup
  }, [open]);

  if (!studies.length && !volume) {
    return <p className="flex-1 px-6 py-8 text-center text-mini leading-relaxed text-white/40">Nothing on the chart yet. Pick an indicator from a category, or search above.</p>;
  }
  return (
    <ul aria-label="On the chart" className="flex-1 min-h-0 overflow-y-auto py-1">
      {volume && (
        <li className="flex items-center gap-2 h-[30px] pl-3 pr-1.5">
          <span className="w-[11px] shrink-0" aria-hidden />
          <span className="w-2 h-2 shrink-0 bg-emerald-500/50" aria-hidden />
          <span className="text-mini text-white">Volume</span>
          <span className="flex-1 truncate text-mini text-white/35">Bars under the price</span>
          <IconButton big label="Remove Volume" onClick={() => onVolume(false)}><X size={12} /></IconButton>
        </li>
      )}
      {studies.map((s) => {
        const e = reg.get(s.id);
        if (!e) return null;
        const label = studyLabel(e.shortName, e.inputConfig, { ...e.defaultInputs, ...s.inputs });
        const first = shownPlots(e)[0];
        const color = first ? s.plots?.[first.id]?.color ?? first.color : 'var(--color-neutral)';
        const isOpen = open === s.uid;
        return (
          <li key={s.uid} id={`applied-${s.uid}`} className={isOpen ? 'bg-black/30 border-y border-white/[0.06]' : undefined}>
            <div className="flex items-center gap-2 h-[30px] pl-3 pr-1.5">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : s.uid)}
                aria-expanded={isOpen}
                aria-label={`${label} settings`}
                className="flex-1 min-w-0 flex items-center gap-2 h-full text-left group"
              >
                <ChevronRight size={11} className={`shrink-0 text-white/30 group-hover:text-white transition-transform duration-100 motion-reduce:transition-none ${isOpen ? 'rotate-90' : ''}`} aria-hidden />
                <span className="w-2 h-2 shrink-0" style={{ background: s.hidden ? 'color-mix(in srgb, var(--color-fg) 20%, transparent)' : color }} aria-hidden />
                <span className={`shrink-0 text-mini ${s.hidden ? 'text-white/35 line-through' : 'text-white'}`}>{label}</span>
                <span className="flex-1 truncate text-mini text-white/35">{longName(e.name, e.shortName)}</span>
              </button>
              {!e.overlay && <PanelBottom size={11} className="shrink-0 text-white/25" aria-label="In its own pane" />}
              <IconButton big label={s.hidden ? `Show ${label}` : `Hide ${label}`} onClick={() => onStudy({ ...s, hidden: !s.hidden })}>
                {s.hidden ? <EyeOff size={12} /> : <Eye size={12} />}
              </IconButton>
              <IconButton big label={`Remove ${label}`} onClick={() => { onRemove(s.uid); if (isOpen) setOpen(null); }}>
                <X size={12} />
              </IconButton>
            </div>
            {isOpen && (
              <div className="pb-2 pl-5">
                <SettingsBody key={reset} study={s} entry={e} onChange={onStudy} />
                <button
                  type="button"
                  onClick={() => { onStudy(resetStudy(s, e)); setReset((n) => n + 1); }}
                  className="ml-1.5 mt-1 h-6 px-2 text-mini text-white/50 hover:text-white"
                >
                  Reset to defaults
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
