import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  createChart, CandlestickSeries, HistogramSeries, LineSeries, ColorType, TickMarkType,
  type IChartApi, type ISeriesApi, type Time, type TickMarkFormatter, type UTCTimestamp,
} from 'lightweight-charts';
import { useMt5Chart, useMt5Quotes, useMt5Symbols, TF_SECONDS, type Mt5Timeframe } from '../../api/hooks/use-mt5';
import { useAuthStore } from '../../stores/use-auth-store';
import { useAppStore } from '../../stores/use-app-store';
import { usePersisted } from '../../hooks/use-persisted';
import { tickBucket, foldTick, mergeLive, type Bar } from '../../lib/live-candles';
import { keepView } from '../../lib/chart-view';
import { toMt5 } from '../../lib/symbols';
import { fmtPrice } from '../trading/mt5-trading';
import { SymbolPicker } from '../trading/symbol-picker';
import { ChartTrading, ChartMenu } from './chart-trading';
import {
  useIndicatorRegistry, useStudyOutputs, useStudySeries, usePaneTops, newStudy, isStudyList, DEFAULT_STUDIES,
  IndicatorPicker, LegendList, StudyChip, StudySettings, type Study, type StudyOut,
} from './chart-studies';
import { useDrawings, DrawRail, DrawingBar, DrawHint, DrawTextEditor } from './chart-drawings';
import { GlassCard } from '../common/glass-card';
import { useT } from '../../i18n';
import { useChartColors, alpha, type ChartColors } from '../../lib/theme';

// ─── Formatting helpers ───

const formatPrice = fmtPrice; // shortest exact form, so FX keeps its 5 digits

function formatVol(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(Math.round(n));
}

