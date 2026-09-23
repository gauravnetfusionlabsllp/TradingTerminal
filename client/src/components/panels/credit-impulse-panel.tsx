import { useMemo } from 'react';
import { useCreditImpulse } from '../../api/hooks/use-credit-impulse';
import { useT, tr, TFn } from '../../i18n';
import { RefreshCw } from 'lucide-react';

// ── Types ──

interface CountryImpulse {
  country: string;
  code: string;
  impulse: number;
  impulsePrev: number;
  direction: 'expanding' | 'contracting' | 'neutral';
  creditGrowthYoY: number;
  privateDebtGdp: number;
}

interface BankLendingSurvey {
  region: string;
  demandIndex: number;
  standardsIndex: number;
  direction: 'loosening' | 'tightening' | 'neutral';
  quarter: string;
}

interface MoneySupply {
  region: string;
  m2YoY: number;
  m2Level: string;
  m1YoY: number;
  trend: 'expanding' | 'contracting' | 'neutral';
}

interface FinancialCondition {
  index: string;
  value: number;
  change1w: number;
  change1m: number;
  regime: 'loose' | 'tight' | 'neutral';
}

interface CreditGrowth {
  sector: string;
  yoyGrowth: number;
  momGrowth: number;
  outstanding: string;
  trend: 'accelerating' | 'decelerating' | 'stable';
}

interface SeniorLoanOfficer {
  category: string;
  tighteningPct: number;
  demandPct: number;
  delinquencyTrend: 'rising' | 'falling' | 'stable';
  quarter: string;
}

interface CreditImpulseData {
  countries: CountryImpulse[];
  bankLending: BankLendingSurvey[];
  moneySupply: MoneySupply[];
  financialConditions: FinancialCondition[];
  creditGrowth: CreditGrowth[];
  seniorLoanOfficer: SeniorLoanOfficer[];
  timestamp: string;
  globalImpulse: number;
  globalDirection: 'expanding' | 'contracting' | 'neutral';
}

// ── Format helpers ──

function fmtImpulse(n: number): string {
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
}

function fmtPct(n: number): string {
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
}

function fmtChange(n: number): string {
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}`;
}

function fmtNet(n: number): string {
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}`;
}

// ── Color helpers ──

function directionColor(dir: string): string {
  if (dir === 'expanding' || dir === 'loosening' || dir === 'accelerating' || dir === 'loose') return 'text-green-400';
  if (dir === 'contracting' || dir === 'tightening' || dir === 'decelerating' || dir === 'tight') return 'text-red-400';
  return 'text-amber-400';
}

function directionBg(dir: string): string {
  if (dir === 'expanding' || dir === 'loosening' || dir === 'accelerating' || dir === 'loose')
    return 'bg-green-500/10 border border-green-500/30';
  if (dir === 'contracting' || dir === 'tightening' || dir === 'decelerating' || dir === 'tight')
    return 'bg-red-500/10 border border-red-500/30';
  return 'bg-amber-500/10 border border-amber-500/30';
}

function impulseColor(n: number): string {
  if (n > 0.5) return 'text-green-400';
  if (n < -0.5) return 'text-red-400';
  return 'text-amber-400';
}

function impulseBgColor(n: number): string {
  if (n > 0.5) return 'bg-green-500/10';
  if (n < -0.5) return 'bg-red-500/10';
  return 'bg-amber-500/10';
}

function delinquencyColor(trend: string): string {
  if (trend === 'falling') return 'text-green-400';
  if (trend === 'rising') return 'text-red-400';
  return 'text-amber-400';
}

function growthColor(n: number): string {
  if (n > 3) return 'text-green-400';
  if (n > 0) return 'text-green-400/70';
  if (n < -1) return 'text-red-400';
  if (n < 0) return 'text-red-400/70';
  return 'text-amber-400';
}

// ── Impulse momentum arrow ──

function MomentumArrow({ current, prev }: { current: number; prev: number }) {
  const delta = current - prev;
  if (Math.abs(delta) < 0.1) return <span className="text-[6px] text-amber-400">→</span>;
  if (delta > 0) return <span className="text-[6px] text-green-400">↑</span>;
  return <span className="text-[6px] text-red-400">↓</span>;
}

// ── Mini bar chart for impulse magnitude ──

