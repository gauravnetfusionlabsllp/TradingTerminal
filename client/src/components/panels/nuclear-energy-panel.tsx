import { useNuclearEnergy } from '../../api/hooks/use-nuclear-energy';
import { Atom, RefreshCw } from 'lucide-react';

// ── Formatting helpers ──

function fmtNum(n: number, decimals = 1): string {
  return n.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// ── Sparkline SVG ──

function PriceSparkline({ data, width = 80, height = 16 }: { data: number[]; width?: number; height?: number }) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);

  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * (height - 2) - 1;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="inline-block">
      <polyline
        points={points}
        fill="none"
        stroke="rgba(74,222,128,0.6)"
        strokeWidth="1"
      />
      <circle
        cx={(data.length - 1) * stepX}
        cy={height - ((data[data.length - 1] - min) / range) * (height - 2) - 1}
        r="1.5"
        fill="#4ade80"
      />
    </svg>
  );
}

// ── Badge helpers ──

function statusBadge(status: string): { text: string; cls: string } {
  switch (status) {
    case 'CONSTRUCTION':
      return { text: 'CONSTRUCTION', cls: 'text-yellow-400 bg-yellow-500/10' };
    case 'APPROVED':
      return { text: 'APPROVED', cls: 'text-blue-400 bg-blue-500/10' };
    case 'PLANNED':
      return { text: 'PLANNED', cls: 'text-neutral-400 bg-neutral-500/10' };
    default:
      return { text: status, cls: 'text-neutral-400 bg-neutral-500/10' };
  }
}

function directionBadge(direction: string): { text: string; cls: string } {
  switch (direction) {
    case 'EXPANDING':
      return { text: 'EXPANDING', cls: 'text-green-400 bg-green-500/10' };
    case 'MAINTAINING':
      return { text: 'MAINTAINING', cls: 'text-blue-400 bg-blue-500/10' };
    case 'PHASE-OUT':
      return { text: 'PHASE-OUT', cls: 'text-red-400 bg-red-500/10' };
    case 'REVERSAL':
      return { text: 'REVERSAL', cls: 'text-yellow-400 bg-yellow-500/10' };
    default:
      return { text: direction, cls: 'text-neutral-400 bg-neutral-500/10' };
  }
}

// ── Section Header ──

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-green-400/30">
      <div className="w-1 h-1 bg-green-400" />
      <span className="text-[7px] font-black uppercase tracking-widest text-green-400">{title}</span>
    </div>
  );
}

// ── Main Panel ──

