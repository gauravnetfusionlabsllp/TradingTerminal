import { useDemographicTrends } from '../../api/hooks/use-demographic-trends';
import { useT, tr, TFn } from '../../i18n';
import { RefreshCw } from 'lucide-react';

// ── Types ──

interface CountryDemographic {
  name: string;
  population: number;
  growthRate: number;
  medianAge: number;
  fertilityRate: number;
  lifeExpectancy: number;
  urbanization: number;
  dependencyRatio: number;
  workingAgePct: number;
}

interface LaborForceEntry {
  country: string;
  laborForce: number;
  participationRate: number;
  unemployment: number;
}

interface ProjectionEntry {
  country: string;
  pop2025: number;
  pop2030: number;
  pop2050: number;
}

interface UrbanizationTrend {
  country: string;
  urbanization: number;
  urbanGrowthRate: number;
}

interface GlobalSummary {
  worldPopulation: number;
  avgGrowthRate: number;
  avgMedianAge: number;
  avgUrbanization: number;
}

interface DemographicTrendsData {
  timestamp: string;
  summary: GlobalSummary;
  countries: CountryDemographic[];
  laborForce: LaborForceEntry[];
  projections: ProjectionEntry[];
  urbanizationTrends: UrbanizationTrend[];
}

// ── Formatting Helpers ──

function fmtPop(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(2) + 'B';
  return n.toFixed(0) + 'M';
}

function fmtPct(n: number): string {
  return n.toFixed(1) + '%';
}

function fmtSigned(n: number, decimals = 2): string {
  const sign = n >= 0 ? '+' : '';
  return sign + n.toFixed(decimals) + '%';
}

function fmtLabor(n: number): string {
  return n.toFixed(0) + 'M';
}

// ── Color Helpers ──

function growthRateColor(v: number): string {
  if (v > 0) return 'text-green-400';
  if (v < 0) return 'text-red-400';
  return 'text-neutral-500';
}

function unemploymentColor(v: number): string {
  if (v > 20) return 'text-red-400';
  if (v > 10) return 'text-red-400/80';
  if (v > 6) return 'text-amber-400';
  return 'text-green-400';
}

function unemploymentBg(v: number): string {
  if (v > 20) return 'bg-red-500/20';
  if (v > 10) return 'bg-red-500/12';
  if (v > 6) return 'bg-red-500/8';
  return 'bg-red-500/[0.03]';
}

function projectionGrowthColor(current: number, projected: number): string {
  if (projected > current) return 'text-green-400';
  if (projected < current) return 'text-red-400';
  return 'text-neutral-500';
}

// ── Section Header ──

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 border-b border-border/15">
      <div className="w-1 h-1 shrink-0 bg-indigo-400" />
      <span className="text-[7px] font-black font-mono uppercase tracking-widest text-indigo-400">
        {title}
      </span>
    </div>
  );
}

// ── Global Summary Bar ──

