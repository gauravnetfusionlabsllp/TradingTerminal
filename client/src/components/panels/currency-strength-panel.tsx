import { useState, useMemo } from 'react';
import { useCurrencyStrength, type CurrencyStrength } from '../../api/hooks/use-currency-strength';
import { useT, tr, TFn } from '../../i18n';
import { Activity, RefreshCw } from 'lucide-react';

type TabMode = 'strength' | 'matrix';

const FLAG_EMOJI: Record<string, string> = {
  USD: '\u{1F1FA}\u{1F1F8}',
  EUR: '\u{1F1EA}\u{1F1FA}',
  GBP: '\u{1F1EC}\u{1F1E7}',
  JPY: '\u{1F1EF}\u{1F1F5}',
  CHF: '\u{1F1E8}\u{1F1ED}',
  AUD: '\u{1F1E6}\u{1F1FA}',
  CAD: '\u{1F1E8}\u{1F1E6}',
  NZD: '\u{1F1F3}\u{1F1FF}',
};

// i18n keys may not exist yet — use fallback pattern
function strengthColor(value: number): string {
  if (value >= 80) return 'var(--color-emerald-400)'; // emerald
  if (value >= 60) return 'var(--color-green-400)'; // green
  if (value >= 40) return 'var(--color-amber-300)'; // yellow
  if (value >= 20) return 'var(--color-orange-400)'; // orange
  return 'var(--color-red-400)'; // red
}

function strengthGradient(value: number): string {
  // Create gradient stop color based on value
  if (value >= 70) return 'from-emerald-500/80 to-green-400/60';
  if (value >= 50) return 'from-yellow-500/70 to-green-400/50';
  if (value >= 30) return 'from-orange-500/70 to-yellow-400/50';
  return 'from-red-500/80 to-orange-400/50';
}

function heatColor(value: number): string {
  // value is a % change. Green for positive, red for negative
  const absVal = Math.min(Math.abs(value), 1.5);
  const intensity = Math.round((absVal / 1.5) * 255);
  if (value > 0) return `color-mix(in srgb, var(--color-green-400) calc((${intensity / 255 * 0.8}) * 100%), transparent)`;
  if (value < 0) return `color-mix(in srgb, var(--color-red-400) calc((${intensity / 255 * 0.8}) * 100%), transparent)`;
  return 'color-mix(in srgb, var(--color-neutral-500) 10%, transparent)';
}

