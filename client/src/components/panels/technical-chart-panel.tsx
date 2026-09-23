import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  createChart, ColorType, LineStyle, TickMarkType,
  type IChartApi, type ISeriesApi, type Time, type TickMarkFormatter, type UTCTimestamp,
} from 'lightweight-charts';
import { useMt5Chart, useMt5Quotes, useMt5Symbols, TF_SECONDS, type Mt5Timeframe } from '../../api/hooks/use-mt5';
import { useAuthStore } from '../../stores/use-auth-store';
import { useAppStore } from '../../stores/use-app-store';
import { tickBucket, foldTick, mergeLive, type Bar } from '../../lib/live-candles';
import { keepView } from '../../lib/chart-view';
import { fmtPrice } from '../trading/mt5-trading';
import { SymbolPicker } from '../trading/symbol-picker';
import { ChartTrading } from './chart-trading';
import { GlassCard } from '../common/glass-card';
import { useT } from '../../i18n';

// ─── Technical indicator calculation functions (pure TypeScript) ───

function calcSMA(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) sum += data[j];
      result.push(sum / period);
    }
  }
  return result;
}

function calcEMA(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  const multiplier = 2 / (period + 1);
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else if (i === period - 1) {
      let sum = 0;
      for (let j = 0; j < period; j++) sum += data[j];
      result.push(sum / period);
    } else {
      const prev = result[i - 1];
      if (prev == null) {
        result.push(null);
      } else {
        result.push((data[i] - prev) * multiplier + prev);
      }
    }
  }
  return result;
}

function calcRSI(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  if (data.length < period + 1) return data.map(() => null);

  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const change = data[i] - data[i - 1];
    if (change >= 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }
  avgGain /= period;
  avgLoss /= period;

  for (let i = 0; i < data.length; i++) {
    if (i < period) {
      result.push(null);
    } else if (i === period) {
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      result.push(100 - 100 / (1 + rs));
    } else {
      const change = data[i] - data[i - 1];
      const gain = change >= 0 ? change : 0;
      const loss = change < 0 ? Math.abs(change) : 0;
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      result.push(100 - 100 / (1 + rs));
    }
  }
  return result;
}

function calcMACD(
  data: number[],
  fast: number,
  slow: number,
  signal: number,
): { macd: (number | null)[]; signal: (number | null)[]; histogram: (number | null)[] } {
  const emaFast = calcEMA(data, fast);
  const emaSlow = calcEMA(data, slow);
  const macdLine: (number | null)[] = emaFast.map((f, i) => {
    const s = emaSlow[i];
    return f != null && s != null ? f - s : null;
  });
  const macdNonNull = macdLine.filter((v): v is number => v != null);
  const signalLine = calcEMA(macdNonNull, signal);
  // Align signal line with macd line
  const signalAligned: (number | null)[] = [];
  let idx = 0;
  for (let i = 0; i < macdLine.length; i++) {
    if (macdLine[i] != null) {
      signalAligned.push(signalLine[idx] ?? null);
      idx++;
    } else {
      signalAligned.push(null);
    }
  }
  const histogram: (number | null)[] = macdLine.map((m, i) => {
    const s = signalAligned[i];
    return m != null && s != null ? m - s : null;
  });
  return { macd: macdLine, signal: signalAligned, histogram };
}

function calcBollinger(
  data: number[],
  period: number,
  stdDev: number,
): { upper: (number | null)[]; middle: (number | null)[]; lower: (number | null)[] } {
  const middle = calcSMA(data, period);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    const m = middle[i];
    if (m == null || i < period - 1) {
      upper.push(null);
      lower.push(null);
    } else {
      let variance = 0;
      for (let j = i - period + 1; j <= i; j++) {
        variance += (data[j] - m) ** 2;
      }
      const sd = Math.sqrt(variance / period);
      upper.push(m + stdDev * sd);
      lower.push(m - stdDev * sd);
    }
  }
  return { upper, middle, lower };
}

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
type IndicatorKey = 'sma20' | 'sma50' | 'sma200' | 'ema20' | 'ema50' | 'ema200' | 'rsi' | 'macd' | 'bollinger' | 'volume';

