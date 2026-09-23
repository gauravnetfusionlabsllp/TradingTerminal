import { useState } from 'react';
import { useBalanceOfPayments } from '../../api/hooks/use-balance-of-payments';

// ── Constants ──

const BLUE = '#60a5fa'; // blue-400
const GREEN = '#4ade80';
const RED = '#f87171';
const AMBER = '#fbbf24';

const COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'EU', name: 'Eurozone' },
  { code: 'UK', name: 'United Kingdom' },
  { code: 'JP', name: 'Japan' },
  { code: 'CN', name: 'China' },
  { code: 'IN', name: 'India' },
  { code: 'BR', name: 'Brazil' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'KR', name: 'South Korea' },
  { code: 'MX', name: 'Mexico' },
  { code: 'CH', name: 'Switzerland' },
] as const;

type CountryCode = (typeof COUNTRIES)[number]['code'];

// ── Interfaces ──

interface CurrentAccountOverview {
  balance: number;
  gdpPct: number;
  prevBalance: number;
  tradeBalance: number;
  primaryIncome: number;
  secondaryIncome: number;
}

interface TradeDetail {
  goodsExports: number;
  goodsImports: number;
  goodsBalance: number;
  goodsYoY: number;
  servicesExports: number;
  servicesImports: number;
  servicesBalance: number;
  servicesYoY: number;
}

interface CapitalAccount {
  fdiInward: number;
  fdiOutward: number;
  fdiNet: number;
  portfolioEquityInflow: number;
  portfolioEquityOutflow: number;
  portfolioDebtInflow: number;
  portfolioDebtOutflow: number;
}

interface Reserves {
  total: number;
  monthsOfImports: number;
  gold: number;
  sdrs: number;
  forex: number;
}

interface TradePartner {
  country: string;
  code: string;
  exports: number;
  imports: number;
  balance: number;
}

interface QuarterlyCA {
  quarter: string;
  value: number;
}

interface CountryBoPData {
  currentAccount: CurrentAccountOverview;
  trade: TradeDetail;
  capital: CapitalAccount;
  reserves: Reserves;
  topPartners: TradePartner[];
  historicalCA: QuarterlyCA[];
}

interface ImbalanceSummary {
  largestSurplus: { code: string; value: number };
  largestDeficit: { code: string; value: number };
}

interface BalanceOfPaymentsData {
  timestamp: string;
  summary: ImbalanceSummary;
  countries: Record<string, CountryBoPData>;
}

// ── Formatting helpers ──

function fmtB(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000) return (n / 1_000).toFixed(1) + 'T';
  return n.toFixed(1) + 'B';
}

function fmtBSigned(n: number): string {
  const prefix = n > 0 ? '+' : '';
  return prefix + '$' + fmtB(n);
}

function fmtPct(n: number): string {
  return (n >= 0 ? '+' : '') + n.toFixed(1) + '%';
}

// ── Color helpers ──

function valColor(n: number): string {
  if (n > 0) return GREEN;
  if (n < 0) return RED;
  return 'rgba(255,255,255,0.3)';
}

function trendArrow(current: number, prev: number): string {
  if (current > prev) return '\u25B2';
  if (current < prev) return '\u25BC';
  return '\u25C6';
}

// ── Section header ──

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 px-2 py-1 bg-white/[0.02] border-b border-border/20">
      <div className="w-1 h-2.5" style={{ backgroundColor: BLUE, opacity: 0.6 }} />
      <span className="text-[7px] font-mono font-black uppercase tracking-wider text-white/40">
        {label}
      </span>
    </div>
  );
}

// ── Breakdown bar ──

function BreakdownBar({
  segments,
}: {
  segments: { label: string; value: number; color: string }[];
}) {
  const total = segments.reduce((s, seg) => s + Math.abs(seg.value), 0);
  if (total === 0) return null;

  return (
    <div className="flex items-center gap-px h-[6px] w-full overflow-hidden bg-white/[0.02]">
      {segments.map((seg) => {
        const pct = (Math.abs(seg.value) / total) * 100;
        return (
          <div
            key={seg.label}
            className="h-full relative group"
            style={{
              width: `${pct}%`,
              backgroundColor: seg.color,
              opacity: 0.5,
            }}
            title={`${seg.label}: $${fmtB(seg.value)}`}
          />
        );
      })}
    </div>
  );
}

