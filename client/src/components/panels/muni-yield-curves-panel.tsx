import { useState } from 'react';
import { useMuniYieldCurves } from '../../api/hooks/use-muni-yield-curves';
import { RefreshCw } from 'lucide-react';

type Tab = 'curves' | 'ratios' | 'issuance' | 'sectors';

const ACCENT = '#4ade80';
const ACCENT_DIM = 'rgba(74,222,128,0.08)';

// ── Helpers ──

function fmtYield(n: number): string {
  return n.toFixed(2) + '%';
}

function fmtChg(n: number): string {
  const sign = n >= 0 ? '+' : '';
  return sign + n.toFixed(2);
}

function chgColor(n: number): string {
  if (n > 0) return 'text-red-400';
  if (n < 0) return 'text-green-400';
  return 'text-neutral-500';
}

function spreadChgColor(n: number): string {
  if (n > 0) return 'text-red-400';
  if (n < 0) return 'text-green-400';
  return 'text-neutral-500';
}

function signalStyle(signal: string): { text: string; bg: string } {
  if (signal === 'Rich') return { text: 'text-red-400', bg: 'bg-red-500/10 border border-red-500/30' };
  if (signal === 'Cheap') return { text: 'text-green-400', bg: 'bg-green-500/10 border border-green-500/30' };
  return { text: 'text-yellow-400', bg: 'bg-yellow-500/10 border border-yellow-500/30' };
}

function ratingBadgeStyle(rating: string): string {
  if (rating.startsWith('AAA')) return 'text-green-400 bg-green-500/10 border border-green-500/30';
  if (rating.startsWith('AA')) return 'text-yellow-400 bg-yellow-500/10 border border-yellow-500/30';
  if (rating.startsWith('A')) return 'text-orange-400 bg-orange-500/10 border border-orange-500/30';
  return 'text-neutral-400 bg-neutral-500/10 border border-neutral-500/30';
}

function typeBadgeStyle(type: string): string {
  if (type === 'GO') return 'text-cyan-400 bg-cyan-500/10 border border-cyan-500/30';
  return 'text-purple-400 bg-purple-500/10 border border-purple-500/30';
}

// ── Main Panel ──

