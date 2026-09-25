import { useState, useMemo, useCallback } from 'react';
import { GitBranch, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useFibonacci, type FibonacciData } from '../../api/hooks/use-fibonacci';
import { useAppStore } from '../../stores/use-app-store';
import { useT } from '../../i18n';

type RangeKey = '1mo' | '3mo' | '6mo' | '1y' | '2y';

const RANGE_TABS: { key: RangeKey; label: string }[] = [
  { key: '1mo', label: '1M' },
  { key: '3mo', label: '3M' },
  { key: '6mo', label: '6M' },
  { key: '1y', label: '1Y' },
  { key: '2y', label: '2Y' },
];

// Fibonacci level color scheme (golden/yellow accent theme)
const LEVEL_COLORS: Record<string, { line: string; text: string; fill: string }> = {
  '0%':    { line: 'var(--color-gray-200)', text: 'text-neutral-300', fill: 'color-mix(in srgb, var(--color-gray-200) 3%, transparent)' },
  '23.6%': { line: 'var(--color-lime-400)', text: 'text-lime-400', fill: 'color-mix(in srgb, var(--color-lime-400) 4%, transparent)' },
  '38.2%': { line: 'var(--color-amber-300)', text: 'text-yellow-400', fill: 'color-mix(in srgb, var(--color-amber-300) 5%, transparent)' },
  '50%':   { line: 'var(--color-orange-400)', text: 'text-orange-400', fill: 'color-mix(in srgb, var(--color-orange-400) 5%, transparent)' },
  '61.8%': { line: 'var(--color-amber-500)', text: 'text-amber-400', fill: 'color-mix(in srgb, var(--color-amber-500) 8%, transparent)' },
  '78.6%': { line: 'var(--color-red-500)', text: 'text-red-400', fill: 'color-mix(in srgb, var(--color-red-500) 5%, transparent)' },
  '100%':  { line: 'var(--color-gray-200)', text: 'text-neutral-300', fill: 'color-mix(in srgb, var(--color-gray-200) 3%, transparent)' },
};

const EXTENSION_COLOR = 'var(--color-indigo-500)'; // indigo for extensions

