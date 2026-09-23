import { useState } from 'react';
import { useBankEarnings } from '../../api/hooks/use-bank-earnings';
import { RefreshCw } from 'lucide-react';

// ── Types ──

type Tab = 'overview' | 'capital' | 'trading' | 'credit' | 'trends';

interface BankOverview {
  name: string;
  ticker: string;
  revenue: number;
  epsActual: number;
  epsEstimate: number;
  beat: boolean;
  nim: number;
  roe: number;
  stockReaction: number;
}

interface BankCapitalEntry {
  name: string;
  ticker: string;
  cet1: number;
  tceRatio: number;
  efficiencyRatio: number;
  totalAssets: number;
  capitalAdequacy: number;
}

interface BankTradingEntry {
  name: string;
  ticker: string;
  ficcRevenue: number;
  equitiesRevenue: number;
  advisoryRevenue: number;
  underwritingRevenue: number;
  marketShare: number;
}

interface BankCreditEntry {
  name: string;
  ticker: string;
  provisions: number;
  nplRatio: number;
  loanGrowth: number;
  depositGrowth: number;
}

interface QuarterlyValue {
  quarter: string;
  value: number;
}

interface BankTrendEntry {
  name: string;
  ticker: string;
  nimTrend: QuarterlyValue[];
  provisionTrend: QuarterlyValue[];
  tradingRevenueTrend: QuarterlyValue[];
}

interface BankEarningsData {
  overview: BankOverview[];
  capital: BankCapitalEntry[];
  trading: BankTradingEntry[];
  credit: BankCreditEntry[];
  trends: BankTrendEntry[];
  timestamp: string;
}

// ── Color helpers ──

function beatMissColor(beat: boolean): string {
  return beat ? 'text-green-400' : 'text-red-400';
}

function beatMissBg(beat: boolean): string {
  return beat
    ? 'bg-green-500/10 border-green-500/30 text-green-400'
    : 'bg-red-500/10 border-red-500/30 text-red-400';
}

function reactionColor(val: number): string {
  if (val > 0) return 'text-green-400';
  if (val < 0) return 'text-red-400';
  return 'text-neutral-400';
}

function cet1Color(cet1: number): string {
  if (cet1 >= 13) return 'text-green-400';
  if (cet1 >= 11) return 'text-amber-400';
  return 'text-red-400';
}

function efficiencyColor(ratio: number): string {
  if (ratio <= 55) return 'text-green-400';
  if (ratio <= 65) return 'text-amber-400';
  return 'text-red-400';
}

function nplColor(npl: number): string {
  if (npl <= 0.3) return 'text-green-400';
  if (npl <= 0.6) return 'text-amber-400';
  return 'text-red-400';
}

function growthColor(val: number): string {
  if (val > 3) return 'text-green-400';
  if (val > 0) return 'text-green-400/70';
  if (val === 0) return 'text-neutral-400';
  return 'text-red-400';
}

function provisionTrendColor(trend: QuarterlyValue[]): string {
  if (trend.length < 2) return 'text-neutral-400';
  const last = trend[trend.length - 1].value;
  const prev = trend[trend.length - 2].value;
  if (last > prev * 1.1) return 'text-red-400';
  if (last > prev) return 'text-amber-400';
  return 'text-green-400';
}

function nimTrendColor(trend: QuarterlyValue[]): string {
  if (trend.length < 2) return 'text-neutral-400';
  const last = trend[trend.length - 1].value;
  const first = trend[0].value;
  if (last === 0 && first === 0) return 'text-neutral-600';
  if (last > first) return 'text-green-400';
  if (last < first) return 'text-red-400';
  return 'text-neutral-400';
}

function tradingTrendColor(trend: QuarterlyValue[]): string {
  if (trend.length < 2) return 'text-neutral-400';
  const last = trend[trend.length - 1].value;
  const first = trend[0].value;
  if (last > first) return 'text-green-400';
  if (last < first) return 'text-red-400';
  return 'text-neutral-400';
}

// ── Formatting helpers ──

function fmtB(n: number): string {
  return '$' + n.toFixed(1) + 'B';
}

function fmtBInt(n: number): string {
  return '$' + n.toLocaleString() + 'B';
}

function fmtPct(n: number, decimals = 2): string {
  return n.toFixed(decimals) + '%';
}

function fmtEps(n: number): string {
  return '$' + n.toFixed(2);
}

