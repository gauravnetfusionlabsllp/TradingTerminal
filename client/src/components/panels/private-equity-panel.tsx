import { usePrivateEquity } from '../../api/hooks/use-private-equity';
import { Briefcase } from 'lucide-react';

// ── Constants ──

const LIME = '#a3e635'; // lime-400
const GREEN = '#34d399';
const RED = '#f87171';
const BLUE = '#60a5fa';
const YELLOW = '#fbbf24';
const ORANGE = '#fb923c';
const PURPLE = '#c084fc';

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
  return n.toFixed(2) + 'x';
}

function fmtIrr(n: number | null): string {
  if (n == null) return '--';
  return (n >= 0 ? '+' : '') + n.toFixed(1) + '%';
}

// ── Color helpers ──

function irrColor(n: number | null): string {
  if (n == null) return 'rgba(255,255,255,0.3)';
  if (n >= 20) return GREEN;
  if (n >= 10) return LIME;
  if (n >= 0) return YELLOW;
  return RED;
}

function quartileColor(quartile: number): string {
  switch (quartile) {
    case 1: return GREEN;
    case 2: return LIME;
    case 3: return YELLOW;
    case 4: return RED;
    default: return 'rgba(255,255,255,0.3)';
  }
}

function quartileLabel(quartile: number): string {
  switch (quartile) {
    case 1: return 'Q1';
    case 2: return 'Q2';
    case 3: return 'Q3';
    case 4: return 'Q4';
    default: return '--';
  }
}

function strategyStyle(strategy: string): { color: string; bg: string } {
  switch (strategy.toLowerCase()) {
    case 'buyout': return { color: BLUE, bg: 'rgba(96,165,250,0.12)' };
    case 'growth': return { color: GREEN, bg: 'rgba(52,211,153,0.12)' };
    case 'venture': return { color: PURPLE, bg: 'rgba(192,132,252,0.12)' };
    case 'credit': return { color: ORANGE, bg: 'rgba(251,146,60,0.12)' };
    case 'infrastructure': return { color: '#67e8f9', bg: 'rgba(103,232,249,0.12)' };
    case 'real assets': return { color: YELLOW, bg: 'rgba(251,191,36,0.12)' };
    case 'secondaries': return { color: '#f472b6', bg: 'rgba(244,114,182,0.12)' };
    case 'distressed': return { color: RED, bg: 'rgba(248,113,113,0.12)' };
    default: return { color: 'rgba(255,255,255,0.4)', bg: 'rgba(255,255,255,0.04)' };
  }
}