/** 7 significant digits — FX keeps its pips (1.139602), indices and crypto their cents. */
function formatPrice(n: number): string {
  return String(+n.toPrecision(7));
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ---- Price Chart with Fibonacci Levels (SVG) ----

function FibonacciChart({ data }: { data: FibonacciData }) {
  const svgWidth = 600;
  const svgHeight = 320;
  const leftMargin = 8;
  const rightMargin = 80;
  const topMargin = 20;
  const bottomMargin = 20;
  const chartWidth = svgWidth - leftMargin - rightMargin;
  const chartHeight = svgHeight - topMargin - bottomMargin;

  const { priceSeries, levels, extensions, currentPrice } = data;

  // Compute price bounds including all levels and extensions
  const allPrices = [
    ...priceSeries.map((p) => p.high),
    ...priceSeries.map((p) => p.low),
    ...levels.map((l) => l.price),
    ...extensions.map((e) => e.price),
    currentPrice,
  ];
  const minPrice = Math.min(...allPrices);
  const maxPrice = Math.max(...allPrices);
  const priceRange = maxPrice - minPrice;
  const padding = priceRange * 0.05;
  const displayMin = minPrice - padding;
  const displayMax = maxPrice + padding;
  const displayRange = displayMax - displayMin;

  function priceToY(price: number): number {
    return topMargin + chartHeight * (1 - (price - displayMin) / displayRange);
  }

  function indexToX(index: number): number {
    if (priceSeries.length <= 1) return leftMargin;
    return leftMargin + (index / (priceSeries.length - 1)) * chartWidth;
  }

  // Build price line path
  const linePath = priceSeries
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${indexToX(i).toFixed(1)},${priceToY(p.close).toFixed(1)}`)
    .join(' ');

  // Build area path (fill under line)
  const areaPath =
    linePath +
    ` L${indexToX(priceSeries.length - 1).toFixed(1)},${(topMargin + chartHeight).toFixed(1)}` +
    ` L${leftMargin.toFixed(1)},${(topMargin + chartHeight).toFixed(1)} Z`;

  const currentY = priceToY(currentPrice);

  return (
    <svg
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      className="w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Background */}
      <rect x="0" y="0" width={svgWidth} height={svgHeight} fill="transparent" />

      {/* Fibonacci level bands (fill between consecutive levels) */}
      {levels.map((level, i) => {
        if (i >= levels.length - 1) return null;
        const y1 = priceToY(level.price);
        const y2 = priceToY(levels[i + 1].price);
        const topY = Math.min(y1, y2);
        const h = Math.abs(y2 - y1);
        const color = LEVEL_COLORS[level.level]?.fill || 'color-mix(in srgb, var(--color-white) 2%, transparent)';
        return (
          <rect
            key={`band-${i}`}
            x={leftMargin}
            y={topY}
            width={chartWidth}
            height={h}
            fill={color}
          />
        );
      })}

      {/* Fibonacci retracement lines */}
      {levels.map((level) => {
        const y = priceToY(level.price);
        const color = LEVEL_COLORS[level.level]?.line || 'var(--color-stone-500)';
        const isGolden = level.level === '61.8%';
        return (
          <g key={`level-${level.level}`}>
            <line
              x1={leftMargin}
              y1={y}
              x2={leftMargin + chartWidth}
              y2={y}
              stroke={color}
              strokeWidth={isGolden ? 1.5 : 0.8}
              strokeDasharray={isGolden ? 'none' : '4,3'}
              opacity={isGolden ? 0.9 : 0.5}
            />
            <text
              x={leftMargin + chartWidth + 4}
              y={y - 4}
              textAnchor="start"
              fill={color}
              fontSize="8"
              fontFamily="inherit"
              fontWeight={isGolden ? 'bold' : 'normal'}
              opacity={0.9}
            >
              {level.level}
            </text>
            <text
              x={leftMargin + chartWidth + 4}
              y={y + 8}
              textAnchor="start"
              fill={color}
              fontSize="7.5"
              fontFamily="inherit"
              opacity={0.7}
            >
              {formatPrice(level.price)}
            </text>
          </g>
        );
      })}

      {/* Extension lines (dashed) */}
      {extensions.map((ext) => {
        const y = priceToY(ext.price);
        // Only render if within visible range
        if (y < topMargin - 10 || y > topMargin + chartHeight + 10) return null;
        return (
          <g key={`ext-${ext.level}`}>
            <line
              x1={leftMargin}
              y1={y}
              x2={leftMargin + chartWidth}
              y2={y}
              stroke={EXTENSION_COLOR}
              strokeWidth={0.7}
              strokeDasharray="6,4"
              opacity={0.5}
            />
            <text
              x={leftMargin + chartWidth + 4}
              y={y - 4}
              textAnchor="start"
              fill={EXTENSION_COLOR}
              fontSize="7.5"
              fontFamily="inherit"
              opacity={0.8}
            >
              {ext.level}
            </text>
            <text
              x={leftMargin + chartWidth + 4}
              y={y + 8}
              textAnchor="start"
              fill={EXTENSION_COLOR}
              fontSize="7"
              fontFamily="inherit"
              opacity={0.6}
            >
              {formatPrice(ext.price)}
            </text>
          </g>
        );
      })}

      {/* Price area fill */}
      <path d={areaPath} fill="color-mix(in srgb, var(--color-amber-300) 6%, transparent)" />

      {/* Price line */}
      <path d={linePath} fill="none" stroke="var(--color-amber-300)" strokeWidth={1.5} opacity={0.8} />

      {/* Current price marker */}
      <line
        x1={leftMargin}
        y1={currentY}
        x2={leftMargin + chartWidth}
        y2={currentY}
        stroke="var(--color-indigo-400)"
        strokeWidth={1.5}
        strokeDasharray="2,2"
        opacity={0.8}
      />
      <polygon
        points={`${leftMargin - 2},${currentY - 4} ${leftMargin + 5},${currentY} ${leftMargin - 2},${currentY + 4}`}
        fill="var(--color-indigo-400)"
      />
      <rect
        x={leftMargin + chartWidth + 1}
        y={currentY - 7}
        width={rightMargin - 4}
        height={14}
        rx={2}
        fill="var(--color-indigo-400)"
        opacity={0.15}
      />
      <text
        x={leftMargin + chartWidth + 4}
        y={currentY + 3}
        textAnchor="start"
        fill="var(--color-indigo-400)"
        fontSize="8.5"
        fontFamily="inherit"
        fontWeight="bold"
      >
        {formatPrice(currentPrice)}
      </text>
    </svg>
  );
}

// ---- Levels Table ----

function LevelsTable({
  levels,
  currentPrice,
  title,
  isExtension,
}: {
  levels: Array<{ level: string; price: number }>;
  currentPrice: number;
  title: string;
  isExtension?: boolean;
}) {
  // Find closest level
  let closestIdx = 0;
  let closestDist = Infinity;
  levels.forEach((l, i) => {
    const d = Math.abs(l.price - currentPrice);
    if (d < closestDist) {
      closestDist = d;
      closestIdx = i;
    }
  });

  return (
    <div>
      <div className="text-mini font-mono text-neutral-500 uppercase tracking-wider mb-1">
        {title}
      </div>
      <table className="w-full text-mini font-mono">
        <thead>
          <tr className="text-neutral-500 border-b border-white/5">
            <th className="text-left py-0.5 px-1.5 font-normal">Level</th>
            <th className="text-right py-0.5 px-1.5 font-normal">Price</th>
            <th className="text-right py-0.5 px-1.5 font-normal">Dist ($)</th>
            <th className="text-right py-0.5 px-1.5 font-normal">Dist (%)</th>
            <th className="text-center py-0.5 px-1.5 font-normal">Pos</th>
          </tr>
        </thead>
        <tbody>
          {levels.map((level, idx) => {
            const dist = level.price - currentPrice;
            const distPct = currentPrice !== 0 ? (dist / currentPrice) * 100 : 0;
            const isClosest = idx === closestIdx && !isExtension;
            const isAbove = currentPrice > level.price;
            const colorInfo = LEVEL_COLORS[level.level];
            const textColor = isExtension
              ? 'text-indigo-400'
              : colorInfo?.text || 'text-neutral-400';
            const isGolden = level.level === '61.8%';

            return (
              <tr
                key={level.level}
                className={`border-b border-white/[0.03] transition-colors ${
                  isClosest
                    ? 'bg-yellow-400/10 ring-1 ring-inset ring-yellow-400/20'
                    : isGolden && !isExtension
                      ? 'bg-amber-400/[0.06]'
                      : 'hover:bg-white/[0.02]'
                }`}
              >
                <td className={`py-1 px-1.5 font-semibold ${textColor}`}>
                  {level.level}
                  {isGolden && !isExtension && (
                    <span className="ml-1 text-micro text-amber-400/60 font-normal">GR</span>
                  )}
                </td>
                <td className="text-right py-1 px-1.5 text-neutral-200">
                  {formatPrice(level.price)}
                </td>
                <td
                  className={`text-right py-1 px-1.5 ${
                    dist >= 0 ? 'text-emerald-400/70' : 'text-red-400/70'
                  }`}
                >
                  {dist >= 0 ? '+' : ''}
                  {formatPrice(dist)}
                </td>
                <td
                  className={`text-right py-1 px-1.5 ${
                    distPct >= 0 ? 'text-emerald-400/70' : 'text-red-400/70'
                  }`}
                >
                  {distPct >= 0 ? '+' : ''}
                  {distPct.toFixed(2)}%
                </td>
                <td className="text-center py-1 px-1.5">
                  <span
                    className={`text-micro ${
                      isAbove ? 'text-emerald-400/60' : 'text-red-400/60'
                    }`}
                  >
                    {isAbove ? 'ABOVE' : 'BELOW'}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---- Zone Indicator ----

function ZoneIndicator({ data }: { data: FibonacciData }) {
  const t = useT();
  const { currentPrice, levels } = data;

  // Find the zone (between which two levels)
  const sortedLevels = [...levels].sort((a, b) => b.price - a.price);
  let upperLevel: typeof sortedLevels[0] | null = null;
  let lowerLevel: typeof sortedLevels[0] | null = null;

  for (let i = 0; i < sortedLevels.length - 1; i++) {
    if (currentPrice <= sortedLevels[i].price && currentPrice >= sortedLevels[i + 1].price) {
      upperLevel = sortedLevels[i];
      lowerLevel = sortedLevels[i + 1];
      break;
    }
  }

  // Find key support (61.8% level)
  const goldenLevel = levels.find((l) => l.level === '61.8%');

  return (
    <div className="px-3 py-2 border-t border-white/5">
      <div className="text-mini font-mono text-neutral-500 uppercase tracking-wider mb-1.5">
        {t('fibZone')}
      </div>
      <div className="space-y-1">
        {upperLevel && lowerLevel ? (
          <div className="text-mini font-mono text-neutral-300">
            <span className="text-yellow-400/80">Price is between</span>{' '}
            <span className="text-neutral-200">{upperLevel.level}</span>{' '}
            <span className="text-neutral-500">({formatPrice(upperLevel.price)})</span>{' '}
            <span className="text-yellow-400/80">and</span>{' '}
            <span className="text-neutral-200">{lowerLevel.level}</span>{' '}
            <span className="text-neutral-500">({formatPrice(lowerLevel.price)})</span>
          </div>
        ) : (
          <div className="text-mini font-mono text-neutral-500">
            Price outside retracement range
          </div>
        )}
        {goldenLevel && (
          <div className="text-mini font-mono text-amber-400/70">
            Key {data.trend === 'uptrend' ? 'support' : 'resistance'} at 61.8%{' '}
            <span className="text-neutral-500">({formatPrice(goldenLevel.price)})</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Main Panel ----

export function FibonacciPanel() {
  const t = useT();
  const symbol = useAppStore((s) => s.selectedSymbol);
  const [range, setRange] = useState<RangeKey>('6mo');
  const { data, isLoading, isError } = useFibonacci(range);
  const queryClient = useQueryClient();

  const handleRefresh = useCallback(() => {
    if (symbol) {
      queryClient.invalidateQueries({ queryKey: ['fibonacci', symbol, range] });
    }
  }, [symbol, range, queryClient]);

  // No symbol selected
  if (!symbol) {
    return (
      <div className="flex flex-col h-full bg-black">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
          <GitBranch className="w-3.5 h-3.5 text-yellow-400" />
          <span className="text-xs font-mono font-semibold tracking-widest text-neutral-300 uppercase">
            {t('panelFibonacci')}
          </span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <span className="text-mini font-mono text-neutral-500 uppercase tracking-widest">
            {t('fibNoSymbol')}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-black overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-2">
          <GitBranch className="w-3.5 h-3.5 text-yellow-400" />
          <span className="text-xs font-mono font-semibold tracking-widest text-neutral-300 uppercase">
            {t('panelFibonacci')}
          </span>
          <span className="text-mini font-mono text-yellow-400">{symbol}</span>
        </div>
        <button
          onClick={handleRefresh}
          className="p-1 text-neutral-500 hover:text-yellow-400 transition-colors"
          title="Refresh"
        >
          <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Range Tabs */}
      <div className="flex border-b border-white/5 shrink-0">
        {RANGE_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setRange(tab.key)}
            className={`flex-1 px-2 py-1.5 text-mini font-mono uppercase tracking-wider transition-colors ${
              range === tab.key
                ? 'text-yellow-400 border-b border-yellow-400 bg-yellow-400/5'
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-yellow-400/30 border-t-yellow-400 animate-spin rounded-sm" />
        </div>
      )}

      {/* Error */}
      {isError && !isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-mini font-mono text-red-400/70 uppercase tracking-widest">
            {t('fibNoData')}
          </span>
        </div>
      )}

      {/* Content */}
      {data && !isLoading && (
        <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin">
          {/* Summary Bar */}
          <div className="px-3 py-2 border-b border-white/5">
            <div className="flex items-center gap-3 mb-1.5">
              {/* Trend Indicator */}
              <div
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-mini font-mono font-bold uppercase tracking-wider ${
                  data.trend === 'uptrend'
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-red-500/10 text-red-400'
                }`}
              >
                {data.trend === 'uptrend' ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {data.trend === 'uptrend' ? t('fibUptrend') : t('fibDowntrend')}
              </div>
              {/* Current Price */}
              <span className="text-lg font-mono font-bold text-white">
                {formatPrice(data.currentPrice)}
              </span>
            </div>

            {/* Swing High / Low */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col py-1 px-2 rounded bg-white/[0.03]">
                <span className="text-micro font-mono text-neutral-500 uppercase">
                  {t('fibSwingHigh')}
                </span>
                <span className="text-mini font-mono text-emerald-400">
                  {formatPrice(data.swingHigh)}
                </span>
                <span className="text-micro font-mono text-neutral-600">
                  {formatDate(data.swingHighDate)}
                </span>
              </div>
              <div className="flex flex-col py-1 px-2 rounded bg-white/[0.03]">
                <span className="text-micro font-mono text-neutral-500 uppercase">
                  {t('fibSwingLow')}
                </span>
                <span className="text-mini font-mono text-red-400">
                  {formatPrice(data.swingLow)}
                </span>
                <span className="text-micro font-mono text-neutral-600">
                  {formatDate(data.swingLowDate)}
                </span>
              </div>
            </div>
          </div>

          {/* Fibonacci Chart */}
          <div className="px-2 py-2 border-b border-white/5">
            <div className="bg-white/[0.02] rounded border border-white/5 p-1">
              <FibonacciChart data={data} />
            </div>
          </div>

          {/* Retracement Levels Table */}
          <div className="px-2 py-1.5 border-b border-white/5">
            <LevelsTable
              levels={data.levels}
              currentPrice={data.currentPrice}
              title={t('fibLevels')}
            />
          </div>

          {/* Extension Levels Table */}
          <div className="px-2 py-1.5">
            <LevelsTable
              levels={data.extensions}
              currentPrice={data.currentPrice}
              title={t('fibExtensions')}
              isExtension
            />
          </div>

          {/* Zone Indicator */}
          <ZoneIndicator data={data} />

          {/* Bottom spacer */}
          <div className="h-2" />
        </div>
      )}
    </div>
  );
}