interface Indicators {
  sma20: boolean;
  sma50: boolean;
  sma200: boolean;
  ema20: boolean;
  ema50: boolean;
  ema200: boolean;
  rsi: boolean;
  macd: boolean;
  bollinger: boolean;
  volume: boolean;
}

const DEFAULT_INDICATORS: Indicators = {
  sma20: true,
  sma50: true,
  sma200: false,
  ema20: false,
  ema50: false,
  ema200: false,
  rsi: false,
  macd: false,
  bollinger: false,
  volume: true,
};

const INDICATOR_LABELS: Record<IndicatorKey, string> = {
  sma20: 'SMA 20',
  sma50: 'SMA 50',
  sma200: 'SMA 200',
  ema20: 'EMA 20',
  ema50: 'EMA 50',
  ema200: 'EMA 200',
  rsi: 'RSI (14)',
  macd: 'MACD',
  bollinger: 'Bollinger',
  volume: 'Volume',
};

const TIMEFRAMES = Object.keys(TF_SECONDS) as Mt5Timeframe[];

// Overlay legend: [indicator, label, color, dashed]
const LEGEND: [IndicatorKey, string, string, boolean?][] = [
  ['sma20', 'SMA20', '#facc15'], ['sma50', 'SMA50', '#3b82f6'], ['sma200', 'SMA200', '#ef4444'],
  ['ema20', 'EMA20', '#facc15', true], ['ema50', 'EMA50', '#3b82f6', true], ['ema200', 'EMA200', '#ef4444', true],
  ['bollinger', 'BB(20,2)', '#fbbf24'],
];

// ─── Standalone panel: MT5 symbol picker, follows the Market Watch selection ───