function formatDate(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

// ─── Types ───

type Candle = Bar;
type ChartType = 'candle' | 'line';

const TIMEFRAMES = Object.keys(TF_SECONDS) as Mt5Timeframe[];

function ToolButton({ active = false, className = '', ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      className={`h-6 px-2 text-mini font-bold tracking-wider border transition-colors duration-100 motion-reduce:transition-none ${
        active ? 'bg-accent/15 text-accent-ink border-accent/40' : 'text-white/45 border-transparent hover:text-white/85 hover:bg-white/[0.05]'
      } ${className}`}
    />
  );
}

const HeaderDivider = () => <span className="w-px h-4 mx-1 bg-white/10" aria-hidden />;

// ─── Standalone panel: MT5 symbol picker, follows the Market Watch selection ───

export function TechnicalChartPanel() {
  const t = useT();
  const user = useAuthStore((s) => s.user);
  const setLoginModalOpen = useAuthStore((s) => s.setLoginModalOpen);
  const selectedSymbol = useAppStore((s) => s.selectedSymbol);
  const watchlist = useAppStore((s) => s.tabSymbols[s.activeWatchlistTab]);
  const { data: symbols = [] } = useMt5Symbols();
  const [picked, setPicked] = useState('');

  // Follow the selection through the MT5 mapping — Yahoo tickers from other panels (GC=F) open XAUUSD,
  // untradable ones leave the chart where it is
  useEffect(() => {
    const mt5 = selectedSymbol && toMt5(selectedSymbol, symbols);
    if (mt5) setPicked(mt5);
  }, [selectedSymbol, symbols]);
  // Arming an order in the ticket brings its symbol up, so the preview shows
  const armed = useAppStore((s) => (s.orderDraft.side ? s.orderDraft.symbol : ''));
  useEffect(() => { if (armed) setPicked(armed); }, [armed]);

  if (!user) {
    return (
      <GlassCard className="h-full flex flex-col items-center justify-center">
        <button
          onClick={() => setLoginModalOpen(true)}
          className="px-4 h-8 rounded-sm bg-accent text-on-accent text-xs font-semibold hover:bg-accent/90 transition-colors"
        >
          {t('loginWithMt5')}
        </button>
      </GlassCard>
    );
  }

  const symbol = picked || watchlist?.find((w) => symbols.some((s) => s.symbol === w)) || symbols[0]?.symbol || '';
  return (
    <TechnicalChart
      symbol={symbol}
      picker={<SymbolPicker symbols={symbols} value={symbol} onSelect={setPicked} placeholder="SYMBOL" className="w-32" />}
    />
  );
}

// ─── Chart: MT5 bars + live FIX ticks ───

export function TechnicalChart({ symbol, picker }: { symbol: string; picker?: React.ReactNode }) {
  const t = useT();
  const tr = (key: string, fallback: string) => {
    try { return (t as (k: string) => string)(key) || fallback; } catch { return fallback; }
  };

  const [tf, setTf] = useState<Mt5Timeframe>('M5');
  const [chartType, setChartType] = useState<ChartType>('candle');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Indicators apply to every symbol (like a template); drawings are saved per symbol by the chart
  const reg = useIndicatorRegistry();
  const [studies, setStudies] = usePersisted<Study[]>('sgfx.chart.indicators', DEFAULT_STUDIES, isStudyList);
  const [volume, setVolume] = usePersisted('sgfx.chart.volume', true, (v) => typeof v === 'boolean');
  const [pickerAt, setPickerAt] = useState<{ left: number; top: number } | null>(null);

  // On-chart trading only for symbols this MT5 account can trade (lots live in the shared order draft)
  const user = useAuthStore((s) => s.user);
  const { data: symbols = [] } = useMt5Symbols();
  // The one-click BUY / SELL strip can be hidden; lines and the right-click menu stay
  const [oneClick, setOneClick] = usePersisted('sgfx.chart.oneClick', true, (v) => typeof v === 'boolean');
  const trade = user && symbols.some((s) => s.symbol === symbol) ? { readOnly: !!user.readOnly, oneClick } : undefined;

  const { data, offset, error, isLoading, hasMore, fetchOlder, isFetchingOlder } = useMt5Chart(symbol, tf);
  const tfSec = TF_SECONDS[tf];
  // MT5 bars open on server time (≈ UTC+3); shift to real UTC so labels read in the viewer's local time
  const base = useMemo<Candle[]>(
    () => (data?.history ?? []).map((c) => ({ ...c, timestamp: c.time - (offset ?? 0) })),
    [data, offset],
  );

  // Live ticks extend the right edge between the 60s refetches
  const [tail, setTail] = useState<Candle[]>([]);
  useEffect(() => setTail([]), [symbol, tf]);
  const { data: quotes } = useMt5Quotes([symbol]);
  const quote = quotes?.[symbol];
  useEffect(() => {
    const last = base[base.length - 1];
    const bucket = tickBucket(quote?.ts, offset, tfSec, Date.now());
    if (!quote || !last || bucket === undefined) return;
    setTail((prev) => foldTick(prev, last, quote.bid, bucket));
  }, [quote, base, offset, tfSec]);
  const candles = useMemo(() => mergeLive(base, tail), [base, tail]);

  const outputs = useStudyOutputs(reg, studies, candles);
  const setStudy = useCallback((s: Study) => setStudies((prev) => prev.map((x) => (x.uid === s.uid ? s : x))), [setStudies]);
  const removeStudy = useCallback((uid: string) => setStudies((prev) => prev.filter((s) => s.uid !== uid)), [setStudies]);

  const togglePicker = (btn: HTMLElement) => {
    if (pickerAt) return setPickerAt(null);
    const root = rootRef.current!.getBoundingClientRect();
    const r = btn.getBoundingClientRect();
    setPickerAt({ left: Math.max(8, Math.min(r.left - root.left, root.width - 448)), top: r.bottom - root.top + 4 });
  };

  // Last candle stats
  const lastCandle = candles.length > 0 ? candles[candles.length - 1] : null;
  const prevCandle = candles.length > 1 ? candles[candles.length - 2] : null;
  const change = lastCandle && prevCandle ? lastCandle.close - prevCandle.close : 0;
  const changePct = prevCandle && prevCandle.close !== 0 ? (change / prevCandle.close) * 100 : 0;

  return (
    <div ref={rootRef} className="@container relative flex flex-col h-full bg-black text-white overflow-hidden select-none">
      {/* Top control bar */}
      <div className="flex items-center gap-0.5 px-2 py-1 border-b border-white/[0.06] shrink-0 flex-wrap">
        {picker}
        <HeaderDivider />
        <div role="group" aria-label="Timeframe" className="flex items-center gap-0.5">
          {TIMEFRAMES.map((label) => (
            <ToolButton key={label} active={tf === label} aria-pressed={tf === label} onClick={() => setTf(label)}>{label}</ToolButton>
          ))}
        </div>
        <HeaderDivider />
        <div role="group" aria-label="Chart type" className="flex items-center gap-0.5">
          <ToolButton active={chartType === 'candle'} aria-pressed={chartType === 'candle'} onClick={() => setChartType('candle')}>
            {tr('chartCandle', 'CANDLE')}
          </ToolButton>
          <ToolButton active={chartType === 'line'} aria-pressed={chartType === 'line'} onClick={() => setChartType('line')}>
            {tr('chartLine', 'LINE')}
          </ToolButton>
        </div>
        <HeaderDivider />
        <ToolButton
          data-popover-trigger
          active={!!pickerAt}
          aria-haspopup="dialog"
          aria-expanded={!!pickerAt}
          onClick={(e) => togglePicker(e.currentTarget)}
          className="flex items-center gap-1.5"
        >
          {tr('chartIndicators', 'INDICATORS')}
          {studies.length > 0 && (
            <span className={`min-w-4 h-4 px-1 flex items-center justify-center text-mini ${pickerAt ? 'bg-accent/25' : 'bg-white/10 text-white/70'}`}>
              {studies.length}
            </span>
          )}
        </ToolButton>
        {trade && !trade.readOnly && (
          <>
            <HeaderDivider />
            <ToolButton
              active={oneClick}
              aria-pressed={oneClick}
              onClick={() => setOneClick(!oneClick)}
              title={oneClick ? 'Hide the one-click BUY / SELL buttons' : 'Show the one-click BUY / SELL buttons on the chart'}
            >
              {tr('chartOneClick', '1-CLICK')}
            </ToolButton>
          </>
        )}

        {/* Stats bar (right side) */}
        <div className="ml-auto flex items-center gap-3 text-mini font-mono">
          {lastCandle && (
            <>
              <span className="text-accent-ink font-bold">{symbol}</span>
              <span className="text-white font-bold">{formatPrice(lastCandle.close)}</span>
              <span className={change >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                {change >= 0 ? '+' : ''}{formatPrice(change)} ({changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%)
              </span>
              <span className="text-white/30">H:{formatPrice(lastCandle.high)}</span>
              <span className="text-white/30">L:{formatPrice(lastCandle.low)}</span>
              <span className="text-white/30">V:{formatVol(lastCandle.volume)}</span>
            </>
          )}
        </div>
      </div>

      {/* Chart area */}
      {/* isolate: keeps the chart's z-10..z-30 overlays (trade strip, menus) below app chrome like the top bar */}
      <div className="flex-1 relative overflow-hidden isolate">
        {candles.length > 0 && (
          <LwChart
            key={`${symbol}:${tf}`}
            symbol={symbol}
            trade={trade}
            candles={candles}
            tfSec={tfSec}
            chartType={chartType}
            volume={volume}
            outputs={outputs}
            onStudy={setStudy}
            onRemoveStudy={removeStudy}
            hoverIndex={hoverIndex}
            setHoverIndex={setHoverIndex}
            hasMore={!!hasMore}
            loadingOlder={isFetchingOlder}
            onNeedOlder={fetchOlder}
          />
        )}

        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-20">
            <div className="w-5 h-5 border-2 border-accent/30 border-t-accent animate-spin" />
          </div>
        )}
        {/* A failed older page keeps the chart that's already drawn */}
        {error && !candles.length && (
          <div className="absolute inset-0 flex items-center justify-center z-20 text-red-400 text-mini font-mono">
            {tr('chartError', 'Failed to load chart data')}
          </div>
        )}
        {!isLoading && !error && candles.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-white/20 text-mini font-mono uppercase tracking-widest">
            {tr('chartNoData', 'No data available')}
          </div>
        )}
      </div>

      {pickerAt && (
        <IndicatorPicker
          reg={reg}
          studies={studies}
          volume={volume}
          at={pickerAt}
          onAdd={(e) => setStudies((prev) => [...prev, newStudy(e, prev)])}
          onStudy={setStudy}
          onRemoveStudy={removeStudy}
          onVolume={setVolume}
          onRemoveAll={() => { setStudies([]); setVolume(false); }}
          onClose={() => setPickerAt(null)}
        />
      )}
    </div>
  );
}

