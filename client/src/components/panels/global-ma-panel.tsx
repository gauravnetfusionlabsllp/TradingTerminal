import { useState, useMemo } from 'react';
import { useGlobalMA } from '../../api/hooks/use-global-ma';
import { GitMerge, ChevronLeft } from 'lucide-react';

// ── Constants ──

const ROSE = '#fb7185'; // rose-400
const GREEN = '#34d399';
const RED = '#f87171';
const BLUE = '#60a5fa';
const YELLOW = '#fbbf24';
const ORANGE = '#fb923c';

// ── Formatting helpers ──

function fmtValue(n: number): string {
  if (Math.abs(n) >= 1_000) return '$' + (n / 1_000).toFixed(1) + 'T';
  if (Math.abs(n) >= 1) return '$' + n.toFixed(1) + 'B';
  return '$' + (n * 1_000).toFixed(0) + 'M';
}

function fmtValueShort(n: number): string {
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + 'T';
  if (Math.abs(n) >= 1) return n.toFixed(1) + 'B';
  return (n * 1_000).toFixed(0) + 'M';
}

function fmtPct(n: number | null): string {
  if (n == null) return '--';
  return n.toFixed(1) + '%';
}

function fmtMultiple(n: number | null): string {
  if (n == null) return '--';
  return n.toFixed(1) + 'x';
}

// ── Color helpers ──

function statusStyle(status: string): { color: string; bg: string } {
  switch (status.toLowerCase()) {
    case 'announced': return { color: BLUE, bg: 'rgba(96,165,250,0.12)' };
    case 'pending': return { color: YELLOW, bg: 'rgba(251,191,36,0.12)' };
    case 'completed': return { color: GREEN, bg: 'rgba(52,211,153,0.12)' };
    case 'terminated': return { color: RED, bg: 'rgba(248,113,113,0.12)' };
    case 'hostile': return { color: ORANGE, bg: 'rgba(251,146,60,0.12)' };
    default: return { color: 'rgba(255,255,255,0.4)', bg: 'rgba(255,255,255,0.04)' };
  }
}

function sectorColor(sector: string): string {
  const colors: Record<string, string> = {
    'Technology': '#818cf8',
    'Healthcare': '#34d399',
    'Financials': '#fbbf24',
    'Energy': '#f97316',
    'Industrials': '#94a3b8',
    'Consumer': '#f472b6',
    'Real Estate': '#67e8f9',
    'Media': '#c084fc',
    'Telecom': '#22d3ee',
  };
  return colors[sector] ?? 'rgba(255,255,255,0.3)';
}

// ── Main Panel ──

export function GlobalMAPanel() {
  const { data: hookData, isLoading, refetch } = useGlobalMA();
  const data = hookData;
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);

  const selectedDeal = useMemo(() => {
    if (!selectedDealId) return null;
    return data?.recentDeals?.find((d: any) => d.id === selectedDealId) ?? null;
  }, [data, selectedDealId]);

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full text-neutral/40 text-[10px] font-mono uppercase tracking-widest">{isLoading ? 'Loading...' : 'No data available'}</div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-black overflow-hidden font-mono text-[9px]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#050505] border-b border-rose-400/30 shrink-0">
        <div className="flex items-center gap-2">
          <GitMerge className="w-3 h-3 text-rose-400" />
          <span className="text-[9px] font-black uppercase tracking-tighter text-rose-400">
            Global M&A Activity
          </span>
        </div>
        <div className="flex items-center gap-3 text-[8px] text-neutral-400">
          <span>YTD <span className="text-rose-400 font-bold">{data.summary?.ytdDealCount?.toLocaleString() ?? '--'}</span> deals</span>
          <span>Total <span className="text-rose-400 font-bold">{data.summary?.ytdTotalValue != null ? fmtValue(data.summary.ytdTotalValue) : '--'}</span></span>
          <button
            onClick={() => refetch()}
            className="text-neutral-500 hover:text-rose-400 transition-colors"
          >
            <svg className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
              <path d="M16 16h5v5" />
            </svg>
          </button>
        </div>
      </div>

      {/* Summary Stats Bar */}
      {data.summary && <SummaryStatsBar summary={data.summary} />}

      {/* Content */}
      <div className="flex-1 overflow-auto no-scrollbar">
        {selectedDeal ? (
          <DealDetailView deal={selectedDeal} onBack={() => setSelectedDealId(null)} />
        ) : (
          <>
            <RecentDealsTable deals={data.recentDeals ?? []} onSelectDeal={setSelectedDealId} />
            <SectorBreakdownSection sectors={data.sectorBreakdown ?? []} />
            <AdvisoryLeagueTable advisors={data.advisoryLeagueTables ?? []} />
            <RegionalActivitySection regions={data.regionalActivity ?? []} />
          </>
        )}
      </div>
    </div>
  );
}