export function CurrencyStrengthPanel() {
  const t = useT();
  const { data, isLoading, refetch } = useCurrencyStrength();
  const [tab, setTab] = useState<TabMode>('strength');

  const metrics = useMemo(() => {
    if (!data?.currencies?.length) return null;

    const sorted = [...data.currencies].sort((a, b) => b.strength - a.strength);
    const strongest = sorted[0];
    const weakest = sorted[sorted.length - 1];

    // Find most volatile pair
    let maxVol = 0;
    let volPair = '';
    for (const c of data.currencies) {
      for (const [other, change] of Object.entries(c.pairs)) {
        const absChange = Math.abs(change);
        if (absChange > maxVol) {
          maxVol = absChange;
          volPair = `${c.code}/${other}`;
        }
      }
    }

    return { strongest, weakest, volPair, maxVol };
  }, [data]);

  return (
    <div className="h-full flex flex-col bg-black overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-raised border-b border-border/30 shrink-0">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-violet-400" />
          <span className="text-mini font-black font-mono uppercase tracking-tighter text-violet-400">
            {tr(t, 'csMeterTitle', 'CURRENCY STRENGTH')}
          </span>
        </div>
        <button onClick={() => refetch()} className="p-1 text-neutral/40 hover:text-violet-400 transition-colors">
          <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Key Metrics Bar */}
      {metrics && (
        <div className="grid grid-cols-3 gap-px px-3 py-1.5 border-b border-border/20 bg-black/60 shrink-0">
          <div className="text-center">
            <div className="text-micro font-mono text-neutral/40 uppercase tracking-wider">
              {tr(t, 'csStrongest', 'Strongest')}
            </div>
            <div className="text-mini font-mono font-black text-emerald-400">
              {FLAG_EMOJI[metrics.strongest.code]} {metrics.strongest.code}
              <span className="text-micro text-emerald-400/60 ml-1">{metrics.strongest.strength.toFixed(1)}</span>
            </div>
          </div>
          <div className="text-center">
            <div className="text-micro font-mono text-neutral/40 uppercase tracking-wider">
              {tr(t, 'csWeakest', 'Weakest')}
            </div>
            <div className="text-mini font-mono font-black text-red-400">
              {FLAG_EMOJI[metrics.weakest.code]} {metrics.weakest.code}
              <span className="text-micro text-red-400/60 ml-1">{metrics.weakest.strength.toFixed(1)}</span>
            </div>
          </div>
          <div className="text-center">
            <div className="text-micro font-mono text-neutral/40 uppercase tracking-wider">
              {tr(t, 'csMostVolatile', 'Most Volatile')}
            </div>
            <div className="text-mini font-mono font-black text-yellow-400">
              {metrics.volPair}
              <span className="text-micro text-yellow-400/60 ml-1">{metrics.maxVol.toFixed(3)}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 px-3 py-1 border-b border-border/20 bg-black/60 shrink-0">
        {(['strength', 'matrix'] as TabMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setTab(mode)}
            className={`px-2.5 py-0.5 text-micro font-black uppercase tracking-wider border transition-colors ${
              tab === mode
                ? 'border-violet-400/40 text-violet-400 bg-violet-400/10'
                : 'border-border/20 text-neutral/30 hover:text-neutral/60'
            }`}
          >
            {mode === 'strength' ? tr(t, 'csStrength', 'Strength') : tr(t, 'csMatrix', 'Matrix')}
          </button>
        ))}
        {data?.updatedAt && (
          <span className="ml-auto text-micro font-mono text-neutral/25">
            {new Date(data.updatedAt).toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto no-scrollbar">
        {isLoading && !data && (
          <div className="text-center py-8 text-violet-400 text-mini font-mono uppercase animate-pulse">
            {tr(t, 'loading', 'Loading...')}
          </div>
        )}

        {!data && !isLoading && (
          <div className="text-center py-8 text-neutral/30 text-mini font-mono uppercase">
            {tr(t, 'csNoData', 'No data available')}
          </div>
        )}

        {data && tab === 'strength' && <StrengthBars currencies={data.currencies} />}
        {data && tab === 'matrix' && <StrengthMatrix currencies={data.currencies} />}
      </div>

      {/* Status bar */}
      <div className="px-3 py-1 border-t border-border/30 bg-raised shrink-0 flex items-center justify-between">
        <span className="text-micro font-mono text-neutral/25">
          {data ? `${data.currencies.length} currencies` : '---'}
        </span>
        <span className="text-micro font-mono text-neutral/25">
          28 {tr(t, 'csPairs', 'pairs')}
        </span>
      </div>
    </div>
  );
}

// ── Strength Bars View ──

function StrengthBars({ currencies }: { currencies: CurrencyStrength[] }) {
  const sorted = useMemo(
    () => [...currencies].sort((a, b) => b.strength - a.strength),
    [currencies],
  );

  return (
    <div className="px-3 py-1.5 space-y-1">
      {sorted.map((c) => (
        <div key={c.code} className="flex items-center gap-2 group">
          {/* Rank */}
          <span className="text-micro font-mono font-black text-neutral/30 w-3 text-right shrink-0">
            {c.rank}
          </span>

          {/* Flag + Code */}
          <span className="text-mini shrink-0 w-5 text-center">{FLAG_EMOJI[c.code]}</span>
          <span className="text-mini font-mono font-black text-white w-7 shrink-0">
            {c.code}
          </span>

          {/* Bar */}
          <div className="flex-1 h-4 bg-white/[0.03] relative overflow-hidden border border-white/[0.04]">
            <div
              className={`absolute inset-y-0 left-0 bg-gradient-to-r ${strengthGradient(c.strength)} transition-all duration-700`}
              style={{ width: `${c.strength}%` }}
            />
            {/* SVG tick marks at 25, 50, 75 */}
            <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
              <line x1="25%" y1="0" x2="25%" y2="100%" stroke="color-mix(in srgb, var(--color-white) 5%, transparent)" strokeWidth="1" />
              <line x1="50%" y1="0" x2="50%" y2="100%" stroke="color-mix(in srgb, var(--color-white) 8%, transparent)" strokeWidth="1" />
              <line x1="75%" y1="0" x2="75%" y2="100%" stroke="color-mix(in srgb, var(--color-white) 5%, transparent)" strokeWidth="1" />
            </svg>
          </div>

          {/* Value */}
          <span
            className="text-mini font-mono font-black w-9 text-right shrink-0"
            style={{ color: strengthColor(c.strength) }}
          >
            {c.strength.toFixed(1)}
          </span>

          {/* Change */}
          <span
            className={`text-micro font-mono w-10 text-right shrink-0 ${
              c.change >= 0 ? 'text-emerald-400/60' : 'text-red-400/60'
            }`}
          >
            {c.change >= 0 ? '+' : ''}{c.change.toFixed(3)}%
          </span>
        </div>
      ))}

      {/* Legend */}
      <div className="pt-2 flex items-center justify-center gap-4">
        <LegendDot color="text-red-400" label="Weak (0)" />
        <LegendDot color="text-yellow-400" label="Neutral (50)" />
        <LegendDot color="text-emerald-400" label="Strong (100)" />
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <div className={`w-1.5 h-1.5 rounded-full ${color} bg-current`} />
      <span className="text-micro font-mono text-neutral/30">{label}</span>
    </div>
  );
}

// ── Matrix View ──

function StrengthMatrix({ currencies }: { currencies: CurrencyStrength[] }) {
  // Sort by strength descending for matrix layout
  const sorted = useMemo(
    () => [...currencies].sort((a, b) => b.strength - a.strength),
    [currencies],
  );

  const codes = sorted.map((c) => c.code);
  const currMap = useMemo(
    () => new Map(sorted.map((c) => [c.code, c])),
    [sorted],
  );

  const cellSize = 36; // px
  const headerSize = 32; // px for row/col headers
  const totalWidth = headerSize + codes.length * cellSize;
  const totalHeight = headerSize + codes.length * cellSize;

  return (
    <div className="px-2 py-2 overflow-auto no-scrollbar">
      <svg
        width={totalWidth}
        height={totalHeight}
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        className="mx-auto"
        style={{ maxWidth: '100%' }}
      >
        {/* Column headers */}
        {codes.map((code, i) => (
          <g key={`ch-${code}`}>
            <text
              x={headerSize + i * cellSize + cellSize / 2}
              y={headerSize - 6}
              textAnchor="middle"
              className="fill-neutral/50"
              style={{ fontSize: '8px', fontFamily: 'inherit', fontWeight: 900 }}
            >
              {code}
            </text>
          </g>
        ))}

        {/* Row headers + cells */}
        {codes.map((rowCode, ri) => (
          <g key={`row-${rowCode}`}>
            {/* Row header */}
            <text
              x={headerSize - 4}
              y={headerSize + ri * cellSize + cellSize / 2 + 3}
              textAnchor="end"
              className="fill-neutral/50"
              style={{ fontSize: '8px', fontFamily: 'inherit', fontWeight: 900 }}
            >
              {rowCode}
            </text>

            {/* Cells */}
            {codes.map((colCode, ci) => {
              const isIdentity = rowCode === colCode;
              const curr = currMap.get(rowCode);
              const pairChange = curr?.pairs[colCode] ?? 0;

              const x = headerSize + ci * cellSize;
              const y = headerSize + ri * cellSize;

              return (
                <g key={`${rowCode}-${colCode}`}>
                  <rect
                    x={x + 1}
                    y={y + 1}
                    width={cellSize - 2}
                    height={cellSize - 2}
                    fill={isIdentity ? 'color-mix(in srgb, var(--color-violet-500) 15%, transparent)' : heatColor(pairChange)}
                    rx={2}
                  />
                  <text
                    x={x + cellSize / 2}
                    y={y + cellSize / 2 + 3}
                    textAnchor="middle"
                    style={{
                      fontSize: isIdentity ? '7px' : '8px',
                      fontFamily: 'inherit',
                      fontWeight: isIdentity ? 400 : 700,
                      fill: isIdentity
                        ? 'color-mix(in srgb, var(--color-violet-500) 50%, transparent)'
                        : pairChange > 0
                          ? 'color-mix(in srgb, var(--color-green-400) 90%, transparent)'
                          : pairChange < 0
                            ? 'color-mix(in srgb, var(--color-red-400) 90%, transparent)'
                            : 'color-mix(in srgb, var(--color-neutral-500) 40%, transparent)',
                    }}
                  >
                    {isIdentity ? '---' : `${pairChange >= 0 ? '+' : ''}${pairChange.toFixed(2)}`}
                  </text>
                </g>
              );
            })}
          </g>
        ))}

        {/* Grid lines */}
        {codes.map((_, i) => (
          <g key={`grid-${i}`}>
            <line
              x1={headerSize}
              y1={headerSize + i * cellSize}
              x2={totalWidth}
              y2={headerSize + i * cellSize}
              stroke="color-mix(in srgb, var(--color-white) 3%, transparent)"
              strokeWidth={1}
            />
            <line
              x1={headerSize + i * cellSize}
              y1={headerSize}
              x2={headerSize + i * cellSize}
              y2={totalHeight}
              stroke="color-mix(in srgb, var(--color-white) 3%, transparent)"
              strokeWidth={1}
            />
          </g>
        ))}
      </svg>

      {/* Matrix legend */}
      <div className="flex items-center justify-center gap-3 mt-2">
        <div className="flex items-center gap-1">
          <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: 'color-mix(in srgb, var(--color-red-400) 60%, transparent)' }} />
          <span className="text-micro font-mono text-neutral/30">Row weaker</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: 'color-mix(in srgb, var(--color-neutral-500) 20%, transparent)' }} />
          <span className="text-micro font-mono text-neutral/30">Neutral</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: 'color-mix(in srgb, var(--color-green-400) 60%, transparent)' }} />
          <span className="text-micro font-mono text-neutral/30">Row stronger</span>
        </div>
      </div>
    </div>
  );
}