function GlobalSummaryBar({ summary }: { summary: GlobalSummary }) {
  return (
    <div className="border-b border-border/20">
      <div className="grid grid-cols-4 gap-px bg-border/5">
        <div className="px-2 py-1.5 bg-black">
          <div className="text-[7px] font-mono text-neutral-500 uppercase tracking-wider">
            WORLD POP
          </div>
          <div className="text-[14px] font-mono font-black tabular-nums text-indigo-400">
            {summary.worldPopulation.toFixed(2)}B
          </div>
        </div>
        <div className="px-2 py-1.5 bg-black">
          <div className="text-[7px] font-mono text-neutral-500 uppercase tracking-wider">
            AVG GROWTH
          </div>
          <div className={`text-[14px] font-mono font-black tabular-nums ${growthRateColor(summary.avgGrowthRate)}`}>
            {fmtSigned(summary.avgGrowthRate)}
          </div>
        </div>
        <div className="px-2 py-1.5 bg-black">
          <div className="text-[7px] font-mono text-neutral-500 uppercase tracking-wider">
            AVG MED AGE
          </div>
          <div className="text-[14px] font-mono font-black tabular-nums text-amber-400">
            {summary.avgMedianAge.toFixed(1)}
          </div>
        </div>
        <div className="px-2 py-1.5 bg-black">
          <div className="text-[7px] font-mono text-neutral-500 uppercase tracking-wider">
            URBANIZATION
          </div>
          <div className="text-[14px] font-mono font-black tabular-nums text-cyan-400">
            {fmtPct(summary.avgUrbanization)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Country Table ──

function CountryTable({ countries, t }: { countries: CountryDemographic[]; t: ReturnType<typeof useT> }) {
  return (
    <div className="border-b border-border/20">
      <SectionHeader title={tr(t, 'demCountryOverview', 'Country Demographics')} />
      <div className="overflow-auto">
        <table className="w-full min-w-[720px]">
          <thead>
            <tr className="border-b border-border/15">
              <th className="text-left text-[7px] font-mono font-bold text-neutral-500 uppercase tracking-wider px-2 py-1">COUNTRY</th>
              <th className="text-right text-[7px] font-mono font-bold text-neutral-500 uppercase tracking-wider px-2 py-1">POP</th>
              <th className="text-right text-[7px] font-mono font-bold text-neutral-500 uppercase tracking-wider px-2 py-1">GROWTH</th>
              <th className="text-right text-[7px] font-mono font-bold text-neutral-500 uppercase tracking-wider px-2 py-1">MED AGE</th>
              <th className="text-right text-[7px] font-mono font-bold text-neutral-500 uppercase tracking-wider px-2 py-1">FERT</th>
              <th className="text-right text-[7px] font-mono font-bold text-neutral-500 uppercase tracking-wider px-2 py-1">LIFE EXP</th>
              <th className="text-right text-[7px] font-mono font-bold text-neutral-500 uppercase tracking-wider px-2 py-1">URBAN%</th>
              <th className="text-right text-[7px] font-mono font-bold text-neutral-500 uppercase tracking-wider px-2 py-1">DEP RATIO</th>
              <th className="text-right text-[7px] font-mono font-bold text-neutral-500 uppercase tracking-wider px-2 py-1">WORK AGE%</th>
            </tr>
          </thead>
          <tbody>
            {countries.map((c) => (
              <tr key={c.name} className="border-b border-border/5 hover:bg-indigo-400/[0.02] transition-colors">
                <td className="text-[9px] font-mono font-bold text-neutral-200 px-2 py-1 whitespace-nowrap">{c.name}</td>
                <td className="text-right text-[9px] font-mono tabular-nums text-neutral-300 px-2 py-1">{fmtPop(c.population)}</td>
                <td className={`text-right text-[9px] font-mono tabular-nums px-2 py-1 ${growthRateColor(c.growthRate)}`}>{fmtSigned(c.growthRate)}</td>
                <td className="text-right text-[9px] font-mono tabular-nums text-neutral-300 px-2 py-1">{c.medianAge.toFixed(1)}</td>
                <td className="text-right text-[9px] font-mono tabular-nums text-neutral-300 px-2 py-1">{c.fertilityRate.toFixed(2)}</td>
                <td className="text-right text-[9px] font-mono tabular-nums text-neutral-300 px-2 py-1">{c.lifeExpectancy.toFixed(1)}</td>
                <td className="text-right text-[9px] font-mono tabular-nums text-cyan-400/80 px-2 py-1">{fmtPct(c.urbanization)}</td>
                <td className="text-right text-[9px] font-mono tabular-nums text-amber-400/80 px-2 py-1">{c.dependencyRatio.toFixed(1)}</td>
                <td className="text-right text-[9px] font-mono tabular-nums text-neutral-300 px-2 py-1">{fmtPct(c.workingAgePct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Aging Index (Top by Dependency Ratio) ──

function AgingIndexSection({ countries, t }: { countries: CountryDemographic[]; t: ReturnType<typeof useT> }) {
  const sorted = [...countries].sort((a, b) => b.dependencyRatio - a.dependencyRatio).slice(0, 8);
  const maxRatio = Math.max(...sorted.map((c) => c.dependencyRatio));

  return (
    <div className="border-b border-border/20">
      <SectionHeader title={tr(t, 'demAgingIndex', 'Aging Index - Dependency Ratio')} />
      <div className="px-2 py-1.5">
        {sorted.map((c) => {
          const pct = (c.dependencyRatio / maxRatio) * 100;
          return (
            <div key={c.name} className="flex items-center gap-2 py-0.5 hover:bg-indigo-400/[0.02] transition-colors px-1">
              <span className="text-[8px] font-mono text-neutral-400 w-[80px] shrink-0 truncate">{c.name}</span>
              <div className="flex-1 h-2.5 bg-border/5 relative">
                <div
                  className="absolute inset-y-0 left-0 bg-amber-500/40"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-[8px] font-mono font-bold tabular-nums text-amber-400 w-[36px] text-right shrink-0">
                {c.dependencyRatio.toFixed(1)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Urbanization Trend ──

function UrbanizationTrendSection({ trends, t }: { trends: UrbanizationTrend[]; t: ReturnType<typeof useT> }) {
  const maxRate = Math.max(...trends.map((u) => u.urbanGrowthRate));

  return (
    <div className="border-b border-border/20">
      <SectionHeader title={tr(t, 'demUrbanTrend', 'Fastest Urbanizing Countries')} />
      <div className="px-2 py-1.5">
        {trends.map((u) => {
          const pct = (u.urbanGrowthRate / maxRate) * 100;
          return (
            <div key={u.country} className="flex items-center gap-2 py-0.5 hover:bg-indigo-400/[0.02] transition-colors px-1">
              <span className="text-[8px] font-mono text-neutral-400 w-[80px] shrink-0 truncate">{u.country}</span>
              <div className="flex-1 h-2.5 bg-border/5 relative">
                <div
                  className="absolute inset-y-0 left-0 bg-cyan-500/40"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-[8px] font-mono tabular-nums text-cyan-400/70 w-[40px] text-right shrink-0">
                {fmtPct(u.urbanization)}
              </span>
              <span className="text-[8px] font-mono font-bold tabular-nums text-cyan-400 w-[40px] text-right shrink-0">
                +{u.urbanGrowthRate.toFixed(2)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Labor Force Section ──

function LaborForceSection({ labor, t }: { labor: LaborForceEntry[]; t: ReturnType<typeof useT> }) {
  return (
    <div className="border-b border-border/20">
      <SectionHeader title={tr(t, 'demLaborForce', 'Labor Force')} />
      <div className="overflow-auto">
        <table className="w-full min-w-[420px]">
          <thead>
            <tr className="border-b border-border/15">
              <th className="text-left text-[7px] font-mono font-bold text-neutral-500 uppercase tracking-wider px-2 py-1">COUNTRY</th>
              <th className="text-right text-[7px] font-mono font-bold text-neutral-500 uppercase tracking-wider px-2 py-1">LABOR FORCE</th>
              <th className="text-right text-[7px] font-mono font-bold text-neutral-500 uppercase tracking-wider px-2 py-1">PARTICIPATION</th>
              <th className="text-right text-[7px] font-mono font-bold text-neutral-500 uppercase tracking-wider px-2 py-1">UNEMPLOYMENT</th>
            </tr>
          </thead>
          <tbody>
            {labor.map((l) => (
              <tr key={l.country} className="border-b border-border/5 hover:bg-indigo-400/[0.02] transition-colors">
                <td className="text-[9px] font-mono font-bold text-neutral-200 px-2 py-1 whitespace-nowrap">{l.country}</td>
                <td className="text-right text-[9px] font-mono tabular-nums text-neutral-300 px-2 py-1">{fmtLabor(l.laborForce)}</td>
                <td className="text-right text-[9px] font-mono tabular-nums text-neutral-300 px-2 py-1">{fmtPct(l.participationRate)}</td>
                <td className="text-right px-2 py-1">
                  <span className={`text-[9px] font-mono font-bold tabular-nums px-1.5 py-0.5 ${unemploymentColor(l.unemployment)} ${unemploymentBg(l.unemployment)}`}>
                    {fmtPct(l.unemployment)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Population Projections ──

function ProjectionsSection({ projections, t }: { projections: ProjectionEntry[]; t: ReturnType<typeof useT> }) {
  return (
    <div className="border-b border-border/20">
      <SectionHeader title={tr(t, 'demProjections', 'Population Projections')} />
      <div className="overflow-auto">
        <table className="w-full min-w-[480px]">
          <thead>
            <tr className="border-b border-border/15">
              <th className="text-left text-[7px] font-mono font-bold text-neutral-500 uppercase tracking-wider px-2 py-1">COUNTRY</th>
              <th className="text-right text-[7px] font-mono font-bold text-neutral-500 uppercase tracking-wider px-2 py-1">2025</th>
              <th className="text-right text-[7px] font-mono font-bold text-neutral-500 uppercase tracking-wider px-2 py-1">2030</th>
              <th className="text-right text-[7px] font-mono font-bold text-neutral-500 uppercase tracking-wider px-2 py-1">2030 CHG</th>
              <th className="text-right text-[7px] font-mono font-bold text-neutral-500 uppercase tracking-wider px-2 py-1">2050</th>
              <th className="text-right text-[7px] font-mono font-bold text-neutral-500 uppercase tracking-wider px-2 py-1">2050 CHG</th>
            </tr>
          </thead>
          <tbody>
            {projections.map((p) => {
              const chg2030 = ((p.pop2030 - p.pop2025) / p.pop2025) * 100;
              const chg2050 = ((p.pop2050 - p.pop2025) / p.pop2025) * 100;
              return (
                <tr key={p.country} className="border-b border-border/5 hover:bg-indigo-400/[0.02] transition-colors">
                  <td className="text-[9px] font-mono font-bold text-neutral-200 px-2 py-1 whitespace-nowrap">{p.country}</td>
                  <td className="text-right text-[9px] font-mono tabular-nums text-neutral-400 px-2 py-1">{fmtPop(p.pop2025)}</td>
                  <td className="text-right text-[9px] font-mono tabular-nums text-neutral-300 px-2 py-1">{fmtPop(p.pop2030)}</td>
                  <td className={`text-right text-[9px] font-mono tabular-nums px-2 py-1 ${projectionGrowthColor(p.pop2025, p.pop2030)}`}>
                    {fmtSigned(chg2030, 1)}
                  </td>
                  <td className="text-right text-[9px] font-mono tabular-nums text-neutral-300 px-2 py-1">{fmtPop(p.pop2050)}</td>
                  <td className={`text-right text-[9px] font-mono tabular-nums px-2 py-1 ${projectionGrowthColor(p.pop2025, p.pop2050)}`}>
                    {fmtSigned(chg2050, 1)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main Panel ──

export function DemographicTrendsPanel() {
  const t = useT();
  const { data: rawData, isLoading, refetch } = useDemographicTrends();

  const data: DemographicTrendsData | undefined = rawData;

  return (
    <div className="h-full flex flex-col bg-black overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#050505] border-b border-border/30 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-indigo-400" />
          <span className="text-[9px] font-black font-mono uppercase tracking-tighter text-indigo-400">
            {tr(t, 'panelDemographicTrends', 'Demographic Trends')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {data?.timestamp && (
            <span className="text-[7px] font-mono text-neutral-600">
              {new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={() => refetch()}
            className="p-1 text-neutral-500 hover:text-indigo-400 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && !rawData && (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-[9px] font-mono text-indigo-400 uppercase animate-pulse">
            LOADING DEMOGRAPHIC DATA...
          </span>
        </div>
      )}

      {/* Content */}
      {!isLoading && !data && (
        <div className="flex items-center justify-center h-full text-neutral/40 text-[10px] font-mono uppercase tracking-widest">No data available</div>
      )}

      {data && (
        <div className="flex-1 overflow-auto no-scrollbar">
          {data.summary && <GlobalSummaryBar summary={data.summary} />}
          <CountryTable countries={data.countries ?? []} t={t} />
          <AgingIndexSection countries={data.countries ?? []} t={t} />
          <UrbanizationTrendSection trends={data.urbanizationTrends ?? []} t={t} />
          <LaborForceSection labor={data.laborForce ?? []} t={t} />
          <ProjectionsSection projections={data.projections ?? []} t={t} />

          {/* Footer */}
          <div className="px-3 py-2 border-t border-border/20">
            <p className="text-[7px] font-mono text-neutral-700 leading-relaxed">
              Data sourced from UN World Population Prospects, World Bank, and ILO. Population in millions unless noted. Not investment advice.
            </p>
          </div>

          <div className="h-2" />
        </div>
      )}
    </div>
  );
}
