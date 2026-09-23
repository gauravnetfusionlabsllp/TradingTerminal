import { Activity } from 'lucide-react';
import { useEquityDerivatives } from '../../api/hooks/use-equity-derivatives';

// ── Formatting helpers ──

function fmtCompact(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K';
  return n.toFixed(0);
}

function fmtPremium(n: number): string {
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
  return '$' + n.toFixed(0);
}

function vixColor(level: number): string {
  if (level >= 30) return 'text-red-400';
  if (level >= 20) return 'text-yellow-400';
  return 'text-emerald-400';
}

function ivHeatColor(iv: number): string {
  // Low IV (14-18): cool cyan, Mid (18-24): warm, High (24+): hot
  if (iv <= 15) return 'bg-cyan-900/40 text-cyan-300';
  if (iv <= 17) return 'bg-cyan-800/40 text-cyan-200';
  if (iv <= 19) return 'bg-cyan-600/30 text-cyan-100';
  if (iv <= 21) return 'bg-yellow-700/30 text-yellow-200';
  if (iv <= 23) return 'bg-orange-700/30 text-orange-200';
  if (iv <= 26) return 'bg-orange-600/30 text-orange-100';
  return 'bg-red-700/30 text-red-200';
}

// ── Main Panel ──

export function EquityDerivativesPanel() {
  const { data, isLoading } = useEquityDerivatives();

  return (
    <div className="h-full flex flex-col bg-black overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#050505] border-b border-cyan-400/30 shrink-0">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-[9px] font-black font-mono uppercase tracking-tighter text-cyan-400">
            Equity Derivatives
          </span>
        </div>
        <div className="flex items-center gap-3 text-[9px] font-mono">
          <span className="text-neutral-500">VIX</span>
          <span className={`font-bold tabular-nums ${vixColor(data?.vix)}`}>
            {data?.vix?.toFixed(2) ?? '--'}
          </span>
          <span className="text-neutral-500">P/C</span>
          <span className="font-bold tabular-nums text-neutral-300">{data?.putCallRatio?.toFixed(2) ?? '--'}</span>
          <span className="text-neutral-500">VOL</span>
          <span className="font-bold tabular-nums text-neutral-300">{data?.totalVolume != null ? fmtCompact(data.totalVolume) : '--'}</span>
        </div>
      </div>

      <div className="flex-1 overflow-auto no-scrollbar">
        {!data ? (
          <div className="flex items-center justify-center h-full text-neutral/40 text-[10px] font-mono uppercase tracking-widest">{isLoading ? 'Loading...' : 'No data available'}</div>
        ) : (<>
        {/* ── Market Overview Stats Bar ── */}
        <div className="px-3 py-2 border-b border-cyan-400/30 bg-[#020808]">
          <div className="flex items-center gap-1 mb-1.5">
            <div className="w-1 h-1 bg-cyan-400" />
            <span className="text-[7px] font-black font-mono uppercase tracking-widest text-neutral-500">
              Market Overview
            </span>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {[
              { label: 'VIX', value: data.vix?.toFixed(2) ?? '--', sub: data.vixChange != null ? `${data.vixChange >= 0 ? '+' : ''}${data.vixChange.toFixed(2)}` : null, subColor: data.vixChange >= 0 ? 'text-red-400' : 'text-emerald-400' },
              { label: 'Impl Corr', value: data.marketOverview?.impliedCorrelation?.toFixed(2) ?? '--', sub: null, subColor: '' },
              { label: 'RV 30d', value: data.marketOverview?.realizedVol30d != null ? data.marketOverview.realizedVol30d.toFixed(1) + '%' : '--', sub: null, subColor: '' },
              { label: 'IV 30d', value: data.marketOverview?.impliedVol30d != null ? data.marketOverview.impliedVol30d.toFixed(1) + '%' : '--', sub: null, subColor: '' },
              { label: 'Skew', value: data.marketOverview?.skewIndex?.toFixed(1) ?? '--', sub: null, subColor: '' },
            ].map((item: any) => (
              <div key={item.label} className="text-center">
                <div className="text-[7px] font-bold font-mono uppercase tracking-wider text-neutral-500">{item.label}</div>
                <div className="text-[11px] font-mono font-bold tabular-nums text-white">{item.value}</div>
                {item.sub && <div className={`text-[7px] font-mono tabular-nums ${item.subColor}`}>{item.sub}</div>}
              </div>
            ))}
          </div>
        </div>

        {/* ── Notable Options Flow ── */}
        <div className="border-b border-cyan-400/30">
          <div className="px-3 py-1.5">
            <div className="flex items-center gap-1">
              <div className="w-1 h-1 bg-cyan-400" />
              <span className="text-[7px] font-black font-mono uppercase tracking-widest text-neutral-500">
                Notable Options Flow
              </span>
            </div>
          </div>
          {/* Table header */}
          <div className="grid grid-cols-[48px_38px_48px_52px_44px_52px_32px_48px_40px] px-3 py-1 border-b border-border/20 text-[7px] font-bold font-mono uppercase tracking-wider text-neutral-500">
            <span>Sym</span>
            <span>Dir</span>
            <span className="text-right">Strike</span>
            <span className="text-right">Expiry</span>
            <span className="text-right">Vol</span>
            <span className="text-right">Prem</span>
            <span className="text-right">IV</span>
            <span className="text-center">Sent</span>
            <span className="text-center">Flow</span>
          </div>
          {(data.optionsFlow ?? []).map((flow: any, i: any) => (
            <div
              key={`${flow.underlying}-${flow.strike}-${i}`}
              className="grid grid-cols-[48px_38px_48px_52px_44px_52px_32px_48px_40px] px-3 py-1 border-b border-border/20 hover:bg-cyan-400/[0.02] transition-colors items-center text-[9px] font-mono"
            >
              <span className="font-bold text-cyan-400">{flow.underlying}</span>
              <span>
                <span className={`px-1 py-[1px] text-[7px] font-bold uppercase ${
                  flow.direction === 'CALL'
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-red-500/15 text-red-400'
                }`}>
                  {flow.direction}
                </span>
              </span>
              <span className="text-right tabular-nums text-neutral-300">{flow.strike}</span>
              <span className="text-right tabular-nums text-neutral-300">
                {new Date(flow.expiry).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </span>
              <span className="text-right tabular-nums text-neutral-300">{fmtCompact(flow.volume)}</span>
              <span className="text-right tabular-nums text-neutral-300">{fmtPremium(flow.premium)}</span>
              <span className="text-right tabular-nums text-neutral-300">{flow.iv.toFixed(0)}%</span>
              <span className="text-center">
                <span className={`px-1 py-[1px] text-[7px] font-bold ${
                  flow.sentiment === 'Bullish' ? 'text-emerald-400'
                  : flow.sentiment === 'Bearish' ? 'text-red-400'
                  : 'text-yellow-400'
                }`}>
                  {flow.sentiment.slice(0, 4).toUpperCase()}
                </span>
              </span>
              <span className="text-center">
                <span className="px-1 py-[1px] text-[7px] font-bold text-cyan-400/70">
                  {flow.flowType}
                </span>
              </span>
            </div>
          ))}
        </div>

        {/* ── Volatility Surface Heatmap (SPX) ── */}
        <div className="border-b border-cyan-400/30">
          <div className="px-3 py-1.5">
            <div className="flex items-center gap-1">
              <div className="w-1 h-1 bg-cyan-400" />
              <span className="text-[7px] font-black font-mono uppercase tracking-widest text-neutral-500">
                SPX Volatility Surface
              </span>
            </div>
          </div>
          <div className="px-3 pb-2 overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="text-[7px] font-bold font-mono uppercase tracking-wider text-neutral-500 text-left py-1 pr-2">Tenor</th>
                  {(data.volSurface?.strikes ?? []).map((strike: any) => (
                    <th key={strike} className="text-[7px] font-bold font-mono uppercase tracking-wider text-neutral-500 text-center py-1 px-1 min-w-[36px]">
                      {strike}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data.volSurface?.tenors ?? []).map((tenor: any, ti: any) => (
                  <tr key={tenor} className="border-t border-border/20 hover:bg-cyan-400/[0.02]">
                    <td className="text-[8px] font-mono font-bold text-neutral-400 py-1 pr-2">{tenor}</td>
                    {(data.volSurface.ivMatrix?.[ti] ?? []).map((iv: any, si: any) => (
                      <td key={`${ti}-${si}`} className={`text-center py-1 px-1 text-[8px] font-mono tabular-nums font-bold ${ivHeatColor(iv)}`}>
                        {iv.toFixed(1)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Index Put/Call Ratios ── */}
        <div className="border-b border-cyan-400/30">
          <div className="px-3 py-1.5">
            <div className="flex items-center gap-1">
              <div className="w-1 h-1 bg-cyan-400" />
              <span className="text-[7px] font-black font-mono uppercase tracking-widest text-neutral-500">
                Index Put/Call Ratios
              </span>
            </div>
          </div>
          <div className="grid grid-cols-[48px_56px_64px_64px] px-3 py-1 border-b border-border/20 text-[7px] font-bold font-mono uppercase tracking-wider text-neutral-500">
            <span>Index</span>
            <span className="text-right">P/C</span>
            <span className="text-right">Call Vol</span>
            <span className="text-right">Put Vol</span>
          </div>
          {(data.putCallRatios ?? []).map((row: any) => (
            <div
              key={row.index}
              className="grid grid-cols-[48px_56px_64px_64px] px-3 py-1 border-b border-border/20 hover:bg-cyan-400/[0.02] transition-colors items-center text-[9px] font-mono"
            >
              <span className="font-bold text-cyan-400">{row.index}</span>
              <span className={`text-right tabular-nums font-bold ${row.pcRatio > 1 ? 'text-red-400' : 'text-emerald-400'}`}>
                {row.pcRatio.toFixed(2)}
              </span>
              <span className="text-right tabular-nums text-neutral-300">{fmtCompact(row.callVol)}</span>
              <span className="text-right tabular-nums text-neutral-300">{fmtCompact(row.putVol)}</span>
            </div>
          ))}
        </div>

        {/* ── Sector Volatility ── */}
        <div className="border-b border-cyan-400/30">
          <div className="px-3 py-1.5">
            <div className="flex items-center gap-1">
              <div className="w-1 h-1 bg-cyan-400" />
              <span className="text-[7px] font-black font-mono uppercase tracking-widest text-neutral-500">
                Sector Volatility
              </span>
            </div>
          </div>
          <div className="grid grid-cols-[80px_48px_48px_56px] px-3 py-1 border-b border-border/20 text-[7px] font-bold font-mono uppercase tracking-wider text-neutral-500">
            <span>Sector</span>
            <span className="text-right">IV 30d</span>
            <span className="text-right">RV 20d</span>
            <span className="text-right">Spread</span>
          </div>
          {(data.sectorVolatility ?? []).map((row: any) => (
            <div
              key={row.sector}
              className="grid grid-cols-[80px_48px_48px_56px] px-3 py-1 border-b border-border/20 hover:bg-cyan-400/[0.02] transition-colors items-center text-[9px] font-mono"
            >
              <span className="text-neutral-300 truncate">{row.sector}</span>
              <span className="text-right tabular-nums text-neutral-300">{row.iv30d.toFixed(1)}%</span>
              <span className="text-right tabular-nums text-neutral-300">{row.rv20d.toFixed(1)}%</span>
              <span className={`text-right tabular-nums font-bold ${row.spread >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {row.spread >= 0 ? '+' : ''}{row.spread.toFixed(1)}
              </span>
            </div>
          ))}
        </div>

        {/* ── Vol Term Structure ── */}
        <div className="px-3 py-2">
          <div className="flex items-center gap-1 mb-2">
            <div className="w-1 h-1 bg-cyan-400" />
            <span className="text-[7px] font-black font-mono uppercase tracking-widest text-neutral-500">
              Vol Term Structure
            </span>
          </div>
          {(() => {
            const maxIV = Math.max(...(data.termStructure ?? []).map((p: any) => p.iv));
            const barScale = maxIV > 0 ? 100 / maxIV : 1;
            return (
              <div className="space-y-1">
                {(data.termStructure ?? []).map((point: any) => (
                  <div key={point.tenor} className="flex items-center gap-2">
                    <span className="text-[8px] font-mono font-bold text-neutral-400 w-8 text-right shrink-0">
                      {point.tenor}
                    </span>
                    <div className="flex-1 h-3 bg-white/[0.02] overflow-hidden relative">
                      <div
                        className="h-full bg-cyan-400/30 transition-all"
                        style={{ width: `${point.iv * barScale}%` }}
                      />
                    </div>
                    <span className="text-[8px] font-mono font-bold tabular-nums text-cyan-400 w-10 text-right shrink-0">
                      {point.iv.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
        </>)}
      </div>
    </div>
  );
}
