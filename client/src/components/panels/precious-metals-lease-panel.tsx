import { useState, useMemo } from 'react';
import { usePreciousMetalsLease } from '../../api/hooks/use-precious-metals-lease';
import { RefreshCw } from 'lucide-react';

// ── Types ──

type TabKey = 'rates' | 'forwards' | 'ratios' | 'etfs' | 'centralBanks';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'rates', label: 'Rates' },
  { key: 'forwards', label: 'Forwards' },
  { key: 'ratios', label: 'Ratios' },
  { key: 'etfs', label: 'ETFs' },
  { key: 'centralBanks', label: 'Central Banks' },
];

const TENORS = ['1M', '2M', '3M', '6M', '9M', '12M'] as const;

const METALS = ['Gold', 'Silver', 'Platinum', 'Palladium'] as const;

interface LeaseRateRow {
  metal: string;
  rates: Record<string, number>;
  gofo?: Record<string, number>;
}

interface ForwardRow {
  metal: string;
  spot: number;
  forwards: Record<string, number>;
  basis: Record<string, number>;
  structure: 'contango' | 'backwardation' | 'flat';
}

interface RatioData {
  name: string;
  current: number;
  change1D: number;
  avg1Y: number;
  high1Y: number;
  low1Y: number;
  percentile: number;
}

interface EtfRow {
  ticker: string;
  metal: string;
  holdingsTonnes: number;
  change1D: number;
  change1W: number;
  change1M: number;
  aum: number;
}

interface CentralBankRow {
  rank: number;
  country: string;
  holdingsTonnes: number;
  pctReserves: number;
  changeYTD: number;
  changeYoY: number;
}

interface PreciousMetalsLeaseData {
  leaseRates: LeaseRateRow[];
  forwards: ForwardRow[];
  ratios: RatioData[];
  etfs: EtfRow[];
  centralBanks: CentralBankRow[];
  timestamp: string;
}

// ── Formatting helpers ──

function fmtNum(n: number | null | undefined, decimals = 2): string {
  if (n == null || isNaN(n)) return '-';
  return n.toFixed(decimals);
}

function fmtPrice(n: number): string {
  if (n >= 1000) return n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (n >= 10) return n.toFixed(2);
  return n.toFixed(4);
}

function fmtTonnes(n: number): string {
  if (n >= 10000) return (n / 1000).toFixed(1) + 'K';
  return n.toFixed(1);
}

function fmtAum(n: number): string {
  if (n >= 1) return `$${n.toFixed(1)}B`;
  return `$${(n * 1000).toFixed(0)}M`;
}

function changeSign(n: number): string {
  return n > 0 ? '+' : '';
}

// ── Color helpers ──

function changeColor(n: number | null | undefined): string {
  if (n == null) return 'text-neutral-500';
  if (n > 0) return 'text-green-400';
  if (n < 0) return 'text-red-400';
  return 'text-neutral-500';
}

function leaseRateColor(rate: number): string {
  if (rate <= 0.3) return 'text-green-400';
  if (rate <= 0.8) return 'text-green-300';
  if (rate <= 1.5) return 'text-yellow-400';
  if (rate <= 3.0) return 'text-orange-400';
  return 'text-red-400';
}

function leaseRateBg(rate: number): string {
  if (rate <= 0.3) return 'bg-green-500/8';
  if (rate <= 0.8) return 'bg-green-500/5';
  if (rate <= 1.5) return 'bg-yellow-500/8';
  if (rate <= 3.0) return 'bg-orange-500/8';
  return 'bg-red-500/8';
}

function structureColor(structure: string): string {
  if (structure === 'backwardation') return 'text-amber-400';
  if (structure === 'contango') return 'text-blue-400';
  return 'text-neutral-500';
}

function structureBg(structure: string): string {
  if (structure === 'backwardation') return 'bg-amber-500/15 border-amber-500/30';
  if (structure === 'contango') return 'bg-blue-500/15 border-blue-500/30';
  return 'bg-neutral-500/15 border-neutral-500/30';
}

// ── Main Panel ──