// ── Historical CA bar chart (last 8 quarters) ──

function HistoricalCAChart({ data }: { data: QuarterlyCA[] }) {
  if (data.length === 0) return null;
  const maxAbs = Math.max(...data.map((d) => Math.abs(d.value)), 1);
  const barH = 40;
  const midY = barH / 2;

  return (
    <div className="px-2 py-1">
      <svg viewBox={`0 0 ${data.length * 28} ${barH + 12}`} className="w-full" style={{ maxHeight: 56 }}>
        {/* Zero line */}
        <line x1={0} y1={midY} x2={data.length * 28} y2={midY} stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} />
        {data.map((d, i) => {
          const x = i * 28 + 2;
          const w = 22;
          const scale = (midY - 2) / maxAbs;
          const h = Math.abs(d.value) * scale;
          const y = d.value >= 0 ? midY - h : midY;
          const color = d.value >= 0 ? 'rgba(96,165,250,0.5)' : 'rgba(248,113,113,0.5)';

          return (
            <g key={d.quarter}>
              <rect x={x} y={y} width={w} height={Math.max(h, 0.5)} fill={color} />
              <text
                x={x + w / 2}
                y={barH + 8}
                textAnchor="middle"
                fill="rgba(255,255,255,0.25)"
                fontSize={5}
                fontFamily="monospace"
              >
                {d.quarter}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Main Panel ──

export function BalanceOfPaymentsPanel() {
  const { data: hookData, isLoading } = useBalanceOfPayments();
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>('US');

  const data: BalanceOfPaymentsData | undefined = hookData;
  const countryData = data?.countries?.[selectedCountry];
  const summary = data?.summary;

  const countryName = COUNTRIES.find((c) => c.code === selectedCountry)?.name ?? selectedCountry;

  return (
    <div className="h-full flex flex-col bg-black overflow-hidden text-[9px] font-mono">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#050505] border-b border-border/20 shrink-0">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 16 16" className="w-4 h-4">
            <circle cx="8" cy="8" r="6" fill="none" stroke={BLUE} strokeWidth="0.8" opacity="0.4" />
            <path d="M4 8H12" stroke={BLUE} strokeWidth="0.6" opacity="0.3" />
            <path d="M8 4V12" stroke={BLUE} strokeWidth="0.6" opacity="0.3" />
            <path d="M5 5.5Q8 4 11 5.5" fill="none" stroke={BLUE} strokeWidth="0.8" />
            <path d="M5 10.5Q8 12 11 10.5" fill="none" stroke={BLUE} strokeWidth="0.8" />
          </svg>
          <span className="text-[9px] font-black uppercase tracking-tighter" style={{ color: BLUE }}>
            BALANCE OF PAYMENTS
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {summary && (
            <>
              <span className="text-[6px] text-white/20">SURPLUS:</span>
              <span className="text-[7px] font-bold" style={{ color: GREEN }}>
                {summary.largestSurplus?.code} {fmtBSigned(summary.largestSurplus?.value ?? 0)}
              </span>
              <span className="text-[6px] text-white/15">|</span>
              <span className="text-[6px] text-white/20">DEFICIT:</span>
              <span className="text-[7px] font-bold" style={{ color: RED }}>
                {summary.largestDeficit?.code} {fmtBSigned(summary.largestDeficit?.value ?? 0)}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Country tabs */}
      <div className="flex items-center border-b border-border/20 shrink-0 overflow-x-auto scrollbar-thin bg-[#030303]">
        {COUNTRIES.map((c) => (
          <button
            key={c.code}
            onClick={() => setSelectedCountry(c.code)}
            className={`px-2.5 py-1 text-[8px] font-mono font-bold uppercase tracking-wider whitespace-nowrap transition-colors border-b-2 ${
              selectedCountry === c.code
                ? 'text-blue-400 border-blue-400 bg-blue-400/[0.04]'
                : 'text-white/30 border-transparent hover:text-white/50 hover:bg-blue-400/[0.02]'
            }`}
          >
            {c.code}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {isLoading && !hookData ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-2">
              <div className="w-5 h-5 border-2 border-blue-400/30 border-t-blue-400 animate-spin" />
              <span className="text-[10px] text-white/40 uppercase tracking-widest">Loading...</span>
            </div>
          </div>
        ) : !countryData ? (
          <div className="flex items-center justify-center h-full text-[10px] text-white/40 uppercase">
            No data available for {countryName}
          </div>
        ) : (
          <>
            {/* ── Current Account Overview ── */}
            <SectionHeader label="Current Account Overview" />
            <div className="px-2 py-1.5 border-b border-border/20">
              {/* Large balance number */}
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="text-[16px] font-black"
                  style={{ color: valColor(countryData.currentAccount.balance) }}
                >
                  {fmtBSigned(countryData.currentAccount.balance)}
                </span>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[7px] text-white/30">
                    {fmtPct(countryData.currentAccount.gdpPct)} GDP
                  </span>
                  <span
                    className="text-[7px] font-bold"
                    style={{
                      color: valColor(
                        countryData.currentAccount.balance - countryData.currentAccount.prevBalance
                      ),
                    }}
                  >
                    {trendArrow(countryData.currentAccount.balance, countryData.currentAccount.prevBalance)}{' '}
                    {fmtBSigned(
                      countryData.currentAccount.balance - countryData.currentAccount.prevBalance
                    )}{' '}
                    vs prev
                  </span>
                </div>
              </div>

              {/* Breakdown bar */}
              <div className="mb-1">
                <BreakdownBar
                  segments={[
                    { label: 'Trade Balance', value: countryData.currentAccount.tradeBalance, color: valColor(countryData.currentAccount.tradeBalance) },
                    { label: 'Primary Income', value: countryData.currentAccount.primaryIncome, color: '#60a5fa' },
                    { label: 'Secondary Income', value: countryData.currentAccount.secondaryIncome, color: '#a78bfa' },
                  ]}
                />
              </div>
              <div className="flex items-center gap-3 text-[6px] text-white/25">
                <span>
                  <span className="inline-block w-1.5 h-1.5 mr-0.5" style={{ backgroundColor: valColor(countryData.currentAccount.tradeBalance), opacity: 0.5 }} />
                  TRADE {fmtBSigned(countryData.currentAccount.tradeBalance)}
                </span>
                <span>
                  <span className="inline-block w-1.5 h-1.5 mr-0.5" style={{ backgroundColor: '#60a5fa', opacity: 0.5 }} />
                  PRIMARY {fmtBSigned(countryData.currentAccount.primaryIncome)}
                </span>
                <span>
                  <span className="inline-block w-1.5 h-1.5 mr-0.5" style={{ backgroundColor: '#a78bfa', opacity: 0.5 }} />
                  SECONDARY {fmtBSigned(countryData.currentAccount.secondaryIncome)}
                </span>
              </div>
            </div>

            {/* ── Trade Balance Detail ── */}
            <SectionHeader label="Trade Balance Detail" />
            <div className="border-b border-border/20">
              <div className="flex items-center px-2 py-0.5 border-b border-border/20 text-[6px] font-mono text-white/20 uppercase tracking-wider">
                <span className="w-16 shrink-0">TYPE</span>
                <span className="w-14 shrink-0 text-right">EXPORTS</span>
                <span className="w-14 shrink-0 text-right">IMPORTS</span>
                <span className="w-14 shrink-0 text-right">BALANCE</span>
                <span className="w-10 shrink-0 text-right">YOY</span>
              </div>
              {[
                { type: 'GOODS', exp: countryData.trade.goodsExports, imp: countryData.trade.goodsImports, bal: countryData.trade.goodsBalance, yoy: countryData.trade.goodsYoY },
                { type: 'SERVICES', exp: countryData.trade.servicesExports, imp: countryData.trade.servicesImports, bal: countryData.trade.servicesBalance, yoy: countryData.trade.servicesYoY },
                { type: 'TOTAL', exp: countryData.trade.goodsExports + countryData.trade.servicesExports, imp: countryData.trade.goodsImports + countryData.trade.servicesImports, bal: countryData.trade.goodsBalance + countryData.trade.servicesBalance, yoy: 0 },
              ].map((row) => {
                const isTotal = row.type === 'TOTAL';
                return (
                  <div
                    key={row.type}
                    className={`flex items-center px-2 py-[3px] border-b hover:bg-blue-400/[0.02] transition-colors ${
                      isTotal ? 'border-white/[0.08] bg-white/[0.02]' : 'border-white/[0.03]'
                    }`}
                  >
                    <span className={`w-16 shrink-0 text-[8px] ${isTotal ? 'font-black text-white/80' : 'text-white/50'}`}>
                      {row.type}
                    </span>
                    <span className="w-14 shrink-0 text-right text-[7px] text-green-400/60">
                      ${fmtB(row.exp)}
                    </span>
                    <span className="w-14 shrink-0 text-right text-[7px] text-red-400/60">
                      ${fmtB(row.imp)}
                    </span>
                    <span
                      className={`w-14 shrink-0 text-right text-[8px] font-bold ${isTotal ? 'font-black' : ''}`}
                      style={{ color: valColor(row.bal) }}
                    >
                      {fmtBSigned(row.bal)}
                    </span>
                    <span
                      className="w-10 shrink-0 text-right text-[7px] font-bold"
                      style={{ color: isTotal ? 'rgba(255,255,255,0.2)' : valColor(row.yoy) }}
                    >
                      {isTotal ? '--' : fmtPct(row.yoy)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* ── Capital Account ── */}
            <SectionHeader label="Capital Account" />
            <div className="border-b border-border/20">
              {/* FDI */}
              <div className="px-2 py-1 border-b border-white/[0.04]">
                <div className="text-[6px] text-white/20 uppercase tracking-wider mb-0.5">
                  Foreign Direct Investment
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex flex-col">
                    <span className="text-[6px] text-white/20">INWARD</span>
                    <span className="text-[8px] font-bold text-green-400/70">
                      ${fmtB(countryData.capital.fdiInward)}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[6px] text-white/20">OUTWARD</span>
                    <span className="text-[8px] font-bold text-red-400/70">
                      ${fmtB(countryData.capital.fdiOutward)}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[6px] text-white/20">NET</span>
                    <span
                      className="text-[8px] font-black"
                      style={{ color: valColor(countryData.capital.fdiNet) }}
                    >
                      {fmtBSigned(countryData.capital.fdiNet)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Portfolio Flows */}
              <div className="px-2 py-1">
                <div className="text-[6px] text-white/20 uppercase tracking-wider mb-0.5">
                  Portfolio Flows
                </div>
                <div className="flex items-center px-0 py-0.5 text-[6px] font-mono text-white/15 uppercase tracking-wider border-b border-white/[0.04]">
                  <span className="w-14 shrink-0">TYPE</span>
                  <span className="w-14 shrink-0 text-right">INFLOW</span>
                  <span className="w-14 shrink-0 text-right">OUTFLOW</span>
                  <span className="w-14 shrink-0 text-right">NET</span>
                </div>
                {[
                  {
                    type: 'EQUITY',
                    inflow: countryData.capital.portfolioEquityInflow,
                    outflow: countryData.capital.portfolioEquityOutflow,
                  },
                  {
                    type: 'DEBT',
                    inflow: countryData.capital.portfolioDebtInflow,
                    outflow: countryData.capital.portfolioDebtOutflow,
                  },
                ].map((row) => {
                  const net = row.inflow - row.outflow;
                  return (
                    <div
                      key={row.type}
                      className="flex items-center py-[3px] border-b border-white/[0.03] hover:bg-blue-400/[0.02] transition-colors"
                    >
                      <span className="w-14 shrink-0 text-[8px] text-white/50">{row.type}</span>
                      <span className="w-14 shrink-0 text-right text-[7px] text-green-400/60">
                        ${fmtB(row.inflow)}
                      </span>
                      <span className="w-14 shrink-0 text-right text-[7px] text-red-400/60">
                        ${fmtB(row.outflow)}
                      </span>
                      <span
                        className="w-14 shrink-0 text-right text-[8px] font-bold"
                        style={{ color: valColor(net) }}
                      >
                        {fmtBSigned(net)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Reserves ── */}
            <SectionHeader label="Reserves" />
            <div className="border-b border-border/20 px-2 py-1.5">
              <div className="flex items-center gap-4 mb-1">
                <div className="flex flex-col">
                  <span className="text-[6px] text-white/20 uppercase">TOTAL RESERVES</span>
                  <span className="text-[12px] font-black text-blue-400">
                    ${fmtB(countryData.reserves.total)}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[6px] text-white/20 uppercase">MONTHS OF IMPORTS</span>
                  <span className="text-[12px] font-black text-white/60">
                    {countryData.reserves.monthsOfImports.toFixed(1)}
                  </span>
                </div>
              </div>

              {/* Composition */}
              <div className="text-[6px] text-white/20 uppercase tracking-wider mb-0.5">
                COMPOSITION
              </div>
              <div className="flex items-center gap-3">
                {[
                  { label: 'GOLD', value: countryData.reserves.gold, color: AMBER },
                  { label: 'SDRS', value: countryData.reserves.sdrs, color: '#a78bfa' },
                  { label: 'FOREX', value: countryData.reserves.forex, color: BLUE },
                ].map((item) => (
                  <div key={item.label} className="flex flex-col">
                    <span className="text-[6px] text-white/20">{item.label}</span>
                    <span className="text-[8px] font-bold" style={{ color: item.color }}>
                      ${fmtB(item.value)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Composition bar */}
              <div className="mt-1">
                <BreakdownBar
                  segments={[
                    { label: 'Gold', value: countryData.reserves.gold, color: AMBER },
                    { label: 'SDRs', value: countryData.reserves.sdrs, color: '#a78bfa' },
                    { label: 'Forex', value: countryData.reserves.forex, color: BLUE },
                  ]}
                />
              </div>
            </div>

            {/* ── Top Trade Partners ── */}
            <SectionHeader label="Top Trade Partners" />
            <div className="border-b border-border/20">
              <div className="flex items-center px-2 py-0.5 border-b border-border/20 text-[6px] font-mono text-white/20 uppercase tracking-wider">
                <span className="w-16 shrink-0">PARTNER</span>
                <span className="w-14 shrink-0 text-right">EXPORTS</span>
                <span className="w-14 shrink-0 text-right">IMPORTS</span>
                <span className="w-14 shrink-0 text-right">BALANCE</span>
              </div>
              {(countryData.topPartners ?? []).map((p) => (
                <div
                  key={p.code}
                  className="flex items-center px-2 py-[3px] border-b border-white/[0.03] hover:bg-blue-400/[0.02] transition-colors"
                >
                  <div className="w-16 shrink-0 flex flex-col">
                    <span className="text-[8px] font-bold text-white/70">{p.code}</span>
                    <span className="text-[6px] text-white/25 truncate">{p.country}</span>
                  </div>
                  <span className="w-14 shrink-0 text-right text-[7px] text-green-400/60">
                    ${fmtB(p.exports)}
                  </span>
                  <span className="w-14 shrink-0 text-right text-[7px] text-red-400/60">
                    ${fmtB(p.imports)}
                  </span>
                  <span
                    className="w-14 shrink-0 text-right text-[8px] font-bold"
                    style={{ color: valColor(p.balance) }}
                  >
                    {fmtBSigned(p.balance)}
                  </span>
                </div>
              ))}
            </div>

            {/* ── Historical CA (last 8 quarters) ── */}
            <SectionHeader label="Historical Current Account (8Q)" />
            <div className="border-b border-border/20">
              <HistoricalCAChart data={countryData.historicalCA ?? []} />
            </div>

            {/* Footer */}
            <div className="px-2 py-1 border-t border-border/20 bg-white/[0.01]">
              <div className="flex items-center justify-between">
                <span className="text-[6px] text-white/15 uppercase tracking-wider">
                  Source: IMF / BEA / National Central Banks
                </span>
                <span className="text-[6px] text-white/15">
                  {data?.timestamp
                    ? new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '--:--'}
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