export function NuclearEnergyPanel() {
  const { data: rawData, isLoading, refetch } = useNuclearEnergy();
  const data = rawData;

  return (
    <div className="h-full flex flex-col bg-black overflow-hidden text-[9px] font-mono">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#050505] border-b border-green-400/30 shrink-0">
        <div className="flex items-center gap-2">
          <Atom className="w-3.5 h-3.5 text-green-400" />
          <span className="text-[9px] font-black uppercase tracking-tighter text-green-400">
            Nuclear Energy
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[7px] font-mono text-neutral-500">
            {data?.overview?.totalReactors ?? '--'} reactors
          </span>
          <span className="text-[7px] font-mono text-green-400">
            U<sub>3</sub>O<sub>8</sub> {data?.overview?.uraniumSpotPrice != null ? `$${fmtNum(data.overview.uraniumSpotPrice, 2)}` : '--'}
          </span>
          <button
            onClick={() => refetch()}
            className="p-0.5 text-neutral-500 hover:text-green-400 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {isLoading && !rawData ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-2">
              <div className="w-5 h-5 border-2 border-green-400/30 border-t-green-400 animate-spin" />
              <span className="text-[10px] text-white/40 uppercase tracking-widest">Loading...</span>
            </div>
          </div>
        ) : !data ? (
          <div className="flex items-center justify-center h-full text-neutral/40 text-[10px] font-mono uppercase tracking-widest">No data available</div>
        ) : (
          <>
            {/* ── Overview ── */}
            <SectionHeader title="Overview" />
            <div className="grid grid-cols-3 gap-px bg-green-400/30 mx-0">
              {[
                { label: 'Operating Reactors', value: data.overview.totalReactors.toString() },
                { label: 'Capacity', value: `${fmtNum(data.overview.operatingCapacityGW)} GW` },
                { label: 'Share of Electricity', value: `${fmtNum(data.overview.shareOfElectricity)}%` },
                { label: 'Under Construction', value: data.overview.underConstruction.toString() },
                { label: 'Planned', value: data.overview.planned.toString() },
                { label: 'Uranium Spot', value: `$${fmtNum(data.overview.uraniumSpotPrice, 2)}/lb` },
              ].map((item: any, i: number) => (
                <div key={i} className="bg-black px-2 py-1.5">
                  <div className="text-[6px] text-neutral-500 uppercase tracking-wider">{item.label}</div>
                  <div className="text-[11px] font-bold text-white tabular-nums">{item.value}</div>
                </div>
              ))}
            </div>

            {/* ── Country Fleet ── */}
            <SectionHeader title="Country Fleet" />
            <div className="px-3 py-1 border-b border-border/20">
              <div className="grid grid-cols-[1.2fr_0.5fr_0.6fr_1.2fr_0.5fr_0.5fr_0.5fr] text-[6px] font-black text-neutral-500 uppercase tracking-wider">
                <span>Country</span>
                <span className="text-right">Reactors</span>
                <span className="text-right">GW</span>
                <span className="pl-2">Share %</span>
                <span className="text-right">Constr</span>
                <span className="text-right">Plan</span>
                <span className="text-right">Age</span>
              </div>
            </div>
            {data.countryFleet.map((c: any, i: number) => (
              <div
                key={i}
                className="grid grid-cols-[1.2fr_0.5fr_0.6fr_1.2fr_0.5fr_0.5fr_0.5fr] px-3 py-1 border-b border-border/20 hover:bg-green-400/[0.02] transition-colors items-center"
              >
                <span className="text-[8px] font-bold text-white/80 truncate">{c.country}</span>
                <span className="text-right text-white/60 tabular-nums">{c.reactors}</span>
                <span className="text-right text-white/60 tabular-nums">{fmtNum(c.capacityGW)}</span>
                <div className="pl-2 flex items-center gap-1">
                  <div className="flex-1 h-1.5 bg-white/[0.04] overflow-hidden">
                    <div
                      className="h-full bg-green-400/50"
                      style={{ width: `${Math.min(c.sharePct, 100)}%` }}
                    />
                  </div>
                  <span className="text-[7px] text-green-400 tabular-nums w-8 text-right shrink-0">
                    {fmtNum(c.sharePct)}%
                  </span>
                </div>
                <span className="text-right text-yellow-400/70 tabular-nums">{c.underConstruction || '-'}</span>
                <span className="text-right text-blue-400/70 tabular-nums">{c.planned || '-'}</span>
                <span className="text-right text-neutral-500 tabular-nums">{fmtNum(c.fleetAge)}y</span>
              </div>
            ))}

            {/* ── Uranium Market ── */}
            <SectionHeader title="Uranium Market" />
            <div className="grid grid-cols-4 gap-px bg-green-400/30 mx-0">
              {[
                { label: 'Spot Price', value: `$${fmtNum(data.uraniumMarket.spotPrice, 2)}` },
                { label: 'Long-Term', value: `$${fmtNum(data.uraniumMarket.longTermPrice, 2)}` },
                { label: 'Conversion', value: `$${fmtNum(data.uraniumMarket.conversionPrice, 2)}` },
                { label: 'Enrichment (SWU)', value: `$${fmtNum(data.uraniumMarket.enrichmentPrice, 2)}` },
              ].map((item: any, i: number) => (
                <div key={i} className="bg-black px-2 py-1.5">
                  <div className="text-[6px] text-neutral-500 uppercase tracking-wider">{item.label}</div>
                  <div className="text-[10px] font-bold text-white tabular-nums">{item.value}</div>
                </div>
              ))}
            </div>
            <div className="flex px-3 py-1.5 gap-4 border-b border-green-400/30">
              {/* Top Producers */}
              <div className="flex-1">
                <div className="text-[6px] text-neutral-500 uppercase tracking-wider mb-1">Top Producers</div>
                {data.uraniumMarket.topProducers.map((p: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-0.5 border-b border-border/20 hover:bg-green-400/[0.02]">
                    <span className="text-[8px] text-white/60">{p.name}</span>
                    <div className="flex items-center gap-1">
                      <div className="w-12 h-1 bg-white/[0.04] overflow-hidden">
                        <div className="h-full bg-green-400/40" style={{ width: `${p.sharePct}%` }} />
                      </div>
                      <span className="text-[7px] text-green-400 tabular-nums w-8 text-right">{fmtNum(p.sharePct, 0)}%</span>
                    </div>
                  </div>
                ))}
              </div>
              {/* Price History Sparkline */}
              <div className="flex flex-col items-end justify-center">
                <div className="text-[6px] text-neutral-500 uppercase tracking-wider mb-1">Price History</div>
                <PriceSparkline data={data.uraniumMarket.priceHistory} width={90} height={24} />
                <div className="flex justify-between w-[90px] mt-0.5">
                  <span className="text-[5px] text-neutral-600">${Math.min(...data.uraniumMarket.priceHistory)}</span>
                  <span className="text-[5px] text-green-400">${Math.max(...data.uraniumMarket.priceHistory)}</span>
                </div>
              </div>
            </div>

            {/* ── New Build Pipeline ── */}
            <SectionHeader title="New Build Pipeline" />
            <div className="px-3 py-1 border-b border-border/20">
              <div className="grid grid-cols-[1.2fr_0.7fr_0.6fr_0.5fr_0.8fr_0.6fr_0.5fr] text-[6px] font-black text-neutral-500 uppercase tracking-wider">
                <span>Project</span>
                <span>Country</span>
                <span>Type</span>
                <span className="text-right">MW</span>
                <span className="text-center">Status</span>
                <span className="text-right">Comm.</span>
                <span className="text-right">$Bn</span>
              </div>
            </div>
            {data.newBuildPipeline.map((p: any, i: number) => {
              const badge = statusBadge(p.status);
              return (
                <div
                  key={i}
                  className="grid grid-cols-[1.2fr_0.7fr_0.6fr_0.5fr_0.8fr_0.6fr_0.5fr] px-3 py-1 border-b border-border/20 hover:bg-green-400/[0.02] transition-colors items-center"
                >
                  <span className="text-[8px] font-bold text-white/80 truncate">{p.project}</span>
                  <span className="text-white/50 truncate">{p.country}</span>
                  <span className="text-white/40">{p.type}</span>
                  <span className="text-right text-white/60 tabular-nums">{p.capacityMW.toLocaleString()}</span>
                  <span className="text-center">
                    <span className={`px-1 py-0.5 text-[6px] font-black uppercase ${badge.cls}`}>
                      {badge.text}
                    </span>
                  </span>
                  <span className="text-right text-white/50 tabular-nums">{p.commissioning}</span>
                  <span className="text-right text-white/50 tabular-nums">{fmtNum(p.costBn)}</span>
                </div>
              );
            })}

            {/* ── SMR Pipeline ── */}
            <SectionHeader title="SMR Pipeline" />
            <div className="px-3 py-1 border-b border-border/20">
              <div className="grid grid-cols-[1fr_1fr_0.5fr_0.8fr_0.7fr_0.4fr] text-[6px] font-black text-neutral-500 uppercase tracking-wider">
                <span>Design</span>
                <span>Developer</span>
                <span className="text-right">MW</span>
                <span className="text-center">Status</span>
                <span className="text-right">First Deploy</span>
                <span className="text-right">Orders</span>
              </div>
            </div>
            {data.smrPipeline.map((s: any, i: number) => {
              const badge = statusBadge(s.status);
              return (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_1fr_0.5fr_0.8fr_0.7fr_0.4fr] px-3 py-1 border-b border-border/20 hover:bg-green-400/[0.02] transition-colors items-center"
                >
                  <span className="text-[8px] font-bold text-white/80 truncate">{s.design}</span>
                  <span className="text-white/50 truncate">{s.developer}</span>
                  <span className="text-right text-white/60 tabular-nums">{s.capacityMW}</span>
                  <span className="text-center">
                    <span className={`px-1 py-0.5 text-[6px] font-black uppercase ${badge.cls}`}>
                      {badge.text}
                    </span>
                  </span>
                  <span className="text-right text-white/50 tabular-nums">{s.firstDeployment}</span>
                  <span className="text-right text-white/60 tabular-nums">{s.orders}</span>
                </div>
              );
            })}

            {/* ── Policy Tracker ── */}
            <SectionHeader title="Policy Tracker" />
            <div className="px-3 py-1 border-b border-border/20">
              <div className="grid grid-cols-[0.8fr_0.7fr_2fr_0.5fr] text-[6px] font-black text-neutral-500 uppercase tracking-wider">
                <span>Country</span>
                <span className="text-center">Direction</span>
                <span>Recent Action</span>
                <span className="text-right">Date</span>
              </div>
            </div>
            {data.policyTracker.map((p: any, i: number) => {
              const badge = directionBadge(p.direction);
              return (
                <div
                  key={i}
                  className="grid grid-cols-[0.8fr_0.7fr_2fr_0.5fr] px-3 py-1 border-b border-border/20 hover:bg-green-400/[0.02] transition-colors items-center"
                >
                  <span className="text-[8px] font-bold text-white/80 truncate">{p.country}</span>
                  <span className="text-center">
                    <span className={`px-1 py-0.5 text-[6px] font-black uppercase ${badge.cls}`}>
                      {badge.text}
                    </span>
                  </span>
                  <span className="text-white/40 truncate">{p.recentAction}</span>
                  <span className="text-right text-neutral-500 tabular-nums">{p.date}</span>
                </div>
              );
            })}

            {/* Footer timestamp */}
            <div className="px-3 py-1.5 border-t border-green-400/30 text-[6px] text-neutral-600">
              Updated {new Date(data.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
