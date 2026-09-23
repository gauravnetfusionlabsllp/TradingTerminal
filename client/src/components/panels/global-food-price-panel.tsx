import { useState } from 'react';
import { useGlobalFoodPrice } from '../../api/hooks/use-global-food-price';
import { useT, tr, TFn } from '../../i18n';
import { RefreshCw, Wheat } from 'lucide-react';

// ── Formatting helpers ──

function fmtPrice(n: number): string {
  if (n >= 10000) return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (n >= 100) return n.toFixed(2);
  if (n >= 1) return n.toFixed(2);
  return n.toFixed(3);
}

function fmtPct(n: number): string {
  return (n >= 0 ? '+' : '') + n.toFixed(1) + '%';
}

function fmtVol(n: number): string {
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 1 });
  return n.toFixed(1);
}

// ── Color helpers ──

function inflationColor(n: number): string {
  if (n >= 30) return 'text-red-500';
  if (n >= 15) return 'text-red-400';
  if (n >= 8) return 'text-orange-400';
  if (n >= 5) return 'text-yellow-400';
  if (n >= 0) return 'text-green-400';
  return 'text-blue-400';
}

function stocksToUseColor(ratio: number): string {
  if (ratio < 15) return 'text-red-400';
  if (ratio < 20) return 'text-orange-400';
  if (ratio > 25) return 'text-green-400';
  return 'text-white';
}

function stocksToUseBg(ratio: number): string {
  if (ratio < 15) return 'bg-red-500';
  if (ratio < 20) return 'bg-orange-500';
  if (ratio > 25) return 'bg-green-500';
  return 'bg-white/50';
}

function alertBadge(level: string): { label: string; cls: string } {
  switch (level) {
    case 'FAMINE':
      return { label: 'FAMINE', cls: 'text-red-200 bg-red-900/80 border border-red-700/60' };
    case 'EMERGENCY':
      return { label: 'EMERGENCY', cls: 'text-red-400 bg-red-500/15 border border-red-500/30' };
    case 'CRISIS':
      return { label: 'CRISIS', cls: 'text-orange-400 bg-orange-500/15 border border-orange-500/30' };
    case 'WATCH':
      return { label: 'WATCH', cls: 'text-yellow-400 bg-yellow-500/15 border border-yellow-500/30' };
    default:
      return { label: level, cls: 'text-neutral-400 bg-neutral-500/10 border border-neutral-500/30' };
  }
}

function trendBadge(trend: string): { label: string; cls: string } {
  switch (trend) {
    case 'rising':
      return { label: 'RISING', cls: 'text-red-400 bg-red-500/10' };
    case 'declining':
      return { label: 'DECLINING', cls: 'text-green-400 bg-green-500/10' };
    case 'stable':
      return { label: 'STABLE', cls: 'text-neutral-400 bg-neutral-500/10' };
    default:
      return { label: trend.toUpperCase(), cls: 'text-neutral-400 bg-neutral-500/10' };
  }
}

// ── Section Header ──

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="px-3 py-1 border-b border-amber-400/30 flex items-center gap-2">
      <div className="w-1 h-1 bg-amber-400" />
      <span className="text-[7px] font-black font-mono uppercase tracking-widest text-amber-400">
        {label}
      </span>
    </div>
  );
}

// ── 1. FAO Sub-Indices Section ──

