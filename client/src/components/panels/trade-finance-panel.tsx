import { useTradeFinance } from '../../api/hooks/use-trade-finance';
import { useT, tr, TFn } from '../../i18n';
import { RefreshCw, Ship } from 'lucide-react';

// ── Formatting helpers ──

function fmtVol(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e12) return '$' + (n / 1e12).toFixed(1) + 'T';
  if (abs >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B';
  if (abs >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
  return '$' + n.toFixed(0);
}

function fmtCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e12) return (n / 1e12).toFixed(2) + 'T';
  if (abs >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (abs >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  return n.toFixed(0);
}

function fmtPct(n: number): string {
  return n.toFixed(2) + '%';
}

function fmtBps(n: number): string {
  return n.toFixed(0) + 'bp';
}

// ── Color helpers ──

function trendBadgeStyle(trend: string): { text: string; bg: string; label: string } {
  if (trend === 'tightening') return { text: 'text-green-400', bg: 'bg-green-500/10 border border-green-500/30', label: 'TIGHT' };
  if (trend === 'widening') return { text: 'text-red-400', bg: 'bg-red-500/10 border border-red-500/30', label: 'WIDE' };
  return { text: 'text-yellow-400', bg: 'bg-yellow-500/10 border border-yellow-500/30', label: 'STABLE' };
}

function riskColor(n: number): string {
  if (n <= 2) return 'text-green-400';
  if (n <= 3) return 'text-emerald-400';
  if (n <= 4) return 'text-yellow-400';
  if (n <= 5) return 'text-orange-400';
  if (n <= 6) return 'text-red-400';
  return 'text-red-500';
}

function riskBg(n: number): string {
  if (n <= 2) return 'bg-green-500/10';
  if (n <= 3) return 'bg-emerald-500/10';
  if (n <= 4) return 'bg-yellow-500/10';
  if (n <= 5) return 'bg-orange-500/10';
  if (n <= 6) return 'bg-red-500/10';
  return 'bg-red-500/20';
}

function coverBadgeStyle(cover: string): { text: string; bg: string; label: string } {
  if (cover === 'available') return { text: 'text-green-400', bg: 'bg-green-500/10 border border-green-500/30', label: 'AVAILABLE' };
  if (cover === 'restricted') return { text: 'text-yellow-400', bg: 'bg-yellow-500/10 border border-yellow-500/30', label: 'RESTRICTED' };
  if (cover === 'limited') return { text: 'text-orange-400', bg: 'bg-orange-500/10 border border-orange-500/30', label: 'LIMITED' };
  return { text: 'text-red-400', bg: 'bg-red-500/10 border border-red-500/30', label: 'OFF COVER' };
}

function statusBadgeStyle(status: string): { text: string; bg: string } {
  if (status === 'active') return { text: 'text-green-400', bg: 'bg-green-500/10 border border-green-500/30' };
  if (status === 'restructuring') return { text: 'text-yellow-400', bg: 'bg-yellow-500/10 border border-yellow-500/30' };
  return { text: 'text-red-400', bg: 'bg-red-500/10 border border-red-500/30' };
}

function utilizationColor(pct: number): string {
  if (pct >= 85) return 'text-red-400';
  if (pct >= 70) return 'text-yellow-400';
  return 'text-green-400';
}

function utilizationBarColor(pct: number): string {
  if (pct >= 85) return 'bg-red-500';
  if (pct >= 70) return 'bg-yellow-500';
  return 'bg-green-500';
}

// ── Section Header ──

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="px-3 py-1 border-b border-yellow-400/30 flex items-center gap-2">
      <div className="w-1 h-1 bg-yellow-400" />
      <span className="text-[7px] font-black font-mono uppercase tracking-widest text-yellow-400">
        {label}
      </span>
    </div>
  );
}

// ── Overview Section ──

