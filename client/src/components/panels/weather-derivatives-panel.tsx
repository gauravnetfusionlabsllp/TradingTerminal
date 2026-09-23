import { useWeatherDerivatives } from '../../api/hooks/use-weather-derivatives';
import { useT, tr, TFn } from '../../i18n';
import { RefreshCw } from 'lucide-react';

// ── Formatting helpers ──

function fmtNum(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toFixed(0);
}

function fmtChange(n: number): string {
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}`;
}

function fmtPct(n: number): string {
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

function fmtTemp(n: number): string {
  return `${n.toFixed(1)}\u00b0F`;
}

function fmtDollars(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

// ── Color helpers ──

function changeColor(n: number): string {
  if (n > 0) return 'text-green-400';
  if (n < 0) return 'text-red-400';
  return 'text-neutral-500';
}

function deviationColor(n: number): string {
  // positive deviation = warming, negative = cooling
  if (n > 0) return 'text-red-400';
  if (n < 0) return 'text-green-400';
  return 'text-neutral-500';
}

function percentileColor(n: number): string {
  if (n >= 75) return 'text-red-400';
  if (n >= 60) return 'text-amber-400';
  if (n <= 25) return 'text-green-400';
  return 'text-neutral-400';
}

function statusColor(status: string): string {
  if (status === 'Active') return 'text-green-400 bg-green-500/10 border border-green-500/30';
  if (status === 'Quoted') return 'text-amber-400 bg-amber-500/10 border border-amber-500/30';
  return 'text-neutral-500 bg-neutral-500/10 border border-neutral-500/30';
}

function correlationColor(n: number): string {
  if (n >= 0.7) return 'text-teal-400';
  if (n >= 0.5) return 'text-teal-400/70';
  return 'text-neutral-500';
}

// ── Main Panel ──

export function WeatherDerivativesPanel() {
  const t = useT();
  const { data: rawData, isLoading, refetch } = useWeatherDerivatives();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = rawData as any;

  return (
    <div className="h-full flex flex-col bg-black overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#050505] border-b border-border/30 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-teal-400" />
          <span className="text-[9px] font-black font-mono uppercase tracking-tighter text-teal-400">
            {tr(t, 'wdWeatherDerivatives', 'Weather Derivatives')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {data?.marketSummary?.dominantSeason && (
            <span className="px-1.5 py-0.5 text-[7px] font-black font-mono uppercase tracking-wider text-teal-400 bg-teal-500/10 border border-teal-500/30">
              {data.marketSummary.dominantSeason} Season
            </span>
          )}
          <button
            onClick={() => refetch()}
            className="p-1 text-neutral-500 hover:text-teal-400 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto no-scrollbar">
        {isLoading && !rawData && (
          <div className="text-center py-8 text-amber-400 text-[9px] font-mono uppercase animate-pulse">
            {tr(t, 'loading', 'Loading...')}
          </div>
        )}

        {!data && !isLoading && (
          <div className="text-center py-8 text-neutral-500 text-[9px] font-mono uppercase">
            {tr(t, 'wdNoData', 'No data available')}
          </div>
        )}

        {data && (
          <>
            <MarketSummarySection data={data.marketSummary} t={t} />
            <TemperatureContractsSection contracts={data.hddCddContracts} t={t} />
            <PrecipitationContractsSection pricing={data.cityPricing} t={t} />
            <WeatherIndexSection patterns={data.seasonalPatterns} t={t} />
            <CatastropheBondsSection strategies={data.hedgingStrategies} t={t} />
            <SeasonalOutlookSection patterns={data.seasonalPatterns} pricing={data.cityPricing} t={t} />

            {/* Timestamp */}
            <div className="px-3 py-1.5 border-t border-border/10">
              <span className="text-[7px] font-mono text-neutral-700">
                {tr(t, 'wdLastUpdate', 'Last update')}: {new Date(data.generatedAt).toLocaleTimeString()}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Market Summary ──

function MarketSummarySection({
  data,
  t,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  t: ReturnType<typeof useT>;
}) {
  if (!data) return null;

  const metrics = [
    { label: tr(t, 'wdTotalNotional', 'Total Notional'), value: `${data.totalNotional}${data.totalNotionalUnit}`, color: 'text-white' },
    { label: tr(t, 'wdActiveContracts', 'Active Contracts'), value: fmtNum(data.activeContracts), color: 'text-teal-400' },
    { label: tr(t, 'wdAvgVol', 'Avg Volatility'), value: `${data.avgVolatility}%`, color: 'text-amber-400' },
    { label: tr(t, 'wdMostActive', 'Most Active'), value: data.mostActiveCity, color: 'text-white' },
    { label: tr(t, 'wdYoYGrowth', 'YoY Growth'), value: `+${data.yoyGrowth}${data.yoyGrowthUnit}`, color: 'text-green-400' },
  ];

  return (
    <div className="border-b border-border/20">
      <div className="grid grid-cols-5 gap-px bg-border/10">
        {metrics.map((m) => (
          <div key={m.label} className="px-2 py-1.5 bg-black hover:bg-teal-400/[0.02]">
            <div className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider">
              {m.label}
            </div>
            <div className={`text-[10px] font-mono font-bold ${m.color}`}>
              {m.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Section 1: Temperature Contracts (HDD/CDD) ──

function TemperatureContractsSection({
  contracts,
  t,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  contracts: any[];
  t: ReturnType<typeof useT>;
}) {
  if (!contracts?.length) return null;

  return (
    <div className="border-b border-border/20">
      <div className="px-3 py-1 border-b border-border/10">
        <span className="text-[8px] font-black font-mono uppercase tracking-wider text-neutral-500">
          {tr(t, 'wdTempContracts', 'Temperature Contracts')}
        </span>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_40px_56px_56px_56px_52px_56px_56px_56px] px-2 py-1 border-b border-border/10 bg-[#030303]">
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider">City</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider text-right">Type</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider text-right">Strike</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider text-right">Last</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider text-right">Chg</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider text-right">Chg%</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider text-right">Vol</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider text-right">OI</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider text-right">Impl.T</span>
      </div>

      {/* Rows */}
      {contracts.map((c: {
        city: string; type: string; strike: number; last: number;
        change: number; changePercent: number; volume: number;
        openInterest: number; impliedTemp: number;
      }) => (
        <div
          key={c.city}
          className="grid grid-cols-[1fr_40px_56px_56px_56px_52px_56px_56px_56px] px-2 py-1 border-b border-border/5 hover:bg-teal-400/[0.02]"
        >
          <span className="text-[8px] font-mono font-bold text-white truncate">{c.city}</span>
          <span className={`text-[8px] font-mono font-bold text-right ${c.type === 'HDD' ? 'text-blue-400' : 'text-orange-400'}`}>
            {c.type}
          </span>
          <span className="text-[8px] font-mono text-neutral-400 text-right">{c.strike}</span>
          <span className="text-[8px] font-mono font-bold text-white text-right">{c.last}</span>
          <span className={`text-[8px] font-mono font-bold text-right ${changeColor(c.change)}`}>
            {fmtChange(c.change)}
          </span>
          <span className={`text-[8px] font-mono text-right ${changeColor(c.changePercent)}`}>
            {fmtPct(c.changePercent)}
          </span>
          <span className="text-[8px] font-mono text-neutral-400 text-right">{fmtNum(c.volume)}</span>
          <span className="text-[8px] font-mono text-neutral-400 text-right">{fmtNum(c.openInterest)}</span>
          <span className="text-[8px] font-mono text-teal-400/80 text-right">{fmtTemp(c.impliedTemp)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Section 2: Precipitation Contracts (City Pricing) ──

function PrecipitationContractsSection({
  pricing,
  t,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pricing: any[];
  t: ReturnType<typeof useT>;
}) {
  if (!pricing?.length) return null;

  return (
    <div className="border-b border-border/20">
      <div className="px-3 py-1 border-b border-border/10">
        <span className="text-[8px] font-black font-mono uppercase tracking-wider text-neutral-500">
          {tr(t, 'wdPrecipContracts', 'Precipitation Contracts')}
        </span>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_56px_56px_52px_52px_52px_48px_52px] px-2 py-1 border-b border-border/10 bg-[#030303]">
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider">City</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider text-right">Cur.T</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider text-right">Nrm.T</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider text-right">Dev</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider text-right">HDD.P</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider text-right">CDD.P</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider text-right">Vol</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider text-right">Corr</span>
      </div>

      {/* Rows */}
      {pricing.map((p: {
        city: string; currentTemp: number; normalTemp: number;
        deviation: number; hddPremium: number; cddPremium: number;
        volatility: number; correlation: number;
      }) => (
        <div
          key={p.city}
          className="grid grid-cols-[1fr_56px_56px_52px_52px_52px_48px_52px] px-2 py-1 border-b border-border/5 hover:bg-teal-400/[0.02]"
        >
          <span className="text-[8px] font-mono font-bold text-white truncate">{p.city}</span>
          <span className="text-[8px] font-mono text-white text-right">{fmtTemp(p.currentTemp)}</span>
          <span className="text-[8px] font-mono text-neutral-500 text-right">{fmtTemp(p.normalTemp)}</span>
          <span className={`text-[8px] font-mono font-bold text-right ${deviationColor(p.deviation)}`}>
            {p.deviation >= 0 ? '+' : ''}{p.deviation.toFixed(1)}
          </span>
          <span className="text-[8px] font-mono text-neutral-400 text-right">{p.hddPremium.toFixed(3)}</span>
          <span className="text-[8px] font-mono text-neutral-400 text-right">{p.cddPremium.toFixed(3)}</span>
          <span className="text-[8px] font-mono text-amber-400/80 text-right">{p.volatility.toFixed(1)}%</span>
          <span className={`text-[8px] font-mono text-right ${correlationColor(p.correlation)}`}>
            {p.correlation.toFixed(2)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Section 3: Weather Index (Seasonal Patterns) ──

function WeatherIndexSection({
  patterns,
  t,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  patterns: any[];
  t: ReturnType<typeof useT>;
}) {
  if (!patterns?.length) return null;

  return (
    <div className="border-b border-border/20">
      <div className="px-3 py-1 border-b border-border/10">
        <span className="text-[8px] font-black font-mono uppercase tracking-wider text-neutral-500">
          {tr(t, 'wdWeatherIndex', 'Weather Index')}
        </span>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[44px_56px_56px_56px_64px_48px] px-2 py-1 border-b border-border/10 bg-[#030303]">
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider">Month</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider text-right">Avg HDD</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider text-right">Avg CDD</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider text-right">Max Dev</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider text-right">Cur Dev</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider text-right">Pctl</span>
      </div>

      {/* Rows */}
      {patterns.map((p: {
        month: string; avgHDD: number; avgCDD: number;
        maxDeviation: number; currentDeviation: number; percentile: number;
      }) => (
        <div
          key={p.month}
          className="grid grid-cols-[44px_56px_56px_56px_64px_48px] px-2 py-1 border-b border-border/5 hover:bg-teal-400/[0.02]"
        >
          <span className="text-[8px] font-mono font-bold text-teal-400/80">{p.month}</span>
          <span className="text-[8px] font-mono text-blue-400/70 text-right">{p.avgHDD || '-'}</span>
          <span className="text-[8px] font-mono text-orange-400/70 text-right">{p.avgCDD || '-'}</span>
          <span className="text-[8px] font-mono text-neutral-500 text-right">{p.maxDeviation}</span>
          <span className={`text-[8px] font-mono font-bold text-right ${deviationColor(p.currentDeviation)}`}>
            {p.currentDeviation >= 0 ? '+' : ''}{p.currentDeviation.toFixed(1)}
          </span>
          <span className={`text-[8px] font-mono font-bold text-right ${percentileColor(p.percentile)}`}>
            {p.percentile}%
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Section 4: Catastrophe Bonds (Hedging Strategies) ──

function CatastropheBondsSection({
  strategies,
  t,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  strategies: any[];
  t: ReturnType<typeof useT>;
}) {
  if (!strategies?.length) return null;

  return (
    <div className="border-b border-border/20">
      <div className="px-3 py-1 border-b border-border/10">
        <span className="text-[8px] font-black font-mono uppercase tracking-wider text-neutral-500">
          {tr(t, 'wdCatBonds', 'Catastrophe Bonds')}
        </span>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_64px_56px_64px_52px_48px_52px] px-2 py-1 border-b border-border/10 bg-[#030303]">
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider">Strategy</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider text-right">Notional</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider text-right">Premium</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider text-right">Max Pay</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider text-right">B/E DD</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider text-right">DTE</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider text-right">Status</span>
      </div>

      {/* Rows */}
      {strategies.map((s: {
        strategy: string; notional: number; premium: number;
        maxPayout: number; breakeven: number; daysToExpiry: number; status: string;
      }) => (
        <div
          key={s.strategy}
          className="grid grid-cols-[1fr_64px_56px_64px_52px_48px_52px] px-2 py-1 border-b border-border/5 hover:bg-teal-400/[0.02]"
        >
          <span className="text-[8px] font-mono font-bold text-white truncate">{s.strategy}</span>
          <span className="text-[8px] font-mono text-neutral-400 text-right">{fmtDollars(s.notional)}</span>
          <span className="text-[8px] font-mono text-amber-400/80 text-right">{fmtDollars(s.premium)}</span>
          <span className="text-[8px] font-mono text-teal-400/80 text-right">{fmtDollars(s.maxPayout)}</span>
          <span className="text-[8px] font-mono text-neutral-400 text-right">{s.breakeven}</span>
          <span className={`text-[8px] font-mono font-bold text-right ${s.daysToExpiry <= 30 ? 'text-red-400' : s.daysToExpiry <= 60 ? 'text-amber-400' : 'text-neutral-400'}`}>
            {s.daysToExpiry}
          </span>
          <span className={`text-[7px] font-mono font-bold px-1 py-0.5 text-right ${statusColor(s.status)}`}>
            {s.status.toUpperCase()}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Section 5: Seasonal Outlook ──

function SeasonalOutlookSection({
  patterns,
  pricing,
  t,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  patterns: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pricing: any[];
  t: ReturnType<typeof useT>;
}) {
  if (!patterns?.length || !pricing?.length) return null;

  // Compute outlook metrics from the data
  const avgDeviation = patterns.reduce(
    (sum: number, p: { currentDeviation: number }) => sum + p.currentDeviation, 0,
  ) / patterns.length;
  const warmingCities = pricing.filter((p: { deviation: number }) => p.deviation > 0).length;
  const coolingCities = pricing.filter((p: { deviation: number }) => p.deviation < 0).length;
  const maxDevCity = pricing.reduce(
    (max: { city: string; deviation: number }, p: { city: string; deviation: number }) =>
      Math.abs(p.deviation) > Math.abs(max.deviation) ? p : max,
    pricing[0],
  );
  const avgCorrelation = pricing.reduce(
    (sum: number, p: { correlation: number }) => sum + p.correlation, 0,
  ) / pricing.length;

  // Determine overall outlook
  const outlook = avgDeviation > 1 ? 'WARMING' : avgDeviation < -1 ? 'COOLING' : 'NEUTRAL';
  const outlookColor = outlook === 'WARMING' ? 'text-red-400' : outlook === 'COOLING' ? 'text-green-400' : 'text-amber-400';
  const outlookBg = outlook === 'WARMING'
    ? 'bg-red-500/10 border border-red-500/30'
    : outlook === 'COOLING'
      ? 'bg-green-500/10 border border-green-500/30'
      : 'bg-amber-500/10 border border-amber-500/30';

  const outlookMetrics = [
    { label: tr(t, 'wdOverallTrend', 'Overall Trend'), value: outlook, color: outlookColor },
    { label: tr(t, 'wdAvgDeviation', 'Avg Deviation'), value: `${avgDeviation >= 0 ? '+' : ''}${avgDeviation.toFixed(1)} DD`, color: deviationColor(avgDeviation) },
    { label: tr(t, 'wdWarmingCities', 'Warming'), value: `${warmingCities} cities`, color: 'text-red-400' },
    { label: tr(t, 'wdCoolingCities', 'Cooling'), value: `${coolingCities} cities`, color: 'text-green-400' },
    { label: tr(t, 'wdMaxDeviation', 'Max Dev'), value: `${maxDevCity.city} ${maxDevCity.deviation >= 0 ? '+' : ''}${maxDevCity.deviation.toFixed(1)}\u00b0F`, color: deviationColor(maxDevCity.deviation) },
    { label: tr(t, 'wdNatGasCorr', 'Nat Gas Corr'), value: avgCorrelation.toFixed(2), color: correlationColor(avgCorrelation) },
  ];

  return (
    <div className="border-b border-border/20">
      <div className="px-3 py-1 border-b border-border/10 flex items-center justify-between">
        <span className="text-[8px] font-black font-mono uppercase tracking-wider text-neutral-500">
          {tr(t, 'wdSeasonalOutlook', 'Seasonal Outlook')}
        </span>
        <span className={`text-[7px] font-black font-mono uppercase px-1.5 py-0.5 ${outlookColor} ${outlookBg}`}>
          {outlook}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-px bg-border/10">
        {outlookMetrics.map((m) => (
          <div key={m.label} className="px-2 py-1.5 bg-black hover:bg-teal-400/[0.02]">
            <div className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider">
              {m.label}
            </div>
            <div className={`text-[9px] font-mono font-bold ${m.color}`}>
              {m.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
