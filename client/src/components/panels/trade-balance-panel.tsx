import { useTradeBalance } from '../../api/hooks/use-trade-balance';
import { useT, tr, TFn } from '../../i18n';
import { RefreshCw } from 'lucide-react';

// ── Constants ──

const CYAN = '#22d3ee'; // cyan-400
const GREEN = '#4ade80';
const RED = '#f87171';
const AMBER = '#fbbf24';

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

function fmtM(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000) return (n / 1_000).toFixed(1) + 'B';
  return n.toFixed(0) + 'M';
}

// ── Color helpers ──

function balanceColor(n: number): string {
  if (n > 0) return GREEN;
  if (n < 0) return RED;
  return AMBER;
}

function changeColor(n: number): string {
  if (n > 0) return GREEN;
  if (n < 0) return RED;
  return AMBER;
}

// ── Types ($B) ──

interface CountryBalance {
  country: string;
  code: string;
  balance: number;
  exports: number;
  imports: number;
  changePct: number;
  trend: 'improving' | 'worsening' | 'stable';
}

interface CurrentAccountEntry {
  component: string;
  value: number;
  prevValue: number;
  changePct: number;
}

interface TopPartner {
  country: string;
  code: string;
  totalTrade: number;
  exports: number;
  imports: number;
  sharePct: number;
}

interface TradeCategory {
  category: string;
  exports: number;
  imports: number;
  balance: number;
  changePct: number;
}

interface ContainerEntry {
  port: string;
  teus: number;
  changePct: number;
  utilizationPct: number;
}

interface PolicyEntry {
  action: string;
  target: string;
  status: 'active' | 'proposed' | 'expired';
  effectDate: string;
  impactB: number;
}

interface TradeBalanceData {
  timestamp: string;
  headlineBalance: number;
  headlineChangePct: number;
  period: string;
  countries: CountryBalance[];
  currentAccount: CurrentAccountEntry[];
  topPartners: TopPartner[];
  categories: TradeCategory[];
  containers: ContainerEntry[];
  policies: PolicyEntry[];
}

// ── Horizontal balance bar ──

function BalanceBar({ value, maxAbs }: { value: number; maxAbs: number }) {
  const pct = maxAbs > 0 ? Math.min(Math.abs(value) / maxAbs * 100, 100) : 0;
  const color = balanceColor(value);

  return (
    <div className="flex-1 h-[5px] bg-white/[0.03] relative overflow-hidden">
      {value >= 0 ? (
        <div
          className="absolute top-0 left-1/2 h-full"
          style={{ width: `${pct / 2}%`, backgroundColor: color, opacity: 0.5 }}
        />
      ) : (
        <div
          className="absolute top-0 h-full"
          style={{ width: `${pct / 2}%`, right: '50%', backgroundColor: color, opacity: 0.5 }}
        />
      )}
      <div className="absolute top-0 left-1/2 w-px h-full bg-white/10" />
    </div>
  );
}

// ── Utilization bar ──

function UtilBar({ pct }: { pct: number }) {
  const color = pct >= 90 ? RED : pct >= 80 ? AMBER : GREEN;

  return (
    <div className="w-12 h-[5px] bg-white/[0.04] relative overflow-hidden">
      <div
        className="absolute top-0 left-0 h-full"
        style={{ width: `${pct}%`, backgroundColor: color, opacity: 0.6 }}
      />
    </div>
  );
}

// ── Section header ──

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 px-2 py-1 bg-white/[0.02] border-b border-border/20">
      <div className="w-1 h-2.5" style={{ backgroundColor: CYAN, opacity: 0.6 }} />
      <span className="text-[7px] font-mono font-black uppercase tracking-wider text-white/40">
        {label}
      </span>
    </div>
  );
}

// ── Status badge ──

function StatusBadge({ status }: { status: 'active' | 'proposed' | 'expired' }) {
  const cfg = {
    active: { text: 'ACTIVE', color: RED, bg: 'rgba(248,113,113,0.12)' },
    proposed: { text: 'PROPOSED', color: AMBER, bg: 'rgba(251,191,36,0.1)' },
    expired: { text: 'EXPIRED', color: 'rgba(255,255,255,0.3)', bg: 'rgba(255,255,255,0.03)' },
  }[status];

  return (
    <span
      className="text-[5px] font-mono font-black uppercase px-1 py-0"
      style={{ color: cfg.color, backgroundColor: cfg.bg }}
    >
      {cfg.text}
    </span>
  );
}

// ── Trend badge ──