function fmtReaction(n: number): string {
  const sign = n >= 0 ? '+' : '';
  return sign + n.toFixed(1) + '%';
}

function fmtTrendDirection(trend: QuarterlyValue[]): string {
  if (trend.length < 2) return '-';
  const last = trend[trend.length - 1].value;
  const first = trend[0].value;
  if (last === 0 && first === 0) return 'N/A';
  const change = ((last - first) / (first || 1)) * 100;
  const sign = change >= 0 ? '+' : '';
  return sign + change.toFixed(1) + '%';
}

// ── Tab Labels ──

const TAB_LABELS: Record<Tab, string> = {
  overview: 'Overview',
  capital: 'Capital',
  trading: 'Trading',
  credit: 'Credit',
  trends: 'Trends',
};

// ── Section: Overview Tab ──

function OverviewTab({ banks }: { banks: BankOverview[] }) {
  return (
    <div>
      <div className="grid grid-cols-[1fr_52px_52px_52px_40px_45px_42px_48px] gap-px px-2 py-0.5 border-b border-border/10 text-[7px] font-mono text-neutral-600 uppercase tracking-wider">
        <span>Bank</span>
        <span className="text-right">Revenue</span>
        <span className="text-right">EPS Act</span>
        <span className="text-right">EPS Est</span>
        <span className="text-center">B/M</span>
        <span className="text-right">NIM</span>
        <span className="text-right">ROE</span>
        <span className="text-right">React</span>
      </div>

      {banks.map((bank) => (
        <div
          key={bank.ticker}
          className="grid grid-cols-[1fr_52px_52px_52px_40px_45px_42px_48px] gap-px px-2 py-0.5 border-b border-border/[0.06] hover:bg-blue-400/[0.02] transition-colors"
        >
          <div className="flex items-center gap-1 overflow-hidden">
            <span className="text-[8px] font-mono font-bold text-white truncate">{bank.name}</span>
            <span className="text-[7px] font-mono text-neutral-600 shrink-0">{bank.ticker}</span>
          </div>
          <span className="text-[8px] font-mono text-white text-right">{fmtB(bank.revenue)}</span>
          <span className={`text-[8px] font-mono font-bold text-right ${beatMissColor(bank.beat)}`}>
            {fmtEps(bank.epsActual)}
          </span>
          <span className="text-[8px] font-mono text-neutral-500 text-right">{fmtEps(bank.epsEstimate)}</span>
          <div className="flex justify-center">
            <span className={`text-[7px] font-mono font-black uppercase px-1 py-px border ${beatMissBg(bank.beat)}`}>
              {bank.beat ? 'BEAT' : 'MISS'}
            </span>
          </div>
          <span className="text-[8px] font-mono text-white text-right">
            {bank.nim > 0 ? fmtPct(bank.nim) : '-'}
          </span>
          <span className="text-[8px] font-mono text-white text-right">{fmtPct(bank.roe, 1)}</span>
          <span className={`text-[8px] font-mono font-bold text-right ${reactionColor(bank.stockReaction)}`}>
            {fmtReaction(bank.stockReaction)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Section: Capital Tab ──

function CapitalTab({ banks }: { banks: BankCapitalEntry[] }) {
  return (
    <div>
      <div className="grid grid-cols-[1fr_50px_48px_55px_60px_55px] gap-px px-2 py-0.5 border-b border-border/10 text-[7px] font-mono text-neutral-600 uppercase tracking-wider">
        <span>Bank</span>
        <span className="text-right">CET1</span>
        <span className="text-right">TCE</span>
        <span className="text-right">Eff Ratio</span>
        <span className="text-right">Tot Assets</span>
        <span className="text-right">Cap Adeq</span>
      </div>

      {banks.map((bank) => (
        <div
          key={bank.ticker}
          className="grid grid-cols-[1fr_50px_48px_55px_60px_55px] gap-px px-2 py-0.5 border-b border-border/[0.06] hover:bg-blue-400/[0.02] transition-colors"
        >
          <div className="flex items-center gap-1 overflow-hidden">
            <span className="text-[8px] font-mono font-bold text-white truncate">{bank.name}</span>
            <span className="text-[7px] font-mono text-neutral-600 shrink-0">{bank.ticker}</span>
          </div>
          <span className={`text-[8px] font-mono font-bold text-right ${cet1Color(bank.cet1)}`}>
            {fmtPct(bank.cet1, 1)}
          </span>
          <span className="text-[8px] font-mono text-white text-right">{fmtPct(bank.tceRatio, 1)}</span>
          <span className={`text-[8px] font-mono font-bold text-right ${efficiencyColor(bank.efficiencyRatio)}`}>
            {fmtPct(bank.efficiencyRatio, 1)}
          </span>
          <span className="text-[8px] font-mono text-white text-right">{fmtBInt(bank.totalAssets)}</span>
          <span className={`text-[8px] font-mono font-bold text-right ${cet1Color(bank.capitalAdequacy)}`}>
            {fmtPct(bank.capitalAdequacy, 1)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Section: Trading Tab ──

function TradingTab({ banks }: { banks: BankTradingEntry[] }) {
  return (
    <div>
      <div className="grid grid-cols-[1fr_48px_48px_50px_52px_50px] gap-px px-2 py-0.5 border-b border-border/10 text-[7px] font-mono text-neutral-600 uppercase tracking-wider">
        <span>Bank</span>
        <span className="text-right">FICC</span>
        <span className="text-right">Equities</span>
        <span className="text-right">Advisory</span>
        <span className="text-right">Undwrt</span>
        <span className="text-right">Mkt Shr</span>
      </div>

      {banks.map((bank) => (
        <div
          key={bank.ticker}
          className="grid grid-cols-[1fr_48px_48px_50px_52px_50px] gap-px px-2 py-0.5 border-b border-border/[0.06] hover:bg-blue-400/[0.02] transition-colors"
        >
          <div className="flex items-center gap-1 overflow-hidden">
            <span className="text-[8px] font-mono font-bold text-white truncate">{bank.name}</span>
            <span className="text-[7px] font-mono text-neutral-600 shrink-0">{bank.ticker}</span>
          </div>
          <span className="text-[8px] font-mono text-blue-400 font-bold text-right">{fmtB(bank.ficcRevenue)}</span>
          <span className="text-[8px] font-mono text-blue-400/80 font-bold text-right">{fmtB(bank.equitiesRevenue)}</span>
          <span className="text-[8px] font-mono text-white text-right">{fmtB(bank.advisoryRevenue)}</span>
          <span className="text-[8px] font-mono text-white text-right">{fmtB(bank.underwritingRevenue)}</span>
          <span className="text-[8px] font-mono text-amber-400 font-bold text-right">{fmtPct(bank.marketShare, 1)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Section: Credit Tab ──

function CreditTab({ banks }: { banks: BankCreditEntry[] }) {
  return (
    <div>
      <div className="grid grid-cols-[1fr_55px_50px_55px_55px] gap-px px-2 py-0.5 border-b border-border/10 text-[7px] font-mono text-neutral-600 uppercase tracking-wider">
        <span>Bank</span>
        <span className="text-right">Provisn</span>
        <span className="text-right">NPL</span>
        <span className="text-right">Loan Gr</span>
        <span className="text-right">Dep Gr</span>
      </div>

      {banks.map((bank) => (
        <div
          key={bank.ticker}
          className="grid grid-cols-[1fr_55px_50px_55px_55px] gap-px px-2 py-0.5 border-b border-border/[0.06] hover:bg-blue-400/[0.02] transition-colors"
        >
          <div className="flex items-center gap-1 overflow-hidden">
            <span className="text-[8px] font-mono font-bold text-white truncate">{bank.name}</span>
            <span className="text-[7px] font-mono text-neutral-600 shrink-0">{bank.ticker}</span>
          </div>
          <span className="text-[8px] font-mono text-amber-400 text-right">{fmtB(bank.provisions)}</span>
          <span className={`text-[8px] font-mono font-bold text-right ${nplColor(bank.nplRatio)}`}>
            {fmtPct(bank.nplRatio)}
          </span>
          <span className={`text-[8px] font-mono font-bold text-right ${growthColor(bank.loanGrowth)}`}>
            {(bank.loanGrowth >= 0 ? '+' : '') + fmtPct(bank.loanGrowth, 1)}
          </span>
          <span className={`text-[8px] font-mono font-bold text-right ${growthColor(bank.depositGrowth)}`}>
            {(bank.depositGrowth >= 0 ? '+' : '') + fmtPct(bank.depositGrowth, 1)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Sparkline helper (inline SVG) ──

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return <span className="text-[7px] text-neutral-600">-</span>;

  const w = 48;
  const h = 14;
  const pad = 1;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - 2 * pad);
    const y = pad + (1 - (v - min) / range) * (h - 2 * pad);
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="inline-block">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Section: Trends Tab ──

function TrendsTab({ banks }: { banks: BankTrendEntry[] }) {
  return (
    <div>
      {/* NIM Trend */}
      <div className="border-b border-border/20">
        <div className="px-3 py-1 border-b border-border/10">
          <span className="text-[8px] font-black font-mono uppercase tracking-wider text-neutral-500">
            NIM Trend (Last 4Q)
          </span>
        </div>
        <div className="grid grid-cols-[1fr_55px_80px_50px] gap-px px-2 py-0.5 border-b border-border/10 text-[7px] font-mono text-neutral-600 uppercase tracking-wider">
          <span>Bank</span>
          <span className="text-right">Current</span>
          <span className="text-center">Trend</span>
          <span className="text-right">Chg</span>
        </div>
        {banks.filter(b => b.nimTrend.some(t => t.value > 0)).map((bank) => (
          <div
            key={bank.ticker}
            className="grid grid-cols-[1fr_55px_80px_50px] gap-px px-2 py-0.5 border-b border-border/[0.06] hover:bg-blue-400/[0.02] transition-colors items-center"
          >
            <div className="flex items-center gap-1 overflow-hidden">
              <span className="text-[8px] font-mono font-bold text-white truncate">{bank.name}</span>
              <span className="text-[7px] font-mono text-neutral-600 shrink-0">{bank.ticker}</span>
            </div>
            <span className="text-[8px] font-mono text-white text-right">
              {fmtPct(bank.nimTrend[bank.nimTrend.length - 1].value)}
            </span>
            <div className="flex justify-center">
              <Sparkline
                values={bank.nimTrend.map(t => t.value)}
                color={nimTrendColor(bank.nimTrend) === 'text-green-400' ? '#4ade80' : nimTrendColor(bank.nimTrend) === 'text-red-400' ? '#f87171' : '#525252'}
              />
            </div>
            <span className={`text-[8px] font-mono font-bold text-right ${nimTrendColor(bank.nimTrend)}`}>
              {fmtTrendDirection(bank.nimTrend)}
            </span>
          </div>
        ))}
      </div>

      {/* Provision Trend */}
      <div className="border-b border-border/20">
        <div className="px-3 py-1 border-b border-border/10">
          <span className="text-[8px] font-black font-mono uppercase tracking-wider text-neutral-500">
            Provision Trend (Last 4Q)
          </span>
        </div>
        <div className="grid grid-cols-[1fr_55px_80px_50px] gap-px px-2 py-0.5 border-b border-border/10 text-[7px] font-mono text-neutral-600 uppercase tracking-wider">
          <span>Bank</span>
          <span className="text-right">Current</span>
          <span className="text-center">Trend</span>
          <span className="text-right">Chg</span>
        </div>
        {banks.map((bank) => (
          <div
            key={bank.ticker}
            className="grid grid-cols-[1fr_55px_80px_50px] gap-px px-2 py-0.5 border-b border-border/[0.06] hover:bg-blue-400/[0.02] transition-colors items-center"
          >
            <div className="flex items-center gap-1 overflow-hidden">
              <span className="text-[8px] font-mono font-bold text-white truncate">{bank.name}</span>
              <span className="text-[7px] font-mono text-neutral-600 shrink-0">{bank.ticker}</span>
            </div>
            <span className="text-[8px] font-mono text-amber-400 text-right">
              {fmtB(bank.provisionTrend[bank.provisionTrend.length - 1].value)}
            </span>
            <div className="flex justify-center">
              <Sparkline
                values={bank.provisionTrend.map(t => t.value)}
                color={provisionTrendColor(bank.provisionTrend) === 'text-green-400' ? '#4ade80' : provisionTrendColor(bank.provisionTrend) === 'text-red-400' ? '#f87171' : '#fbbf24'}
              />
            </div>
            <span className={`text-[8px] font-mono font-bold text-right ${provisionTrendColor(bank.provisionTrend)}`}>
              {fmtTrendDirection(bank.provisionTrend)}
            </span>
          </div>
        ))}
      </div>

      {/* Trading Revenue Trend */}
      <div className="border-b border-border/20">
        <div className="px-3 py-1 border-b border-border/10">
          <span className="text-[8px] font-black font-mono uppercase tracking-wider text-neutral-500">
            Trading Revenue Trend (Last 4Q)
          </span>
        </div>
        <div className="grid grid-cols-[1fr_55px_80px_50px] gap-px px-2 py-0.5 border-b border-border/10 text-[7px] font-mono text-neutral-600 uppercase tracking-wider">
          <span>Bank</span>
          <span className="text-right">Current</span>
          <span className="text-center">Trend</span>
          <span className="text-right">Chg</span>
        </div>
        {banks.map((bank) => (
          <div
            key={bank.ticker}
            className="grid grid-cols-[1fr_55px_80px_50px] gap-px px-2 py-0.5 border-b border-border/[0.06] hover:bg-blue-400/[0.02] transition-colors items-center"
          >
            <div className="flex items-center gap-1 overflow-hidden">
              <span className="text-[8px] font-mono font-bold text-white truncate">{bank.name}</span>
              <span className="text-[7px] font-mono text-neutral-600 shrink-0">{bank.ticker}</span>
            </div>
            <span className="text-[8px] font-mono text-blue-400 font-bold text-right">
              {fmtB(bank.tradingRevenueTrend[bank.tradingRevenueTrend.length - 1].value)}
            </span>
            <div className="flex justify-center">
              <Sparkline
                values={bank.tradingRevenueTrend.map(t => t.value)}
                color={tradingTrendColor(bank.tradingRevenueTrend) === 'text-green-400' ? '#4ade80' : tradingTrendColor(bank.tradingRevenueTrend) === 'text-red-400' ? '#f87171' : '#525252'}
              />
            </div>
            <span className={`text-[8px] font-mono font-bold text-right ${tradingTrendColor(bank.tradingRevenueTrend)}`}>
              {fmtTrendDirection(bank.tradingRevenueTrend)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Panel ──

export function BankEarningsPanel() {
  const { data: rawData, isLoading, refetch } = useBankEarnings();
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const data = rawData as BankEarningsData | undefined;

  const beatCount = (data?.overview ?? []).filter(b => b.beat).length;
  const totalCount = data?.overview?.length ?? 0;

  return (
    <div className="h-full flex flex-col bg-black overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#050505] border-b border-border/30 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-blue-400" />
          <span className="text-[9px] font-black font-mono uppercase tracking-tighter text-blue-400">
            Bank Earnings Monitor
          </span>
        </div>
        <div className="flex items-center gap-2">
          {totalCount > 0 && <span className={`px-1.5 py-0.5 text-[7px] font-black font-mono uppercase tracking-wider border ${
            beatCount / totalCount >= 0.7
              ? 'text-green-400 bg-green-500/10 border-green-500/30'
              : beatCount / totalCount >= 0.5
                ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
                : 'text-red-400 bg-red-500/10 border-red-500/30'
          }`}>
            {beatCount}/{totalCount} Beat
          </span>}
          <button
            onClick={() => refetch()}
            className="p-1 text-neutral-500 hover:text-blue-400 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tab selector */}
      <div className="flex border-b border-border/20 shrink-0">
        <div className="flex gap-px px-2 py-1 flex-1">
          {(['overview', 'capital', 'trading', 'credit', 'trends'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-2 py-0.5 text-[7px] font-black font-mono uppercase tracking-wider transition-colors ${
                activeTab === tab
                  ? 'text-blue-400 border-b border-blue-400'
                  : 'text-neutral-600 hover:text-neutral-400'
              }`}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>
        <div className="px-2 py-1 text-[7px] font-mono text-neutral-600">
          {data?.timestamp ? new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto no-scrollbar">
        {isLoading && !rawData && (
          <div className="text-center py-8 text-blue-400 text-[9px] font-mono uppercase animate-pulse">
            Loading...
          </div>
        )}

        {!isLoading && !data && (
          <div className="text-center py-8 text-neutral-500 text-[9px] font-mono uppercase">
            No data available
          </div>
        )}

        {data && (
          <>
            {activeTab === 'overview' && <OverviewTab banks={data.overview ?? []} />}
            {activeTab === 'capital' && <CapitalTab banks={data.capital ?? []} />}
            {activeTab === 'trading' && <TradingTab banks={data.trading ?? []} />}
            {activeTab === 'credit' && <CreditTab banks={data.credit ?? []} />}
            {activeTab === 'trends' && <TrendsTab banks={data.trends ?? []} />}
          </>
        )}
      </div>
    </div>
  );
}