// ─── Chart renderer: lightweight-charts (drag-pan, wheel/pinch zoom, crosshair built in) ───

const INITIAL_BARS = 120; // on open; dragging toward the left edge loads older pages
const OLDER_AT = 20; // fetch the next older page when the view is this close to the oldest loaded bar
const FUTURE_BARS = 500; // empty slots right of the last bar, so drawings can reach into the future

// Bars are real UTC; label them in the viewer's local time
const tickMark: TickMarkFormatter = (time, type) => {
  const d = new Date((time as number) * 1000);
  if (type === TickMarkType.Year) return String(d.getFullYear());
  if (type === TickMarkType.Month) return d.toLocaleDateString('en-US', { month: 'short' });
  if (type === TickMarkType.DayOfMonth) return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
};

/** Everything themed comes from the tokens; re-applied whenever the theme flips */
const chartOptions = (c: ChartColors) => ({
  autoSize: true,
  layout: {
    background: { type: ColorType.Solid as const, color: 'transparent' },
    textColor: c.neutral,
    fontSize: 11,
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    attributionLogo: false,
    // Indicator panes: hairline separators, blue when grabbed to resize
    panes: { separatorColor: c.border, separatorHoverColor: alpha(c.accent, 0.4), enableResize: true },
  },
  grid: {
    vertLines: { color: alpha(c.border, 0.45) },
    horzLines: { color: alpha(c.border, 0.45) },
  },
  crosshair: {
    horzLine: { color: c.neutral, labelBackgroundColor: c.accent },
    vertLine: { color: c.neutral, labelBackgroundColor: c.accent },
  },
  rightPriceScale: { borderColor: c.border, minimumWidth: 72 },
  timeScale: { borderColor: c.border, timeVisible: true, tickMarkFormatter: tickMark },
  localization: { timeFormatter: (t: Time) => formatDate(t as number) },
});
const candleColors = (c: ChartColors) => ({
  upColor: c.bullish, downColor: c.bearish, borderUpColor: c.bullish, borderDownColor: c.bearish,
  wickUpColor: alpha(c.bullish, 0.55), wickDownColor: alpha(c.bearish, 0.55),
});