export function MuniYieldCurvesPanel() {
  const [tab, setTab] = useState<Tab>('curves');
  const { data, isLoading, refetch } = useMuniYieldCurves();

  const curves = data?.curves ?? [];
  const ratios = data?.ratios ?? [];
  const issuance = data?.issuance ?? [];
  const sectors = data?.sectors ?? [];
  const summary = data?.summary;

  return (
    <div className="h-full flex flex-col bg-black overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#050505] border-b border-border/30 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5" style={{ backgroundColor: ACCENT }} />
          <span className="text-[9px] font-black font-mono uppercase tracking-tighter" style={{ color: ACCENT }}>
            MUNI YIELD CURVES
          </span>
        </div>
        <button
          onClick={() => refetch()}
          className="p-1 text-neutral-500 hover:text-green-400 transition-colors"
        >
          <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Summary Bar */}
      <div className="grid grid-cols-5 gap-px bg-border/10 border-b border-border/20 shrink-0">
        <SummaryCell label="AAA 10Y" value={summary?.aaa10y != null ? fmtYield(summary.aaa10y) : '--'} accent />
        <SummaryCell label="AA 10Y" value={summary?.aa10y != null ? fmtYield(summary.aa10y) : '--'} />
        <SummaryCell label="M/T RATIO" value={summary?.mtRatio != null ? summary.mtRatio.toFixed(1) + '%' : '--'} />
        <SummaryCell label="ISSUANCE" value={summary?.totalIssuance != null ? '$' + summary.totalIssuance.toFixed(1) + 'B' : '--'} />
        <SummaryCell label="AVG COUPON" value={summary?.avgCoupon != null ? summary.avgCoupon.toFixed(2) + '%' : '--'} />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border/30 bg-black/40 shrink-0">
        {(['curves', 'ratios', 'issuance', 'sectors'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-1.5 text-[8px] font-black uppercase tracking-widest border-b-2 transition-colors ${
              tab === t
                ? 'border-green-400 text-green-400'
                : 'border-transparent text-neutral-500 hover:text-neutral-300'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto no-scrollbar">
        {isLoading && !data && (
          <div className="text-center py-8 text-green-400 text-[9px] font-mono uppercase animate-pulse">
            Loading...
          </div>
        )}

        {!isLoading && !data && (
          <div className="flex items-center justify-center h-full text-neutral/40 text-[10px] font-mono uppercase tracking-widest">No data available</div>
        )}

        {data && tab === 'curves' && <CurvesTab curves={curves} />}
        {data && tab === 'ratios' && <RatiosTab ratios={ratios} />}
        {data && tab === 'issuance' && <IssuanceTab issuance={issuance} />}
        {data && tab === 'sectors' && <SectorsTab sectors={sectors} />}
      </div>
    </div>
  );
}

// ── Summary Cell ──

function SummaryCell({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="px-2 py-1.5 bg-black">
      <div className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider">{label}</div>
      <div
        className={`text-[11px] font-mono font-black mt-0.5 ${accent ? '' : 'text-white'}`}
        style={accent ? { color: ACCENT } : undefined}
      >
        {value}
      </div>
    </div>
  );
}

// ── Curves Tab ──

interface CurveRow {
  tenor: string;
  aaa: number;
  aaaChg: number;
  aa: number;
  aaChg: number;
  a: number;
  aChg: number;
}

function CurvesTab({ curves }: { curves: CurveRow[] }) {
  const maxYield = Math.max(...curves.map((c) => Math.max(c.aaa, c.aa, c.a)));

  return (
    <div>
      {/* Column headers */}
      <div className="grid grid-cols-[60px_1fr_1fr_1fr_minmax(80px,1fr)] px-3 py-1 border-b border-border/20">
        <span className="text-[7px] font-black font-mono uppercase tracking-wider text-neutral-500">Tenor</span>
        <span className="text-[7px] font-black font-mono uppercase tracking-wider text-green-400 text-right">AAA</span>
        <span className="text-[7px] font-black font-mono uppercase tracking-wider text-yellow-400 text-right">AA</span>
        <span className="text-[7px] font-black font-mono uppercase tracking-wider text-orange-400 text-right">A</span>
        <span className="text-[7px] font-black font-mono uppercase tracking-wider text-neutral-500 text-right">Curve</span>
      </div>

      {curves.map((row, i) => {
        const aaaBarW = maxYield > 0 ? (row.aaa / maxYield) * 100 : 0;
        const aaBarW = maxYield > 0 ? (row.aa / maxYield) * 100 : 0;
        const aBarW = maxYield > 0 ? (row.a / maxYield) * 100 : 0;

        return (
          <div
            key={row.tenor}
            className={`grid grid-cols-[60px_1fr_1fr_1fr_minmax(80px,1fr)] px-3 py-1.5 border-b border-border/10 transition-colors hover:bg-white/[0.02] ${
              i % 2 === 0 ? 'bg-black' : 'bg-white/[0.01]'
            }`}
          >
            {/* Tenor */}
            <span className="text-[9px] font-mono font-bold" style={{ color: ACCENT }}>{row.tenor}</span>

            {/* AAA */}
            <div className="text-right">
              <span className="text-[9px] font-mono font-bold text-green-400">{row.aaa.toFixed(2)}</span>
              <span className={`text-[7px] font-mono ml-1 ${chgColor(row.aaaChg)}`}>{fmtChg(row.aaaChg)}</span>
            </div>

            {/* AA */}
            <div className="text-right">
              <span className="text-[9px] font-mono font-bold text-yellow-400">{row.aa.toFixed(2)}</span>
              <span className={`text-[7px] font-mono ml-1 ${chgColor(row.aaChg)}`}>{fmtChg(row.aaChg)}</span>
            </div>

            {/* A */}
            <div className="text-right">
              <span className="text-[9px] font-mono font-bold text-orange-400">{row.a.toFixed(2)}</span>
              <span className={`text-[7px] font-mono ml-1 ${chgColor(row.aChg)}`}>{fmtChg(row.aChg)}</span>
            </div>

            {/* Bar visualization */}
            <div className="flex flex-col justify-center gap-0.5 pl-2">
              <div className="flex items-center gap-1">
                <div className="h-[3px] bg-green-400/40" style={{ width: `${aaaBarW}%` }} />
              </div>
              <div className="flex items-center gap-1">
                <div className="h-[3px] bg-yellow-400/40" style={{ width: `${aaBarW}%` }} />
              </div>
              <div className="flex items-center gap-1">
                <div className="h-[3px] bg-orange-400/40" style={{ width: `${aBarW}%` }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Ratios Tab ──

interface RatioRow {
  tenor: string;
  ratio: number;
  percentile: number;
  signal: string;
}

function RatiosTab({ ratios }: { ratios: RatioRow[] }) {
  return (
    <div>
      {/* Column headers */}
      <div className="grid grid-cols-[60px_1fr_1fr_1fr] px-3 py-1 border-b border-border/20">
        <span className="text-[7px] font-black font-mono uppercase tracking-wider text-green-400">Tenor</span>
        <span className="text-[7px] font-black font-mono uppercase tracking-wider text-neutral-500 text-right">Ratio %</span>
        <span className="text-[7px] font-black font-mono uppercase tracking-wider text-neutral-500 text-right">Percentile</span>
        <span className="text-[7px] font-black font-mono uppercase tracking-wider text-neutral-500 text-right">Signal</span>
      </div>

      {ratios.map((row, i) => {
        const sig = signalStyle(row.signal);
        return (
          <div
            key={row.tenor}
            className={`grid grid-cols-[60px_1fr_1fr_1fr] px-3 py-1.5 border-b border-border/10 transition-colors hover:bg-white/[0.02] ${
              i % 2 === 0 ? 'bg-black' : 'bg-white/[0.01]'
            }`}
          >
            <span className="text-[9px] font-mono font-bold" style={{ color: ACCENT }}>{row.tenor}</span>
            <span className="text-[9px] font-mono font-bold text-white text-right">{row.ratio.toFixed(1)}%</span>
            <div className="text-right flex items-center justify-end gap-1">
              <div className="w-12 h-1.5 bg-white/[0.04] overflow-hidden">
                <div
                  className="h-full"
                  style={{
                    width: `${row.percentile}%`,
                    backgroundColor: row.percentile < 30 ? '#4ade80' : row.percentile > 70 ? '#f87171' : '#facc15',
                  }}
                />
              </div>
              <span className="text-[8px] font-mono text-neutral-400">{row.percentile}th</span>
            </div>
            <div className="text-right">
              <span className={`px-1.5 py-0.5 text-[7px] font-black font-mono uppercase tracking-wider ${sig.text} ${sig.bg}`}>
                {row.signal}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Issuance Tab ──

interface IssuanceRow {
  issuer: string;
  coupon: number;
  maturity: string;
  rating: string;
  size: number;
  spread: number;
  type: string;
  taxStatus: string;
}

function IssuanceTab({ issuance }: { issuance: IssuanceRow[] }) {
  return (
    <div>
      {/* Column headers */}
      <div className="grid grid-cols-[1.4fr_0.6fr_0.6fr_0.5fr_0.6fr_0.5fr_0.6fr_0.7fr] px-3 py-1 border-b border-border/20 gap-1">
        <span className="text-[7px] font-black font-mono uppercase tracking-wider text-green-400">Issuer</span>
        <span className="text-[7px] font-black font-mono uppercase tracking-wider text-neutral-500 text-right">Coupon</span>
        <span className="text-[7px] font-black font-mono uppercase tracking-wider text-neutral-500 text-right">Maturity</span>
        <span className="text-[7px] font-black font-mono uppercase tracking-wider text-neutral-500 text-right">Rating</span>
        <span className="text-[7px] font-black font-mono uppercase tracking-wider text-neutral-500 text-right">Size</span>
        <span className="text-[7px] font-black font-mono uppercase tracking-wider text-neutral-500 text-right">Spread</span>
        <span className="text-[7px] font-black font-mono uppercase tracking-wider text-neutral-500 text-right">Type</span>
        <span className="text-[7px] font-black font-mono uppercase tracking-wider text-neutral-500 text-right">Tax</span>
      </div>

      {issuance.map((row, i) => (
        <div
          key={row.issuer + row.maturity}
          className={`grid grid-cols-[1.4fr_0.6fr_0.6fr_0.5fr_0.6fr_0.5fr_0.6fr_0.7fr] px-3 py-1.5 border-b border-border/10 transition-colors hover:bg-white/[0.02] gap-1 ${
            i % 2 === 0 ? 'bg-black' : 'bg-white/[0.01]'
          }`}
        >
          <span className="text-[8px] font-mono font-bold truncate" style={{ color: ACCENT }}>{row.issuer}</span>
          <span className="text-[8px] font-mono text-white text-right">{row.coupon.toFixed(2)}%</span>
          <span className="text-[8px] font-mono text-neutral-400 text-right">{row.maturity}</span>
          <div className="text-right">
            <span className={`px-1 py-0.5 text-[7px] font-black font-mono uppercase ${ratingBadgeStyle(row.rating)}`}>
              {row.rating}
            </span>
          </div>
          <span className="text-[8px] font-mono text-white text-right">${row.size}M</span>
          <span className="text-[8px] font-mono text-neutral-400 text-right">+{row.spread}bp</span>
          <div className="text-right">
            <span className={`px-1 py-0.5 text-[7px] font-black font-mono uppercase ${typeBadgeStyle(row.type)}`}>
              {row.type}
            </span>
          </div>
          <span className="text-[7px] font-mono text-neutral-500 text-right">{row.taxStatus}</span>
        </div>
      ))}
    </div>
  );
}

// ── Sectors Tab ──

interface SectorRow {
  sector: string;
  spread: number;
  chg1w: number;
  chg1m: number;
}

function SectorsTab({ sectors }: { sectors: SectorRow[] }) {
  const maxSpread = Math.max(...sectors.map((s) => s.spread));

  return (
    <div>
      {/* Column headers */}
      <div className="grid grid-cols-[1.2fr_0.8fr_0.6fr_0.6fr_1fr] px-3 py-1 border-b border-border/20">
        <span className="text-[7px] font-black font-mono uppercase tracking-wider text-green-400">Sector</span>
        <span className="text-[7px] font-black font-mono uppercase tracking-wider text-neutral-500 text-right">Spread (bp)</span>
        <span className="text-[7px] font-black font-mono uppercase tracking-wider text-neutral-500 text-right">1W Chg</span>
        <span className="text-[7px] font-black font-mono uppercase tracking-wider text-neutral-500 text-right">1M Chg</span>
        <span className="text-[7px] font-black font-mono uppercase tracking-wider text-neutral-500 text-right">Width</span>
      </div>

      {sectors.map((row, i) => {
        const barW = maxSpread > 0 ? (row.spread / maxSpread) * 100 : 0;

        return (
          <div
            key={row.sector}
            className={`grid grid-cols-[1.2fr_0.8fr_0.6fr_0.6fr_1fr] px-3 py-1.5 border-b border-border/10 transition-colors hover:bg-white/[0.02] ${
              i % 2 === 0 ? 'bg-black' : 'bg-white/[0.01]'
            }`}
          >
            <span className="text-[8px] font-mono font-bold truncate" style={{ color: ACCENT }}>{row.sector}</span>
            <span className="text-[9px] font-mono font-bold text-white text-right">+{row.spread}</span>
            <span className={`text-[8px] font-mono font-bold text-right ${spreadChgColor(row.chg1w)}`}>
              {row.chg1w >= 0 ? '+' : ''}{row.chg1w}
            </span>
            <span className={`text-[8px] font-mono font-bold text-right ${spreadChgColor(row.chg1m)}`}>
              {row.chg1m >= 0 ? '+' : ''}{row.chg1m}
            </span>
            <div className="flex items-center justify-end gap-1 pl-2">
              <div className="flex-1 h-[5px] overflow-hidden" style={{ backgroundColor: ACCENT_DIM }}>
                <div
                  className="h-full"
                  style={{
                    width: `${barW}%`,
                    backgroundColor: ACCENT,
                    opacity: 0.5,
                  }}
                />
              </div>
              <span className="text-[7px] font-mono text-neutral-600 w-6 text-right">{row.spread}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
