import { useRealEstateInvestment } from '../../api/hooks/use-real-estate-investment';
import { Building2, RefreshCw } from 'lucide-react';

// ── Formatting Helpers ──

function fmtB(n: number): string {
  if (Math.abs(n) >= 1000) return '$' + (n / 1000).toFixed(1) + 'T';
  return '$' + n.toFixed(1) + 'B';
}

function fmtM(n: number): string {
  if (Math.abs(n) >= 1000) return '$' + (n / 1000).toFixed(1) + 'B';
  return '$' + n.toFixed(0) + 'M';
}

function fmtPct(n: number): string {
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
}

function fmtSqft(n: number): string {
  return '$' + n.toLocaleString();
}

// ── Color Helpers ──

function changeColor(n: number): string {
  if (n > 0) return 'text-green-400';
  if (n < 0) return 'text-red-400';
  return 'text-neutral-500';
}

function sectorBadgeStyle(sector: string): { color: string; bg: string } {
  switch (sector) {
    case 'Industrial': return { color: '#818cf8', bg: 'rgba(129,140,248,0.12)' };
    case 'Infrastructure': return { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' };
    case 'Data Center': return { color: '#34d399', bg: 'rgba(52,211,153,0.12)' };
    case 'Retail': return { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' };
    case 'Net Lease': return { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' };
    case 'Self Storage': return { color: '#f472b6', bg: 'rgba(244,114,182,0.12)' };
    case 'Healthcare': return { color: '#fb923c', bg: 'rgba(251,146,60,0.12)' };
    case 'Residential': return { color: '#2dd4bf', bg: 'rgba(45,212,191,0.12)' };
    default: return { color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' };
  }
}

function dealTypeBadgeStyle(dealType: string): { color: string; bg: string } {
  switch (dealType) {
    case 'Core': return { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' };
    case 'Core-Plus': return { color: '#818cf8', bg: 'rgba(129,140,248,0.12)' };
    case 'Value-Add': return { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' };
    case 'Opportunistic': return { color: '#f87171', bg: 'rgba(248,113,113,0.12)' };
    default: return { color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' };
  }
}

function trendArrow(trend: string): { text: string; color: string } {
  if (trend === 'rising') return { text: '\u2191', color: 'text-red-400' };
  if (trend === 'falling') return { text: '\u2193', color: 'text-green-400' };
  return { text: '\u2192', color: 'text-neutral-500' };
}

function vacancyColor(v: number): string {
  if (v <= 5) return 'text-green-400';
  if (v <= 10) return 'text-yellow-400';
  if (v <= 15) return 'text-orange-400';
  return 'text-red-400';
}

// ── Main Panel ──

export function RealEstateInvestmentPanel() {
  const { data: rawData, isLoading, refetch } = useRealEstateInvestment();
  const data = rawData;

  return (
    <div className="h-full flex flex-col bg-black overflow-hidden text-[9px] font-mono">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#050505] border-b border-border/30 shrink-0">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-indigo-400" />
          <span className="text-[9px] font-black uppercase tracking-tighter text-indigo-400">
            Real Estate Investment
          </span>
          <span className="text-[7px] text-neutral-600 uppercase tracking-wider">
            Vol {data?.overview?.transactionVolume != null ? fmtB(data.overview.transactionVolume) : '--'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[7px] font-bold text-indigo-400/70 uppercase px-1.5 py-0.5 bg-indigo-400/10 border border-indigo-400/30">
            Cap Rate {data?.overview?.avgCapRate != null ? `${data.overview.avgCapRate.toFixed(2)}%` : '--'}
          </span>
          <button
            onClick={() => refetch()}
            className="p-1 text-neutral-500 hover:text-indigo-400 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto no-scrollbar">
        {isLoading && !rawData && (
          <div className="text-center py-8 text-indigo-400 text-[9px] font-mono uppercase animate-pulse">
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
            <OverviewStats overview={data.overview} />
            <ReitPerformanceTable reits={data.reits} />
            <CapRatesBySector capRates={data.capRates} />
            <RecentTransactions transactions={data.transactions} />
            <RegionalVacancyRents regions={data.regionalVacancy} />
            <DebtMarketSection debtMarket={data.debtMarket} />
          </>
        )}
      </div>
    </div>
  );
}

// ── Overview Stats ──

function OverviewStats({ overview }: { overview: any }) {
  return (
    <div className="border-b border-indigo-400/30">
      <div className="grid grid-cols-6 divide-x divide-border/20">
        <div className="px-3 py-2">
          <div className="text-[7px] font-mono text-indigo-400 uppercase tracking-widest font-black">
            Transaction Vol
          </div>
          <div className="text-[13px] font-mono font-black text-white tabular-nums mt-0.5">
            {fmtB(overview.transactionVolume)}
          </div>
        </div>
        <div className="px-3 py-2">
          <div className="text-[7px] font-mono text-neutral-500 uppercase tracking-widest font-black">
            YoY Change
          </div>
          <div className={`text-[13px] font-mono font-black tabular-nums mt-0.5 ${changeColor(overview.volumeYoY)}`}>
            {fmtPct(overview.volumeYoY)}
          </div>
        </div>
        <div className="px-3 py-2">
          <div className="text-[7px] font-mono text-neutral-500 uppercase tracking-widest font-black">
            Avg Cap Rate
          </div>
          <div className="text-[13px] font-mono font-black text-white tabular-nums mt-0.5">
            {overview.avgCapRate.toFixed(2)}%
          </div>
        </div>
        <div className="px-3 py-2">
          <div className="text-[7px] font-mono text-neutral-500 uppercase tracking-widest font-black">
            Spread / Treasury
          </div>
          <div className="text-[13px] font-mono font-black text-white tabular-nums mt-0.5">
            {overview.spreadOverTreasury.toFixed(0)}bp
          </div>
        </div>
        <div className="px-3 py-2">
          <div className="text-[7px] font-mono text-neutral-500 uppercase tracking-widest font-black">
            Vacancy Rate
          </div>
          <div className={`text-[13px] font-mono font-black tabular-nums mt-0.5 ${vacancyColor(overview.vacancyRate)}`}>
            {overview.vacancyRate.toFixed(1)}%
          </div>
        </div>
        <div className="px-3 py-2">
          <div className="text-[7px] font-mono text-neutral-500 uppercase tracking-widest font-black">
            Price Index
          </div>
          <div className="text-[13px] font-mono font-black text-white tabular-nums mt-0.5">
            {overview.priceIndex.toFixed(1)}
            <span className={`text-[8px] ml-1 ${changeColor(overview.priceIndexChange)}`}>
              {fmtPct(overview.priceIndexChange)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── REIT Performance Table ──

function ReitPerformanceTable({ reits }: { reits: any[] }) {
  return (
    <div className="border-b border-indigo-400/30">
      <div className="px-3 py-1 border-b border-border/20 flex items-center gap-1.5">
        <div className="w-1 h-1 bg-indigo-400" />
        <span className="text-[7px] font-black font-mono uppercase tracking-widest text-indigo-400">
          REIT Performance
        </span>
        <span className="text-[7px] font-mono text-neutral-700 ml-auto">
          {reits.length} REITs
        </span>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-[1fr_70px_65px_55px_60px_55px_60px_50px] px-3 py-1 border-b border-border/20">
        <span className="text-[7px] font-bold font-mono uppercase tracking-wider text-neutral-500">Name</span>
        <span className="text-[7px] font-bold font-mono uppercase tracking-wider text-neutral-500 text-right">Sector</span>
        <span className="text-[7px] font-bold font-mono uppercase tracking-wider text-neutral-500 text-right">Mkt Cap</span>
        <span className="text-[7px] font-bold font-mono uppercase tracking-wider text-neutral-500 text-right">Div %</span>
        <span className="text-[7px] font-bold font-mono uppercase tracking-wider text-neutral-500 text-right">Price Chg</span>
        <span className="text-[7px] font-bold font-mono uppercase tracking-wider text-neutral-500 text-right">FFO</span>
        <span className="text-[7px] font-bold font-mono uppercase tracking-wider text-neutral-500 text-right">Occ %</span>
        <span className="text-[7px] font-bold font-mono uppercase tracking-wider text-neutral-500 text-right">Lev %</span>
      </div>

      {/* Table Rows */}
      {reits.map((reit: any) => {
        const badge = sectorBadgeStyle(reit.sector);
        return (
          <div
            key={reit.ticker}
            className="grid grid-cols-[1fr_70px_65px_55px_60px_55px_60px_50px] px-3 py-1 border-b border-border/20 hover:bg-indigo-400/[0.02]"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[9px] font-mono font-bold text-white truncate">{reit.name}</span>
              <span className="text-[7px] font-mono text-neutral-600">{reit.ticker}</span>
            </div>
            <div className="flex justify-end">
              <span
                className="text-[6px] font-mono font-black uppercase px-1 py-0.5"
                style={{ color: badge.color, backgroundColor: badge.bg }}
              >
                {reit.sector}
              </span>
            </div>
            <span className="text-[9px] font-mono text-neutral-300 text-right tabular-nums">
              ${reit.marketCap.toFixed(1)}B
            </span>
            <span className="text-[9px] font-mono text-indigo-400 text-right tabular-nums font-bold">
              {reit.divYield.toFixed(2)}%
            </span>
            <span className={`text-[9px] font-mono text-right tabular-nums font-bold ${changeColor(reit.priceChange)}`}>
              {fmtPct(reit.priceChange)}
            </span>
            <span className="text-[9px] font-mono text-neutral-300 text-right tabular-nums">
              ${reit.ffo.toFixed(2)}
            </span>
            <span className={`text-[9px] font-mono text-right tabular-nums ${reit.occupancy >= 95 ? 'text-green-400' : reit.occupancy >= 90 ? 'text-yellow-400' : 'text-orange-400'}`}>
              {reit.occupancy.toFixed(1)}%
            </span>
            <span className={`text-[9px] font-mono text-right tabular-nums ${reit.leverage <= 25 ? 'text-green-400' : reit.leverage <= 35 ? 'text-neutral-300' : 'text-orange-400'}`}>
              {reit.leverage.toFixed(1)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Cap Rates by Sector ──

function CapRatesBySector({ capRates }: { capRates: any[] }) {
  return (
    <div className="border-b border-indigo-400/30">
      <div className="px-3 py-1 border-b border-border/20 flex items-center gap-1.5">
        <div className="w-1 h-1 bg-indigo-400" />
        <span className="text-[7px] font-black font-mono uppercase tracking-widest text-indigo-400">
          Cap Rates by Sector
        </span>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-[1fr_65px_65px_65px_50px] px-3 py-1 border-b border-border/20">
        <span className="text-[7px] font-bold font-mono uppercase tracking-wider text-neutral-500">Sector</span>
        <span className="text-[7px] font-bold font-mono uppercase tracking-wider text-neutral-500 text-right">US</span>
        <span className="text-[7px] font-bold font-mono uppercase tracking-wider text-neutral-500 text-right">EU</span>
        <span className="text-[7px] font-bold font-mono uppercase tracking-wider text-neutral-500 text-right">APAC</span>
        <span className="text-[7px] font-bold font-mono uppercase tracking-wider text-neutral-500 text-right">Trend</span>
      </div>

      {/* Table Rows */}
      {capRates.map((row: any) => {
        const trend = trendArrow(row.trend);
        return (
          <div
            key={row.sector}
            className="grid grid-cols-[1fr_65px_65px_65px_50px] px-3 py-1 border-b border-border/20 hover:bg-indigo-400/[0.02]"
          >
            <span className="text-[9px] font-mono font-bold text-neutral-300">{row.sector}</span>
            <span className="text-[9px] font-mono text-neutral-300 text-right tabular-nums">{row.us.toFixed(2)}%</span>
            <span className="text-[9px] font-mono text-neutral-300 text-right tabular-nums">{row.eu.toFixed(2)}%</span>
            <span className="text-[9px] font-mono text-neutral-300 text-right tabular-nums">{row.apac.toFixed(2)}%</span>
            <div className="flex justify-end items-center gap-1">
              <span className={`text-[9px] font-mono font-bold ${trend.color}`}>{trend.text}</span>
              <span
                className={`text-[6px] font-mono font-black uppercase px-1 py-0.5 ${
                  row.trend === 'rising'
                    ? 'text-red-400 bg-red-500/10'
                    : row.trend === 'falling'
                      ? 'text-green-400 bg-green-500/10'
                      : 'text-neutral-500 bg-neutral-500/10'
                }`}
              >
                {row.trend}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Recent Transactions ──

function RecentTransactions({ transactions }: { transactions: any[] }) {
  return (
    <div className="border-b border-indigo-400/30">
      <div className="px-3 py-1 border-b border-border/20 flex items-center gap-1.5">
        <div className="w-1 h-1 bg-indigo-400" />
        <span className="text-[7px] font-black font-mono uppercase tracking-widest text-indigo-400">
          Recent Transactions
        </span>
        <span className="text-[7px] font-mono text-neutral-700 ml-auto">
          {transactions.length} deals
        </span>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-[1fr_90px_110px_65px_65px_55px_70px] px-3 py-1 border-b border-border/20">
        <span className="text-[7px] font-bold font-mono uppercase tracking-wider text-neutral-500">Property</span>
        <span className="text-[7px] font-bold font-mono uppercase tracking-wider text-neutral-500">Location</span>
        <span className="text-[7px] font-bold font-mono uppercase tracking-wider text-neutral-500">Buyer / Seller</span>
        <span className="text-[7px] font-bold font-mono uppercase tracking-wider text-neutral-500 text-right">Price</span>
        <span className="text-[7px] font-bold font-mono uppercase tracking-wider text-neutral-500 text-right">$/sqft</span>
        <span className="text-[7px] font-bold font-mono uppercase tracking-wider text-neutral-500 text-right">Cap</span>
        <span className="text-[7px] font-bold font-mono uppercase tracking-wider text-neutral-500 text-right">Type</span>
      </div>

      {/* Table Rows */}
      {transactions.map((txn: any, idx: number) => {
        const dealBadge = dealTypeBadgeStyle(txn.dealType);
        return (
          <div
            key={idx}
            className="grid grid-cols-[1fr_90px_110px_65px_65px_55px_70px] px-3 py-1 border-b border-border/20 hover:bg-indigo-400/[0.02]"
          >
            <span className="text-[9px] font-mono font-bold text-white truncate">{txn.property}</span>
            <span className="text-[8px] font-mono text-neutral-500 truncate">{txn.location}</span>
            <div className="flex items-center gap-0.5 min-w-0">
              <span className="text-[8px] font-mono text-green-400 truncate">{txn.buyer}</span>
              <span className="text-[7px] font-mono text-neutral-600 shrink-0">{'\u2192'}</span>
              <span className="text-[8px] font-mono text-red-400 truncate">{txn.seller}</span>
            </div>
            <span className="text-[9px] font-mono text-neutral-300 text-right tabular-nums">
              {fmtM(txn.price)}
            </span>
            <span className="text-[9px] font-mono text-neutral-300 text-right tabular-nums">
              {fmtSqft(txn.priceSqft)}
            </span>
            <span className="text-[9px] font-mono text-indigo-400 text-right tabular-nums font-bold">
              {txn.capRate.toFixed(1)}%
            </span>
            <div className="flex justify-end">
              <span
                className="text-[6px] font-mono font-black uppercase px-1 py-0.5"
                style={{ color: dealBadge.color, backgroundColor: dealBadge.bg }}
              >
                {txn.dealType}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Regional Vacancy & Rents ──

function RegionalVacancyRents({ regions }: { regions: any[] }) {
  return (
    <div className="border-b border-indigo-400/30">
      <div className="px-3 py-1 border-b border-border/20 flex items-center gap-1.5">
        <div className="w-1 h-1 bg-indigo-400" />
        <span className="text-[7px] font-black font-mono uppercase tracking-widest text-indigo-400">
          Regional Vacancy & Rents
        </span>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-[80px_60px_60px_60px_65px_55px] px-3 py-1 border-b border-border/20">
        <span className="text-[7px] font-bold font-mono uppercase tracking-wider text-neutral-500">Market</span>
        <span className="text-[7px] font-bold font-mono uppercase tracking-wider text-neutral-500 text-right">Office</span>
        <span className="text-[7px] font-bold font-mono uppercase tracking-wider text-neutral-500 text-right">Indust.</span>
        <span className="text-[7px] font-bold font-mono uppercase tracking-wider text-neutral-500 text-right">Retail</span>
        <span className="text-[7px] font-bold font-mono uppercase tracking-wider text-neutral-500 text-right">Rent $/sf</span>
        <span className="text-[7px] font-bold font-mono uppercase tracking-wider text-neutral-500 text-right">Rent Chg</span>
      </div>

      {/* Table Rows */}
      {regions.map((region: any) => (
        <div
          key={region.market}
          className="grid grid-cols-[80px_60px_60px_60px_65px_55px] px-3 py-1 border-b border-border/20 hover:bg-indigo-400/[0.02]"
        >
          <span className="text-[9px] font-mono font-bold text-neutral-300">{region.market}</span>
          <span className={`text-[9px] font-mono text-right tabular-nums ${vacancyColor(region.officeVacancy)}`}>
            {region.officeVacancy.toFixed(1)}%
          </span>
          <span className={`text-[9px] font-mono text-right tabular-nums ${vacancyColor(region.industrialVacancy)}`}>
            {region.industrialVacancy.toFixed(1)}%
          </span>
          <span className={`text-[9px] font-mono text-right tabular-nums ${vacancyColor(region.retailVacancy)}`}>
            {region.retailVacancy.toFixed(1)}%
          </span>
          <span className="text-[9px] font-mono text-neutral-300 text-right tabular-nums">
            ${region.officeRent.toFixed(2)}
          </span>
          <span className={`text-[9px] font-mono text-right tabular-nums font-bold ${changeColor(region.rentChange)}`}>
            {fmtPct(region.rentChange)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Debt Market Section ──

function DebtMarketSection({ debtMarket }: { debtMarket: any }) {
  return (
    <div className="border-b border-indigo-400/30">
      <div className="px-3 py-1 border-b border-border/20 flex items-center gap-1.5">
        <div className="w-1 h-1 bg-indigo-400" />
        <span className="text-[7px] font-black font-mono uppercase tracking-widest text-indigo-400">
          Debt Market
        </span>
      </div>

      {/* CMBS Spreads */}
      <div className="px-3 py-2 border-b border-border/20">
        <div className="text-[7px] font-bold font-mono uppercase tracking-wider text-neutral-500 mb-1.5">
          CMBS Spreads (bps over Treasury)
        </div>
        <div className="grid grid-cols-5 gap-2">
          {[
            { label: 'AAA', value: debtMarket.cmbsSpreads.aaa },
            { label: 'AA', value: debtMarket.cmbsSpreads.aa },
            { label: 'A', value: debtMarket.cmbsSpreads.a },
            { label: 'BBB', value: debtMarket.cmbsSpreads.bbb },
            { label: 'BB', value: debtMarket.cmbsSpreads.bb },
          ].map((item: any) => (
            <div key={item.label} className="text-center">
              <div className="text-[7px] font-mono text-neutral-500 font-bold">{item.label}</div>
              <div className={`text-[11px] font-mono font-black tabular-nums mt-0.5 ${
                item.value <= 100 ? 'text-green-400' : item.value <= 200 ? 'text-yellow-400' : item.value <= 300 ? 'text-orange-400' : 'text-red-400'
              }`}>
                {item.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Debt Metrics Grid */}
      <div className="grid grid-cols-3 divide-x divide-border/20">
        <div className="px-3 py-2">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[8px] font-mono text-neutral-500">Avg LTV</span>
              <span className={`text-[9px] font-mono font-bold tabular-nums ${
                debtMarket.avgLTV <= 55 ? 'text-green-400' : debtMarket.avgLTV <= 65 ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {debtMarket.avgLTV.toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[8px] font-mono text-neutral-500">Avg DSCR</span>
              <span className={`text-[9px] font-mono font-bold tabular-nums ${
                debtMarket.avgDSCR >= 1.5 ? 'text-green-400' : debtMarket.avgDSCR >= 1.2 ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {debtMarket.avgDSCR.toFixed(2)}x
              </span>
            </div>
          </div>
        </div>
        <div className="px-3 py-2">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[8px] font-mono text-neutral-500">Lending Vol</span>
              <div className="flex items-center gap-1">
                <span className="text-[9px] font-mono font-bold text-neutral-300 tabular-nums">
                  {fmtB(debtMarket.lendingVolume)}
                </span>
                <span className={`text-[7px] font-mono tabular-nums ${changeColor(debtMarket.lendingVolumeChange)}`}>
                  {fmtPct(debtMarket.lendingVolumeChange)}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[8px] font-mono text-neutral-500">Delinquency</span>
              <div className="flex items-center gap-1">
                <span className={`text-[9px] font-mono font-bold tabular-nums ${
                  debtMarket.delinquencyRate <= 3 ? 'text-green-400' : debtMarket.delinquencyRate <= 5 ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {debtMarket.delinquencyRate.toFixed(2)}%
                </span>
                <span className={`text-[7px] font-mono tabular-nums ${changeColor(debtMarket.delinquencyChange)}`}>
                  +{debtMarket.delinquencyChange.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="px-3 py-2">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[8px] font-mono text-neutral-500">Maturing 12M</span>
              <span className="text-[9px] font-mono font-bold text-orange-400 tabular-nums">
                {fmtB(debtMarket.maturingLoans12m)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[8px] font-mono text-neutral-500">Maturing 24M</span>
              <span className="text-[9px] font-mono font-bold text-red-400 tabular-nums">
                {fmtB(debtMarket.maturingLoans24m)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
