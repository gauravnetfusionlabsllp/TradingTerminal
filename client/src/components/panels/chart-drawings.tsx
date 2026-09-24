// Drawing tools on the Technical Chart. lightweight-charts-drawing renders drawings, selects them and drags their
// anchors; placing them by click, moving a whole drawing, text editing and saving per symbol live here.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { IChartApi, ISeriesApi, SeriesType } from 'lightweight-charts';
import {
  DrawingManager, getToolRegistry,
  type Anchor, type DrawingCategory, type DrawingOptions, type DrawingStyle, type IDrawing, type SerializedDrawing, type Viewport,
} from 'lightweight-charts-drawing';
import { Eye, EyeOff, Lock, LockOpen, MousePointer2, Pencil, Ruler, Shapes, Trash2, Type } from 'lucide-react';
import { usePersisted } from '../../hooks/use-persisted';
import { SWATCHES, snapAnchors, sentenceCase, tint, textOf, setTextOf } from '../../lib/chart-tools';

const registry = getToolRegistry();
type Tool = NonNullable<ReturnType<typeof registry.get>>;

const PREVIEW = '__preview__';
const INK = '#e4e4e7';
const FONT_FAMILY = '"JetBrains Mono", Consolas, monospace';

const TEXT_TOOLS = new Set(['text-annotation', 'callout', 'anchored-text', 'note', 'price-note', 'flag-mark', 'pin', 'comment', 'signpost']);
// Freehand and open-ended tools need drag or double-click placement; click placement covers the rest
const SKIP = new Set(['brush', 'highlighter', 'path', 'polyline', 'table']);
// Tools whose color carries meaning (bullish / bearish marks, long / short zones) keep the library's
const OWN_COLORS = new Set(['arrow-mark-up', 'arrow-mark-down', 'long-position', 'short-position']);
const FILLABLE = new Set<DrawingCategory>(['shape', 'channel', 'measurement']);

/** Alt + key → tool (e.code, so it works on any keyboard layout) */
const SHORTCUTS: Record<string, string> = {
  KeyT: 'trend-line', KeyH: 'horizontal-line', KeyV: 'vertical-line', KeyC: 'cross-line', KeyF: 'fib-retracement', KeyR: 'rectangle',
};
const SHORTCUT_OF = Object.fromEntries(Object.entries(SHORTCUTS).map(([code, t]) => [t, `Alt+${code.slice(3)}`]));

const styleFor = (type: string): Partial<DrawingStyle> =>
  OWN_COLORS.has(type)
    ? { labelFont: `10px ${FONT_FAMILY}`, labelColor: INK }
    : { lineColor: INK, lineWidth: 1, fillColor: tint(INK, 0.06), labelColor: INK, labelFont: `10px ${FONT_FAMILY}` };
// The library's text boxes default to a white fill; ours match the dark surfaces
const TEXT_OPTIONS = { fontSize: 11, fontFamily: FONT_FAMILY, backgroundColor: 'rgba(24,24,27,0.92)', borderColor: 'rgba(255,255,255,0.14)', textColor: INK, padding: 6 };
// The library prints prices as "$1.10" (two decimals): right for gold and indices, wrong for FX. On finer symbols its
// price text is off; levels keep their percentages and the axis shows the price.
const PRICE_TEXT_OFF: Record<string, Record<string, boolean>> = {
  'horizontal-line': { showPrice: false }, 'horizontal-ray': { showPrice: false }, 'cross-line': { showPrice: false },
  'trend-line': { showPriceChange: false }, 'info-line': { showPriceChange: false },
  'fib-retracement': { showPrices: false }, 'fib-extension': { showPrices: false }, 'fib-channel': { showPrices: false },
  'price-range': { showPrices: false, showRange: false }, 'date-price-range': { showPrices: false },
  'long-position': { showPrices: false }, 'short-position': { showPrices: false },
  projection: { showPrices: false }, forecast: { showPrices: false }, 'price-note': { showPrice: false },
};
/** Tool options aren't serialized by the library, so these are reapplied on every load */
const optionsFor = (type: string, precision: number, saved?: Partial<DrawingOptions>) => ({
  ...saved,
  ...(TEXT_TOOLS.has(type) ? TEXT_OPTIONS : {}),
  ...(precision > 2 ? PRICE_TEXT_OFF[type] : {}),
  ...(type === 'price-label' ? { decimals: precision } : {}),
}) as Partial<DrawingOptions>;