/** Decimals the symbol quotes in (EURUSD 5, USDJPY 3, indices 2), from recent closes */
function pricePrecision(candles: Candle[]): number {
  let p = 2;
  for (const c of candles.slice(-50)) {
    const s = formatPrice(c.close);
    const dot = s.indexOf('.');
    if (dot >= 0) p = Math.max(p, s.length - dot - 1);
  }
  return Math.min(p, 6);
}

interface MainSeries {
  volume: ISeriesApi<'Histogram'>;
  candle: ISeriesApi<'Candlestick'>;
  line: ISeriesApi<'Line'>;
}

interface LwChartProps {
  symbol: string;
  trade?: { readOnly: boolean; oneClick: boolean };
  candles: Candle[];
  tfSec: number;
  chartType: ChartType;
  volume: boolean;
  outputs: StudyOut[];
  onStudy: (s: Study) => void;
  onRemoveStudy: (uid: string) => void;
  hoverIndex: number | null;
  setHoverIndex: (i: number | null) => void;
  hasMore: boolean;
  loadingOlder: boolean;
  onNeedOlder: () => void;
}

/** Mounted per symbol + timeframe (keyed by the caller); data is pushed in with setData on every change. */
function LwChart({
  symbol, trade, candles, tfSec, chartType, volume, outputs, onStudy, onRemoveStudy, hoverIndex, setHoverIndex, hasMore, loadingOlder, onNeedOlder,
}: LwChartProps) {
  const mainEl = useRef<HTMLDivElement>(null);
  const main = useRef<{ chart: IChartApi; s: MainSeries } | null>(null);
  const timeIndex = useRef(new Map<number, number>());
  const prev = useRef<{ n: number; lastT: number } | null>(null);
  // The range subscription lives as long as the chart; read the paging state through a ref
  const older = useRef({ hasMore, loadingOlder, onNeedOlder });
  older.current = { hasMore, loadingOlder, onNeedOlder };
  // Children's effects run before ours, so the trading layer mounts from state once the chart exists (a ref would still be null)
  const [ready, setReady] = useState<{ chart: IChartApi; s: MainSeries } | null>(null);
  const [settings, setSettings] = useState<{ uid: string; top: number } | null>(null);
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null);
  const barCount = useRef(0);
  barCount.current = candles.length;
  const colors = useChartColors();
  const colorsRef = useRef(colors);
  colorsRef.current = colors;

  // Right-click → Reset chart: the opening view (last INITIAL_BARS bars), price axes back on auto-scale, pane heights back to 3 : 1
  const resetView = useCallback(() => {
    const m = main.current;
    if (!m) return;
    m.chart.panes().forEach((p, i) => {
      p.setStretchFactor(i === 0 ? 3 : 1);
      try { p.priceScale('right').applyOptions({ autoScale: true }); } catch { /* pane without a right scale */ }
    });
    const n = barCount.current;
    m.chart.timeScale().setVisibleLogicalRange({ from: n - INITIAL_BARS, to: n + 3 });
  }, []);

  // Without trading the chart still gets its right-click menu (the trading layer brings its own, Reset included)
  const canTrade = !!trade;
  useEffect(() => {
    const el = mainEl.current;
    if (!ready || canTrade || !el) return;
    const onMenu = (e: MouseEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      setMenuAt({ x: e.clientX - r.left, y: e.clientY - r.top });
    };
    el.addEventListener('contextmenu', onMenu);
    return () => el.removeEventListener('contextmenu', onMenu);
  }, [ready, canTrade]);

  // One chart; indicators that need their own scale go in v5 panes below the price pane
  useEffect(() => {
    const c = colorsRef.current;
    const chart = createChart(mainEl.current!, chartOptions(c));
    const s: MainSeries = {
      volume: chart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: 'volume', priceLineVisible: false, lastValueVisible: false }),
      candle: chart.addSeries(CandlestickSeries, candleColors(c)),
      line: chart.addSeries(LineSeries, { color: c.accent, lineWidth: 2, visible: false }),
    };
    chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    chart.panes()[0]?.setStretchFactor(3); // price pane 3 : 1 against each indicator pane
    chart.timeScale().subscribeVisibleLogicalRangeChange((r) => {
      const o = older.current;
      if (r && r.from < OLDER_AT && o.hasMore && !o.loadingOlder) o.onNeedOlder();
    });
    chart.subscribeCrosshairMove((p) => setHoverIndex(p.time == null ? null : timeIndex.current.get(p.time as number) ?? null));
    main.current = { chart, s };
    setReady(main.current);
    return () => { chart.remove(); main.current = null; prev.current = null; setReady(null); };
  }, [setHoverIndex]);

  const precision = useMemo(() => pricePrecision(candles), [candles]);
  // Whitespace bars (time only) extend the time scale past the last candle; the right edge and autoscale ignore them.
  // ponytail: uniform grid (ignores weekend/session gaps), session-aware slots if drawings must line up across a weekend
  const future = useMemo(() => {
    const last = candles[candles.length - 1]?.timestamp;
    return last == null ? [] : Array.from({ length: FUTURE_BARS }, (_, i) => last + (i + 1) * tfSec);
  }, [candles, tfSec]);

  // Push data (pages, refetches and live ticks alike), then put the view back where it was
  useEffect(() => {
    const m = main.current;
    const n = candles.length;
    if (!m || !n) return;
    const { chart, s } = m;
    const ts = chart.timeScale();
    const before = ts.getVisibleLogicalRange();
    const time = (c: Candle) => c.timestamp as UTCTimestamp;

    const priceFormat = { type: 'price' as const, precision, minMove: 10 ** -precision };
    s.candle.applyOptions({ visible: chartType === 'candle', priceFormat });
    s.line.applyOptions({ visible: chartType === 'line', priceFormat });
    s.volume.applyOptions({ visible: volume });
    s.candle.setData([
      ...candles.map((c) => ({ time: time(c), open: c.open, high: c.high, low: c.low, close: c.close })),
      ...future.map((t) => ({ time: t as UTCTimestamp })),
    ]);
    s.line.setData(candles.map((c) => ({ time: time(c), value: c.close })));
    s.volume.setData(candles.map((c) => ({
      time: time(c),
      value: c.volume,
      color: alpha(c.close >= c.open ? colors.bullish : colors.bearish, 0.3),
    })));
    timeIndex.current = new Map(candles.map((c, i) => [c.timestamp, i]));

    const p = prev.current;
    if (!p || !before) {
      ts.setVisibleLogicalRange({ from: n - INITIAL_BARS, to: n + 3 });
    } else {
      let appended = 0;
      for (let i = n - 1; i >= 0 && candles[i].timestamp > p.lastT; i--) appended++;
      ts.setVisibleLogicalRange(keepView(before, p.n, n, appended));
    }
    prev.current = { n, lastT: candles[n - 1].timestamp };
  }, [candles, future, chartType, precision, volume, colors]);

  // Theme flip: recolour in place (the chart, its view and its panes stay)
  useEffect(() => {
    if (!ready) return;
    ready.chart.applyOptions(chartOptions(colors));
    ready.s.candle.applyOptions(candleColors(colors));
    ready.s.line.applyOptions({ color: colors.accent });
  }, [ready, colors]);

  const series = ready ? (chartType === 'candle' ? ready.s.candle : ready.s.line) : null;
  useStudySeries(ready?.chart ?? null, series, outputs);

  const times = useMemo(() => [...candles.map((c) => c.timestamp), ...future], [candles, future]);
  const draw = useDrawings({ chart: ready?.chart ?? null, series, el: ready ? mainEl.current : null, symbol, times, precision });

  const paneCount = outputs.reduce((n, o) => Math.max(n, o.pane + 1), 1);
  const tops = usePaneTops(ready?.chart ?? null, ready ? mainEl.current : null, paneCount);
  // Pane k runs from tops[k] to the next pane (the last one to the time axis): legends fit inside it
  const chartH = (mainEl.current?.clientHeight ?? 0) - (ready?.chart.timeScale().height() ?? 0);
  const paneH = (k: number) => (tops[k + 1] ?? chartH) - (tops[k] ?? 0);

  const shown = hoverIndex != null && hoverIndex >= 0 && hoverIndex < candles.length ? hoverIndex : candles.length - 1;
  const bar = candles[shown];
  const fmtOverlay = (v: number) => v.toFixed(precision);
  const settingsOut = settings && outputs.find((o) => o.study.uid === settings.uid);
  const chip = (o: StudyOut, row: number) => (
    <StudyChip
      key={o.study.uid}
      o={o}
      index={shown}
      fmt={fmtOverlay}
      onToggle={() => onStudy({ ...o.study, hidden: !o.study.hidden })}
      onRemove={() => { onRemoveStudy(o.study.uid); setSettings((s) => (s?.uid === o.study.uid ? null : s)); }}
      onEdit={() => {
        const h = mainEl.current?.clientHeight ?? 0;
        const want = (tops[o.pane] ?? 0) + (o.pane ? 24 : 44) + row * 20;
        setSettings({ uid: o.study.uid, top: Math.max(4, Math.min(want, h - 340)) });
      }}
    />
  );

  return (
    <div className="absolute inset-0 flex">
      <DrawRail api={draw} />
      <div className="relative flex-1 min-w-0">
        <div ref={mainEl} className="absolute inset-0" />
        {ready && trade && mainEl.current && (
          <ChartTrading
            chart={ready.chart}
            series={series!}
            el={mainEl.current}
            symbol={symbol}
            precision={precision}
            drawing={!!draw.tool}
            onReset={resetView}
            {...trade}
          />
        )}

        {/* OHLCV of the bar under the crosshair (the last bar otherwise), then the price-pane indicators */}
        <div className="absolute top-1 left-2 z-10 pointer-events-none flex flex-col items-start gap-0.5 max-w-[calc(100%-16px)] text-mini font-mono">
          {bar && (
            <div className="flex items-center gap-3 bg-black/80 px-2 py-0.5 border border-white/5">
              <span className="text-white/50">{formatDate(bar.timestamp)}</span>
              <span className="text-white/70">O:<span className="text-white">{formatPrice(bar.open)}</span></span>
              <span className="text-white/70">H:<span className="text-white">{formatPrice(bar.high)}</span></span>
              <span className="text-white/70">L:<span className="text-white">{formatPrice(bar.low)}</span></span>
              <span className="text-white/70">C:<span className={bar.close >= bar.open ? 'text-emerald-400' : 'text-red-400'}>{formatPrice(bar.close)}</span></span>
              <span className="text-white/70">V:<span className="text-white">{formatVol(bar.volume)}</span></span>
            </div>
          )}
          <LegendList
            items={outputs.filter((o) => o.pane === 0)}
            limit={Math.max(1, Math.min(5, Math.floor((paneH(0) - 44) / 20)))}
            maxHeight={paneH(0) - 56}
            render={chip}
          />
        </div>
        {/* Each indicator pane carries its own legend at its top edge */}
        {tops.slice(1).map((top, i) => (
          <div key={i} className="absolute left-2 z-10 pointer-events-none flex flex-col items-start gap-0.5 font-mono" style={{ top: top + 3 }}>
            <LegendList
              items={outputs.filter((o) => o.pane === i + 1)}
              limit={Math.max(1, Math.min(3, Math.floor((paneH(i + 1) - 26) / 20)))}
              maxHeight={paneH(i + 1) - 30}
              render={chip}
            />
          </div>
        ))}

        {menuAt && !canTrade && mainEl.current && (
          <ChartMenu at={menuAt} items={[{ label: 'Reset chart', onClick: resetView }]} bounds={mainEl.current} onClose={() => setMenuAt(null)} />
        )}
        <DrawingBar api={draw} />
        <DrawTextEditor api={draw} width={mainEl.current?.clientWidth ?? 0} />
        {settingsOut && (
          <StudySettings o={settingsOut} top={settings.top} onChange={onStudy} onClose={() => setSettings(null)} />
        )}

        <div className="absolute bottom-7 left-2 z-10 pointer-events-none flex flex-col items-start gap-1 font-mono">
          {loadingOlder && <div className="text-micro text-accent-ink/70 tracking-widest">LOADING HISTORY…</div>}
          <DrawHint api={draw} />
        </div>
      </div>
    </div>
  );
}