function OverviewSection({ overview, t }: { overview: any; t: ReturnType<typeof useT> }) {
  const metrics = [
    { label: tr(t, 'tfTotalVol', 'Total Volume'), value: fmtVol(overview.totalVolume) },
    { label: tr(t, 'tfGap', 'Finance Gap'), value: fmtVol(overview.tradeFinanceGap) },
    { label: tr(t, 'tfLcVol', 'LC Volume'), value: fmtVol(overview.lcVolume) },
    { label: tr(t, 'tfScfVol', 'SCF Volume'), value: fmtVol(overview.scfVolume) },
    { label: tr(t, 'tfFactoring', 'Factoring'), value: fmtVol(overview.factoringVolume) },
    { label: tr(t, 'tfForfaiting', 'Forfaiting'), value: fmtVol(overview.forfaitingVolume) },
  ];

  return (
    <div className="border-b border-yellow-400/30">
      <SectionHeader label={tr(t, 'tfOverview', 'Overview')} />
      <div className="grid grid-cols-6 gap-px bg-border/10">
        {metrics.map((m: any) => (
          <div key={m.label} className="bg-black px-2 py-1.5">
            <div className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider">
              {m.label}
            </div>
            <div className="text-[9px] font-mono font-bold text-white tabular-nums">
              {m.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── LC Rates Table ──

function LcRatesSection({ lcRates, t }: { lcRates: any[]; t: ReturnType<typeof useT> }) {
  return (
    <div className="border-b border-yellow-400/30">
      <SectionHeader label={tr(t, 'tfLcRates', 'Letter of Credit Rates')} />
      <div className="grid grid-cols-[1fr_52px_52px_40px_56px_48px_48px] gap-0 px-2 py-0.5 border-b border-border/20 bg-[#030303]">
        <span className="text-[7px] font-mono text-neutral-600 uppercase">Corridor</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase text-right">Price</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase text-right">Conf Fee</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase text-right">Tenor</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase text-right">Avg Size</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase text-right">Default</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase text-center">Trend</span>
      </div>
      {lcRates.map((row: any) => {
        const badge = trendBadgeStyle(row.trend);
        return (
          <div
            key={row.corridor}
            className="grid grid-cols-[1fr_52px_52px_40px_56px_48px_48px] gap-0 px-2 py-[3px] border-b border-border/20 hover:bg-yellow-400/[0.02] transition-colors items-center"
          >
            <span className="text-[8px] font-mono font-bold text-white">{row.corridor}</span>
            <span className="text-[8px] font-mono text-yellow-400/80 text-right tabular-nums">{fmtBps(row.pricingBps)}</span>
            <span className="text-[8px] font-mono text-neutral-400 text-right tabular-nums">{fmtPct(row.confirmationFee)}</span>
            <span className="text-[8px] font-mono text-neutral-500 text-right">{row.tenor}</span>
            <span className="text-[8px] font-mono text-neutral-400 text-right tabular-nums">{fmtVol(row.avgSize)}</span>
            <span className="text-[8px] font-mono text-neutral-500 text-right tabular-nums">{fmtPct(row.defaultRate)}</span>
            <div className="flex justify-center">
              <span className={`px-1 py-px text-[6px] font-mono font-black uppercase ${badge.text} ${badge.bg}`}>
                {badge.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Supply Chain Finance Section ──

function ScfSection({ scf, t }: { scf: any[]; t: ReturnType<typeof useT> }) {
  return (
    <div className="border-b border-yellow-400/30">
      <SectionHeader label={tr(t, 'tfScf', 'Supply Chain Finance')} />
      <div className="grid grid-cols-[1fr_56px_64px_52px_48px_44px] gap-0 px-2 py-0.5 border-b border-border/20 bg-[#030303]">
        <span className="text-[7px] font-mono text-neutral-600 uppercase">Buyer</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase text-right">Facility</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase text-right">Util %</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase text-right">Disc Rate</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase text-right">Suppliers</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase text-right">Terms</span>
      </div>
      {scf.map((row: any) => (
        <div
          key={row.buyer}
          className="grid grid-cols-[1fr_56px_64px_52px_48px_44px] gap-0 px-2 py-[3px] border-b border-border/20 hover:bg-yellow-400/[0.02] transition-colors items-center"
        >
          <span className="text-[8px] font-mono font-bold text-white truncate">{row.buyer}</span>
          <span className="text-[8px] font-mono text-neutral-400 text-right tabular-nums">{fmtVol(row.facility)}</span>
          <div className="flex items-center gap-1 justify-end">
            <div className="w-10 h-[3px] bg-neutral-800 relative">
              <div
                className={`absolute left-0 top-0 h-full ${utilizationBarColor(row.utilization)}`}
                style={{ width: `${Math.min(row.utilization, 100)}%` }}
              />
            </div>
            <span className={`text-[8px] font-mono font-bold text-right tabular-nums ${utilizationColor(row.utilization)}`}>
              {fmtPct(row.utilization)}
            </span>
          </div>
          <span className="text-[8px] font-mono text-yellow-400/80 text-right tabular-nums">{fmtPct(row.discountRate)}</span>
          <span className="text-[8px] font-mono text-neutral-500 text-right tabular-nums">{row.supplierCount.toLocaleString()}</span>
          <span className="text-[8px] font-mono text-neutral-500 text-right">{row.paymentTerms}</span>
        </div>
      ))}
    </div>
  );
}

// ── Trade Receivables Section ──

function ReceivablesSection({ receivables, t }: { receivables: any; t: ReturnType<typeof useT> }) {
  return (
    <div className="border-b border-yellow-400/30">
      <SectionHeader label={tr(t, 'tfReceivables', 'Trade Receivables')} />
      {/* Summary metrics */}
      <div className="grid grid-cols-4 gap-px bg-border/10 border-b border-border/20">
        {[
          { label: tr(t, 'tfOutstanding', 'Outstanding'), value: fmtVol(receivables.outstanding) },
          { label: tr(t, 'tfSecuritized', 'Securitized'), value: fmtVol(receivables.securitized) },
          { label: tr(t, 'tfAvgYield', 'Avg Yield'), value: fmtPct(receivables.avgYield) },
          { label: tr(t, 'tfDefaultRate', 'Default Rate'), value: fmtPct(receivables.defaultRate) },
        ].map((m: any) => (
          <div key={m.label} className="bg-black px-2 py-1.5">
            <div className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider">{m.label}</div>
            <div className="text-[9px] font-mono font-bold text-white tabular-nums">{m.value}</div>
          </div>
        ))}
      </div>
      {/* By region breakdown */}
      <div className="grid grid-cols-[1fr_56px_44px_44px_44px] gap-0 px-2 py-0.5 border-b border-border/20 bg-[#030303]">
        <span className="text-[7px] font-mono text-neutral-600 uppercase">Region</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase text-right">Amount</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase text-right">Share</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase text-right">Yield</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase text-right">Default</span>
      </div>
      {receivables.byRegion.map((row: any) => (
        <div
          key={row.region}
          className="grid grid-cols-[1fr_56px_44px_44px_44px] gap-0 px-2 py-[3px] border-b border-border/20 hover:bg-yellow-400/[0.02] transition-colors items-center"
        >
          <span className="text-[8px] font-mono font-bold text-white">{row.region}</span>
          <span className="text-[8px] font-mono text-neutral-400 text-right tabular-nums">{fmtVol(row.amount)}</span>
          <span className="text-[8px] font-mono text-yellow-400/80 text-right tabular-nums">{fmtPct(row.share)}</span>
          <span className="text-[8px] font-mono text-green-400/80 text-right tabular-nums">{fmtPct(row.yield)}</span>
          <span className={`text-[8px] font-mono text-right tabular-nums ${row.defaultRate >= 1.0 ? 'text-red-400' : 'text-neutral-500'}`}>
            {fmtPct(row.defaultRate)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Country Risk Premiums Section ──

function CountryRiskSection({ risks, t }: { risks: any[]; t: ReturnType<typeof useT> }) {
  return (
    <div className="border-b border-yellow-400/30">
      <SectionHeader label={tr(t, 'tfCountryRisk', 'Country Risk Premiums')} />
      <div className="grid grid-cols-[1fr_36px_36px_52px_44px_64px] gap-0 px-2 py-0.5 border-b border-border/20 bg-[#030303]">
        <span className="text-[7px] font-mono text-neutral-600 uppercase">Country</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase text-center">ST</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase text-center">MT</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase text-right">Premium</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase text-right">Delay</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase text-center">Cover</span>
      </div>
      {risks.map((row: any) => {
        const cover = coverBadgeStyle(row.coverAvailability);
        return (
          <div
            key={row.country}
            className="grid grid-cols-[1fr_36px_36px_52px_44px_64px] gap-0 px-2 py-[3px] border-b border-border/20 hover:bg-yellow-400/[0.02] transition-colors items-center"
          >
            <span className="text-[8px] font-mono font-bold text-white">{row.country}</span>
            <div className="flex justify-center">
              <span className={`w-5 h-4 flex items-center justify-center text-[8px] font-mono font-bold tabular-nums ${riskColor(row.stRisk)} ${riskBg(row.stRisk)}`}>
                {row.stRisk}
              </span>
            </div>
            <div className="flex justify-center">
              <span className={`w-5 h-4 flex items-center justify-center text-[8px] font-mono font-bold tabular-nums ${riskColor(row.mtRisk)} ${riskBg(row.mtRisk)}`}>
                {row.mtRisk}
              </span>
            </div>
            <span className="text-[8px] font-mono text-yellow-400/80 text-right tabular-nums">{fmtBps(row.premiumBps)}</span>
            <span className="text-[8px] font-mono text-neutral-500 text-right tabular-nums">{row.paymentDelay}d</span>
            <div className="flex justify-center">
              <span className={`px-1 py-px text-[6px] font-mono font-black uppercase ${cover.text} ${cover.bg}`}>
                {cover.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Digitalization Section ──

function DigitalizationSection({ digi, t }: { digi: any; t: ReturnType<typeof useT> }) {
  return (
    <div className="border-b border-yellow-400/30">
      <SectionHeader label={tr(t, 'tfDigital', 'Digitalization')} />
      {/* KPI metrics */}
      <div className="grid grid-cols-3 gap-px bg-border/10 border-b border-border/20">
        {[
          { label: tr(t, 'tfBlockchainLc', 'Blockchain LC'), value: fmtPct(digi.blockchainLcPct), sub: 'of total LC' },
          { label: tr(t, 'tfEbl', 'e-BL Penetration'), value: fmtPct(digi.eblPenetration), sub: 'of ocean trade' },
          { label: tr(t, 'tfEblGrowth', 'e-BL Growth'), value: '+' + fmtPct(digi.eblGrowthPct), sub: 'YoY' },
        ].map((m: any) => (
          <div key={m.label} className="bg-black px-2 py-1.5">
            <div className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider">{m.label}</div>
            <div className="flex items-baseline gap-1">
              <span className="text-[9px] font-mono font-bold text-yellow-400 tabular-nums">{m.value}</span>
              <span className="text-[6px] font-mono text-neutral-700">{m.sub}</span>
            </div>
          </div>
        ))}
      </div>
      {/* Platform status table */}
      <div className="grid grid-cols-[1fr_72px_56px_56px_52px] gap-0 px-2 py-0.5 border-b border-border/20 bg-[#030303]">
        <span className="text-[7px] font-mono text-neutral-600 uppercase">Platform</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase">Type</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase text-center">Status</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase text-right">Txns</span>
        <span className="text-[7px] font-mono text-neutral-600 uppercase text-right">Volume</span>
      </div>
      {digi.platforms.map((p: any) => {
        const sBadge = statusBadgeStyle(p.status);
        return (
          <div
            key={p.name}
            className="grid grid-cols-[1fr_72px_56px_56px_52px] gap-0 px-2 py-[3px] border-b border-border/20 hover:bg-yellow-400/[0.02] transition-colors items-center"
          >
            <span className="text-[8px] font-mono font-bold text-white">{p.name}</span>
            <span className="text-[7px] font-mono text-neutral-500 truncate">{p.type}</span>
            <div className="flex justify-center">
              <span className={`px-1 py-px text-[6px] font-mono font-black uppercase ${sBadge.text} ${sBadge.bg}`}>
                {p.status.toUpperCase()}
              </span>
            </div>
            <span className="text-[8px] font-mono text-neutral-400 text-right tabular-nums">
              {p.transactions > 0 ? p.transactions.toLocaleString() : '-'}
            </span>
            <span className="text-[8px] font-mono text-neutral-400 text-right tabular-nums">
              {p.volume > 0 ? fmtCompact(p.volume) : '-'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Panel ──

export function TradeFinancePanel() {
  const t = useT();
  const { data, isLoading, refetch } = useTradeFinance();

  const d = data;

  return (
    <div className="h-full flex flex-col bg-black overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#050505] border-b border-yellow-400/30 shrink-0">
        <div className="flex items-center gap-2">
          <Ship className="w-3.5 h-3.5 text-yellow-400" />
          <span className="text-[9px] font-black font-mono uppercase tracking-tighter text-yellow-400">
            {tr(t, 'tfTitle', 'Trade Finance')}
          </span>
          {d?.overview && (
            <span className="text-[7px] font-mono text-neutral-600 ml-1">
              Vol {fmtVol(d.overview.totalVolume)}
            </span>
          )}
          {d?.overview && (
            <span className="text-[7px] font-mono text-red-400/70 ml-1">
              Gap {fmtVol(d.overview.tradeFinanceGap)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {d?.timestamp && (
            <span className="text-[6px] font-mono text-neutral-700">
              {new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={() => refetch()}
            className="p-1 text-neutral-500 hover:text-yellow-400 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto no-scrollbar text-[9px] font-mono">
        {isLoading && !data && (
          <div className="text-center py-8 text-yellow-400 text-[9px] font-mono uppercase animate-pulse">
            {tr(t, 'loading', 'Loading...')}
          </div>
        )}

        {!isLoading && !data && (
          <div className="text-center py-8 text-neutral-500 text-[9px] font-mono uppercase">
            {tr(t, 'tfNoData', 'No data available')}
          </div>
        )}

        {d && (
          <>
            <OverviewSection overview={d.overview} t={t} />
            <LcRatesSection lcRates={d.lcRates} t={t} />
            <ScfSection scf={d.supplyChainFinance} t={t} />
            <ReceivablesSection receivables={d.tradeReceivables} t={t} />
            <CountryRiskSection risks={d.countryRisk} t={t} />
            <DigitalizationSection digi={d.digitalization} t={t} />
          </>
        )}
      </div>
    </div>
  );
}