function TrendBadge({ trend }: { trend: 'improving' | 'worsening' | 'stable' }) {
  const cfg = {
    improving: { text: 'IMPROVING', color: GREEN, bg: 'rgba(74,222,128,0.1)' },
    worsening: { text: 'WORSENING', color: RED, bg: 'rgba(248,113,113,0.1)' },
    stable: { text: 'STABLE', color: AMBER, bg: 'rgba(251,191,36,0.08)' },
  }[trend];

  return (
    <span
      className="text-[5px] font-mono font-black uppercase px-1 py-0"
      style={{ color: cfg.color, backgroundColor: cfg.bg }}
    >
      {cfg.text}
    </span>
  );
}

// ── Main Panel ──

export function TradeBalancePanel() {
  const t = useT();
  const { data: hookData, isLoading, refetch } = useTradeBalance();

  const data = hookData as TradeBalanceData | undefined;

  const maxAbsBalance = Math.max(...(data?.countries ?? []).map(c => Math.abs(c.balance)), 1);

  return (
    <div className="h-full flex flex-col bg-black overflow-hidden text-[9px] font-mono">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#050505] border-b border-border/20 shrink-0">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 16 16" className="w-4 h-4">
            <path d="M2 12L6 8L10 10L14 4" fill="none" stroke={CYAN} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M11 4H14V7" fill="none" stroke={CYAN} strokeWidth="1" strokeLinecap="round" />
            <line x1="2" y1="14" x2="14" y2="14" stroke={CYAN} strokeWidth="0.6" opacity="0.3" />
          </svg>
          <span className="text-[9px] font-black uppercase tracking-tighter" style={{ color: CYAN }}>
            {tr(t, 'tradeBalanceTitle', 'Trade Balance')}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {data && (
          <>
          <span className="text-[7px] font-mono text-white/20">{data.period}</span>
          <span
            className="text-[7px] font-mono font-bold px-1 py-0.5"
            style={{
              color: balanceColor(data.headlineBalance),
              backgroundColor: data.headlineBalance < 0 ? 'rgba(248,113,113,0.08)' : 'rgba(74,222,128,0.08)',
            }}
          >
            {fmtBSigned(data.headlineBalance)}
          </span>
          <span
            className="text-[6px] font-mono font-bold"
            style={{ color: changeColor(data.headlineChangePct) }}
          >
            {fmtPct(data.headlineChangePct)}
          </span>
          </>
          )}
          <button onClick={() => refetch()} className="p-0.5 text-white/30 hover:text-cyan-400 transition-colors">
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {isLoading && !hookData ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-2">
              <div className="w-5 h-5 border-2 border-cyan-400/30 border-t-cyan-400 animate-spin" />
              <span className="text-[10px] text-white/40 uppercase tracking-widest">
                {tr(t, 'loading', 'Loading...')}
              </span>
            </div>
          </div>
        ) : !data ? (
          <div className="flex items-center justify-center h-full text-neutral/40 text-[10px] font-mono uppercase tracking-widest">No data available</div>
        ) : (
          <>
            {/* ── Trade Balance by Country ── */}
            <SectionHeader label={tr(t, 'tbCountry', 'Trade Balance by Country')} />
            <div>
              {/* Column headers */}
              <div className="flex items-center px-2 py-0.5 border-b border-border/20 text-[6px] font-mono text-white/20 uppercase tracking-wider">
                <span className="w-14 shrink-0">COUNTRY</span>
                <span className="w-10 shrink-0 text-right">BALANCE</span>
                <span className="flex-1 text-center">SURPLUS / DEFICIT</span>
                <span className="w-10 shrink-0 text-right">EXP</span>
                <span className="w-10 shrink-0 text-right">IMP</span>
                <span className="w-8 shrink-0 text-right">CHG</span>
                <span className="w-14 shrink-0 text-right">TREND</span>
              </div>
              {data.countries.map(c => (
                <div
                  key={c.code}
                  className="flex items-center px-2 py-[3px] border-b border-white/[0.03] hover:bg-cyan-400/[0.02] transition-colors"
                >
                  <div className="w-14 shrink-0 flex flex-col">
                    <span className="text-[8px] font-bold text-white/70">{c.code}</span>
                    <span className="text-[6px] text-white/25 truncate">{c.country}</span>
                  </div>
                  <span
                    className="w-10 shrink-0 text-right text-[8px] font-bold"
                    style={{ color: balanceColor(c.balance) }}
                  >
                    {fmtBSigned(c.balance)}
                  </span>
                  <div className="flex-1 px-1">
                    <BalanceBar value={c.balance} maxAbs={maxAbsBalance} />
                  </div>
                  <span className="w-10 shrink-0 text-right text-[7px] text-white/40">
                    ${fmtB(c.exports)}
                  </span>
                  <span className="w-10 shrink-0 text-right text-[7px] text-white/40">
                    ${fmtB(c.imports)}
                  </span>
                  <span
                    className="w-8 shrink-0 text-right text-[7px] font-bold"
                    style={{ color: changeColor(c.changePct) }}
                  >
                    {fmtPct(c.changePct)}
                  </span>
                  <div className="w-14 shrink-0 flex justify-end">
                    <TrendBadge trend={c.trend} />
                  </div>
                </div>
              ))}
            </div>

            {/* ── Current Account ── */}
            <SectionHeader label={tr(t, 'tbCurrentAccount', 'Current Account')} />
            <div>
              <div className="flex items-center px-2 py-0.5 border-b border-border/20 text-[6px] font-mono text-white/20 uppercase tracking-wider">
                <span className="flex-1">COMPONENT</span>
                <span className="w-14 text-right">CURRENT</span>
                <span className="w-14 text-right">PREVIOUS</span>
                <span className="w-10 text-right">CHG%</span>
              </div>
              {data.currentAccount.map(ca => {
                const isTotal = ca.component === 'Current Account';
                return (
                  <div
                    key={ca.component}
                    className={`flex items-center px-2 py-[3px] border-b hover:bg-cyan-400/[0.02] transition-colors ${
                      isTotal ? 'border-white/[0.08] bg-white/[0.02]' : 'border-white/[0.03]'
                    }`}
                  >
                    <span className={`flex-1 text-[8px] ${isTotal ? 'font-black text-white/80' : 'text-white/50'}`}>
                      {ca.component}
                    </span>
                    <span
                      className={`w-14 text-right text-[8px] font-bold ${isTotal ? 'font-black' : ''}`}
                      style={{ color: balanceColor(ca.value) }}
                    >
                      {fmtBSigned(ca.value)}
                    </span>
                    <span className="w-14 text-right text-[7px] text-white/30">
                      {fmtBSigned(ca.prevValue)}
                    </span>
                    <span
                      className="w-10 text-right text-[7px] font-bold"
                      style={{ color: changeColor(ca.changePct) }}
                    >
                      {fmtPct(ca.changePct)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* ── Top Trade Partners (US) ── */}
            <SectionHeader label={tr(t, 'tbTopPartners', 'Top Trade Partners (US)')} />
            <div>
              <div className="flex items-center px-2 py-0.5 border-b border-border/20 text-[6px] font-mono text-white/20 uppercase tracking-wider">
                <span className="w-8 shrink-0">#</span>
                <span className="w-14 shrink-0">PARTNER</span>
                <span className="w-12 shrink-0 text-right">TOTAL</span>
                <span className="w-10 shrink-0 text-right">EXP</span>
                <span className="w-10 shrink-0 text-right">IMP</span>
                <span className="flex-1 text-right">SHARE</span>
                <span className="w-14 shrink-0" />
              </div>
              {data.topPartners.map((p, i) => {
                const barW = Math.min(p.sharePct / 18 * 100, 100);
                return (
                  <div
                    key={p.code}
                    className="flex items-center px-2 py-[3px] border-b border-white/[0.03] hover:bg-cyan-400/[0.02] transition-colors"
                  >
                    <span className="w-8 shrink-0 text-[7px] text-white/20">{i + 1}</span>
                    <div className="w-14 shrink-0 flex flex-col">
                      <span className="text-[8px] font-bold text-white/70">{p.code}</span>
                      <span className="text-[6px] text-white/25 truncate">{p.country}</span>
                    </div>
                    <span className="w-12 shrink-0 text-right text-[8px] font-bold text-white/60">
                      ${fmtB(p.totalTrade)}
                    </span>
                    <span className="w-10 shrink-0 text-right text-[7px] text-green-400/60">
                      ${fmtB(p.exports)}
                    </span>
                    <span className="w-10 shrink-0 text-right text-[7px] text-red-400/60">
                      ${fmtB(p.imports)}
                    </span>
                    <span className="flex-1 text-right text-[7px] text-white/40">
                      {p.sharePct.toFixed(1)}%
                    </span>
                    <div className="w-14 shrink-0 pl-1">
                      <div className="h-[4px] bg-white/[0.03] relative overflow-hidden">
                        <div
                          className="absolute top-0 left-0 h-full"
                          style={{ width: `${barW}%`, backgroundColor: CYAN, opacity: 0.35 }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Trade by Category ── */}
            <SectionHeader label={tr(t, 'tbCategory', 'Trade by Category')} />
            <div>
              <div className="flex items-center px-2 py-0.5 border-b border-border/20 text-[6px] font-mono text-white/20 uppercase tracking-wider">
                <span className="flex-1">CATEGORY</span>
                <span className="w-10 text-right">EXP</span>
                <span className="w-10 text-right">IMP</span>
                <span className="w-12 text-right">BALANCE</span>
                <span className="w-10 text-right">CHG%</span>
              </div>
              {data.categories.map(cat => (
                <div
                  key={cat.category}
                  className="flex items-center px-2 py-[3px] border-b border-white/[0.03] hover:bg-cyan-400/[0.02] transition-colors"
                >
                  <span className="flex-1 text-[8px] text-white/50 truncate">{cat.category}</span>
                  <span className="w-10 text-right text-[7px] text-green-400/60">${fmtB(cat.exports)}</span>
                  <span className="w-10 text-right text-[7px] text-red-400/60">${fmtB(cat.imports)}</span>
                  <span
                    className="w-12 text-right text-[8px] font-bold"
                    style={{ color: balanceColor(cat.balance) }}
                  >
                    {fmtBSigned(cat.balance)}
                  </span>
                  <span
                    className="w-10 text-right text-[7px] font-bold"
                    style={{ color: changeColor(cat.changePct) }}
                  >
                    {fmtPct(cat.changePct)}
                  </span>
                </div>
              ))}
            </div>

            {/* ── Container Trade ── */}
            <SectionHeader label={tr(t, 'tbContainer', 'Container Trade')} />
            <div>
              <div className="flex items-center px-2 py-0.5 border-b border-border/20 text-[6px] font-mono text-white/20 uppercase tracking-wider">
                <span className="flex-1">PORT</span>
                <span className="w-12 text-right">TEUS</span>
                <span className="w-8 text-right">CHG</span>
                <span className="w-8 text-right">UTIL</span>
                <span className="w-14 shrink-0" />
              </div>
              {data.containers.map(ct => (
                <div
                  key={ct.port}
                  className="flex items-center px-2 py-[3px] border-b border-white/[0.03] hover:bg-cyan-400/[0.02] transition-colors"
                >
                  <span className="flex-1 text-[8px] text-white/50 truncate">{ct.port}</span>
                  <span className="w-12 text-right text-[8px] font-bold text-white/60">
                    {fmtM(ct.teus / 1_000)}
                  </span>
                  <span
                    className="w-8 text-right text-[7px] font-bold"
                    style={{ color: changeColor(ct.changePct) }}
                  >
                    {fmtPct(ct.changePct)}
                  </span>
                  <span className="w-8 text-right text-[7px] text-white/40">
                    {ct.utilizationPct}%
                  </span>
                  <div className="w-14 shrink-0 pl-1">
                    <UtilBar pct={ct.utilizationPct} />
                  </div>
                </div>
              ))}
            </div>

            {/* ── Trade Policy ── */}
            <SectionHeader label={tr(t, 'tbPolicy', 'Trade Policy')} />
            <div>
              <div className="flex items-center px-2 py-0.5 border-b border-border/20 text-[6px] font-mono text-white/20 uppercase tracking-wider">
                <span className="flex-1">ACTION</span>
                <span className="w-16 shrink-0">TARGET</span>
                <span className="w-12 shrink-0 text-center">STATUS</span>
                <span className="w-14 shrink-0 text-right">EFFECTIVE</span>
                <span className="w-12 shrink-0 text-right">IMPACT</span>
              </div>
              {data.policies.map((p, i) => (
                <div
                  key={`${p.action}-${i}`}
                  className="flex items-center px-2 py-[3px] border-b border-white/[0.03] hover:bg-cyan-400/[0.02] transition-colors"
                >
                  <span className="flex-1 text-[8px] text-white/50 truncate">{p.action}</span>
                  <span className="w-16 shrink-0 text-[7px] text-white/40 truncate">{p.target}</span>
                  <div className="w-12 shrink-0 flex justify-center">
                    <StatusBadge status={p.status} />
                  </div>
                  <span className="w-14 shrink-0 text-right text-[7px] text-white/30">{p.effectDate}</span>
                  <span
                    className="w-12 shrink-0 text-right text-[8px] font-bold"
                    style={{ color: balanceColor(p.impactB) }}
                  >
                    {fmtBSigned(p.impactB)}
                  </span>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-2 py-1 border-t border-border/20 bg-white/[0.01]">
              <div className="flex items-center justify-between">
                <span className="text-[6px] text-white/15 uppercase tracking-wider">
                  {tr(t, 'tbSource', 'Source: BEA / Census Bureau / BLS')}
                </span>
                <span className="text-[6px] text-white/15">
                  {new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