export function TechnicalChartPanel() {
  const t = useT();
  const user = useAuthStore((s) => s.user);
  const setLoginModalOpen = useAuthStore((s) => s.setLoginModalOpen);
  const selectedSymbol = useAppStore((s) => s.selectedSymbol);
  const watchlist = useAppStore((s) => s.tabSymbols[s.activeWatchlistTab]);
  const { data: symbols = [] } = useMt5Symbols();
  const [picked, setPicked] = useState('');

  useEffect(() => {
    if (selectedSymbol) setPicked(selectedSymbol);
  }, [selectedSymbol]);

  if (!user) {
    return (
      <GlassCard className="h-full flex flex-col items-center justify-center">
        <button
          onClick={() => setLoginModalOpen(true)}
          className="px-4 py-2 border border-accent text-accent text-[11px] font-black uppercase tracking-widest hover:bg-accent hover:text-black transition-colors"
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
  const [indicators, setIndicators] = useState<Indicators>(DEFAULT_INDICATORS);
  const [showIndicatorMenu, setShowIndicatorMenu] = useState(false);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const indicatorMenuRef = useRef<HTMLDivElement>(null);

  // On-chart trading only for symbols this MT5 account can trade; lots live here so a timeframe switch keeps them
  const user = useAuthStore((s) => s.user);
  const { data: symbols = [] } = useMt5Symbols();
  const [lots, setLots] = useState('0.01');
  const trade = user && symbols.some((s) => s.symbol === symbol) ? { readOnly: !!user.readOnly, lots, setLots } : undefined;

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

  // Close indicator menu on outside click
  useEffect(() => {
    if (!showIndicatorMenu) return;
    const handler = (e: MouseEvent) => {
      if (indicatorMenuRef.current && !indicatorMenuRef.current.contains(e.target as Node)) {
        setShowIndicatorMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showIndicatorMenu]);

  const toggleIndicator = useCallback((key: IndicatorKey) => {
    setIndicators((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // Pre-compute indicator data
  const closes = useMemo(() => candles.map((c) => c.close), [candles]);

  const indicatorData = useMemo(() => {
    const d: {
      sma20: (number | null)[];
      sma50: (number | null)[];
      sma200: (number | null)[];
      ema20: (number | null)[];
      ema50: (number | null)[];
      ema200: (number | null)[];
      rsi: (number | null)[];
      macd: { macd: (number | null)[]; signal: (number | null)[]; histogram: (number | null)[] };
      bollinger: { upper: (number | null)[]; middle: (number | null)[]; lower: (number | null)[] };
    } = {
      sma20: [],
      sma50: [],
      sma200: [],
      ema20: [],
      ema50: [],
      ema200: [],
      rsi: [],
      macd: { macd: [], signal: [], histogram: [] },
      bollinger: { upper: [], middle: [], lower: [] },
    };
    if (closes.length === 0) return d;
    if (indicators.sma20) d.sma20 = calcSMA(closes, 20);
    if (indicators.sma50) d.sma50 = calcSMA(closes, 50);
    if (indicators.sma200) d.sma200 = calcSMA(closes, 200);
    if (indicators.ema20) d.ema20 = calcEMA(closes, 20);
    if (indicators.ema50) d.ema50 = calcEMA(closes, 50);
    if (indicators.ema200) d.ema200 = calcEMA(closes, 200);
    if (indicators.rsi) d.rsi = calcRSI(closes, 14);
    if (indicators.macd) d.macd = calcMACD(closes, 12, 26, 9);
    if (indicators.bollinger) d.bollinger = calcBollinger(closes, 20, 2);
    return d;
  }, [closes, indicators]);

  // Last candle stats
  const lastCandle = candles.length > 0 ? candles[candles.length - 1] : null;
  const prevCandle = candles.length > 1 ? candles[candles.length - 2] : null;
  const change = lastCandle && prevCandle ? lastCandle.close - prevCandle.close : 0;
  const changePct = prevCandle && prevCandle.close !== 0 ? (change / prevCandle.close) * 100 : 0;

  // Hover candle
  const hoverCandle = hoverIndex != null && hoverIndex >= 0 && hoverIndex < candles.length ? candles[hoverIndex] : null;

  return (
    <div className="relative flex flex-col h-full bg-black text-white overflow-hidden select-none" style={{ fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace' }}>
      {/* Top control bar */}
      <div className="flex items-center gap-1 px-2 py-1 border-b border-white/5 shrink-0 flex-wrap">
        {picker}

        {/* Timeframe buttons */}
        <div className="flex items-center gap-0.5">
          {TIMEFRAMES.map((label) => (
            <button
              key={label}
              onClick={() => setTf(label)}
              className={`px-1.5 py-0.5 text-[8px] font-bold tracking-wider transition-colors ${
                tf === label
                  ? 'bg-amber-400/20 text-amber-400 border border-amber-400/40'
                  : 'text-white/40 hover:text-white/70 border border-transparent'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Chart type toggle */}
        <div className="flex items-center gap-0.5 ml-1">
          <button
            onClick={() => setChartType('candle')}
            className={`px-1.5 py-0.5 text-[8px] font-bold tracking-wider transition-colors ${
              chartType === 'candle'
                ? 'bg-amber-400/20 text-amber-400 border border-amber-400/40'
                : 'text-white/40 hover:text-white/70 border border-transparent'
            }`}
          >
            {tr('chartCandle', 'CANDLE')}
          </button>
          <button
            onClick={() => setChartType('line')}
            className={`px-1.5 py-0.5 text-[8px] font-bold tracking-wider transition-colors ${
              chartType === 'line'
                ? 'bg-amber-400/20 text-amber-400 border border-amber-400/40'
                : 'text-white/40 hover:text-white/70 border border-transparent'
            }`}
          >
            {tr('chartLine', 'LINE')}
          </button>
        </div>

        {/* Indicators dropdown */}
        <div className="relative ml-1" ref={indicatorMenuRef}>
          <button
            onClick={() => setShowIndicatorMenu((v) => !v)}
            className={`px-1.5 py-0.5 text-[8px] font-bold tracking-wider transition-colors border ${
              showIndicatorMenu
                ? 'bg-amber-400/20 text-amber-400 border-amber-400/40'
                : 'text-white/40 hover:text-white/70 border-white/10'
            }`}
          >
            {tr('chartIndicators', 'INDICATORS')}
          </button>
          {showIndicatorMenu && (
            <div className="absolute top-full left-0 mt-1 bg-zinc-900 border border-white/10 shadow-2xl z-50 min-w-[140px]">
              {(Object.keys(INDICATOR_LABELS) as IndicatorKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => toggleIndicator(key)}
                  className="w-full flex items-center gap-2 px-2 py-1 text-left hover:bg-white/5 transition-colors"
                >
                  <span
                    className={`w-2.5 h-2.5 border flex items-center justify-center text-[7px] ${
                      indicators[key] ? 'bg-amber-400/30 border-amber-400 text-amber-400' : 'border-white/20'
                    }`}
                  >
                    {indicators[key] ? '\u2713' : ''}
                  </span>
                  <span className={`text-[9px] font-mono ${indicators[key] ? 'text-white' : 'text-white/40'}`}>
                    {INDICATOR_LABELS[key]}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Stats bar (right side) */}
        <div className="ml-auto flex items-center gap-3 text-[9px] font-mono">
          {lastCandle && (
            <>
              <span className="text-amber-400 font-bold">{symbol}</span>
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
            chartType={chartType}
            indicators={indicators}
            indicatorData={indicatorData}
            setHoverIndex={setHoverIndex}
            hasMore={!!hasMore}
            loadingOlder={isFetchingOlder}
            onNeedOlder={fetchOlder}
          />
        )}

        {/* Hover OHLCV + indicator legend */}
        <div className="absolute top-1 left-2 z-10 pointer-events-none flex flex-col gap-0.5 text-[9px] font-mono">
          {hoverCandle && (
            <div className="flex items-center gap-3 bg-black/80 px-2 py-0.5 border border-white/5">
              <span className="text-white/50">{formatDate(hoverCandle.timestamp)}</span>
              <span className="text-white/70">O:<span className="text-white">{formatPrice(hoverCandle.open)}</span></span>
              <span className="text-white/70">H:<span className="text-white">{formatPrice(hoverCandle.high)}</span></span>
              <span className="text-white/70">L:<span className="text-white">{formatPrice(hoverCandle.low)}</span></span>
              <span className="text-white/70">C:<span className={hoverCandle.close >= hoverCandle.open ? 'text-emerald-400' : 'text-red-400'}>{formatPrice(hoverCandle.close)}</span></span>
              <span className="text-white/70">V:<span className="text-white">{formatVol(hoverCandle.volume)}</span></span>
            </div>
          )}
          <div className="flex items-center gap-2">
            {LEGEND.filter(([key]) => indicators[key]).map(([key, label, color, dashed]) => (
              <span key={key} className="flex items-center gap-1" style={{ color }}>
                <span className="inline-block w-3 border-t" style={{ borderColor: color, borderTopStyle: dashed ? 'dashed' : 'solid' }} />
                {label}
              </span>
            ))}
          </div>
        </div>

        {isFetchingOlder && (
          <div className="absolute bottom-7 left-2 z-10 pointer-events-none text-[8px] font-mono text-amber-400/70 tracking-widest">
            LOADING HISTORY…
          </div>
        )}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-20">
            <div className="w-5 h-5 border-2 border-amber-400/30 border-t-amber-400 animate-spin" />
          </div>
        )}
        {/* A failed older page keeps the chart that's already drawn */}
        {error && !candles.length && (
          <div className="absolute inset-0 flex items-center justify-center z-20 text-red-400 text-[10px] font-mono">
            {tr('chartError', 'Failed to load chart data')}
          </div>
        )}
        {!isLoading && !error && candles.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-white/20 text-[10px] font-mono uppercase tracking-widest">
            {tr('chartNoData', 'No data available')}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Chart renderer: lightweight-charts (drag-pan, wheel/pinch zoom, crosshair built in) ───

type Series = (number | null)[];
interface IndicatorData {
  sma20: Series;
  sma50: Series;
  sma200: Series;
  ema20: Series;
  ema50: Series;
  ema200: Series;
  rsi: Series;
  macd: { macd: Series; signal: Series; histogram: Series };
  bollinger: { upper: Series; middle: Series; lower: Series };
}

const INITIAL_BARS = 120; // on open; dragging toward the left edge loads older pages
const OLDER_AT = 20; // fetch the next older page when the view is this close to the oldest loaded bar

// Bars are real UTC; label them in the viewer's local time
const tickMark: TickMarkFormatter = (time, type) => {
  const d = new Date((time as number) * 1000);
  if (type === TickMarkType.Year) return String(d.getFullYear());
  if (type === TickMarkType.Month) return d.toLocaleDateString('en-US', { month: 'short' });
  if (type === TickMarkType.DayOfMonth) return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
};

const CHART_OPTIONS = {
  layout: {
    background: { type: ColorType.Solid as const, color: 'transparent' },
    textColor: '#a1a1aa',
    fontSize: 10,
    fontFamily: 'ui-monospace, monospace',
    attributionLogo: false,
  },
  grid: {
    vertLines: { color: 'rgba(63,63,70,0.1)' },
    horzLines: { color: 'rgba(63,63,70,0.1)' },
  },
  crosshair: {
    horzLine: { color: '#f59e0b', labelBackgroundColor: '#f59e0b' },
    vertLine: { color: '#f59e0b', labelBackgroundColor: '#f59e0b' },
  },
  // Same price-axis width on every pane, so bars line up vertically across main / RSI / MACD
  rightPriceScale: { borderColor: 'rgba(63,63,70,0.3)', minimumWidth: 72 },
  timeScale: { borderColor: 'rgba(63,63,70,0.3)', timeVisible: true, tickMarkFormatter: tickMark },
  localization: { timeFormatter: (t: Time) => formatDate(t as number) },
};

// RSI / MACD panes follow the main chart's time scale instead of scrolling on their own
const SUB_OPTIONS = {
  ...CHART_OPTIONS,
  handleScroll: false,
  handleScale: false,
  timeScale: { ...CHART_OPTIONS.timeScale, visible: false },
};

interface Pane { chart: IChartApi; dispose: () => void }

function makePane(el: HTMLDivElement, options: typeof CHART_OPTIONS | typeof SUB_OPTIONS): Pane {
  const chart = createChart(el, { ...options, width: el.clientWidth, height: el.clientHeight });
  const ro = new ResizeObserver(() => chart.applyOptions({ width: el.clientWidth, height: el.clientHeight }));
  ro.observe(el);
  return { chart, dispose: () => { ro.disconnect(); chart.remove(); } };
}

const lineOpts = (color: string, dashed = false) => ({
  color,
  lineWidth: 1 as const,
  lineStyle: dashed ? LineStyle.Dashed : LineStyle.Solid,
  priceLineVisible: false,
  lastValueVisible: false,
  crosshairMarkerVisible: false,
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

type Line = ISeriesApi<'Line'>;
interface MainSeries {
  volume: ISeriesApi<'Histogram'>;
  candle: ISeriesApi<'Candlestick'>;
  line: Line;
  bbU: Line; bbM: Line; bbL: Line;
  sma20: Line; sma50: Line; sma200: Line;
  ema20: Line; ema50: Line; ema200: Line;
}

interface LwChartProps {
  symbol: string;
  trade?: { readOnly: boolean; lots: string; setLots: (v: string) => void };
  candles: Candle[];
  chartType: ChartType;
  indicators: Indicators;
  indicatorData: IndicatorData;
  setHoverIndex: (i: number | null) => void;
  hasMore: boolean;
  loadingOlder: boolean;
  onNeedOlder: () => void;
}

/** Mounted per symbol + timeframe (keyed by the caller); data is pushed in with setData on every change. */
function LwChart({ symbol, trade, candles, chartType, indicators, indicatorData, setHoverIndex, hasMore, loadingOlder, onNeedOlder }: LwChartProps) {
  const mainEl = useRef<HTMLDivElement>(null);
  const rsiEl = useRef<HTMLDivElement>(null);
  const macdEl = useRef<HTMLDivElement>(null);
  const main = useRef<(Pane & { s: MainSeries }) | null>(null);
  const rsi = useRef<(Pane & { line: Line }) | null>(null);
  const macd = useRef<(Pane & { hist: ISeriesApi<'Histogram'>; line: Line; signal: Line }) | null>(null);
  const timeIndex = useRef(new Map<number, number>());
  const prev = useRef<{ n: number; lastT: number } | null>(null);
  // The range subscription lives as long as the chart; read the paging state through a ref
  const older = useRef({ hasMore, loadingOlder, onNeedOlder });
  older.current = { hasMore, loadingOlder, onNeedOlder };
  // Children's effects run before ours, so the trading layer mounts from state once the pane exists (a ref would still be null)
  const [ready, setReady] = useState<(Pane & { s: MainSeries }) | null>(null);

  // Main pane (series created once; toggles only change visibility / data)
  useEffect(() => {
    const pane = makePane(mainEl.current!, CHART_OPTIONS);
    const { chart } = pane;
    const s: MainSeries = {
      volume: chart.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: 'volume', priceLineVisible: false, lastValueVisible: false }),
      candle: chart.addCandlestickSeries({
        upColor: '#22c55e', downColor: '#ef4444', borderUpColor: '#22c55e', borderDownColor: '#ef4444',
        wickUpColor: '#22c55e88', wickDownColor: '#ef444488',
      }),
      line: chart.addLineSeries({ color: '#f59e0b', lineWidth: 2, visible: false }),
      bbU: chart.addLineSeries(lineOpts('rgba(251,191,36,0.4)')),
      bbM: chart.addLineSeries(lineOpts('rgba(251,191,36,0.25)', true)),
      bbL: chart.addLineSeries(lineOpts('rgba(251,191,36,0.4)')),
      sma20: chart.addLineSeries(lineOpts('#facc15')),
      sma50: chart.addLineSeries(lineOpts('#3b82f6')),
      sma200: chart.addLineSeries(lineOpts('#ef4444')),
      ema20: chart.addLineSeries(lineOpts('#facc15', true)),
      ema50: chart.addLineSeries(lineOpts('#3b82f6', true)),
      ema200: chart.addLineSeries(lineOpts('#ef4444', true)),
    };
    chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    chart.timeScale().subscribeVisibleLogicalRangeChange((r) => {
      if (!r) return;
      rsi.current?.chart.timeScale().setVisibleLogicalRange(r);
      macd.current?.chart.timeScale().setVisibleLogicalRange(r);
      const o = older.current;
      if (r.from < OLDER_AT && o.hasMore && !o.loadingOlder) o.onNeedOlder();
    });
    chart.subscribeCrosshairMove((p) => setHoverIndex(p.time == null ? null : timeIndex.current.get(p.time as number) ?? null));
    main.current = { ...pane, s };
    setReady(main.current);
    return () => { pane.dispose(); main.current = null; prev.current = null; setReady(null); };
  }, [setHoverIndex]);

  // RSI pane with 70/30 guides
  useEffect(() => {
    if (!indicators.rsi || !rsiEl.current) return;
    const pane = makePane(rsiEl.current, SUB_OPTIONS);
    const line = pane.chart.addLineSeries({ color: '#a855f7', lineWidth: 1, priceLineVisible: false, title: 'RSI' });
    line.createPriceLine({ price: 70, color: 'rgba(239,68,68,0.5)', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false, title: '' });
    line.createPriceLine({ price: 30, color: 'rgba(34,197,94,0.5)', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false, title: '' });
    rsi.current = { ...pane, line };
    return () => { pane.dispose(); rsi.current = null; };
  }, [indicators.rsi]);

  // MACD pane
  useEffect(() => {
    if (!indicators.macd || !macdEl.current) return;
    const pane = makePane(macdEl.current, SUB_OPTIONS);
    const hist = pane.chart.addHistogramSeries({ priceLineVisible: false, lastValueVisible: false });
    const line = pane.chart.addLineSeries({ color: '#3b82f6', lineWidth: 1, priceLineVisible: false, title: 'MACD' });
    const signal = pane.chart.addLineSeries({ color: '#f97316', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
    macd.current = { ...pane, hist, line, signal };
    return () => { pane.dispose(); macd.current = null; };
  }, [indicators.macd]);

  const precision = useMemo(() => pricePrecision(candles), [candles]);

  // Push data (pages, refetches and live ticks alike), then put the view back where it was
  useEffect(() => {
    const m = main.current;
    const n = candles.length;
    if (!m || !n) return;
    const { chart, s } = m;
    const ts = chart.timeScale();
    const before = ts.getVisibleLogicalRange();
    const time = (c: Candle) => c.timestamp as UTCTimestamp;
    // Gaps become whitespace points so every pane has the same time points (keeps logical ranges aligned)
    const pts = (on: boolean, arr: Series) =>
      on ? candles.map((c, i) => (arr[i] == null ? { time: time(c) } : { time: time(c), value: arr[i]! })) : [];

    const priceFormat = { type: 'price' as const, precision, minMove: 10 ** -precision };
    s.candle.applyOptions({ visible: chartType === 'candle', priceFormat });
    s.line.applyOptions({ visible: chartType === 'line', priceFormat });
    s.volume.applyOptions({ visible: indicators.volume });
    s.candle.setData(candles.map((c) => ({ time: time(c), open: c.open, high: c.high, low: c.low, close: c.close })));
    s.line.setData(candles.map((c) => ({ time: time(c), value: c.close })));
    s.volume.setData(candles.map((c) => ({
      time: time(c),
      value: c.volume,
      color: c.close >= c.open ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)',
    })));
    s.sma20.setData(pts(indicators.sma20, indicatorData.sma20));
    s.sma50.setData(pts(indicators.sma50, indicatorData.sma50));
    s.sma200.setData(pts(indicators.sma200, indicatorData.sma200));
    s.ema20.setData(pts(indicators.ema20, indicatorData.ema20));
    s.ema50.setData(pts(indicators.ema50, indicatorData.ema50));
    s.ema200.setData(pts(indicators.ema200, indicatorData.ema200));
    s.bbU.setData(pts(indicators.bollinger, indicatorData.bollinger.upper));
    s.bbM.setData(pts(indicators.bollinger, indicatorData.bollinger.middle));
    s.bbL.setData(pts(indicators.bollinger, indicatorData.bollinger.lower));
    rsi.current?.line.setData(pts(true, indicatorData.rsi));
    if (macd.current) {
      macd.current.hist.setData(candles.map((c, i) => {
        const v = indicatorData.macd.histogram[i];
        return v == null ? { time: time(c) } : { time: time(c), value: v, color: v >= 0 ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.5)' };
      }));
      macd.current.line.setData(pts(true, indicatorData.macd.macd));
      macd.current.signal.setData(pts(true, indicatorData.macd.signal));
    }
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
    const r = ts.getVisibleLogicalRange();
    if (r) {
      rsi.current?.chart.timeScale().setVisibleLogicalRange(r);
      macd.current?.chart.timeScale().setVisibleLogicalRange(r);
    }
  }, [candles, indicatorData, indicators, chartType, precision]);

  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="flex-1 min-h-0 relative">
        <div ref={mainEl} className="absolute inset-0" />
        {ready && trade && mainEl.current && (
          <ChartTrading
            chart={ready.chart}
            series={chartType === 'candle' ? ready.s.candle : ready.s.line}
            el={mainEl.current}
            symbol={symbol}
            precision={precision}
            {...trade}
          />
        )}
      </div>
      {indicators.rsi && <div ref={rsiEl} className="h-[22%] min-h-[60px] border-t border-white/5" />}
      {indicators.macd && <div ref={macdEl} className="h-[22%] min-h-[60px] border-t border-white/5" />}
    </div>
  );
}
