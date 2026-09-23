import { useState } from 'react';
import { useRareEarthBatteryMetals } from '../../api/hooks/use-rare-earth-battery-metals';
import { RefreshCw } from 'lucide-react';

// ── Types ──

type TabKey = 'prices' | 'supply' | 'evdemand' | 'pipeline';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'prices', label: 'Prices' },
  { key: 'supply', label: 'Supply Chain' },
  { key: 'evdemand', label: 'EV Demand' },
  { key: 'pipeline', label: 'Pipeline' },
];

// ── Formatting helpers ──

function fmtPrice(n: number): string {
  if (n >= 10000) return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (n >= 100) return n.toFixed(0);
  if (n >= 1) return n.toFixed(2);
  return n.toFixed(3);
}

function fmtPct(n: number): string {
  return (n >= 0 ? '+' : '') + n.toFixed(1) + '%';
}

function fmtNum(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (abs >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (abs >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toFixed(0);
}

// ── Color helpers ──

function changeColor(n: number): string {
  if (n > 0) return 'text-green-400';
  if (n < 0) return 'text-red-400';
  return 'text-neutral-500';
}

function disruptionBadge(level: string): { cls: string } {
  switch (level) {
    case 'critical':
      return { cls: 'text-red-400 bg-red-500/10 border border-red-500/30' };
    case 'high':
      return { cls: 'text-orange-400 bg-orange-500/10 border border-orange-500/30' };
    case 'moderate':
      return { cls: 'text-yellow-400 bg-yellow-500/10 border border-yellow-500/30' };
    case 'low':
      return { cls: 'text-blue-400 bg-blue-500/10 border border-blue-500/30' };
    default:
      return { cls: 'text-green-400 bg-green-500/10 border border-green-500/30' };
  }
}

function stageBadge(stage: string): { cls: string } {
  switch (stage) {
    case 'Production':
      return { cls: 'text-green-400 bg-green-500/10 border border-green-500/30' };
    case 'Construction':
      return { cls: 'text-blue-400 bg-blue-500/10 border border-blue-500/30' };
    case 'Development':
      return { cls: 'text-yellow-400 bg-yellow-500/10 border border-yellow-500/30' };
    case 'Permitting':
      return { cls: 'text-orange-400 bg-orange-500/10 border border-orange-500/30' };
    case 'Exploration':
      return { cls: 'text-red-400 bg-red-500/10 border border-red-500/30' };
    default:
      return { cls: 'text-neutral-400 bg-neutral-500/10 border border-neutral-500/30' };
  }
}

// ── Main Panel ──

export function RareEarthBatteryMetalsPanel() {
  const { data, isLoading, refetch } = useRareEarthBatteryMetals();
  const [activeTab, setActiveTab] = useState<TabKey>('prices');

  if (!data && !isLoading) {
    return (
      <div className="h-full flex flex-col bg-black overflow-hidden text-[9px] font-mono">
        <div className="flex items-center justify-center h-full">
          <span className="text-[9px] font-mono text-neutral-600 uppercase tracking-wider">
            FAILED TO LOAD BATTERY METALS DATA
          </span>
        </div>
      </div>
    );
  }

  const d = data;

  return (
    <div className="h-full flex flex-col bg-black overflow-hidden text-[9px] font-mono">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#050505] border-b border-border/20 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-orange-400" />
          <span className="text-[9px] font-black font-mono uppercase tracking-tighter text-orange-400">
            Rare Earth & Battery Metals
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="p-0.5 text-neutral-500 hover:text-orange-400 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tab selector */}
      <div className="flex border-b border-border/20 shrink-0">
        <div className="flex gap-px px-2 py-1 flex-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-2 py-0.5 text-[7px] font-black font-mono uppercase tracking-wider transition-colors ${
                activeTab === t.key
                  ? 'text-orange-400 border-b border-orange-400'
                  : 'text-neutral-600 hover:text-neutral-400'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        {isLoading && !data ? (
          <div className="flex items-center justify-center h-full">
            <span className="text-[9px] font-mono text-orange-400 uppercase tracking-wider animate-pulse">
              LOADING BATTERY METALS DATA...
            </span>
          </div>
        ) : (
          <>
            {activeTab === 'prices' && <PricesTab prices={d.prices} />}
            {activeTab === 'supply' && <SupplyChainTab supply={d.supplyChain} />}
            {activeTab === 'evdemand' && <EvDemandTab demand={d.evDemand} />}
            {activeTab === 'pipeline' && <PipelineTab pipeline={d.pipeline} />}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-1 border-t border-border/10 bg-[#050505] shrink-0">
        <span className="text-[7px] font-mono text-neutral-700">
          Updated: {d?.timestamp ? new Date(d.timestamp).toLocaleTimeString() : '--'}
        </span>
      </div>
    </div>
  );
}

// ── PRICES TAB ──

function PricesTab({ prices }: { prices: any[] }) {
  return (
    <div>
      <div className="px-2 py-1.5 border-b border-border/20 bg-[#030303]">
        <span className="text-[7px] font-black font-mono uppercase tracking-wider text-neutral-500">
          Spot Prices
        </span>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1.4fr_0.5fr_0.7fr_0.4fr_0.5fr_0.5fr_0.5fr_0.8fr] gap-0 px-2 py-0.5 border-b border-border/20 bg-[#030303]">
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider">Metal</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider">Sym</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider text-right">Price</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider text-right">1D</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider text-right">30D</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider text-right">YTD</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider text-right">52W H</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider text-right">52W L</span>
      </div>

      {prices.map((m) => (
        <div
          key={m.symbol}
          className="grid grid-cols-[1.4fr_0.5fr_0.7fr_0.4fr_0.5fr_0.5fr_0.5fr_0.8fr] gap-0 px-2 py-[3px] border-b border-border/5 hover:bg-orange-400/[0.02] transition-colors items-center"
        >
          <span className="text-[8px] font-mono font-bold text-white truncate">{m.name}</span>
          <span className="text-[7px] font-mono text-neutral-500">{m.symbol}</span>
          <div className="text-right">
            <span className="text-[8px] font-mono font-bold text-white tabular-nums">{fmtPrice(m.price)}</span>
            <span className="text-[6px] font-mono text-neutral-600 ml-0.5">{m.unit}</span>
          </div>
          <span className={`text-[8px] font-mono font-bold text-right tabular-nums ${changeColor(m.dailyChange)}`}>
            {fmtPct(m.dailyChange)}
          </span>
          <span className={`text-[8px] font-mono font-bold text-right tabular-nums ${changeColor(m.change30d)}`}>
            {fmtPct(m.change30d)}
          </span>
          <span className={`text-[8px] font-mono font-bold text-right tabular-nums ${changeColor(m.ytdChange)}`}>
            {fmtPct(m.ytdChange)}
          </span>
          <span className="text-[7px] font-mono text-neutral-400 text-right tabular-nums">{fmtPrice(m.high52w)}</span>
          <span className="text-[7px] font-mono text-neutral-400 text-right tabular-nums">{fmtPrice(m.low52w)}</span>
        </div>
      ))}
    </div>
  );
}

// ── SUPPLY CHAIN TAB ──

function SupplyChainTab({ supply }: { supply: any[] }) {
  return (
    <div>
      <div className="px-2 py-1.5 border-b border-border/20 bg-[#030303]">
        <span className="text-[7px] font-black font-mono uppercase tracking-wider text-neutral-500">
          Producer Countries
        </span>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_0.7fr_0.6fr_0.7fr_0.9fr] gap-0 px-2 py-0.5 border-b border-border/20 bg-[#030303]">
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider">Country</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider text-right">Production</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider text-right">Global %</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider text-right">Reserves</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider text-center">Disruption</span>
      </div>

      {supply.map((s) => {
        const badge = disruptionBadge(s.disruptionLevel);
        return (
          <div
            key={s.country}
            className="grid grid-cols-[1fr_0.7fr_0.6fr_0.7fr_0.9fr] gap-0 px-2 py-[3px] border-b border-border/5 hover:bg-orange-400/[0.02] transition-colors items-center"
          >
            <span className="text-[8px] font-mono font-bold text-white">{s.country}</span>
            <div className="text-right">
              <span className="text-[8px] font-mono text-neutral-300 tabular-nums">{fmtNum(s.production)}</span>
              <div className="text-[6px] font-mono text-neutral-600">{s.unit}</div>
            </div>
            <div className="flex items-center gap-1 justify-end">
              <div className="w-12 h-1.5 bg-white/[0.03] overflow-hidden">
                <div
                  className="h-full bg-orange-500/70"
                  style={{ width: `${Math.min(s.globalShare, 100)}%` }}
                />
              </div>
              <span className="text-[7px] font-mono font-bold text-orange-400 tabular-nums w-10 text-right">
                {s.globalShare.toFixed(1)}%
              </span>
            </div>
            <span className="text-[7px] font-mono text-neutral-400 text-right tabular-nums">
              {s.reserves > 0 ? fmtNum(s.reserves) : '-'}
            </span>
            <div className="flex justify-center">
              {s.disruptionLevel !== 'none' ? (
                <span className={`text-[6px] font-black font-mono uppercase px-1 py-0 ${badge.cls}`}>
                  {s.disruption}
                </span>
              ) : (
                <span className="text-[6px] font-mono text-neutral-600">-</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── EV DEMAND TAB ──

function EvDemandTab({ demand }: { demand: any[] }) {
  return (
    <div>
      <div className="px-2 py-1.5 border-b border-border/20 bg-[#030303]">
        <span className="text-[7px] font-black font-mono uppercase tracking-wider text-neutral-500">
          Battery Demand Forecast by Region
        </span>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_0.5fr_0.5fr_0.5fr_0.5fr_0.5fr_0.5fr_0.8fr] gap-0 px-2 py-0.5 border-b border-border/20 bg-[#030303]">
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider">Region</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider text-right">Q1</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider text-right">Q2</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider text-right">Q3</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider text-right">Q4</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider text-right">Unit</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider text-right">YoY</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider">Chemistry</span>
      </div>

      {demand.map((d) => {
        const total = d.q1 + d.q2 + d.q3 + d.q4;
        const maxTotal = 14300; // approximate max for bar scaling
        return (
          <div key={d.region}>
            <div
              className="grid grid-cols-[1fr_0.5fr_0.5fr_0.5fr_0.5fr_0.5fr_0.5fr_0.8fr] gap-0 px-2 py-[3px] border-b border-border/5 hover:bg-orange-400/[0.02] transition-colors items-center"
            >
              <span className="text-[8px] font-mono font-bold text-white">{d.region}</span>
              <span className="text-[8px] font-mono text-neutral-300 text-right tabular-nums">{fmtNum(d.q1)}</span>
              <span className="text-[8px] font-mono text-neutral-300 text-right tabular-nums">{fmtNum(d.q2)}</span>
              <span className="text-[8px] font-mono text-neutral-300 text-right tabular-nums">{fmtNum(d.q3)}</span>
              <span className="text-[8px] font-mono text-neutral-300 text-right tabular-nums">{fmtNum(d.q4)}</span>
              <span className="text-[7px] font-mono text-neutral-500 text-right">{d.unit}</span>
              <span className="text-[8px] font-mono font-bold text-green-400 text-right tabular-nums">
                +{d.growthYoY.toFixed(1)}%
              </span>
              <div className="flex flex-wrap gap-0.5">
                {d.keyChemistry.split(' / ').map((c: string) => (
                  <span
                    key={c}
                    className="text-[6px] font-mono font-bold text-orange-400/80 bg-orange-500/10 px-1 py-0"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
            {/* Quarterly bar */}
            <div className="px-2 py-0.5 border-b border-border/5">
              <div className="flex items-center gap-1">
                <div className="flex-1 h-1.5 bg-white/[0.03] overflow-hidden flex">
                  <div className="h-full bg-orange-500/40" style={{ width: `${(d.q1 / maxTotal) * 100}%` }} />
                  <div className="h-full bg-orange-500/55" style={{ width: `${(d.q2 / maxTotal) * 100}%` }} />
                  <div className="h-full bg-orange-500/70" style={{ width: `${(d.q3 / maxTotal) * 100}%` }} />
                  <div className="h-full bg-orange-500/85" style={{ width: `${(d.q4 / maxTotal) * 100}%` }} />
                </div>
                <span className="text-[6px] font-mono text-neutral-500 tabular-nums w-10 text-right shrink-0">
                  {fmtNum(total)}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── PIPELINE TAB ──

function PipelineTab({ pipeline }: { pipeline: any[] }) {
  return (
    <div>
      <div className="px-2 py-1.5 border-b border-border/20 bg-[#030303]">
        <span className="text-[7px] font-black font-mono uppercase tracking-wider text-neutral-500">
          New Mining Projects
        </span>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1.2fr_1fr_0.8fr_0.7fr_0.8fr_0.5fr] gap-0 px-2 py-0.5 border-b border-border/20 bg-[#030303]">
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider">Project</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider">Location</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider">Metal</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider text-center">Stage</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider text-right">Capacity</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider text-right">Start</span>
      </div>

      {pipeline.map((p) => {
        const badge = stageBadge(p.stage);
        return (
          <div
            key={p.project}
            className="grid grid-cols-[1.2fr_1fr_0.8fr_0.7fr_0.8fr_0.5fr] gap-0 px-2 py-[3px] border-b border-border/5 hover:bg-orange-400/[0.02] transition-colors items-center"
          >
            <div>
              <span className="text-[8px] font-mono font-bold text-white truncate block">{p.project}</span>
              <span className="text-[6px] font-mono text-neutral-600">{p.owner}</span>
            </div>
            <span className="text-[7px] font-mono text-neutral-400 truncate">{p.location}</span>
            <span className="text-[7px] font-mono text-neutral-300">{p.metal}</span>
            <div className="flex justify-center">
              <span className={`text-[6px] font-black font-mono uppercase px-1 py-0 ${badge.cls}`}>
                {p.stage}
              </span>
            </div>
            <span className="text-[7px] font-mono text-neutral-400 text-right tabular-nums">{p.capacity}</span>
            <span className="text-[7px] font-mono text-neutral-500 text-right">{p.startDate}</span>
          </div>
        );
      })}

      {/* Stage legend */}
      <div className="px-2 py-2 border-t border-border/20">
        <div className="text-[7px] font-black font-mono uppercase tracking-wider text-neutral-500 mb-1">
          Stage Legend
        </div>
        <div className="flex flex-wrap gap-2">
          {['Production', 'Construction', 'Development', 'Permitting', 'Exploration'].map((s) => {
            const b = stageBadge(s);
            return (
              <span key={s} className={`text-[6px] font-black font-mono uppercase px-1.5 py-0.5 ${b.cls}`}>
                {s}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