export function PreciousMetalsLeasePanel() {
  const { data: rawData, isLoading, refetch } = usePreciousMetalsLease();
  const [activeTab, setActiveTab] = useState<TabKey>('rates');

  const data = rawData as PreciousMetalsLeaseData | undefined;

  return (
    <div className="h-full flex flex-col bg-black overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#050505] border-b border-border/30 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-yellow-400" />
          <span className="text-[9px] font-black font-mono uppercase tracking-tighter text-yellow-400">
            Precious Metals Lease Monitor
          </span>
        </div>
        <button
          onClick={() => refetch()}
          className="p-1 text-neutral-500 hover:text-yellow-400 transition-colors"
        >
          <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border/20 shrink-0">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex-1 py-1.5 text-[8px] font-black uppercase tracking-widest border-b-2 transition-colors ${
              activeTab === t.key
                ? 'border-yellow-400 text-yellow-400'
                : 'border-transparent text-neutral-500 hover:text-neutral-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto no-scrollbar">
        {isLoading && !rawData && (
          <div className="text-center py-8 text-yellow-400 text-[9px] font-mono uppercase animate-pulse">
            Loading...
          </div>
        )}

        {!data && !isLoading && (
          <div className="text-center py-8 text-neutral-500 text-[9px] font-mono uppercase">
            No data available
          </div>
        )}

        {data && activeTab === 'rates' && <RatesTab data={data} />}
        {data && activeTab === 'forwards' && <ForwardsTab data={data} />}
        {data && activeTab === 'ratios' && <RatiosTab data={data} />}
        {data && activeTab === 'etfs' && <EtfsTab data={data} />}
        {data && activeTab === 'centralBanks' && <CentralBanksTab data={data} />}
      </div>

      {/* Footer */}
      <div className="px-3 py-1 border-t border-border/10 bg-[#050505] shrink-0">
        <span className="text-[7px] font-mono text-neutral-700">
          Updated: {data?.timestamp ? new Date(data.timestamp).toLocaleTimeString() : '--'}
        </span>
      </div>
    </div>
  );
}

// ── RATES TAB ──