function ImpulseBar({ value, maxAbs }: { value: number; maxAbs: number }) {
  const pct = maxAbs > 0 ? Math.min(Math.abs(value) / maxAbs * 100, 100) : 0;
  const color = value > 0.5 ? 'bg-green-400/40' : value < -0.5 ? 'bg-red-400/40' : 'bg-amber-400/40';

  return (
    <div className="w-full h-1.5 bg-white/[0.03] relative overflow-hidden">
      <div
        className={`absolute top-0 h-full ${color}`}
        style={{
          width: `${pct}%`,
          left: value >= 0 ? 0 : undefined,
          right: value < 0 ? 0 : undefined,
        }}
      />
    </div>
  );
}

// ── Section: Credit Impulse by Country ──

function CreditImpulseSection({
  countries,
  globalImpulse,
  globalDirection,
  t,
}: {
  countries: CountryImpulse[];
  globalImpulse?: number;
  globalDirection?: string;
  t: ReturnType<typeof useT>;
}) {
  const maxAbs = useMemo(() => Math.max(...countries.map((c) => Math.abs(c.impulse)), 1), [countries]);

  return (
    <div className="border-b border-border/20">
      <div className="px-3 py-1 border-b border-border/10 flex items-center justify-between">
        <span className="text-[8px] font-black font-mono uppercase tracking-wider text-neutral-500">
          {tr(t, 'ciCreditImpulse', 'Credit Impulse by Country')}
        </span>
        {globalImpulse != null && globalDirection && <div className="flex items-center gap-1.5">
          <span className="text-[7px] font-mono text-neutral-600">GLOBAL:</span>
          <span className={`text-[8px] font-mono font-bold ${impulseColor(globalImpulse)}`}>
            {fmtImpulse(globalImpulse)}
          </span>
          <span className={`text-[6px] font-mono font-black uppercase px-1 py-px ${directionBg(globalDirection)} ${directionColor(globalDirection)}`}>
            {globalDirection.toUpperCase()}
          </span>
        </div>}
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_52px_52px_32px_52px_48px_1fr] gap-px px-2 py-0.5 border-b border-border/10">
        <span className="text-[6px] font-mono text-neutral-600 uppercase tracking-wider">COUNTRY</span>
        <span className="text-[6px] font-mono text-neutral-600 uppercase tracking-wider text-right">IMPULSE</span>
        <span className="text-[6px] font-mono text-neutral-600 uppercase tracking-wider text-right">PREV</span>
        <span className="text-[6px] font-mono text-neutral-600 uppercase tracking-wider text-center">MOM</span>
        <span className="text-[6px] font-mono text-neutral-600 uppercase tracking-wider text-right">CR GR%</span>
        <span className="text-[6px] font-mono text-neutral-600 uppercase tracking-wider text-right">DEBT/GDP</span>
        <span className="text-[6px] font-mono text-neutral-600 uppercase tracking-wider text-right">MAGNITUDE</span>
      </div>

      {countries.map((c) => (
        <div
          key={c.code}
          className="grid grid-cols-[1fr_52px_52px_32px_52px_48px_1fr] gap-px px-2 py-0.5 border-b border-border/5 hover:bg-purple-400/[0.02] transition-colors"
        >
          <div className="flex items-center gap-1">
            <span className="text-[7px] font-mono font-bold text-neutral-400">{c.code}</span>
            <span className="text-[7px] font-mono text-neutral-600 truncate">{c.country}</span>
          </div>
          <span className={`text-[8px] font-mono font-bold text-right ${impulseColor(c.impulse)}`}>
            {fmtImpulse(c.impulse)}
          </span>
          <span className="text-[7px] font-mono text-neutral-600 text-right">
            {fmtImpulse(c.impulsePrev)}
          </span>
          <div className="flex justify-center">
            <MomentumArrow current={c.impulse} prev={c.impulsePrev} />
          </div>
          <span className={`text-[7px] font-mono text-right ${growthColor(c.creditGrowthYoY)}`}>
            {fmtPct(c.creditGrowthYoY)}
          </span>
          <span className="text-[7px] font-mono text-neutral-500 text-right">
            {c.privateDebtGdp.toFixed(0)}%
          </span>
          <div className="flex items-center px-1">
            <ImpulseBar value={c.impulse} maxAbs={maxAbs} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Section: Bank Lending Survey ──

function BankLendingSection({
  surveys,
  t,
}: {
  surveys: BankLendingSurvey[];
  t: ReturnType<typeof useT>;
}) {
  return (
    <div className="border-b border-border/20">
      <div className="px-3 py-1 border-b border-border/10">
        <span className="text-[8px] font-black font-mono uppercase tracking-wider text-neutral-500">
          {tr(t, 'ciBankLending', 'Bank Lending Survey')}
        </span>
      </div>

      <div className="grid grid-cols-[1fr_60px_60px_56px_52px] gap-px px-2 py-0.5 border-b border-border/10">
        <span className="text-[6px] font-mono text-neutral-600 uppercase tracking-wider">REGION</span>
        <span className="text-[6px] font-mono text-neutral-600 uppercase tracking-wider text-right">DEMAND</span>
        <span className="text-[6px] font-mono text-neutral-600 uppercase tracking-wider text-right">STANDARDS</span>
        <span className="text-[6px] font-mono text-neutral-600 uppercase tracking-wider text-right">DIRECTION</span>
        <span className="text-[6px] font-mono text-neutral-600 uppercase tracking-wider text-right">QUARTER</span>
      </div>

      {surveys.map((s) => (
        <div
          key={s.region}
          className="grid grid-cols-[1fr_60px_60px_56px_52px] gap-px px-2 py-0.5 border-b border-border/5 hover:bg-purple-400/[0.02] transition-colors"
        >
          <span className="text-[7px] font-mono font-bold text-neutral-400 truncate">{s.region}</span>
          <span className={`text-[7px] font-mono font-bold text-right ${s.demandIndex >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {fmtNet(s.demandIndex)}
          </span>
          <span className={`text-[7px] font-mono font-bold text-right ${s.standardsIndex <= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {fmtNet(s.standardsIndex)}
          </span>
          <div className="flex justify-end">
            <span className={`text-[6px] font-mono font-black uppercase px-1 py-px ${directionBg(s.direction)} ${directionColor(s.direction)}`}>
              {s.direction === 'loosening' ? 'LOOSE' : 'TIGHT'}
            </span>
          </div>
          <span className="text-[7px] font-mono text-neutral-600 text-right">{s.quarter}</span>
        </div>
      ))}
    </div>
  );
}

// ── Section: Money Supply ──

function MoneySupplySection({
  data,
  t,
}: {
  data: MoneySupply[];
  t: ReturnType<typeof useT>;
}) {
  return (
    <div className="border-b border-border/20">
      <div className="px-3 py-1 border-b border-border/10">
        <span className="text-[8px] font-black font-mono uppercase tracking-wider text-neutral-500">
          {tr(t, 'ciMoneySupply', 'Money Supply')}
        </span>
      </div>

      <div className="grid grid-cols-[1fr_60px_72px_52px_56px] gap-px px-2 py-0.5 border-b border-border/10">
        <span className="text-[6px] font-mono text-neutral-600 uppercase tracking-wider">REGION</span>
        <span className="text-[6px] font-mono text-neutral-600 uppercase tracking-wider text-right">M2 YOY</span>
        <span className="text-[6px] font-mono text-neutral-600 uppercase tracking-wider text-right">M2 LEVEL</span>
        <span className="text-[6px] font-mono text-neutral-600 uppercase tracking-wider text-right">M1 YOY</span>
        <span className="text-[6px] font-mono text-neutral-600 uppercase tracking-wider text-right">TREND</span>
      </div>

      {data.map((m) => (
        <div
          key={m.region}
          className="grid grid-cols-[1fr_60px_72px_52px_56px] gap-px px-2 py-0.5 border-b border-border/5 hover:bg-purple-400/[0.02] transition-colors"
        >
          <span className="text-[7px] font-mono font-bold text-neutral-400 truncate">{m.region}</span>
          <span className={`text-[7px] font-mono font-bold text-right ${growthColor(m.m2YoY)}`}>
            {fmtPct(m.m2YoY)}
          </span>
          <span className="text-[7px] font-mono text-neutral-500 text-right">{m.m2Level}</span>
          <span className={`text-[7px] font-mono font-bold text-right ${growthColor(m.m1YoY)}`}>
            {fmtPct(m.m1YoY)}
          </span>
          <div className="flex justify-end">
            <span className={`text-[6px] font-mono font-black uppercase px-1 py-px ${directionBg(m.trend)} ${directionColor(m.trend)}`}>
              {m.trend === 'expanding' ? 'EXPAND' : m.trend === 'contracting' ? 'CONTR' : 'FLAT'}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Section: Financial Conditions ──

function FinancialConditionsSection({
  conditions,
  t,
}: {
  conditions: FinancialCondition[];
  t: ReturnType<typeof useT>;
}) {
  return (
    <div className="border-b border-border/20">
      <div className="px-3 py-1 border-b border-border/10">
        <span className="text-[8px] font-black font-mono uppercase tracking-wider text-neutral-500">
          {tr(t, 'ciFinancialConditions', 'Financial Conditions')}
        </span>
      </div>

      <div className="grid grid-cols-[1fr_52px_52px_52px_52px] gap-px px-2 py-0.5 border-b border-border/10">
        <span className="text-[6px] font-mono text-neutral-600 uppercase tracking-wider">INDEX</span>
        <span className="text-[6px] font-mono text-neutral-600 uppercase tracking-wider text-right">VALUE</span>
        <span className="text-[6px] font-mono text-neutral-600 uppercase tracking-wider text-right">1W CHG</span>
        <span className="text-[6px] font-mono text-neutral-600 uppercase tracking-wider text-right">1M CHG</span>
        <span className="text-[6px] font-mono text-neutral-600 uppercase tracking-wider text-right">REGIME</span>
      </div>

      {conditions.map((c) => (
        <div
          key={c.index}
          className="grid grid-cols-[1fr_52px_52px_52px_52px] gap-px px-2 py-0.5 border-b border-border/5 hover:bg-purple-400/[0.02] transition-colors"
        >
          <span className="text-[7px] font-mono font-bold text-neutral-400 truncate">{c.index}</span>
          <span className="text-[8px] font-mono font-bold text-white text-right">
            {c.value.toFixed(2)}
          </span>
          <span className={`text-[7px] font-mono font-bold text-right ${c.change1w <= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {fmtChange(c.change1w)}
          </span>
          <span className={`text-[7px] font-mono font-bold text-right ${c.change1m <= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {fmtChange(c.change1m)}
          </span>
          <div className="flex justify-end">
            <span className={`text-[6px] font-mono font-black uppercase px-1 py-px ${directionBg(c.regime)} ${directionColor(c.regime)}`}>
              {c.regime.toUpperCase()}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Section: Credit Growth ──

function CreditGrowthSection({
  data,
  t,
}: {
  data: CreditGrowth[];
  t: ReturnType<typeof useT>;
}) {
  return (
    <div className="border-b border-border/20">
      <div className="px-3 py-1 border-b border-border/10">
        <span className="text-[8px] font-black font-mono uppercase tracking-wider text-neutral-500">
          {tr(t, 'ciCreditGrowth', 'Credit Growth by Sector')}
        </span>
      </div>

      <div className="grid grid-cols-[1fr_52px_52px_64px_56px] gap-px px-2 py-0.5 border-b border-border/10">
        <span className="text-[6px] font-mono text-neutral-600 uppercase tracking-wider">SECTOR</span>
        <span className="text-[6px] font-mono text-neutral-600 uppercase tracking-wider text-right">YOY%</span>
        <span className="text-[6px] font-mono text-neutral-600 uppercase tracking-wider text-right">MOM%</span>
        <span className="text-[6px] font-mono text-neutral-600 uppercase tracking-wider text-right">OUTSTAND.</span>
        <span className="text-[6px] font-mono text-neutral-600 uppercase tracking-wider text-right">TREND</span>
      </div>

      {data.map((c) => (
        <div
          key={c.sector}
          className="grid grid-cols-[1fr_52px_52px_64px_56px] gap-px px-2 py-0.5 border-b border-border/5 hover:bg-purple-400/[0.02] transition-colors"
        >
          <span className="text-[7px] font-mono font-bold text-neutral-400 truncate">{c.sector}</span>
          <span className={`text-[8px] font-mono font-bold text-right ${growthColor(c.yoyGrowth)}`}>
            {fmtPct(c.yoyGrowth)}
          </span>
          <span className={`text-[7px] font-mono font-bold text-right ${growthColor(c.momGrowth)}`}>
            {fmtPct(c.momGrowth)}
          </span>
          <span className="text-[7px] font-mono text-neutral-500 text-right">{c.outstanding}</span>
          <div className="flex justify-end">
            <span className={`text-[6px] font-mono font-black uppercase px-1 py-px ${directionBg(c.trend)} ${directionColor(c.trend)}`}>
              {c.trend === 'accelerating' ? 'ACCEL' : c.trend === 'decelerating' ? 'DECEL' : 'STABLE'}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Section: Senior Loan Officer Survey ──

function SeniorLoanOfficerSection({
  data,
  t,
}: {
  data: SeniorLoanOfficer[];
  t: ReturnType<typeof useT>;
}) {
  return (
    <div className="border-b border-border/20">
      <div className="px-3 py-1 border-b border-border/10">
        <span className="text-[8px] font-black font-mono uppercase tracking-wider text-neutral-500">
          {tr(t, 'ciSLOS', 'Senior Loan Officer Survey')}
        </span>
      </div>

      <div className="grid grid-cols-[1fr_60px_52px_56px_48px] gap-px px-2 py-0.5 border-b border-border/10">
        <span className="text-[6px] font-mono text-neutral-600 uppercase tracking-wider">CATEGORY</span>
        <span className="text-[6px] font-mono text-neutral-600 uppercase tracking-wider text-right">TIGHT %</span>
        <span className="text-[6px] font-mono text-neutral-600 uppercase tracking-wider text-right">DEMAND</span>
        <span className="text-[6px] font-mono text-neutral-600 uppercase tracking-wider text-right">DELINQ.</span>
        <span className="text-[6px] font-mono text-neutral-600 uppercase tracking-wider text-right">QTR</span>
      </div>

      {data.map((s) => (
        <div
          key={s.category}
          className="grid grid-cols-[1fr_60px_52px_56px_48px] gap-px px-2 py-0.5 border-b border-border/5 hover:bg-purple-400/[0.02] transition-colors"
        >
          <span className="text-[7px] font-mono font-bold text-neutral-400 truncate">{s.category}</span>
          <span className={`text-[7px] font-mono font-bold text-right ${s.tighteningPct > 0 ? 'text-red-400' : 'text-green-400'}`}>
            {fmtNet(s.tighteningPct)}%
          </span>
          <span className={`text-[7px] font-mono font-bold text-right ${s.demandPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {fmtNet(s.demandPct)}
          </span>
          <div className="flex justify-end">
            <span className={`text-[6px] font-mono font-black uppercase px-1 py-px ${
              s.delinquencyTrend === 'falling'
                ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                : s.delinquencyTrend === 'rising'
                  ? 'bg-red-500/10 border border-red-500/30 text-red-400'
                  : 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
            }`}>
              {s.delinquencyTrend === 'falling' ? 'FALL' : s.delinquencyTrend === 'rising' ? 'RISE' : 'STBL'}
            </span>
          </div>
          <span className="text-[7px] font-mono text-neutral-600 text-right">{s.quarter}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main Panel ──

export function CreditImpulsePanel() {
  const t = useT();
  const { data: hookData, isLoading, refetch } = useCreditImpulse();

  const data = hookData as CreditImpulseData | undefined;

  return (
    <div className="h-full flex flex-col bg-black overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#050505] border-b border-border/30 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-purple-400" />
          <span className="text-[9px] font-black font-mono uppercase tracking-tighter text-purple-400">
            {tr(t, 'ciTitle', 'Credit Impulse Monitor')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {data?.globalDirection && <span className={`px-1.5 py-0.5 text-[7px] font-black font-mono uppercase tracking-wider ${directionColor(data.globalDirection)} ${directionBg(data.globalDirection)}`}>
            {data.globalDirection === 'expanding'
              ? tr(t, 'ciExpanding', 'Expanding')
              : data.globalDirection === 'contracting'
                ? tr(t, 'ciContracting', 'Contracting')
                : tr(t, 'ciNeutral', 'Neutral')}
          </span>}
          {data?.globalImpulse != null && <span className={`text-[8px] font-mono font-bold ${impulseColor(data.globalImpulse)}`}>
            {fmtImpulse(data.globalImpulse)}
          </span>}
          <button
            onClick={() => refetch()}
            className="p-1 text-neutral-500 hover:text-purple-400 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto no-scrollbar">
        {isLoading && !hookData && (
          <div className="text-center py-8 text-amber-400 text-[9px] font-mono uppercase animate-pulse">
            {tr(t, 'loading', 'Loading...')}
          </div>
        )}

        {!hookData && !isLoading && (
          <div className="text-center py-8 text-neutral-500 text-[9px] font-mono uppercase">
            {tr(t, 'ciNoData', 'No data available')}
          </div>
        )}

        {data && (<>
        <CreditImpulseSection
          countries={data.countries ?? []}
          globalImpulse={data.globalImpulse}
          globalDirection={data.globalDirection}
          t={t}
        />
        <BankLendingSection surveys={data.bankLending ?? []} t={t} />
        <MoneySupplySection data={data.moneySupply ?? []} t={t} />
        <FinancialConditionsSection conditions={data.financialConditions ?? []} t={t} />
        <CreditGrowthSection data={data.creditGrowth ?? []} t={t} />
        <SeniorLoanOfficerSection data={data.seniorLoanOfficer ?? []} t={t} />

        {/* Footer timestamp */}
        <div className="px-3 py-1.5 border-t border-border/10">
          <span className="text-[7px] font-mono text-neutral-700">
            {tr(t, 'ciLastUpdate', 'Last update')}: {data.timestamp ? new Date(data.timestamp).toLocaleTimeString() : '--'}
          </span>
        </div>
        </>)}
      </div>
    </div>
  );
}
