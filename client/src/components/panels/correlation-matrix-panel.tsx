import { useState } from 'react';
import { GlassCard } from '../common/glass-card';
import { useCorrelationMatrix } from '../../api/hooks/use-correlations';
import { Grid3X3 } from 'lucide-react';
import { useT } from '../../i18n';

const PERIODS = ['1M', '3M', '6M', '1Y'] as const;
type Period = typeof PERIODS[number];

function getCellColor(value: number, isDiagonal: boolean): string {
  if (isDiagonal) return 'color-mix(in srgb, var(--color-zinc-700) 30%, transparent)';
  // blue (-1) -> white (0) -> red (+1)
  if (value > 0) {
    const intensity = Math.min(value, 1);
    return `color-mix(in srgb, var(--color-red-500) calc((${intensity * 0.6}) * 100%), transparent)`;
  }
  if (value < 0) {
    const intensity = Math.min(Math.abs(value), 1);
    return `color-mix(in srgb, var(--color-blue-500) calc((${intensity * 0.6}) * 100%), transparent)`;
  }
  return 'transparent';
}

function getTextColor(value: number): string {
  const abs = Math.abs(value);
  if (abs > 0.7) return 'var(--color-white)';
  if (abs > 0.4) return 'var(--color-zinc-200)';
  return 'var(--color-zinc-400)';
}

export function CorrelationMatrixPanel() {
  const t = useT();
  const [period, setPeriod] = useState<Period>('3M');
  const { data, isLoading, error } = useCorrelationMatrix(period);

  return (
    <GlassCard
      title={
        <span className="flex items-center gap-1.5">
          <Grid3X3 className="w-3 h-3" />
          {t('correlationMatrix')}
        </span>
      }
      className="h-full"
    >
      {/* Period selector */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 border-b border-border/30 bg-black/20">
        <span className="text-micro font-mono text-neutral/50 uppercase">{t('correlationPeriod')}:</span>
        <div className="flex items-center gap-0.5">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-2 py-0.5 text-mini font-mono font-black transition-all ${
                period === p
                  ? 'bg-accent/20 text-accent-ink'
                  : 'text-neutral/50 hover:text-white'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Matrix */}
      <div className="flex-1 overflow-auto no-scrollbar p-2">
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <div className="w-4 h-4 border-2 border-accent/30 border-t-accent animate-spin" />
            <span className="text-mini font-mono text-neutral/40 uppercase tracking-widest">{t('loading')}</span>
          </div>
        )}
        {error && (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <span className="text-mini font-mono text-bearish/60 uppercase tracking-widest">{t('failedCorrelations')}</span>
            <button onClick={() => window.location.reload()} className="text-mini font-mono text-accent-ink hover:text-white border border-accent/30 px-2 py-0.5 transition-colors">{t('retry')}</button>
          </div>
        )}
        {!isLoading && !error && data && (
          <div className="overflow-auto">
            <table className="border-collapse w-full">
              <thead>
                <tr>
                  {/* Empty corner cell */}
                  <th className="p-1 text-micro font-mono text-neutral/30 w-12" />
                  {data.symbols.map((sym, i) => (
                    <th
                      key={sym}
                      className="p-1 text-micro font-mono font-bold text-accent-ink uppercase tracking-wider whitespace-nowrap"
                      title={data.names[i]}
                    >
                      {sym}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.matrix.map((row, i) => (
                  <tr key={data.symbols[i]}>
                    <td className="p-1 text-micro font-mono font-bold text-accent-ink uppercase tracking-wider whitespace-nowrap">
                      {data.symbols[i]}
                    </td>
                    {row.map((val, j) => {
                      const isDiagonal = i === j;
                      return (
                        <td
                          key={j}
                          className="p-1 text-center border border-border/10"
                          style={{ backgroundColor: getCellColor(val, isDiagonal) }}
                        >
                          <span
                            className="text-mini font-mono font-bold"
                            style={{ color: isDiagonal ? 'var(--color-zinc-500)' : getTextColor(val) }}
                          >
                            {val.toFixed(2)}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Legend */}
            <div className="flex items-center justify-center gap-3 mt-3">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-blue-500/60 border border-border/20" />
                <span className="text-micro font-mono text-neutral/40">{t('legendInverse')}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-transparent border border-border/20" />
                <span className="text-micro font-mono text-neutral/40">{t('legendNone')}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-red-500/60 border border-border/20" />
                <span className="text-micro font-mono text-neutral/40">{t('legendDirect')}</span>
              </div>
            </div>
          </div>
        )}
        {!isLoading && !error && !data && (
          <div className="flex items-center justify-center py-8 text-mini font-mono text-neutral/40 uppercase tracking-widest">
            {t('noCorrelationData')}
          </div>
        )}
      </div>
    </GlassCard>
  );
}