function RatesTab({ data }: { data: PreciousMetalsLeaseData }) {
  const goldRow = data.leaseRates.find((r) => r.metal === 'Gold');

  return (
    <div>
      {/* Section header */}
      <div className="px-2 py-1.5 border-b border-border/10 bg-[#030303]">
        <span className="text-[7px] font-black font-mono uppercase tracking-wider text-neutral-500">
          Lease Rates (% Annualized)
        </span>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[72px_repeat(6,1fr)] gap-0 px-2 py-0.5 border-b border-border/10 bg-[#030303]">
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider">Metal</span>
        {TENORS.map((t) => (
          <span key={t} className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider text-right">
            {t}
          </span>
        ))}
      </div>

      {/* Lease rate rows */}
      {data.leaseRates.map((row) => (
        <div
          key={row.metal}
          className="grid grid-cols-[72px_repeat(6,1fr)] gap-0 px-2 py-[3px] border-b border-border/5 hover:bg-yellow-400/[0.02] transition-colors"
        >
          <span className="text-[8px] font-mono font-bold text-white">{row.metal}</span>
          {TENORS.map((t) => {
            const rate = row.rates[t] ?? 0;
            return (
              <div key={t} className={`text-right ${leaseRateBg(rate)}`}>
                <span className={`text-[8px] font-mono font-bold ${leaseRateColor(rate)}`}>
                  {fmtNum(rate)}
                </span>
              </div>
            );
          })}
        </div>
      ))}

      {/* Color legend */}
      <div className="px-2 py-1.5 flex items-center gap-3 border-b border-border/10">
        <span className="text-[6px] font-mono text-neutral-600 uppercase">Level:</span>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-green-500/30" />
          <span className="text-[6px] font-mono text-green-400">Low</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-yellow-500/30" />
          <span className="text-[6px] font-mono text-yellow-400">Med</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-red-500/30" />
          <span className="text-[6px] font-mono text-red-400">High</span>
        </div>
      </div>

      {/* GOFO section (Gold only) */}
      {goldRow?.gofo && (
        <>
          <div className="px-2 py-1.5 border-b border-border/10 bg-[#030303]">
            <span className="text-[7px] font-black font-mono uppercase tracking-wider text-neutral-500">
              Gold Forward Offered Rate (GOFO)
            </span>
          </div>

          <div className="grid grid-cols-[72px_repeat(6,1fr)] gap-0 px-2 py-0.5 border-b border-border/10 bg-[#030303]">
            <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider">Rate</span>
            {TENORS.map((t) => (
              <span key={t} className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider text-right">
                {t}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-[72px_repeat(6,1fr)] gap-0 px-2 py-[3px] border-b border-border/5 hover:bg-yellow-400/[0.02] transition-colors">
            <span className="text-[8px] font-mono font-bold text-yellow-400">GOFO</span>
            {TENORS.map((t) => {
              const rate = goldRow.gofo?.[t] ?? 0;
              const isNeg = rate < 0;
              return (
                <span
                  key={t}
                  className={`text-[8px] font-mono font-bold text-right ${
                    isNeg ? 'text-red-400' : 'text-green-400'
                  }`}
                >
                  {fmtNum(rate)}
                </span>
              );
            })}
          </div>

          <div className="px-2 py-1 border-b border-border/10">
            <span className="text-[6px] font-mono text-neutral-700 uppercase">
              GOFO = LIBOR - Gold Lease Rate | Negative GOFO signals supply stress
            </span>
          </div>
        </>
      )}

      {/* Lease rate heatmap visualization */}
      <div className="px-2 py-1.5 border-b border-border/10 bg-[#030303]">
        <span className="text-[7px] font-black font-mono uppercase tracking-wider text-neutral-500">
          Term Structure Heatmap
        </span>
      </div>

      <div className="px-3 py-2">
        <LeaseHeatmap data={data.leaseRates} />
      </div>
    </div>
  );
}

// ── Lease Heatmap (SVG) ──

function LeaseHeatmap({ data }: { data: LeaseRateRow[] }) {
  const chart = useMemo(() => {
    const W = 360;
    const H = 80;
    const PAD_L = 62;
    const PAD_T = 14;
    const cellW = (W - PAD_L) / TENORS.length;
    const cellH = (H - PAD_T) / data.length;

    const allRates = data.flatMap((r) => TENORS.map((t) => r.rates[t] ?? 0));
    const maxRate = Math.max(...allRates, 0.01);

    return { W, H, PAD_L, PAD_T, cellW, cellH, maxRate };
  }, [data]);

  function heatColor(rate: number): string {
    const pct = Math.min(rate / chart.maxRate, 1);
    if (pct <= 0.2) return 'rgba(34,197,94,0.4)';
    if (pct <= 0.4) return 'rgba(34,197,94,0.25)';
    if (pct <= 0.6) return 'rgba(250,204,21,0.35)';
    if (pct <= 0.8) return 'rgba(249,115,22,0.4)';
    return 'rgba(239,68,68,0.45)';
  }

  return (
    <svg viewBox={`0 0 ${chart.W} ${chart.H}`} className="w-full" style={{ maxHeight: 100 }}>
      {/* Tenor labels */}
      {TENORS.map((t, i) => (
        <text
          key={t}
          x={chart.PAD_L + i * chart.cellW + chart.cellW / 2}
          y={10}
          textAnchor="middle"
          fill="rgba(255,255,255,0.3)"
          fontSize={7}
          fontFamily="monospace"
        >
          {t}
        </text>
      ))}

      {/* Metal labels + cells */}
      {data.map((row, ri) => (
        <g key={row.metal}>
          <text
            x={chart.PAD_L - 4}
            y={chart.PAD_T + ri * chart.cellH + chart.cellH / 2 + 3}
            textAnchor="end"
            fill="rgba(255,255,255,0.5)"
            fontSize={7}
            fontFamily="monospace"
          >
            {row.metal}
          </text>

          {TENORS.map((t, ci) => {
            const rate = row.rates[t] ?? 0;
            return (
              <g key={t}>
                <rect
                  x={chart.PAD_L + ci * chart.cellW + 1}
                  y={chart.PAD_T + ri * chart.cellH + 1}
                  width={chart.cellW - 2}
                  height={chart.cellH - 2}
                  fill={heatColor(rate)}
                />
                <text
                  x={chart.PAD_L + ci * chart.cellW + chart.cellW / 2}
                  y={chart.PAD_T + ri * chart.cellH + chart.cellH / 2 + 3}
                  textAnchor="middle"
                  fill="rgba(255,255,255,0.7)"
                  fontSize={7}
                  fontFamily="monospace"
                >
                  {rate.toFixed(2)}
                </text>
              </g>
            );
          })}
        </g>
      ))}
    </svg>
  );
}

// ── FORWARDS TAB ──

function ForwardsTab({ data }: { data: PreciousMetalsLeaseData }) {
  const fwdTenors = ['1M', '3M', '6M', '12M'] as const;

  return (
    <div>
      {data.forwards.map((row) => (
        <div key={row.metal} className="border-b border-border/10">
          {/* Metal header */}
          <div className="flex items-center justify-between px-2 py-1.5 bg-[#030303]">
            <div className="flex items-center gap-2">
              <span className="text-[8px] font-black font-mono uppercase tracking-wider text-yellow-400">
                {row.metal}
              </span>
              <span className="text-[9px] font-mono font-bold text-white">
                {fmtPrice(row.spot)}
              </span>
            </div>
            <span
              className={`text-[7px] font-mono font-black px-1.5 py-0.5 uppercase border ${structureColor(row.structure)} ${structureBg(row.structure)}`}
            >
              {row.structure}
            </span>
          </div>

          {/* Forward prices header */}
          <div className="grid grid-cols-[60px_repeat(4,1fr)] gap-0 px-2 py-0.5 border-b border-border/5 bg-[#030303]">
            <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider">Type</span>
            {fwdTenors.map((t) => (
              <span key={t} className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider text-right">
                {t}
              </span>
            ))}
          </div>

          {/* Forward price row */}
          <div className="grid grid-cols-[60px_repeat(4,1fr)] gap-0 px-2 py-[3px] border-b border-border/5 hover:bg-yellow-400/[0.02] transition-colors">
            <span className="text-[7px] font-mono text-neutral-500 uppercase">Fwd</span>
            {fwdTenors.map((t) => (
              <span key={t} className="text-[8px] font-mono font-bold text-white text-right">
                {fmtPrice(row.forwards[t] ?? 0)}
              </span>
            ))}
          </div>

          {/* Basis row */}
          <div className="grid grid-cols-[60px_repeat(4,1fr)] gap-0 px-2 py-[3px] border-b border-border/5 hover:bg-yellow-400/[0.02] transition-colors">
            <span className="text-[7px] font-mono text-neutral-500 uppercase">Basis</span>
            {fwdTenors.map((t) => {
              const basis = row.basis[t] ?? 0;
              return (
                <span
                  key={t}
                  className={`text-[8px] font-mono font-bold text-right ${
                    basis < 0 ? 'text-amber-400' : 'text-blue-400'
                  }`}
                >
                  {changeSign(basis)}{fmtNum(basis)}
                </span>
              );
            })}
          </div>
        </div>
      ))}

      {data.forwards.length === 0 && (
        <div className="text-center py-8 text-neutral-500 text-[9px] font-mono uppercase">
          No forward data available
        </div>
      )}

      {/* Structure legend */}
      <div className="px-2 py-1.5 flex items-center gap-3">
        <span className="text-[6px] font-mono text-neutral-600 uppercase">Structure:</span>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-blue-500/30" />
          <span className="text-[6px] font-mono text-blue-400">Contango</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-amber-500/30" />
          <span className="text-[6px] font-mono text-amber-400">Backwardation</span>
        </div>
      </div>
    </div>
  );
}

// ── RATIOS TAB ──

function RatiosTab({ data }: { data: PreciousMetalsLeaseData }) {
  return (
    <div>
      {data.ratios.map((ratio) => (
        <div key={ratio.name} className="border-b border-border/10 px-3 py-2">
          {/* Ratio header */}
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[8px] font-black font-mono uppercase tracking-wider text-yellow-400">
              {ratio.name}
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[14px] font-mono font-black text-white">
                {ratio.current >= 1 ? ratio.current.toFixed(1) : ratio.current.toFixed(3)}
              </span>
              <span className={`text-[9px] font-mono font-bold ${changeColor(ratio.change1D)}`}>
                {changeSign(ratio.change1D)}{ratio.current >= 1 ? ratio.change1D.toFixed(2) : ratio.change1D.toFixed(3)}
              </span>
            </div>
          </div>

          {/* Range bar */}
          <RatioRangeBar
            current={ratio.current}
            low={ratio.low1Y}
            high={ratio.high1Y}
            avg={ratio.avg1Y}
          />

          {/* Stats row */}
          <div className="flex items-center justify-between mt-1.5">
            <div className="flex items-center gap-3">
              <div>
                <span className="text-[6px] font-mono text-neutral-600 uppercase block">1Y Low</span>
                <span className="text-[8px] font-mono text-red-400">
                  {ratio.low1Y >= 1 ? ratio.low1Y.toFixed(1) : ratio.low1Y.toFixed(3)}
                </span>
              </div>
              <div>
                <span className="text-[6px] font-mono text-neutral-600 uppercase block">1Y Avg</span>
                <span className="text-[8px] font-mono text-neutral-400">
                  {ratio.avg1Y >= 1 ? ratio.avg1Y.toFixed(1) : ratio.avg1Y.toFixed(3)}
                </span>
              </div>
              <div>
                <span className="text-[6px] font-mono text-neutral-600 uppercase block">1Y High</span>
                <span className="text-[8px] font-mono text-green-400">
                  {ratio.high1Y >= 1 ? ratio.high1Y.toFixed(1) : ratio.high1Y.toFixed(3)}
                </span>
              </div>
            </div>
            <div>
              <span className="text-[6px] font-mono text-neutral-600 uppercase block text-right">Percentile</span>
              <span className={`text-[9px] font-mono font-bold ${
                ratio.percentile >= 80 ? 'text-red-400'
                  : ratio.percentile >= 60 ? 'text-yellow-400'
                    : ratio.percentile >= 40 ? 'text-neutral-400'
                      : ratio.percentile >= 20 ? 'text-blue-400'
                        : 'text-green-400'
              }`}>
                {ratio.percentile}th
              </span>
            </div>
          </div>
        </div>
      ))}

      {data.ratios.length === 0 && (
        <div className="text-center py-8 text-neutral-500 text-[9px] font-mono uppercase">
          No ratio data available
        </div>
      )}
    </div>
  );
}

function RatioRangeBar({
  current,
  low,
  high,
  avg,
}: {
  current: number;
  low: number;
  high: number;
  avg: number;
}) {
  const range = high - low;
  const currentPct = range > 0 ? ((current - low) / range) * 100 : 50;
  const avgPct = range > 0 ? ((avg - low) / range) * 100 : 50;

  return (
    <div className="w-full h-2 bg-neutral-800 relative">
      {/* Average marker */}
      <div
        className="absolute top-0 bottom-0 w-px bg-neutral-500"
        style={{ left: `${Math.min(100, Math.max(0, avgPct))}%` }}
      />
      {/* Current marker */}
      <div
        className="absolute top-0 bottom-0 w-1.5 bg-yellow-400"
        style={{ left: `${Math.min(100, Math.max(0, currentPct))}%`, transform: 'translateX(-50%)' }}
      />
    </div>
  );
}

// ── ETFS TAB ──

function EtfsTab({ data }: { data: PreciousMetalsLeaseData }) {
  return (
    <div>
      {/* Section header */}
      <div className="px-2 py-1.5 border-b border-border/10 bg-[#030303]">
        <span className="text-[7px] font-black font-mono uppercase tracking-wider text-neutral-500">
          Precious Metals ETF Holdings
        </span>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[44px_48px_64px_52px_52px_52px_52px] gap-0 px-2 py-0.5 border-b border-border/10 bg-[#030303]">
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider">Ticker</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider">Metal</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider text-right">Holdings</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider text-right">1D Chg</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider text-right">1W Chg</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider text-right">1M Chg</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider text-right">AUM</span>
      </div>

      {data.etfs.map((etf) => (
        <div
          key={etf.ticker}
          className="grid grid-cols-[44px_48px_64px_52px_52px_52px_52px] gap-0 px-2 py-[3px] border-b border-border/5 hover:bg-yellow-400/[0.02] transition-colors"
        >
          <span className="text-[8px] font-mono font-bold text-yellow-400">{etf.ticker}</span>
          <span className="text-[7px] font-mono text-neutral-500">{etf.metal}</span>
          <div className="text-right">
            <span className="text-[8px] font-mono font-bold text-white">{fmtTonnes(etf.holdingsTonnes)}</span>
            <span className="text-[6px] font-mono text-neutral-600 ml-0.5">t</span>
          </div>
          <span className={`text-[8px] font-mono font-bold text-right ${changeColor(etf.change1D)}`}>
            {changeSign(etf.change1D)}{Math.abs(etf.change1D).toFixed(1)}
          </span>
          <span className={`text-[8px] font-mono font-bold text-right ${changeColor(etf.change1W)}`}>
            {changeSign(etf.change1W)}{Math.abs(etf.change1W).toFixed(1)}
          </span>
          <span className={`text-[8px] font-mono font-bold text-right ${changeColor(etf.change1M)}`}>
            {changeSign(etf.change1M)}{Math.abs(etf.change1M).toFixed(1)}
          </span>
          <span className="text-[8px] font-mono text-neutral-400 text-right">
            {fmtAum(etf.aum)}
          </span>
        </div>
      ))}

      {data.etfs.length === 0 && (
        <div className="text-center py-8 text-neutral-500 text-[9px] font-mono uppercase">
          No ETF data available
        </div>
      )}

      {/* Holdings bar chart */}
      {data.etfs.length > 0 && (
        <>
          <div className="px-2 py-1.5 border-t border-border/10 bg-[#030303]">
            <span className="text-[7px] font-black font-mono uppercase tracking-wider text-neutral-500">
              Daily Flow (Tonnes)
            </span>
          </div>
          <div className="px-3 py-2">
            <EtfFlowChart etfs={data.etfs} />
          </div>
        </>
      )}
    </div>
  );
}

function EtfFlowChart({ etfs }: { etfs: EtfRow[] }) {
  const maxAbs = Math.max(...etfs.map((e) => Math.abs(e.change1D)), 0.01);

  return (
    <div className="space-y-0.5">
      {etfs.map((etf) => {
        const pct = (Math.abs(etf.change1D) / maxAbs) * 100;
        const isPos = etf.change1D >= 0;

        return (
          <div key={etf.ticker} className="flex items-center gap-2">
            <span className="text-[7px] font-mono text-yellow-400 w-[32px] shrink-0 font-bold">
              {etf.ticker}
            </span>
            <div className="flex-1 h-[8px] relative">
              <div className="absolute inset-0 bg-neutral-900" />
              <div className="absolute top-0 bottom-0 left-1/2 w-px bg-neutral-700" />
              {isPos ? (
                <div
                  className="absolute top-0 bottom-0 left-1/2 bg-green-500/60"
                  style={{ width: `${pct / 2}%` }}
                />
              ) : (
                <div
                  className="absolute top-0 bottom-0 bg-red-500/60"
                  style={{ width: `${pct / 2}%`, right: '50%' }}
                />
              )}
            </div>
            <span className={`text-[7px] font-mono font-bold w-[40px] text-right shrink-0 ${changeColor(etf.change1D)}`}>
              {changeSign(etf.change1D)}{Math.abs(etf.change1D).toFixed(1)}t
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── CENTRAL BANKS TAB ──

function CentralBanksTab({ data }: { data: PreciousMetalsLeaseData }) {
  const maxHoldings = useMemo(() => {
    return Math.max(...data.centralBanks.map((cb) => cb.holdingsTonnes), 1);
  }, [data.centralBanks]);

  return (
    <div>
      {/* Section header */}
      <div className="px-2 py-1.5 border-b border-border/10 bg-[#030303]">
        <span className="text-[7px] font-black font-mono uppercase tracking-wider text-neutral-500">
          Top 10 Central Bank Gold Holdings
        </span>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[24px_72px_64px_52px_52px_52px] gap-0 px-2 py-0.5 border-b border-border/10 bg-[#030303]">
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider">#</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider">Country</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider text-right">Tonnes</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider text-right">% Rsv</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider text-right">YTD</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider text-right">YoY</span>
      </div>

      {data.centralBanks.map((cb, i) => (
        <div
          key={cb.country}
          className={`grid grid-cols-[24px_72px_64px_52px_52px_52px] gap-0 px-2 py-[3px] border-b border-border/5 hover:bg-yellow-400/[0.02] transition-colors ${
            i % 2 === 0 ? 'bg-black' : 'bg-white/[0.01]'
          }`}
        >
          <span className="text-[7px] font-mono text-neutral-600">{cb.rank}</span>
          <span className="text-[8px] font-mono font-bold text-white truncate">{cb.country}</span>
          <span className="text-[8px] font-mono font-bold text-yellow-400 text-right">
            {fmtTonnes(cb.holdingsTonnes)}
          </span>
          <span className="text-[8px] font-mono text-neutral-400 text-right">
            {fmtNum(cb.pctReserves, 1)}%
          </span>
          <span className={`text-[8px] font-mono font-bold text-right ${
            cb.changeYTD === 0 ? 'text-neutral-600' : changeColor(cb.changeYTD)
          }`}>
            {cb.changeYTD === 0 ? '-' : `${changeSign(cb.changeYTD)}${Math.abs(cb.changeYTD).toFixed(1)}`}
          </span>
          <span className={`text-[8px] font-mono font-bold text-right ${
            cb.changeYoY === 0 ? 'text-neutral-600' : changeColor(cb.changeYoY)
          }`}>
            {cb.changeYoY === 0 ? '-' : `${changeSign(cb.changeYoY)}${Math.abs(cb.changeYoY).toFixed(1)}`}
          </span>
        </div>
      ))}

      {data.centralBanks.length === 0 && (
        <div className="text-center py-8 text-neutral-500 text-[9px] font-mono uppercase">
          No central bank data available
        </div>
      )}

      {/* Holdings bar chart */}
      {data.centralBanks.length > 0 && (
        <>
          <div className="px-2 py-1.5 border-t border-border/10 bg-[#030303]">
            <span className="text-[7px] font-black font-mono uppercase tracking-wider text-neutral-500">
              Gold Reserves Distribution
            </span>
          </div>
          <div className="px-3 py-2">
            <div className="space-y-0.5">
              {data.centralBanks.map((cb) => {
                const pct = (cb.holdingsTonnes / maxHoldings) * 100;
                const hasRecentChange = cb.changeYTD !== 0;

                return (
                  <div key={cb.country} className="flex items-center gap-2 hover:bg-yellow-400/[0.02] transition-colors">
                    <span className="text-[7px] font-mono text-neutral-400 w-[60px] shrink-0 truncate">
                      {cb.country}
                    </span>
                    <div className="flex-1 h-[8px] bg-neutral-900 relative">
                      <div
                        className={`absolute inset-y-0 left-0 ${hasRecentChange ? 'bg-yellow-400/70' : 'bg-yellow-400/40'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[7px] font-mono font-bold text-yellow-400 w-[44px] text-right shrink-0">
                      {fmtTonnes(cb.holdingsTonnes)}t
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Active buyers note */}
      <div className="px-2 py-1.5 border-t border-border/10">
        <span className="text-[6px] font-mono text-neutral-700 uppercase">
          Brighter bars indicate recent changes in holdings | Source: WGC, IMF
        </span>
      </div>
    </div>
  );
}