function sectorBadgeStyle(sector: string): { color: string; bg: string } {
  const colors: Record<string, { color: string; bg: string }> = {
    'Technology': { color: '#818cf8', bg: 'rgba(129,140,248,0.12)' },
    'Healthcare': { color: GREEN, bg: 'rgba(52,211,153,0.12)' },
    'Financials': { color: YELLOW, bg: 'rgba(251,191,36,0.12)' },
    'Industrials': { color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
    'Consumer': { color: '#f472b6', bg: 'rgba(244,114,182,0.12)' },
    'Energy': { color: ORANGE, bg: 'rgba(251,146,60,0.12)' },
    'Infrastructure': { color: '#67e8f9', bg: 'rgba(103,232,249,0.12)' },
    'Real Estate': { color: '#2dd4bf', bg: 'rgba(45,212,191,0.12)' },
    'Business Services': { color: BLUE, bg: 'rgba(96,165,250,0.12)' },
    'Software': { color: PURPLE, bg: 'rgba(192,132,252,0.12)' },
  };
  return colors[sector] ?? { color: 'rgba(255,255,255,0.3)', bg: 'rgba(255,255,255,0.04)' };
}

function financingStyle(type: string): { color: string; bg: string } {
  switch (type.toLowerCase()) {
    case 'lbo': return { color: BLUE, bg: 'rgba(96,165,250,0.12)' };
    case 'all equity': return { color: GREEN, bg: 'rgba(52,211,153,0.12)' };
    case 'growth equity': return { color: PURPLE, bg: 'rgba(192,132,252,0.12)' };
    case 'club deal': return { color: YELLOW, bg: 'rgba(251,191,36,0.12)' };
    case 'take-private': return { color: ORANGE, bg: 'rgba(251,146,60,0.12)' };
    case 'recap': return { color: '#f472b6', bg: 'rgba(244,114,182,0.12)' };
    default: return { color: 'rgba(255,255,255,0.4)', bg: 'rgba(255,255,255,0.04)' };
  }
}

function dealStatusStyle(status: string): { color: string; bg: string } {
  switch (status.toLowerCase()) {
    case 'closed': return { color: GREEN, bg: 'rgba(52,211,153,0.12)' };
    case 'announced': return { color: BLUE, bg: 'rgba(96,165,250,0.12)' };
    case 'pending': return { color: YELLOW, bg: 'rgba(251,191,36,0.12)' };
    case 'loi signed': return { color: ORANGE, bg: 'rgba(251,146,60,0.12)' };
    default: return { color: 'rgba(255,255,255,0.4)', bg: 'rgba(255,255,255,0.04)' };
  }
}

function exitTypeStyle(type: string): { color: string; bg: string } {
  switch (type.toLowerCase()) {
    case 'ipo': return { color: GREEN, bg: 'rgba(52,211,153,0.12)' };
    case 'strategic': return { color: BLUE, bg: 'rgba(96,165,250,0.12)' };
    case 'secondary': return { color: YELLOW, bg: 'rgba(251,191,36,0.12)' };
    case 'recap': return { color: ORANGE, bg: 'rgba(251,146,60,0.12)' };
    default: return { color: 'rgba(255,255,255,0.4)', bg: 'rgba(255,255,255,0.04)' };
  }
}

// ── Main Panel ──

export function PrivateEquityPanel() {
  const { data: hookData, isLoading, refetch } = usePrivateEquity();
  const data = hookData;

  return (
    <div className="h-full flex flex-col bg-black overflow-hidden font-mono text-[9px]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#050505] border-b border-lime-400/30 shrink-0">
        <div className="flex items-center gap-2">
          <Briefcase className="w-3 h-3 text-lime-400" />
          <span className="text-[9px] font-black uppercase tracking-tighter text-lime-400">
            Private Equity
          </span>
        </div>
        <div className="flex items-center gap-3 text-[8px] text-neutral-400">
          <span>AUM <span className="text-lime-400 font-bold">{data?.overview?.totalAum != null ? fmtValue(data.overview.totalAum) : '--'}</span></span>
          <span>Dry Powder <span className="text-lime-400 font-bold">{data?.overview?.dryPowder != null ? fmtValue(data.overview.dryPowder) : '--'}</span></span>
          <button
            onClick={() => refetch()}
            className="text-neutral-500 hover:text-lime-400 transition-colors"
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

      {/* Overview Stats Bar */}
      {data?.overview && <OverviewBar overview={data.overview} />}

      {/* Content */}
      <div className="flex-1 overflow-auto no-scrollbar">
        {!data ? (
          <div className="flex items-center justify-center h-full text-neutral/40 text-[10px] font-mono uppercase tracking-widest">{isLoading ? 'Loading...' : 'No data available'}</div>
        ) : (
          <>
            <TopFirmsSection firms={data.topFirms} />
            <RecentDealsSection deals={data.recentDeals} />
            <FundraisingSection fundraising={data.fundraising} />
            <RecentExitsSection exits={data.recentExits} />
            <PerformanceBenchmarksSection benchmarks={data.performanceBenchmarks} />
          </>
        )}
      </div>
    </div>
  );
}

// ── Overview Stats Bar ──

function OverviewBar({ overview }: { overview: any }) {
  const stats = [
    { label: 'TOTAL AUM', value: fmtValue(overview.totalAum) },
    { label: 'DRY POWDER', value: fmtValue(overview.dryPowder) },
    { label: 'FUNDRAISING YTD', value: fmtValue(overview.fundraisingYtd) },
    { label: 'DEAL ACTIVITY', value: overview.dealActivity.toLocaleString() },
    { label: 'EXIT VOLUME', value: fmtValue(overview.exitVolume) },
    { label: 'AVG ENTRY MULT', value: fmtMultiple(overview.avgEntryMultiple) },
  ];

  return (
    <div className="shrink-0 grid grid-cols-6 border-b border-lime-400/30">
      {stats.map((s: any, i: any) => (
        <div key={i} className="flex flex-col items-center py-1.5 px-1 border-r border-border/20 last:border-r-0">
          <span className="text-[7px] uppercase tracking-widest font-black text-neutral-500">{s.label}</span>
          <span className="text-[10px] font-bold tabular-nums text-lime-400">{s.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Top Firms Table ──

function TopFirmsSection({ firms }: { firms: any[] }) {
  return (
    <div className="border-b border-lime-400/30">
      {/* Section header */}
      <div className="flex items-center gap-1.5 px-3 py-1 border-b border-border/20">
        <div className="w-1 h-1 bg-lime-400" />
        <span className="text-[7px] font-black uppercase tracking-widest text-lime-400">Top Firms</span>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[1fr_55px_55px_50px_45px_40px_40px_60px] px-3 py-1 border-b border-border/20">
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500">Firm</span>
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500 text-right">AUM</span>
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500 text-right">Fund</span>
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500 text-right">Net IRR</span>
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500 text-right">TVPI</span>
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500 text-right">DPI</span>
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500 text-right">Deals</span>
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500 text-center">Strategy</span>
      </div>

      {/* Rows */}
      {firms.map((f: any, i: any) => {
        const ss = strategyStyle(f.strategy);
        return (
          <div
            key={i}
            className="grid grid-cols-[1fr_55px_55px_50px_45px_40px_40px_60px] px-3 py-1 border-b border-border/20 hover:bg-lime-400/[0.02] transition-colors items-center"
          >
            <span className="text-neutral-300 font-bold truncate">{f.firm}</span>
            <span className="text-neutral-300 text-right tabular-nums">{fmtValueShort(f.aum)}</span>
            <span className="text-neutral-300 text-right tabular-nums">{fmtValueShort(f.latestFundSize)}</span>
            <span className="text-right tabular-nums font-bold" style={{ color: irrColor(f.netIrr) }}>
              {fmtIrr(f.netIrr)}
            </span>
            <span className="text-neutral-300 text-right tabular-nums">{fmtMultiple(f.tvpi)}</span>
            <span className="text-neutral-300 text-right tabular-nums">{fmtMultiple(f.dpi)}</span>
            <span className="text-neutral-300 text-right tabular-nums">{f.dealsYtd}</span>
            <div className="flex justify-center">
              <span
                className="text-[6px] font-black uppercase px-1 py-0 truncate"
                style={{ color: ss.color, backgroundColor: ss.bg }}
              >
                {f.strategy}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Recent Deals Section ──

function RecentDealsSection({ deals }: { deals: any[] }) {
  return (
    <div className="border-b border-lime-400/30">
      {/* Section header */}
      <div className="flex items-center gap-1.5 px-3 py-1 border-b border-border/20">
        <div className="w-1 h-1 bg-lime-400" />
        <span className="text-[7px] font-black uppercase tracking-widest text-lime-400">Recent Deals</span>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[80px_1fr_55px_65px_50px_65px_55px] px-3 py-1 border-b border-border/20">
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500">Acquirer</span>
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500">Target</span>
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500 text-right">Value</span>
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500 text-center">Sector</span>
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500 text-right">Entry X</span>
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500 text-center">Financing</span>
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500 text-center">Status</span>
      </div>

      {/* Rows */}
      {deals.map((d: any, i: any) => {
        const sec = sectorBadgeStyle(d.sector);
        const fin = financingStyle(d.financingType);
        const st = dealStatusStyle(d.status);
        return (
          <div
            key={i}
            className="grid grid-cols-[80px_1fr_55px_65px_50px_65px_55px] px-3 py-1 border-b border-border/20 hover:bg-lime-400/[0.02] transition-colors items-center"
          >
            <span className="text-neutral-300 font-bold truncate">{d.acquirer}</span>
            <span className="text-neutral-400 truncate">{d.target}</span>
            <span className="text-neutral-300 text-right tabular-nums">{fmtValue(d.value)}</span>
            <div className="flex justify-center">
              <span
                className="text-[6px] font-black uppercase px-1 py-0 truncate"
                style={{ color: sec.color, backgroundColor: sec.bg }}
              >
                {d.sector}
              </span>
            </div>
            <span className="text-neutral-300 text-right tabular-nums">{fmtMultiple(d.entryMultiple)}</span>
            <div className="flex justify-center">
              <span
                className="text-[6px] font-black uppercase px-1 py-0 truncate"
                style={{ color: fin.color, backgroundColor: fin.bg }}
              >
                {d.financingType}
              </span>
            </div>
            <div className="flex justify-center">
              <span
                className="text-[6px] font-black uppercase px-1 py-0"
                style={{ color: st.color, backgroundColor: st.bg }}
              >
                {d.status}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Fundraising Section ──

function FundraisingSection({ fundraising }: { fundraising: any }) {
  const maxRaised = Math.max(...fundraising.breakdown.map((b: any) => b.raised), 1);

  return (
    <div className="border-b border-lime-400/30">
      {/* Section header */}
      <div className="flex items-center gap-1.5 px-3 py-1 border-b border-border/20">
        <div className="w-1 h-1 bg-lime-400" />
        <span className="text-[7px] font-black uppercase tracking-widest text-lime-400">Fundraising</span>
        <span className="text-[8px] text-neutral-400 ml-auto">
          Total Raised <span className="text-lime-400 font-bold">{fmtValue(fundraising.totalRaised)}</span>
        </span>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[1fr_60px_50px_40px_55px_80px] px-3 py-1 border-b border-border/20">
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500">Strategy</span>
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500 text-right">Raised</span>
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500 text-right">% Total</span>
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500 text-right">Funds</span>
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500 text-right">Avg Size</span>
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500 text-right">Share</span>
      </div>

      {/* Rows */}
      {fundraising.breakdown.map((b: any, i: any) => {
        const ss = strategyStyle(b.strategy);
        return (
          <div
            key={i}
            className="grid grid-cols-[1fr_60px_50px_40px_55px_80px] px-3 py-1 border-b border-border/20 hover:bg-lime-400/[0.02] transition-colors items-center"
          >
            <div className="flex items-center gap-1.5">
              <div className="w-1 h-1 shrink-0" style={{ backgroundColor: ss.color }} />
              <span className="text-neutral-300">{b.strategy}</span>
            </div>
            <span className="text-neutral-300 text-right tabular-nums">{fmtValue(b.raised)}</span>
            <span className="text-neutral-400 text-right tabular-nums">{fmtPct(b.pctOfTotal)}</span>
            <span className="text-neutral-300 text-right tabular-nums">{b.fundCount}</span>
            <span className="text-neutral-300 text-right tabular-nums">{fmtValue(b.avgFundSize)}</span>
            <div className="flex items-center justify-end gap-1.5">
              <span className="text-lime-400 tabular-nums text-[8px] font-bold">{b.pctOfTotal.toFixed(1)}%</span>
              <div className="w-[40px] h-[4px] bg-white/[0.04] overflow-hidden">
                <div
                  className="h-full bg-lime-400/40"
                  style={{ width: `${(b.raised / maxRaised) * 100}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Recent Exits Section ──

function RecentExitsSection({ exits }: { exits: any[] }) {
  return (
    <div className="border-b border-lime-400/30">
      {/* Section header */}
      <div className="flex items-center gap-1.5 px-3 py-1 border-b border-border/20">
        <div className="w-1 h-1 bg-lime-400" />
        <span className="text-[7px] font-black uppercase tracking-widest text-lime-400">Recent Exits</span>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[80px_1fr_60px_40px_55px_45px_50px] px-3 py-1 border-b border-border/20">
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500">Firm</span>
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500">Company</span>
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500 text-center">Exit Type</span>
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500 text-right">Entry</span>
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500 text-right">Exit Val</span>
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500 text-right">MOIC</span>
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500 text-right">Gross IRR</span>
      </div>

      {/* Rows */}
      {exits.map((e: any, i: any) => {
        const et = exitTypeStyle(e.exitType);
        return (
          <div
            key={i}
            className="grid grid-cols-[80px_1fr_60px_40px_55px_45px_50px] px-3 py-1 border-b border-border/20 hover:bg-lime-400/[0.02] transition-colors items-center"
          >
            <span className="text-neutral-300 font-bold truncate">{e.firm}</span>
            <span className="text-neutral-400 truncate">{e.company}</span>
            <div className="flex justify-center">
              <span
                className="text-[6px] font-black uppercase px-1 py-0"
                style={{ color: et.color, backgroundColor: et.bg }}
              >
                {e.exitType}
              </span>
            </div>
            <span className="text-neutral-400 text-right tabular-nums">{e.entryYear}</span>
            <span className="text-neutral-300 text-right tabular-nums">{fmtValue(e.exitValue)}</span>
            <span className="text-right tabular-nums font-bold" style={{ color: e.moic >= 3 ? GREEN : e.moic >= 2 ? LIME : YELLOW }}>
              {fmtMultiple(e.moic)}
            </span>
            <span className="text-right tabular-nums font-bold" style={{ color: irrColor(e.grossIrr) }}>
              {fmtIrr(e.grossIrr)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Performance Benchmarks Section ──

function PerformanceBenchmarksSection({ benchmarks }: { benchmarks: any[] }) {
  return (
    <div className="border-b border-lime-400/30">
      {/* Section header */}
      <div className="flex items-center gap-1.5 px-3 py-1 border-b border-border/20">
        <div className="w-1 h-1 bg-lime-400" />
        <span className="text-[7px] font-black uppercase tracking-widest text-lime-400">Performance Benchmarks</span>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[55px_65px_35px_55px_35px_50px_35px] px-3 py-1 border-b border-border/20">
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500">Vintage</span>
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500 text-right">Net IRR</span>
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500 text-center">Q</span>
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500 text-right">TVPI</span>
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500 text-center">Q</span>
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500 text-right">DPI</span>
        <span className="text-[7px] font-bold uppercase tracking-wider text-neutral-500 text-center">Q</span>
      </div>

      {/* Rows */}
      {benchmarks.map((b: any, i: any) => (
        <div
          key={i}
          className="grid grid-cols-[55px_65px_35px_55px_35px_50px_35px] px-3 py-1 border-b border-border/20 hover:bg-lime-400/[0.02] transition-colors items-center"
        >
          <span className="text-neutral-300 font-bold tabular-nums">{b.vintageYear}</span>
          <span className="text-right tabular-nums font-bold" style={{ color: irrColor(b.netIrr) }}>
            {fmtIrr(b.netIrr)}
          </span>
          <div className="flex justify-center">
            <span
              className="text-[6px] font-black px-1 py-0"
              style={{ color: quartileColor(b.irrQuartile), backgroundColor: quartileColor(b.irrQuartile) + '18' }}
            >
              {quartileLabel(b.irrQuartile)}
            </span>
          </div>
          <span className="text-neutral-300 text-right tabular-nums">{fmtMultiple(b.tvpi)}</span>
          <div className="flex justify-center">
            <span
              className="text-[6px] font-black px-1 py-0"
              style={{ color: quartileColor(b.tvpiQuartile), backgroundColor: quartileColor(b.tvpiQuartile) + '18' }}
            >
              {quartileLabel(b.tvpiQuartile)}
            </span>
          </div>
          <span className="text-neutral-300 text-right tabular-nums">{fmtMultiple(b.dpi)}</span>
          <div className="flex justify-center">
            <span
              className="text-[6px] font-black px-1 py-0"
              style={{ color: quartileColor(b.dpiQuartile), backgroundColor: quartileColor(b.dpiQuartile) + '18' }}
            >
              {quartileLabel(b.dpiQuartile)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