const toolName = (type: string) => sentenceCase(registry.get(type)?.name ?? type);
const withShortcut = (type: string) => (SHORTCUT_OF[type] ? `${toolName(type)} (${SHORTCUT_OF[type]})` : toolName(type));

type Saved = SerializedDrawing & { text?: string };
const storageKey = (symbol: string) => `sgfx.drawings.${symbol}`;
function loadSaved(symbol: string): Saved[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(storageKey(symbol)) ?? '[]');
    return Array.isArray(v) ? v.filter((d) => d && typeof d.type === 'string' && Array.isArray(d.anchors)) : [];
  } catch {
    return [];
  }
}

// ─── Hook: one drawing manager per chart mount (the chart remounts per symbol + timeframe) ───

interface Args {
  chart: IChartApi | null;
  series: ISeriesApi<SeriesType> | null;
  el: HTMLElement | null;
  symbol: string;
  /** Bar open times on screen, ascending: saved anchors snap onto them */
  times: number[];
  /** Decimals the symbol quotes in */
  precision: number;
}

export interface Editing { id: string; x: number; y: number; text: string }

export function useDrawings({ chart, series, el, symbol, times, precision }: Args) {
  const dm = useMemo(() => new DrawingManager(), []);
  const [tool, setToolState] = useState<string | null>(null);
  const [placed, setPlaced] = useState(0);
  const [selected, setSelected] = useState<IDrawing | null>(null);
  const [count, setCount] = useState(0);
  const [hidden, setHidden] = useState(false);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [, repaint] = useState(0);
  const [keep, setKeep] = usePersisted('sgfx.drawings.keep', false);

  const pending = useRef<Anchor[]>([]);
  // Anchors as saved vs as snapped onto this timeframe's bars: an untouched drawing saves its original times back
  const snapped = useRef(new Map<string, { saved: Anchor[]; shown: Anchor[] }>());
  const timesRef = useRef(times);
  timesRef.current = times;
  const digits = useRef(precision);
  digits.current = precision;
  const live = useRef({ tool, keep, hidden });
  live.current = { tool, keep, hidden };

  const save = useCallback(() => {
    const out = dm.getAllDrawings().filter((d) => d.id !== PREVIEW).map((d): Saved => {
      const j: Saved = d.toJSON();
      const s = snapped.current.get(d.id);
      if (s && JSON.stringify(j.anchors) === JSON.stringify(s.shown)) j.anchors = s.saved;
      if (TEXT_TOOLS.has(d.type)) j.text = textOf(d);
      return j;
    });
    try { localStorage.setItem(storageKey(symbol), JSON.stringify(out)); } catch { /* storage off: this session only */ }
    setCount(out.length);
  }, [dm, symbol]);

  const cancelPlacement = useCallback(() => {
    pending.current = [];
    setPlaced(0);
    if (dm.getDrawing(PREVIEW)) dm.removeDrawing(PREVIEW);
  }, [dm]);

  const showAll = useCallback((visible: boolean) => {
    dm.getAllDrawings().forEach((d) => d.updateOptions({ visible }));
    if (!visible) dm.deselectAll();
    setHidden(!visible);
  }, [dm]);

  const setTool = useCallback((t: string | null) => {
    cancelPlacement();
    dm.setActiveTool(t);
    if (t) {
      dm.deselectAll();
      if (live.current.hidden) { showAll(true); save(); } // picking a tool brings hidden drawings back
    }
    setToolState(t);
  }, [dm, cancelPlacement, showAll, save]);

  const openEditor = useCallback((d: IDrawing) => {
    if (!chart || !series) return;
    const a = d.anchors[d.anchors.length - 1];
    const x = chart.timeScale().timeToCoordinate(a.time);
    const y = series.priceToCoordinate(a.price);
    if (x == null || y == null) return;
    setEditing({ id: d.id, x, y, text: textOf(d) ?? '' });
  }, [chart, series]);

  // Attach (and re-attach when the line/candle series swaps); saved drawings load on the first attach
  const loaded = useRef(false);
  useEffect(() => {
    if (!chart || !series || !el) return;
    dm.attach(chart, series, el);
    if (!loaded.current) {
      loaded.current = true;
      for (const s of loadSaved(symbol)) {
        const shown = snapAnchors(s.anchors as (Anchor & { time: number })[], timesRef.current) ?? s.anchors;
        const d = registry.createDrawing(s.type, s.id, shown, s.style, optionsFor(s.type, digits.current, s.options));
        if (!d) continue;
        if (s.text != null) setTextOf(d, s.text);
        if (shown !== s.anchors) snapped.current.set(s.id, { saved: s.anchors, shown });
        dm.addDrawing(d);
      }
      const all = dm.getAllDrawings();
      setCount(all.length);
      setHidden(all.length > 0 && all.every((d) => d.options.visible === false));
    }
    return () => {
      try { dm.detach(); } catch { /* on unmount the chart is removed first */ }
    };
  }, [dm, chart, series, el, symbol]);

  useEffect(() => {
    const offs = [
      dm.on('drawing:added', (e) => { if (e.drawingId !== PREVIEW) save(); }),
      dm.on('drawing:removed', (e) => { if (e.drawingId !== PREVIEW) save(); }),
      dm.on('drawing:updated', save),
      dm.on('drawing:cleared', save),
      dm.on('drawing:selected', (e) => setSelected(e.drawing ?? null)),
      dm.on('drawing:deselected', () => setSelected(null)),
    ];
    return () => offs.forEach((off) => off());
  }, [dm, save]);

  // Mouse: click placement with a rubber-band preview, whole-drawing moves, no chart panning over the selection
  useEffect(() => {
    if (!chart || !series || !el) return;
    const ts = chart.timeScale();
    const pointOf = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    // Drawings live on the price pane only (not on indicator panes or the axes)
    const anchorAt = (p: { x: number; y: number }): Anchor | null => {
      if (p.x < 0 || p.x > ts.width() || p.y < 0 || p.y > (chart.panes()[0]?.getHeight() ?? 0)) return null;
      const time = ts.coordinateToTime(p.x);
      const price = series.coordinateToPrice(p.y);
      return time == null || price == null ? null : { time, price };
    };
    const viewport = (): Viewport => ({
      width: ts.width(),
      height: el.clientHeight,
      timeScale: { coordinateToTime: (x) => ts.coordinateToTime(x), timeToCoordinate: (t) => ts.timeToCoordinate(t), logicalToCoordinate: (l) => ts.logicalToCoordinate(l) },
      priceScale: { coordinateToPrice: (y) => series.coordinateToPrice(y), priceToCoordinate: (p) => series.priceToCoordinate(p) },
    });

    let down: { x: number; y: number } | null = null;
    let moving: { d: IDrawing; from: { x: number; y: number }; anchors: Anchor[] } | null = null;
    let noPan = false;
    const lockPan = (on: boolean) => {
      if (on === noPan) return;
      noPan = on;
      chart.applyOptions({ handleScroll: !on, handleScale: !on });
    };
    const cursor = (c?: 'crosshair' | 'move') => { if (c) el.dataset.drawCursor = c; else delete el.dataset.drawCursor; };
    const overSelection = (p: { x: number; y: number }) => {
      const sel = dm.getSelectedDrawing();
      return !!sel && !sel.options.locked && (dm.hitTestAnchor(p) != null || sel.testHit(p, viewport()));
    };

    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const p = pointOf(e);
      down = p;
      const sel = dm.getSelectedDrawing();
      if (live.current.tool || !sel || sel.options.locked || dm.hitTestAnchor(p) != null) return; // anchors: the manager drags them
      if (sel.testHit(p, viewport())) moving = { d: sel, from: p, anchors: sel.anchors.map((a) => ({ ...a })) };
    };
    const onMove = (e: MouseEvent) => {
      const p = pointOf(e);
      if (moving) {
        const dx = p.x - moving.from.x, dy = p.y - moving.from.y;
        const next: Anchor[] = [];
        for (const a of moving.anchors) {
          const x = ts.timeToCoordinate(a.time), y = series.priceToCoordinate(a.price);
          const time = x == null ? null : ts.coordinateToTime(x + dx);
          const price = y == null ? null : series.coordinateToPrice(y + dy);
          if (time == null || price == null) return; // would leave the loaded bars
          next.push({ time, price });
        }
        moving.d.setAnchors(next);
        return;
      }
      if (e.buttons) return;
      if (live.current.tool) {
        cursor('crosshair');
        const pv = dm.getDrawing(PREVIEW);
        const a = pv && anchorAt(p);
        if (pv && a) pv.updateAnchor(pending.current.length, a);
        return;
      }
      const on = overSelection(p);
      lockPan(on); // or a drag here would pan the chart instead of moving the drawing
      cursor(on ? 'move' : undefined);
    };
    const onUp = () => {
      if (!moving) return;
      moving = null;
      save();
    };
    const onClick = (e: MouseEvent) => {
      const t = live.current.tool;
      const p = pointOf(e);
      if (!t || !down || Math.hypot(p.x - down.x, p.y - down.y) > 4) return; // a pan, not a click
      const a = anchorAt(p);
      if (!a) return;
      const need = registry.get(t)?.requiredAnchors ?? 2;
      pending.current.push(a);
      if (pending.current.length < need) {
        const pv = dm.getDrawing(PREVIEW);
        if (pv) pv.updateAnchor(pending.current.length - 1, a);
        else {
          const fill = [...pending.current];
          while (fill.length < need) fill.push({ ...a });
          const d = registry.createDrawing(t, PREVIEW, fill, styleFor(t), optionsFor(t, digits.current));
          if (d) dm.addDrawing(d);
        }
        setPlaced(pending.current.length);
        return;
      }
      const anchors = pending.current;
      cancelPlacement();
      const d = registry.createDrawing(t, `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, anchors, styleFor(t), optionsFor(t, digits.current));
      if (!d) return;
      dm.addDrawing(d);
      if (TEXT_TOOLS.has(t)) openEditor(d);
      if (live.current.keep) return;
      setTool(null);
      dm.selectDrawing(d.id); // straight into the style bar
    };
    const onDouble = (e: MouseEvent) => {
      if (live.current.tool) return;
      const d = dm.hitTest(pointOf(e));
      if (d && TEXT_TOOLS.has(d.type)) openEditor(d);
    };

    el.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    el.addEventListener('click', onClick);
    el.addEventListener('dblclick', onDouble);
    return () => {
      el.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      el.removeEventListener('click', onClick);
      el.removeEventListener('dblclick', onDouble);
      cursor();
    };
  }, [dm, chart, series, el, save, setTool, cancelPlacement, openEditor]);

  // Keyboard: Esc, Delete, Alt shortcuts (not while typing in a field)
  useEffect(() => {
    const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    const onKey = (e: KeyboardEvent) => {
      if (typing(e.target)) return;
      if (e.key === 'Escape') {
        if (live.current.tool) setTool(null);
        else dm.deselectAll();
        return;
      }
      const sel = dm.getSelectedDrawing();
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel && !live.current.tool) {
        e.preventDefault();
        dm.removeDrawing(sel.id);
        return;
      }
      const t = e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey ? SHORTCUTS[e.code] : undefined;
      if (t) {
        e.preventDefault();
        setTool(live.current.tool === t ? null : t);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [dm, setTool]);

  const restyle = (style: Partial<DrawingStyle>) => {
    selected?.updateStyle(style);
    save();
    repaint((n) => n + 1);
  };
  const setLocked = (locked: boolean) => {
    selected?.updateOptions({ locked });
    save();
    repaint((n) => n + 1);
  };
  const editingRef = useRef(editing);
  editingRef.current = editing;

  return {
    tool, setTool, placed, selected, count, hidden, keep, setKeep, editing,
    restyle,
    setLocked,
    remove: () => { if (selected) dm.removeDrawing(selected.id); },
    editText: () => { if (selected) openEditor(selected); },
    toggleHidden: () => { showAll(live.current.hidden); save(); },
    clearAll: () => {
      cancelPlacement();
      dm.clearAll();
      snapped.current.clear();
      setSelected(null);
    },
    commitText: (text: string) => {
      const e = editingRef.current;
      if (!e) return;
      editingRef.current = null;
      const d = dm.getDrawing(e.id);
      if (d && text.trim()) { setTextOf(d, text.trim()); save(); }
      setEditing(null);
    },
    cancelText: () => { editingRef.current = null; setEditing(null); },
  };
}

export type Drawings = ReturnType<typeof useDrawings>;

// ─── Left rail ───

const Svg = ({ children }: { children: React.ReactNode }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>{children}</svg>
);
const LinesIcon = () => <Svg><path d="M5 19 19 5" /><circle cx="5" cy="19" r="2" fill="currentColor" /><circle cx="19" cy="5" r="2" fill="currentColor" /></Svg>;
const ChannelIcon = () => <Svg><path d="M3 14 14 3" /><path d="M10 21 21 10" /><path d="M6.5 17.5 17.5 6.5" strokeDasharray="2 3" /></Svg>;
const FibIcon = () => <Svg><path d="M4 5h16M4 10h16M4 14h16M4 19h16" /><path d="M4 19 20 5" strokeWidth="1.5" opacity="0.5" /></Svg>;

interface Group { key: string; label: string; icon: React.ReactNode; sections: Tool[][] }
const GROUPS: Group[] = [
  { key: 'lines', label: 'Lines', icon: <LinesIcon />, cats: ['line'] },
  { key: 'channels', label: 'Channels & pitchforks', icon: <ChannelIcon />, cats: ['channel', 'pitchfork'] },
  { key: 'fib', label: 'Fib & Gann', icon: <FibIcon />, cats: ['fibonacci', 'gann'] },
  { key: 'shapes', label: 'Shapes', icon: <Shapes size={16} />, cats: ['shape'] },
  { key: 'text', label: 'Text & notes', icon: <Type size={16} />, cats: ['annotation'] },
  { key: 'measure', label: 'Measure & forecast', icon: <Ruler size={16} />, cats: ['measurement', 'forecasting'] },
].map(({ cats, ...g }) => ({
  ...g,
  sections: (cats as DrawingCategory[]).map((c) => registry.getByCategory(c).filter((t) => !SKIP.has(t.type))).filter((s) => s.length),
}));
const groupOf = (type: string | null) => GROUPS.find((g) => g.sections.some((s) => s.some((t) => t.type === type)));

const railButton = (on: boolean) =>
  `relative flex items-center justify-center h-8 transition-colors duration-100 motion-reduce:transition-none ${
    on ? 'text-amber-400 bg-amber-400/15' : 'text-white/55 hover:text-white hover:bg-white/[0.06]'
  }`;
const ActiveBar = () => <span className="absolute left-0 top-1 bottom-1 w-0.5 bg-amber-400" aria-hidden />;

export function DrawRail({ api }: { api: Drawings }) {
  const [last, setLast] = usePersisted<Record<string, string>>('sgfx.drawings.lastTool', {}, (v) => !!v && typeof v === 'object');
  const [open, setOpen] = useState<{ key: string; top: number } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const railRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const activeGroup = groupOf(api.tool);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setOpen(null); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), 3000);
    return () => clearTimeout(t);
  }, [confirming]);

  const faceTool = (g: Group) => (g.sections.flat().some((t) => t.type === last[g.key]) ? last[g.key] : g.sections[0][0].type);
  const choose = (g: Group, type: string) => {
    setLast((m) => ({ ...m, [g.key]: type }));
    api.setTool(type);
    setOpen(null);
  };
  const openMenu = (g: Group, btn: HTMLElement) => {
    if (open?.key === g.key) return setOpen(null);
    const railH = railRef.current?.clientHeight ?? 0;
    const rows = g.sections.flat().length;
    const h = rows * 28 + g.sections.length * 9 + 8;
    setOpen({ key: g.key, top: Math.max(0, Math.min(btn.offsetTop, railH - h)) });
  };
  const menu = open && GROUPS.find((g) => g.key === open.key);

  return (
    <div ref={railRef} className="relative w-9 shrink-0 flex flex-col py-1 gap-px bg-zinc-900 border-r border-white/[0.06]" role="toolbar" aria-label="Drawing tools" aria-orientation="vertical">
      <button type="button" onClick={() => api.setTool(null)} aria-pressed={!api.tool} aria-label="Cursor (Esc)" title="Cursor (Esc)" className={railButton(!api.tool)}>
        {!api.tool && <ActiveBar />}
        <MousePointer2 size={15} />
      </button>
      <div className="mx-2 my-1 border-t border-white/[0.08]" />

      {GROUPS.map((g) => {
        const face = faceTool(g);
        const on = activeGroup?.key === g.key;
        return (
          <div key={g.key} className="relative flex">
            <button
              type="button"
              onClick={() => (on ? api.setTool(null) : choose(g, face))}
              aria-pressed={on}
              aria-label={withShortcut(on ? api.tool! : face)}
              title={withShortcut(on ? api.tool! : face)}
              className={`${railButton(on)} flex-1`}
            >
              {on && <ActiveBar />}
              {g.icon}
            </button>
            <button
              type="button"
              onClick={(e) => openMenu(g, e.currentTarget.parentElement!)}
              aria-haspopup="menu"
              aria-expanded={open?.key === g.key}
              aria-label={`All ${g.label.toLowerCase()}`}
              title={`All ${g.label.toLowerCase()}`}
              className={`absolute right-0 top-0 bottom-0 w-2.5 flex items-end justify-center pb-1 ${open?.key === g.key ? 'text-amber-400' : 'text-white/25 hover:text-white'}`}
            >
              <svg width="5" height="5" viewBox="0 0 5 5" aria-hidden><path d="M5 0v5H0z" fill="currentColor" /></svg>
            </button>
          </div>
        );
      })}

      <div className="flex-1" />
      <div className="mx-2 my-1 border-t border-white/[0.08]" />
      <button
        type="button"
        onClick={() => api.setKeep(!api.keep)}
        aria-pressed={api.keep}
        aria-label="Keep drawing: stay on the tool after each drawing"
        title="Keep drawing: stay on the tool after each drawing"
        className={railButton(api.keep)}
      >
        <Pencil size={14} />
      </button>
      <button
        type="button"
        onClick={api.toggleHidden}
        disabled={!api.count}
        aria-pressed={api.hidden}
        aria-label={api.hidden ? 'Show drawings' : 'Hide drawings'}
        title={api.hidden ? 'Show drawings' : 'Hide drawings'}
        className={`${railButton(api.hidden)} disabled:opacity-30`}
      >
        {api.hidden ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
      <div className="relative flex">
        <button
          type="button"
          onClick={() => { if (confirming) { api.clearAll(); setConfirming(false); } else setConfirming(true); }}
          disabled={!api.count}
          aria-label={confirming ? 'Click again to remove all drawings' : 'Remove all drawings'}
          title={confirming ? undefined : 'Remove all drawings'}
          className={`flex-1 ${confirming ? 'relative flex items-center justify-center h-8 text-white bg-red-600' : railButton(false)} disabled:opacity-30`}
        >
          <Trash2 size={15} />
        </button>
        {confirming && (
          <span role="status" className="absolute left-full ml-1 top-1/2 -translate-y-1/2 z-40 whitespace-nowrap px-2 py-1 text-[10px] text-red-200 bg-red-950 border border-red-500/40 animate-pop">
            Click again to remove all drawings
          </span>
        )}
      </div>

      {menu && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={menu.label}
          className="absolute left-full ml-px z-40 w-56 max-h-full overflow-y-auto py-1 bg-zinc-900 border border-white/10 shadow-2xl animate-pop"
          style={{ top: open.top }}
        >
          {menu.sections.map((tools, i) => (
            <div key={i} className={i ? 'mt-1 pt-1 border-t border-white/[0.06]' : undefined}>
              {tools.map((t) => {
                const on = api.tool === t.type;
                return (
                  <button
                    key={t.type}
                    type="button"
                    role="menuitemradio"
                    aria-checked={on}
                    onClick={() => choose(menu, t.type)}
                    className={`w-full flex items-center justify-between gap-3 h-7 px-3 text-left text-[10px] ${on ? 'text-amber-400 bg-amber-400/10' : 'text-white/75 hover:text-white hover:bg-white/[0.06]'}`}
                  >
                    <span className="truncate">{toolName(t.type)}</span>
                    {SHORTCUT_OF[t.type] && <span className="shrink-0 text-white/30">{SHORTCUT_OF[t.type]}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Selected-drawing bar (pinned top-center so it never covers the price near the drawing) ───

const WIDTHS = [1, 2, 3];
const DASHES: { label: string; dash: number[]; svg: string }[] = [
  { label: 'Solid', dash: [], svg: '' },
  { label: 'Dashed', dash: [6, 4], svg: '4 3' },
  { label: 'Dotted', dash: [1, 3], svg: '1 2.5' },
];
const FILLS = [0, 0.08, 0.2];
const alphaOf = (fill?: string) => Number(/,\s*([\d.]+)\)$/.exec(fill ?? '')?.[1] ?? 0.06);

const barButton = (on = false) =>
  `h-7 min-w-7 px-1.5 flex items-center justify-center ${on ? 'text-amber-400 bg-amber-400/15' : 'text-white/60 hover:text-white hover:bg-white/[0.06]'}`;
const Divider = () => <span className="w-px h-4 bg-white/10 mx-0.5" aria-hidden />;

export function DrawingBar({ api }: { api: Drawings }) {
  const [colors, setColors] = useState(false);
  const d = api.selected;
  useEffect(() => setColors(false), [d]);
  if (!d || api.tool) return null;

  const def = registry.get(d.type);
  const s = d.style;
  const locked = !!d.options.locked;
  const dash = JSON.stringify(s.lineDash ?? []);
  const alpha = alphaOf(s.fillColor);
  const fillable = !!def && FILLABLE.has(def.category);

  return (
    <div role="toolbar" aria-label={`${toolName(d.type)} style`} className="absolute top-1.5 left-1/2 -translate-x-1/2 z-20 flex items-center h-7 max-w-[calc(100%-16px)] bg-zinc-900 border border-white/10 shadow-xl animate-pop">
      <span className="px-2.5 max-w-[10rem] truncate text-[10px] text-white/45">{toolName(d.type)}</span>
      <Divider />
      <div className="relative">
        <button type="button" onClick={() => setColors((v) => !v)} aria-label="Color" aria-expanded={colors} title="Color" className={barButton(colors)}>
          <span className="w-3.5 h-3.5 border border-white/25" style={{ background: s.lineColor }} />
        </button>
        {colors && (
          <div className="absolute top-full left-0 mt-1 grid grid-cols-5 gap-1 p-1.5 bg-zinc-900 border border-white/10 shadow-xl animate-pop">
            {SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                onClick={() => { api.restyle({ lineColor: c, labelColor: c, fillColor: tint(c, alpha) }); setColors(false); }}
                className={`w-5 h-5 border ${c === s.lineColor ? 'border-amber-400' : 'border-transparent hover:border-white/50'}`}
                style={{ background: c }}
              />
            ))}
          </div>
        )}
      </div>
      <Divider />
      {WIDTHS.map((w) => (
        <button key={w} type="button" onClick={() => api.restyle({ lineWidth: w })} aria-pressed={s.lineWidth === w} aria-label={`${w}px line`} title={`${w}px line`} className={barButton(s.lineWidth === w)}>
          <span className="block w-3.5 bg-current" style={{ height: w }} />
        </button>
      ))}
      <Divider />
      {DASHES.map((o) => (
        <button key={o.label} type="button" onClick={() => api.restyle({ lineDash: o.dash })} aria-pressed={dash === JSON.stringify(o.dash)} aria-label={o.label} title={o.label} className={barButton(dash === JSON.stringify(o.dash))}>
          <svg width="16" height="4" aria-hidden><path d="M1 2h14" stroke="currentColor" strokeWidth="1.5" strokeDasharray={o.svg || undefined} strokeLinecap="round" /></svg>
        </button>
      ))}
      {fillable && (
        <>
          <Divider />
          {FILLS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => api.restyle({ fillColor: tint(s.lineColor.startsWith('#') ? s.lineColor : INK, a) })}
              aria-pressed={Math.abs(alpha - a) < 0.01}
              aria-label={a ? `Fill ${Math.round(a * 100)}%` : 'No fill'}
              title={a ? `Fill ${Math.round(a * 100)}%` : 'No fill'}
              className={barButton(Math.abs(alpha - a) < 0.01)}
            >
              <span className="w-3 h-3 border border-current" style={{ background: a ? `color-mix(in srgb, currentColor ${a * 250}%, transparent)` : undefined }} />
            </button>
          ))}
        </>
      )}
      <Divider />
      {TEXT_TOOLS.has(d.type) && (
        <button type="button" onClick={api.editText} aria-label="Edit text" title="Edit text (double-click)" className={barButton()}>
          <Type size={13} />
        </button>
      )}
      <button type="button" onClick={() => api.setLocked(!locked)} aria-pressed={locked} aria-label={locked ? 'Unlock' : 'Lock'} title={locked ? 'Unlock' : 'Lock'} className={barButton(locked)}>
        {locked ? <Lock size={13} /> : <LockOpen size={13} />}
      </button>
      <button type="button" onClick={api.remove} aria-label="Delete" title="Delete (Del)" className="h-7 min-w-7 px-1.5 flex items-center justify-center text-white/60 hover:text-red-400 hover:bg-red-500/10">
        <Trash2 size={13} />
      </button>
    </div>
  );
}

// ─── Placement hint + text editor ───

export function DrawHint({ api }: { api: Drawings }) {
  if (!api.tool) return null;
  const name = toolName(api.tool);
  const need = registry.get(api.tool)?.requiredAnchors ?? 2;
  const text = need === 1 ? `${name}: click to place it.` : api.placed ? `${name}: ${api.placed} of ${need} points placed.` : `${name}: click ${need} points.`;
  return (
    <div role="status" className="px-2 py-0.5 text-[9px] text-white/60 bg-black/80 border border-white/[0.06]">
      {text} Esc cancels.
    </div>
  );
}

export function DrawTextEditor({ api, width }: { api: Drawings; width: number }) {
  const e = api.editing;
  if (!e) return null;
  return (
    <input
      autoFocus
      defaultValue={e.text}
      onFocus={(ev) => ev.currentTarget.select()}
      onKeyDown={(ev) => {
        if (ev.key === 'Enter') api.commitText(ev.currentTarget.value);
        else if (ev.key === 'Escape') api.cancelText();
      }}
      onBlur={(ev) => api.commitText(ev.currentTarget.value)}
      aria-label="Drawing text"
      placeholder="Type, then Enter"
      className="absolute z-30 w-52 h-7 text-[11px] text-white !bg-zinc-900 !border-amber-400/60 !py-0 !px-2 shadow-xl"
      style={{ left: Math.max(4, Math.min(e.x, width - 212)), top: Math.max(4, e.y - 14) }}
    />
  );
}