// ── Summary Stats Bar ──

function SummaryStatsBar({ summary }: { summary: any }) {
  const stats = [
    { label: 'TOTAL DEALS', value: summary.totalDeals.toLocaleString() },
    { label: 'TOTAL VALUE', value: fmtValue(summary.totalValue) },
    { label: 'AVG DEAL', value: fmtValue(summary.avgDealSize) },
    { label: 'CROSS-BORDER', value: fmtPct(summary.crossBorderPct) },
    { label: 'MEGA DEALS', value: String(summary.megaDeals) },
    { label: 'VS LAST YR', value: (summary.vsLastYearPct >= 0 ? '+' : '') + fmtPct(summary.vsLastYearPct), positive: summary.vsLastYearPct >= 0 },
  ];

  return (
    <div className="shrink-0 grid grid-cols-6 border-b border-rose-400/30">
      {stats.map((s: any, i: any) => (
        <div key={i} className="flex flex-col items-center py-1.5 px-1 border-r border-border/20 last:border-r-0">
          <span className="text-[7px] uppercase tracking-widest font-black text-neutral-500">{s.label}</span>
          <span className={`text-[10px] font-bold tabular-nums ${s.positive != null ? (s.positive ? 'text-green-400' : 'text-red-400') : 'text-rose-400'}`}>
            {s.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Recent Deals Table ──

function RecentDealsTable({ deals, onSelectDeal }: { deals: any[]; onSelectDeal: (id: string) => void }) {
  return (
    <div className="border-b border-rose-400/30">
      {/* Section header */}
      <div className="flex items-center gap-1.5 px-3 py-1 border-b border-border/20">
        <div className="w-1 h-1 bg-rose-400" />
        <span className="text-[7px] font-black uppercase tracking-widest text-neutral-500">Recent Deals</span>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[1fr_60px_70px_60px_55px_50px_65px] px-3 py-1 border-b border-border/20">
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500">Acquirer / Target</span>
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500 text-right">Value</span>
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500 text-center">Sector</span>
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500 text-center">Type</span>
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500 text-center">Status</span>
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500 text-right">Premium</span>
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500 text-right">Payment</span>
      </div>

      {/* Rows */}
      {deals.map((deal: any) => {
        const ss = statusStyle(deal.status);
        const sc = sectorColor(deal.sector);

        return (
          <div
            key={deal.id}
            onClick={() => onSelectDeal(deal.id)}
            className="grid grid-cols-[1fr_60px_70px_60px_55px_50px_65px] px-3 py-1 border-b border-border/20 hover:bg-rose-400/[0.02] cursor-pointer transition-colors items-center"
          >
            {/* Acquirer -> Target */}
            <div className="flex items-center gap-1 min-w-0">
              <span className="text-neutral-300 font-bold truncate">{deal.acquirerTicker}</span>
              <span className="text-neutral-600 text-[7px]">&#8594;</span>
              <span className="text-neutral-300 truncate">{deal.targetTicker}</span>
            </div>

            {/* Value */}
            <span className="text-neutral-300 text-right tabular-nums">{fmtValue(deal.value)}</span>

            {/* Sector badge */}
            <div className="flex justify-center">
              <span
                className="text-[6px] font-black uppercase px-1 py-0 truncate"
                style={{ color: sc, backgroundColor: sc + '18' }}
              >
                {deal.sector}
              </span>
            </div>

            {/* Type badge */}
            <div className="flex justify-center">
              <span className="text-[6px] font-black uppercase px-1 py-0 text-neutral-400 bg-white/[0.04]">
                {deal.type}
              </span>
            </div>

            {/* Status badge */}
            <div className="flex justify-center">
              <span
                className="text-[6px] font-black uppercase px-1 py-0"
                style={{ color: ss.color, backgroundColor: ss.bg }}
              >
                {deal.status}
              </span>
            </div>

            {/* Premium */}
            <span className="text-right tabular-nums" style={{ color: deal.premium != null ? GREEN : 'rgba(255,255,255,0.2)' }}>
              {fmtPct(deal.premium)}
            </span>

            {/* Payment type */}
            <span className="text-neutral-500 text-right text-[7px] truncate">{deal.paymentType}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Deal Detail View ──

function DealDetailView({ deal, onBack }: { deal: any; onBack: () => void }) {
  const ss = statusStyle(deal.status);

  return (
    <div className="p-3 space-y-3">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-[8px] text-neutral-500 hover:text-rose-400 transition-colors"
      >
        <ChevronLeft className="w-3 h-3" />
        <span className="uppercase tracking-wider font-bold">Back to deals</span>
      </button>

      {/* Deal header */}
      <div className="border border-rose-400/30 p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-white">{deal.acquirer}</span>
            <span className="text-neutral-600">&#8594;</span>
            <span className="text-[11px] font-bold text-white">{deal.target}</span>
          </div>
          <span
            className="text-[7px] font-black uppercase px-1.5 py-0.5"
            style={{ color: ss.color, backgroundColor: ss.bg }}
          >
            {deal.status}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-3 mt-2">
          <div className="flex flex-col">
            <span className="text-[7px] uppercase tracking-widest font-black text-neutral-500">Deal Value</span>
            <span className="text-[10px] font-bold text-rose-400 tabular-nums">{fmtValue(deal.value)}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[7px] uppercase tracking-widest font-black text-neutral-500">Premium</span>
            <span className="text-[10px] font-bold tabular-nums" style={{ color: GREEN }}>{fmtPct(deal.premium)}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[7px] uppercase tracking-widest font-black text-neutral-500">Payment</span>
            <span className="text-[10px] font-bold text-neutral-300">{deal.paymentType}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[7px] uppercase tracking-widest font-black text-neutral-500">Sector</span>
            <span className="text-[10px] font-bold" style={{ color: sectorColor(deal.sector) }}>{deal.sector}</span>
          </div>
        </div>
      </div>

      {/* Advisors */}
      <div className="border border-border/20">
        <div className="flex items-center gap-1.5 px-3 py-1 border-b border-border/20">
          <div className="w-1 h-1 bg-rose-400" />
          <span className="text-[7px] font-black uppercase tracking-widest text-neutral-500">Advisors</span>
        </div>
        <div className="grid grid-cols-2 divide-x divide-border/20">
          <div className="p-2">
            <span className="text-[7px] uppercase tracking-wider font-bold text-neutral-500 block mb-1">Acquirer Side</span>
            {deal.advisors.acquirerAdvisors.map((a: any, i: any) => (
              <div key={i} className="text-neutral-300 py-0.5">{a}</div>
            ))}
          </div>
          <div className="p-2">
            <span className="text-[7px] uppercase tracking-wider font-bold text-neutral-500 block mb-1">Target Side</span>
            {deal.advisors.targetAdvisors.map((a: any, i: any) => (
              <div key={i} className="text-neutral-300 py-0.5">{a}</div>
            ))}
          </div>
        </div>
      </div>

      {/* Timeline / Regulatory */}
      <div className="border border-border/20">
        <div className="flex items-center gap-1.5 px-3 py-1 border-b border-border/20">
          <div className="w-1 h-1 bg-rose-400" />
          <span className="text-[7px] font-black uppercase tracking-widest text-neutral-500">Deal Timeline</span>
        </div>
        <div className="p-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[7px] uppercase tracking-wider text-neutral-500">Announced</span>
            <span className="text-neutral-300 tabular-nums">{deal.announcedDate}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[7px] uppercase tracking-wider text-neutral-500">Expected Close</span>
            <span className="text-neutral-300 tabular-nums">{deal.expectedClose ?? '--'}</span>
          </div>
          <div className="flex items-center justify-between border-t border-border/20 pt-1.5">
            <span className="text-[7px] uppercase tracking-wider text-neutral-500">Regulatory Status</span>
            <span className="text-neutral-300 text-right max-w-[60%]">{deal.regulatoryStatus}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sector Breakdown Section ──

function SectorBreakdownSection({ sectors }: { sectors: any[] }) {
  return (
    <div className="border-b border-rose-400/30">
      {/* Section header */}
      <div className="flex items-center gap-1.5 px-3 py-1 border-b border-border/20">
        <div className="w-1 h-1 bg-rose-400" />
        <span className="text-[7px] font-black uppercase tracking-widest text-neutral-500">Sector Breakdown</span>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[1fr_55px_65px_55px_60px] px-3 py-1 border-b border-border/20">
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500">Sector</span>
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500 text-right">Deals</span>
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500 text-right">Value</span>
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500 text-right">Avg Prem</span>
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500 text-right">EV/EBITDA</span>
      </div>

      {/* Rows */}
      {sectors.map((s: any) => {
        const sc = sectorColor(s.sector);
        return (
          <div
            key={s.sector}
            className="grid grid-cols-[1fr_55px_65px_55px_60px] px-3 py-1 border-b border-border/20 hover:bg-rose-400/[0.02] transition-colors items-center"
          >
            <div className="flex items-center gap-1.5">
              <div className="w-1 h-1 shrink-0" style={{ backgroundColor: sc }} />
              <span className="text-neutral-300">{s.sector}</span>
            </div>
            <span className="text-neutral-300 text-right tabular-nums">{s.dealCount}</span>
            <span className="text-neutral-300 text-right tabular-nums">{fmtValue(s.totalValue)}</span>
            <span className="text-right tabular-nums" style={{ color: GREEN }}>{fmtPct(s.avgPremium)}</span>
            <span className="text-neutral-300 text-right tabular-nums">{fmtMultiple(s.avgEvEbitda)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Advisory League Tables ──

function AdvisoryLeagueTable({ advisors }: { advisors: any[] }) {
  const maxShare = useMemo(() => Math.max(...advisors.map((a: any) => a.marketSharePct), 1), [advisors]);

  return (
    <div className="border-b border-rose-400/30">
      {/* Section header */}
      <div className="flex items-center gap-1.5 px-3 py-1 border-b border-border/20">
        <div className="w-1 h-1 bg-rose-400" />
        <span className="text-[7px] font-black uppercase tracking-widest text-neutral-500">Advisory League Tables</span>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[25px_1fr_45px_60px_90px] px-3 py-1 border-b border-border/20">
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500">#</span>
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500">Advisor</span>
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500 text-right">Deals</span>
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500 text-right">Value</span>
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500 text-right">Mkt Share</span>
      </div>

      {/* Rows */}
      {advisors.map((a: any) => (
        <div
          key={a.rank}
          className="grid grid-cols-[25px_1fr_45px_60px_90px] px-3 py-1 border-b border-border/20 hover:bg-rose-400/[0.02] transition-colors items-center"
        >
          <span className="text-neutral-500 tabular-nums">{a.rank}</span>
          <span className="text-neutral-300 truncate">{a.advisor}</span>
          <span className="text-neutral-300 text-right tabular-nums">{a.dealCount}</span>
          <span className="text-neutral-300 text-right tabular-nums">{fmtValue(a.value)}</span>
          <div className="flex items-center justify-end gap-1.5">
            <span className="text-rose-400 tabular-nums text-[8px] font-bold">{a.marketSharePct.toFixed(1)}%</span>
            <div className="w-[40px] h-[4px] bg-white/[0.04] overflow-hidden">
              <div
                className="h-full bg-rose-400/40"
                style={{ width: `${(a.marketSharePct / maxShare) * 100}%` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Regional Activity Section ──

function RegionalActivitySection({ regions }: { regions: any[] }) {
  return (
    <div className="border-b border-rose-400/30">
      {/* Section header */}
      <div className="flex items-center gap-1.5 px-3 py-1 border-b border-border/20">
        <div className="w-1 h-1 bg-rose-400" />
        <span className="text-[7px] font-black uppercase tracking-widest text-neutral-500">Regional Activity</span>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[1fr_50px_60px_1fr_55px] px-3 py-1 border-b border-border/20">
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500">Region</span>
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500 text-right">Deals</span>
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500 text-right">Value</span>
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500 pl-3">Top Deal</span>
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500 text-right">X-Border</span>
      </div>

      {/* Rows */}
      {regions.map((r: any) => (
        <div
          key={r.region}
          className="grid grid-cols-[1fr_50px_60px_1fr_55px] px-3 py-1 border-b border-border/20 hover:bg-rose-400/[0.02] transition-colors items-center"
        >
          <span className="text-neutral-300">{r.region}</span>
          <span className="text-neutral-300 text-right tabular-nums">{r.dealCount}</span>
          <span className="text-neutral-300 text-right tabular-nums">{fmtValue(r.value)}</span>
          <span className="text-neutral-500 pl-3 truncate text-[8px]">{r.topDeal}</span>
          <span className="text-rose-400 text-right tabular-nums">{fmtPct(r.crossBorderPct)}</span>
        </div>
      ))}
    </div>
  );
}