function FaoIndicesSection({ fao, t }: { fao: any; t: ReturnType<typeof useT> }) {
  const indices = [
    { label: tr(t, 'gfpOverall', 'Overall'), value: fao.overall, change: fao.momChange },
    { label: tr(t, 'gfpMeat', 'Meat'), value: fao.meat, change: fao.meatChange },
    { label: tr(t, 'gfpDairy', 'Dairy'), value: fao.dairy, change: fao.dairyChange },
    { label: tr(t, 'gfpCereals', 'Cereals'), value: fao.cereals, change: fao.cerealsChange },
    { label: tr(t, 'gfpOils', 'Oils'), value: fao.oils, change: fao.oilsChange },
    { label: tr(t, 'gfpSugar', 'Sugar'), value: fao.sugar, change: fao.sugarChange },
  ];

  return (
    <div className="border-b border-amber-400/30">
      <SectionHeader label={tr(t, 'gfpFaoIndices', 'FAO Price Indices')} />
      <div className="grid grid-cols-6 gap-px bg-border/10">
        {indices.map((idx: any) => (
          <div key={idx.label} className="bg-black px-2 py-1.5">
            <div className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider">
              {idx.label}
            </div>
            <div className="text-[10px] font-mono font-bold text-white tabular-nums">
              {idx.value.toFixed(1)}
            </div>
            <div className={`text-[8px] font-mono font-bold tabular-nums ${idx.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {fmtPct(idx.change)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 2. Commodity Prices Section ──

function CommodityPricesSection({ commodities, t }: { commodities: any[]; t: ReturnType<typeof useT> }) {
  return (
    <div className="border-b border-amber-400/30">
      <SectionHeader label={tr(t, 'gfpCommodityPrices', 'Commodity Prices')} />
      <div className="grid grid-cols-[1.4fr_0.7fr_0.5fr_0.5fr_0.5fr_0.5fr_0.8fr] px-3 py-0.5 border-b border-border/20 text-[7px] font-black font-mono text-neutral-600 uppercase tracking-wider">
        <span>{tr(t, 'gfpCommodity', 'Commodity')}</span>
        <span className="text-right">{tr(t, 'gfpPrice', 'Price')}</span>
        <span className="text-right">{tr(t, 'gfp1d', '1D')}</span>
        <span className="text-right">{tr(t, 'gfp1m', '1M')}</span>
        <span className="text-right">{tr(t, 'gfp1y', '1Y')}</span>
        <span className="text-right" />
        <span className="text-right">{tr(t, 'gfp52w', '52W Range')}</span>
      </div>
      {commodities.map((c: any) => {
        const range52w = c.high52w - c.low52w;
        const rangePct = range52w > 0 ? ((c.price - c.low52w) / range52w) * 100 : 50;

        return (
          <div
            key={c.commodity}
            className="grid grid-cols-[1.4fr_0.7fr_0.5fr_0.5fr_0.5fr_0.5fr_0.8fr] px-3 py-1 border-b border-border/20 hover:bg-amber-400/[0.02] transition-colors items-center"
          >
            <span className="text-[8px] font-mono font-bold text-white truncate">{c.commodity}</span>
            <div className="text-right">
              <span className="text-[8px] font-mono font-bold text-white tabular-nums">{fmtPrice(c.price)}</span>
              <span className="text-[6px] font-mono text-neutral-600 ml-0.5">{c.unit}</span>
            </div>
            <span className={`text-[8px] font-mono font-bold text-right tabular-nums ${c.dailyChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {fmtPct(c.dailyChange)}
            </span>
            <span className={`text-[8px] font-mono font-bold text-right tabular-nums ${c.monthChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {fmtPct(c.monthChange)}
            </span>
            <span className={`text-[8px] font-mono font-bold text-right tabular-nums ${c.yearChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {fmtPct(c.yearChange)}
            </span>
            <span />
            <div className="flex items-center gap-1">
              <span className="text-[6px] font-mono text-neutral-600 tabular-nums">{fmtPrice(c.low52w)}</span>
              <div className="flex-1 h-1.5 bg-white/[0.04] relative overflow-hidden">
                <div
                  className="absolute top-0 left-0 h-full bg-amber-400/40"
                  style={{ width: `${Math.min(Math.max(rangePct, 2), 100)}%` }}
                />
              </div>
              <span className="text-[6px] font-mono text-neutral-600 tabular-nums">{fmtPrice(c.high52w)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── 3. Food Inflation by Country Section ──

function FoodInflationSection({ countries, t }: { countries: any[]; t: ReturnType<typeof useT> }) {
  return (
    <div className="border-b border-amber-400/30">
      <SectionHeader label={tr(t, 'gfpInflation', 'Food Inflation by Country')} />
      <div className="grid grid-cols-[1fr_0.6fr_0.6fr_0.6fr_0.5fr] px-3 py-0.5 border-b border-border/20 text-[7px] font-black font-mono text-neutral-600 uppercase tracking-wider">
        <span>{tr(t, 'gfpCountry', 'Country')}</span>
        <span className="text-right">{tr(t, 'gfpFoodCPI', 'Food CPI')}</span>
        <span className="text-right">{tr(t, 'gfpCoreCPI', 'Core CPI')}</span>
        <span className="text-right">{tr(t, 'gfpFoodShare', 'Food Share')}</span>
        <span className="text-center">{tr(t, 'gfpTrend', 'Trend')}</span>
      </div>
      {countries.map((c: any) => {
        const trend = trendBadge(c.trend);
        return (
          <div
            key={c.country}
            className="grid grid-cols-[1fr_0.6fr_0.6fr_0.6fr_0.5fr] px-3 py-1 border-b border-border/20 hover:bg-amber-400/[0.02] transition-colors items-center"
          >
            <span className="text-[8px] font-mono font-bold text-white">{c.country}</span>
            <span className={`text-[8px] font-mono font-bold text-right tabular-nums ${inflationColor(c.foodInflation)}`}>
              {c.foodInflation >= 0 ? '+' : ''}{c.foodInflation.toFixed(1)}%
            </span>
            <span className="text-[8px] font-mono text-neutral-400 text-right tabular-nums">
              {c.coreInflation >= 0 ? '+' : ''}{c.coreInflation.toFixed(1)}%
            </span>
            <span className="text-[8px] font-mono text-neutral-400 text-right tabular-nums">
              {c.foodShareCPI.toFixed(1)}%
            </span>
            <div className="flex justify-center">
              <span className={`text-[6px] font-black font-mono uppercase px-1 py-0 ${trend.cls}`}>
                {trend.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── 4. Supply & Demand Section ──

function SupplyDemandSection({ items, t }: { items: any[]; t: ReturnType<typeof useT> }) {
  return (
    <div className="border-b border-amber-400/30">
      <SectionHeader label={tr(t, 'gfpSupplyDemand', 'Supply & Demand (MMT)')} />
      <div className="grid grid-cols-[1fr_0.7fr_0.7fr_0.7fr_0.7fr_0.5fr] px-3 py-0.5 border-b border-border/20 text-[7px] font-black font-mono text-neutral-600 uppercase tracking-wider">
        <span>{tr(t, 'gfpCommodity', 'Commodity')}</span>
        <span className="text-right">{tr(t, 'gfpProduction', 'Production')}</span>
        <span className="text-right">{tr(t, 'gfpConsumption', 'Consumption')}</span>
        <span className="text-right">{tr(t, 'gfpEndStocks', 'End Stocks')}</span>
        <span className="text-right">{tr(t, 'gfpStocksUse', 'Stk/Use')}</span>
        <span className="text-right">{tr(t, 'gfpYoY', 'YoY')}</span>
      </div>
      {items.map((s: any) => (
        <div
          key={s.commodity}
          className="grid grid-cols-[1fr_0.7fr_0.7fr_0.7fr_0.7fr_0.5fr] px-3 py-1 border-b border-border/20 hover:bg-amber-400/[0.02] transition-colors items-center"
        >
          <span className="text-[8px] font-mono font-bold text-white">{s.commodity}</span>
          <span className="text-[8px] font-mono text-neutral-300 text-right tabular-nums">
            {fmtVol(s.production)}
          </span>
          <span className="text-[8px] font-mono text-neutral-300 text-right tabular-nums">
            {fmtVol(s.consumption)}
          </span>
          <span className="text-[8px] font-mono text-neutral-300 text-right tabular-nums">
            {fmtVol(s.endingStocks)}
          </span>
          <div className="flex items-center justify-end gap-1">
            <div className="w-8 h-1.5 bg-white/[0.04] overflow-hidden">
              <div
                className={`h-full ${stocksToUseBg(s.stocksToUse)}`}
                style={{ width: `${Math.min(s.stocksToUse * 2, 100)}%`, opacity: 0.6 }}
              />
            </div>
            <span className={`text-[8px] font-mono font-bold tabular-nums ${stocksToUseColor(s.stocksToUse)}`}>
              {s.stocksToUse.toFixed(1)}%
            </span>
          </div>
          <span className={`text-[8px] font-mono font-bold text-right tabular-nums ${s.yoyChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {fmtPct(s.yoyChange)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── 5. Trade Flows Section ──

function TradeFlowsSection({ flows, t }: { flows: any[]; t: ReturnType<typeof useT> }) {
  const [activeTab, setActiveTab] = useState(0);
  const activeFlow = flows[activeTab];
  if (!activeFlow) return null;

  const maxExportVol = Math.max(...activeFlow.exporters.map((e: any) => e.volume), 1);
  const maxImportVol = Math.max(...activeFlow.importers.map((i: any) => i.volume), 1);

  return (
    <div className="border-b border-amber-400/30">
      <SectionHeader label={tr(t, 'gfpTradeFlows', 'Global Trade Flows')} />
      {/* Commodity tabs */}
      <div className="flex border-b border-border/20 bg-black/40">
        {flows.map((f: any, idx: any) => (
          <button
            key={f.commodity}
            onClick={() => setActiveTab(idx)}
            className={`flex-1 py-1 text-[7px] font-black font-mono uppercase tracking-wider border-b-2 transition-colors ${
              activeTab === idx
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-neutral-600 hover:text-neutral-400'
            }`}
          >
            {f.commodity}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-px bg-border/10">
        {/* Exporters */}
        <div className="bg-black">
          <div className="px-2 py-0.5 text-[6px] font-black font-mono text-neutral-600 uppercase tracking-wider border-b border-border/20">
            {tr(t, 'gfpExporters', 'Top Exporters (MMT)')}
          </div>
          {activeFlow.exporters.map((e: any) => (
            <div
              key={e.country}
              className="flex items-center gap-1 px-2 py-0.5 border-b border-border/20 hover:bg-amber-400/[0.02]"
            >
              <span className="text-[7px] font-mono font-bold text-white w-16 truncate shrink-0">{e.country}</span>
              <div className="flex-1 h-2 bg-white/[0.03] overflow-hidden">
                <div
                  className="h-full bg-amber-400/50"
                  style={{ width: `${(e.volume / maxExportVol) * 100}%` }}
                />
              </div>
              <span className="text-[7px] font-mono text-neutral-300 tabular-nums w-8 text-right shrink-0">
                {e.volume.toFixed(1)}
              </span>
              <span className="text-[6px] font-mono text-neutral-600 tabular-nums w-8 text-right shrink-0">
                {e.marketShare.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>

        {/* Importers */}
        <div className="bg-black">
          <div className="px-2 py-0.5 text-[6px] font-black font-mono text-neutral-600 uppercase tracking-wider border-b border-border/20">
            {tr(t, 'gfpImporters', 'Top Importers (MMT)')}
          </div>
          {activeFlow.importers.map((i: any) => (
            <div
              key={i.country}
              className="flex items-center gap-1 px-2 py-0.5 border-b border-border/20 hover:bg-amber-400/[0.02]"
            >
              <span className="text-[7px] font-mono font-bold text-white w-16 truncate shrink-0">{i.country}</span>
              <div className="flex-1 h-2 bg-white/[0.03] overflow-hidden">
                <div
                  className="h-full bg-blue-400/50"
                  style={{ width: `${(i.volume / maxImportVol) * 100}%` }}
                />
              </div>
              <span className="text-[7px] font-mono text-neutral-300 tabular-nums w-8 text-right shrink-0">
                {i.volume.toFixed(1)}
              </span>
              <span className="text-[6px] font-mono text-neutral-600 tabular-nums w-8 text-right shrink-0">
                {i.marketShare.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── 6. Food Security Alerts Section ──

function FoodSecuritySection({ alerts, t }: { alerts: any[]; t: ReturnType<typeof useT> }) {
  return (
    <div className="border-b border-amber-400/30">
      <SectionHeader label={tr(t, 'gfpFoodSecurity', 'Food Security Alerts')} />
      <div className="grid grid-cols-[1fr_0.6fr_0.6fr_1.4fr] px-3 py-0.5 border-b border-border/20 text-[7px] font-black font-mono text-neutral-600 uppercase tracking-wider">
        <span>{tr(t, 'gfpRegion', 'Region')}</span>
        <span className="text-center">{tr(t, 'gfpAlert', 'Alert')}</span>
        <span className="text-right">{tr(t, 'gfpPopulation', 'Pop. (M)')}</span>
        <span>{tr(t, 'gfpDrivers', 'Key Drivers')}</span>
      </div>
      {alerts.map((a: any) => {
        const badge = alertBadge(a.alertLevel);
        return (
          <div
            key={a.region}
            className="grid grid-cols-[1fr_0.6fr_0.6fr_1.4fr] px-3 py-1 border-b border-border/20 hover:bg-amber-400/[0.02] transition-colors items-center"
          >
            <span className="text-[8px] font-mono font-bold text-white truncate">{a.region}</span>
            <div className="flex justify-center">
              <span className={`text-[6px] font-black font-mono uppercase px-1 py-0 ${badge.cls}`}>
                {badge.label}
              </span>
            </div>
            <span className="text-[8px] font-mono font-bold text-white text-right tabular-nums">
              {a.populationAffected.toFixed(1)}
            </span>
            <span className="text-[7px] font-mono text-neutral-500 truncate">{a.drivers}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Panel ──

export function GlobalFoodPricePanel() {
  const t = useT();
  const { data, isLoading, refetch } = useGlobalFoodPrice();

  const d = data;

  return (
    <div className="h-full flex flex-col bg-black overflow-hidden text-[9px] font-mono">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#050505] border-b border-amber-400/30 shrink-0">
        <div className="flex items-center gap-2">
          <Wheat className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[9px] font-black font-mono uppercase tracking-tighter text-amber-400">
            {tr(t, 'gfpTitle', 'Global Food Price')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {d?.faoIndex && (<>
          <span className="text-[7px] font-mono text-neutral-500">FAO</span>
          <span className="text-[9px] font-mono font-bold text-white tabular-nums">
            {d.faoIndex.overall.toFixed(1)}
          </span>
          <span className={`text-[7px] font-mono font-bold tabular-nums ${d.faoIndex.momChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            MoM {fmtPct(d.faoIndex.momChange)}
          </span>
          <span className={`text-[7px] font-mono font-bold tabular-nums ${d.faoIndex.yoyChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            YoY {fmtPct(d.faoIndex.yoyChange)}
          </span>
          </>)}
          <button
            onClick={() => refetch()}
            className="p-0.5 text-neutral-500 hover:text-amber-400 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {isLoading && !data ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-2">
              <div className="w-5 h-5 border-2 border-amber-400/30 border-t-amber-400 animate-spin" />
              <span className="text-[10px] text-white/40 uppercase tracking-widest">
                {tr(t, 'loading', 'Loading...')}
              </span>
            </div>
          </div>
        ) : !d ? (
          <div className="flex items-center justify-center h-full text-neutral/40 text-[10px] font-mono uppercase tracking-widest">No data available</div>
        ) : (
          <>
            {d.faoIndex && <FaoIndicesSection fao={d.faoIndex} t={t} />}
            <CommodityPricesSection commodities={d.commodityPrices ?? []} t={t} />
            <FoodInflationSection countries={d.foodInflation ?? []} t={t} />
            <SupplyDemandSection items={d.supplyDemand ?? []} t={t} />
            <TradeFlowsSection flows={d.tradeFlows ?? []} t={t} />
            <FoodSecuritySection alerts={d.foodSecurity ?? []} t={t} />
          </>
        )}
      </div>
    </div>
  );
}
