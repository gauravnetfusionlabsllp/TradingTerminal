import { useState } from 'react';
import { useEquityMarketMicrostructure } from '../../api/hooks/use-equity-market-microstructure';
import { useT, tr, TFn } from '../../i18n';
import { RefreshCw, Activity, Shield, BarChart3 } from 'lucide-react';

// ── Constants ──

const ACCENT = '#60a5fa'; // blue-400
const ACCENT_DIM = 'rgba(96,165,250,0.08)';
const GREEN = '#22c55e';
const RED = '#ef4444';
const YELLOW = '#eab308';

type Tab = 'spreads' | 'orderbook' | 'toxicity' | 'darkpool' | 'flow' | 'impact';

// ── Formatting helpers ──

function fmtCompact(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K';
  return n.toFixed(0);
}

function fmtBps(n: number): string {
  return n.toFixed(1) + ' bps';
}

function fmtDollar(n: number): string {
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
  return '$' + n.toFixed(0);
}

function getSignalColor(signal: string): { bg: string; text: string } {
  switch (signal) {
    case 'ELEVATED':
    case 'HIGH':
      return { bg: 'rgba(239,68,68,0.2)', text: RED };
    case 'MODERATE':
      return { bg: 'rgba(234,179,8,0.2)', text: YELLOW };
    case 'NORMAL':
    case 'LOW':
      return { bg: 'rgba(34,197,94,0.2)', text: GREEN };
    default:
      return { bg: 'rgba(161,161,170,0.15)', text: '#a1a1aa' };
  }
}

function spreadHeatColor(bps: number): string {
  if (bps <= 1.0) return GREEN;
  if (bps <= 2.0) return YELLOW;
  return RED;
}

// ── Main Panel ──

export function EquityMarketMicrostructurePanel() {
  const t = useT();
  const { data: liveData, isLoading, refetch } = useEquityMarketMicrostructure();
  const data = liveData;
  const [activeTab, setActiveTab] = useState<Tab>('spreads');

  const tabs: { key: Tab; label: string }[] = [
    { key: 'spreads', label: 'SPREADS' },
    { key: 'orderbook', label: 'ORDER BOOK' },
    { key: 'toxicity', label: 'TOXICITY' },
    { key: 'darkpool', label: 'DARK POOL' },
    { key: 'flow', label: 'FLOW' },
    { key: 'impact', label: 'IMPACT' },
  ];

  if (isLoading && !data) {
    return (
      <div className="h-full flex items-center justify-center bg-black">
        <div
          className="text-[9px] font-mono uppercase tracking-widest animate-pulse"
          style={{ color: ACCENT }}
        >
          LOADING MICROSTRUCTURE DATA...
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full text-neutral/40 text-[10px] font-mono uppercase tracking-widest">No data available</div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-black text-[9px] font-mono overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#050505] border-b border-border/20 shrink-0">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5" style={{ color: ACCENT }} />
          <span
            className="text-[9px] font-black font-mono uppercase tracking-tighter"
            style={{ color: ACCENT }}
          >
            {tr(t, 'emmTitle', 'Equity Market Microstructure')}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {data.summary && (
            <div className="flex items-center gap-3 text-[8px] font-mono">
              <span className="text-neutral-500">SPREAD</span>
              <span className="font-bold tabular-nums text-neutral-300">{data.summary.avgSpread != null ? `${data.summary.avgSpread.toFixed(1)}bps` : '--'}</span>
              <span className="text-neutral-500">VPIN</span>
              <span className="font-bold tabular-nums" style={{ color: data.summary.vpin > 0.6 ? RED : data.summary.vpin > 0.4 ? YELLOW : GREEN }}>
                {data.summary.vpin?.toFixed(2) ?? '--'}
              </span>
              <span className="text-neutral-500">DARK</span>
              <span className="font-bold tabular-nums text-neutral-300">{data.summary.darkPoolPct != null ? `${data.summary.darkPoolPct.toFixed(1)}%` : '--'}</span>
            </div>
          )}
          <button
            onClick={() => refetch()}
            className="p-1 text-neutral-500 hover:text-blue-400 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex items-center gap-0 border-b border-border/20 shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="px-3 py-2 text-[9px] font-mono font-bold uppercase tracking-wider transition-colors"
            style={{
              color: activeTab === tab.key ? ACCENT : 'rgba(255,255,255,0.35)',
              borderBottom: activeTab === tab.key ? `1px solid ${ACCENT}` : '1px solid transparent',
              background: activeTab === tab.key ? ACCENT_DIM : 'transparent',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto no-scrollbar">
        {activeTab === 'spreads' && <SpreadsTab data={data} />}
        {activeTab === 'orderbook' && <OrderBookTab data={data} />}
        {activeTab === 'toxicity' && <ToxicityTab data={data} />}
        {activeTab === 'darkpool' && <DarkPoolTab data={data} />}
        {activeTab === 'flow' && <FlowTab data={data} />}
        {activeTab === 'impact' && <ImpactTab data={data} />}
      </div>
    </div>
  );
}

// ── 1. Spread Analysis Tab ──

function SpreadsTab({ data }: { data: any }) {
  const t = useT();
  const spreads = data?.spreadAnalysis ?? [];

  return (
    <div>
      <div className="px-3 pt-2 pb-1">
        <span className="text-[7px] font-black uppercase tracking-wider text-neutral-600">
          {tr(t, 'emmSpreads', 'Bid-Ask Spread Analysis')}
        </span>
      </div>
      <table className="w-full text-[9px] font-mono">
        <thead className="sticky top-0 bg-black/95 text-[7px] font-black uppercase tracking-wider text-neutral-600 border-b border-border/20">
          <tr>
            <th className="px-2 py-1.5 text-left font-bold">Stock</th>
            <th className="px-2 py-1.5 text-right font-bold">Quoted</th>
            <th className="px-2 py-1.5 text-right font-bold">Effective</th>
            <th className="px-2 py-1.5 text-right font-bold">Realized</th>
            <th className="px-2 py-1.5 text-right font-bold">Depth</th>
            <th className="px-2 py-1.5 text-center font-bold">Spread Profile</th>
          </tr>
        </thead>
        <tbody>
          {spreads.map((s: any) => {
            const maxSpread = Math.max(...spreads.map((x: any) => x.quotedSpread));
            return (
              <tr
                key={s.stock}
                className="border-b border-border/20 hover:bg-blue-400/[0.02] transition-colors"
              >
                <td className="px-2 py-1.5">
                  <span className="font-bold" style={{ color: ACCENT }}>{s.stock}</span>
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  <span className="font-bold" style={{ color: spreadHeatColor(s.quotedSpread) }}>
                    {fmtBps(s.quotedSpread)}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  <span className="font-bold" style={{ color: spreadHeatColor(s.effectiveSpread) }}>
                    {fmtBps(s.effectiveSpread)}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  <span className="font-bold" style={{ color: spreadHeatColor(s.realizedSpread) }}>
                    {fmtBps(s.realizedSpread)}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums text-neutral-300">
                  {fmtCompact(s.depth)}
                </td>
                <td className="px-2 py-1.5">
                  <SpreadProfileBar
                    quoted={s.quotedSpread}
                    effective={s.effectiveSpread}
                    realized={s.realizedSpread}
                    max={maxSpread}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Spread Legend */}
      <div className="flex items-center gap-4 px-3 py-2 border-t border-border/20">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2" style={{ background: 'rgba(96,165,250,0.6)' }} />
          <span className="text-[6px] font-mono text-neutral-600 uppercase">Quoted</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2" style={{ background: 'rgba(234,179,8,0.6)' }} />
          <span className="text-[6px] font-mono text-neutral-600 uppercase">Effective</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2" style={{ background: 'rgba(34,197,94,0.6)' }} />
          <span className="text-[6px] font-mono text-neutral-600 uppercase">Realized</span>
        </div>
      </div>
    </div>
  );
}

// ── Spread Profile SVG Bar ──

function SpreadProfileBar({ quoted, effective, realized, max }: { quoted: number; effective: number; realized: number; max: number }) {
  const W = 80;
  const H = 12;
  const scale = max > 0 ? (W - 4) / max : 1;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block mx-auto">
      <rect x={0} y={0} width={W} height={H} fill="rgba(255,255,255,0.02)" />
      <rect x={1} y={1} width={Math.max(quoted * scale, 1)} height={3} fill="rgba(96,165,250,0.6)" />
      <rect x={1} y={4.5} width={Math.max(effective * scale, 1)} height={3} fill="rgba(234,179,8,0.6)" />
      <rect x={1} y={8} width={Math.max(realized * scale, 1)} height={3} fill="rgba(34,197,94,0.6)" />
    </svg>
  );
}

// ── 2. Order Book Depth Tab ──

function OrderBookTab({ data }: { data: any }) {
  const t = useT();
  const book = data?.orderBook;

  if (!book) {
    return (
      <div className="text-center py-8 text-neutral-500 text-[9px] font-mono uppercase">
        No order book data
      </div>
    );
  }

  const bids = book.bids ?? [];
  const asks = book.asks ?? [];
  const maxCumSize = Math.max(
    ...bids.map((b: any) => b.cumSize),
    ...asks.map((a: any) => a.cumSize),
  );

  const W = 320;
  const H = 260;
  const MARGIN = { top: 24, right: 10, bottom: 20, left: 10 };
  const CENTER_X = W / 2;
  const chartH = H - MARGIN.top - MARGIN.bottom;
  const levels = Math.max(bids.length, asks.length);
  const rowH = levels > 0 ? chartH / levels : 16;
  const halfW = CENTER_X - MARGIN.left - 20;

  return (
    <div className="px-3 py-2">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[7px] font-black uppercase tracking-wider text-neutral-600">
          {tr(t, 'emmOrderBook', 'Order Book Depth')} - {book.symbol}
        </span>
        <span className="text-[8px] font-bold tabular-nums" style={{ color: ACCENT }}>
          MID {book.midPrice.toFixed(2)}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 300 }}>
        {/* Header labels */}
        <text x={CENTER_X - halfW / 2} y={14} textAnchor="middle" fill={GREEN} fontSize={7} fontFamily="monospace" fontWeight="bold">BID</text>
        <text x={CENTER_X + halfW / 2} y={14} textAnchor="middle" fill={RED} fontSize={7} fontFamily="monospace" fontWeight="bold">ASK</text>
        <text x={CENTER_X} y={14} textAnchor="middle" fill="#71717a" fontSize={6} fontFamily="monospace">PRICE</text>

        {/* Center price column line */}
        <line x1={CENTER_X} y1={MARGIN.top} x2={CENTER_X} y2={H - MARGIN.bottom} stroke="rgba(255,255,255,0.08)" strokeWidth={0.5} />

        {/* Bid side (left) */}
        {bids.map((bid: any, i: number) => {
          const y = MARGIN.top + i * rowH;
          const barW = maxCumSize > 0 ? (bid.cumSize / maxCumSize) * halfW : 0;
          const sizeBarW = maxCumSize > 0 ? (bid.size / maxCumSize) * halfW : 0;

          return (
            <g key={`bid-${i}`}>
              {/* Cumulative fill */}
              <rect
                x={CENTER_X - 20 - barW}
                y={y + 1}
                width={barW}
                height={rowH - 2}
                fill="rgba(34,197,94,0.08)"
              />
              {/* Individual size bar */}
              <rect
                x={CENTER_X - 20 - sizeBarW}
                y={y + 1}
                width={sizeBarW}
                height={rowH - 2}
                fill="rgba(34,197,94,0.25)"
              />
              {/* Size text */}
              <text
                x={CENTER_X - 22}
                y={y + rowH / 2 + 1}
                textAnchor="end"
                dominantBaseline="middle"
                fill="#71717a"
                fontSize={6}
                fontFamily="monospace"
              >
                {fmtCompact(bid.size)}
              </text>
              {/* Price */}
              <text
                x={CENTER_X - 4}
                y={y + rowH / 2 + 1}
                textAnchor="end"
                dominantBaseline="middle"
                fill={GREEN}
                fontSize={7}
                fontFamily="monospace"
                fontWeight="bold"
              >
                {bid.price.toFixed(2)}
              </text>
              {/* Row separator */}
              <line x1={MARGIN.left} y1={y + rowH} x2={CENTER_X - 1} y2={y + rowH} stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} />
            </g>
          );
        })}

        {/* Ask side (right) */}
        {asks.map((ask: any, i: number) => {
          const y = MARGIN.top + i * rowH;
          const barW = maxCumSize > 0 ? (ask.cumSize / maxCumSize) * halfW : 0;
          const sizeBarW = maxCumSize > 0 ? (ask.size / maxCumSize) * halfW : 0;

          return (
            <g key={`ask-${i}`}>
              {/* Cumulative fill */}
              <rect
                x={CENTER_X + 20}
                y={y + 1}
                width={barW}
                height={rowH - 2}
                fill="rgba(239,68,68,0.08)"
              />
              {/* Individual size bar */}
              <rect
                x={CENTER_X + 20}
                y={y + 1}
                width={sizeBarW}
                height={rowH - 2}
                fill="rgba(239,68,68,0.25)"
              />
              {/* Price */}
              <text
                x={CENTER_X + 4}
                y={y + rowH / 2 + 1}
                textAnchor="start"
                dominantBaseline="middle"
                fill={RED}
                fontSize={7}
                fontFamily="monospace"
                fontWeight="bold"
              >
                {ask.price.toFixed(2)}
              </text>
              {/* Size text */}
              <text
                x={CENTER_X + 22}
                y={y + rowH / 2 + 1}
                textAnchor="start"
                dominantBaseline="middle"
                fill="#71717a"
                fontSize={6}
                fontFamily="monospace"
              >
                {fmtCompact(ask.size)}
              </text>
              {/* Row separator */}
              <line x1={CENTER_X + 1} y1={y + rowH} x2={W - MARGIN.right} y2={y + rowH} stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} />
            </g>
          );
        })}

        {/* Bottom axis labels */}
        <text x={MARGIN.left + 4} y={H - 6} fill="#52525b" fontSize={5.5} fontFamily="monospace">CUM SIZE</text>
        <text x={W - MARGIN.right - 4} y={H - 6} textAnchor="end" fill="#52525b" fontSize={5.5} fontFamily="monospace">CUM SIZE</text>
      </svg>

      {/* Book stats */}
      <div className="flex items-center gap-4 mt-2 pt-2 border-t border-border/20">
        <div className="flex items-center gap-1.5">
          <span className="text-[7px] font-black uppercase tracking-wider text-neutral-600">BID DEPTH</span>
          <span className="text-[8px] font-bold tabular-nums" style={{ color: GREEN }}>
            {fmtCompact(bids.reduce((s: number, b: any) => s + b.size, 0))}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[7px] font-black uppercase tracking-wider text-neutral-600">ASK DEPTH</span>
          <span className="text-[8px] font-bold tabular-nums" style={{ color: RED }}>
            {fmtCompact(asks.reduce((s: number, a: any) => s + a.size, 0))}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[7px] font-black uppercase tracking-wider text-neutral-600">IMBALANCE</span>
          {(() => {
            const bidTotal = bids.reduce((s: number, b: any) => s + b.size, 0);
            const askTotal = asks.reduce((s: number, a: any) => s + a.size, 0);
            const imb = bidTotal + askTotal > 0 ? ((bidTotal - askTotal) / (bidTotal + askTotal) * 100) : 0;
            return (
              <span className="text-[8px] font-bold tabular-nums" style={{ color: imb > 0 ? GREEN : imb < 0 ? RED : '#71717a' }}>
                {imb > 0 ? '+' : ''}{imb.toFixed(1)}%
              </span>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

// ── 3. Toxicity Metrics Tab ──

function ToxicityTab({ data }: { data: any }) {
  const t = useT();
  const tox = data?.toxicity;

  if (!tox) {
    return (
      <div className="text-center py-8 text-neutral-500 text-[9px] font-mono uppercase">
        No toxicity data
      </div>
    );
  }

  const metrics = [
    { key: 'vpin', label: 'VPIN', desc: 'Volume-Synchronized PIN', data: tox.vpin, fmt: (v: number) => v.toFixed(2) },
    { key: 'lambda', label: 'KYLE LAMBDA', desc: 'Price Impact Coefficient', data: tox.lambda, fmt: (v: number) => v.toFixed(4) },
    { key: 'amihud', label: 'AMIHUD ILLIQ', desc: 'Amihud Illiquidity Ratio', data: tox.amihud, fmt: (v: number) => v.toFixed(4) },
    { key: 'pinModel', label: 'PIN MODEL', desc: 'Probability of Informed Trading', data: tox.pinModel, fmt: (v: number) => (v * 100).toFixed(1) + '%' },
    { key: 'adverseSelection', label: 'ADV. SELECTION', desc: 'Adverse Selection Component', data: tox.adverseSelection, fmt: (v: number) => v.toFixed(2) },
  ];

  return (
    <div className="px-3 py-2">
      <div className="mb-2">
        <span className="text-[7px] font-black uppercase tracking-wider text-neutral-600">
          {tr(t, 'emmToxicity', 'Information Toxicity Metrics')}
        </span>
      </div>
      <div className="space-y-2">
        {metrics.map((m) => {
          const sc = getSignalColor(m.data.signal);
          return (
            <div
              key={m.key}
              className="border border-border/20 p-2 hover:bg-blue-400/[0.02] transition-colors"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <Shield className="w-3 h-3" style={{ color: sc.text }} />
                  <div>
                    <div className="text-[8px] font-bold uppercase" style={{ color: ACCENT }}>{m.label}</div>
                    <div className="text-[6px] text-neutral-600 uppercase">{m.desc}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold tabular-nums text-white">
                    {m.fmt(m.data.value)}
                  </span>
                  <span
                    className="text-[6px] font-black uppercase px-1.5 py-[1px]"
                    style={{ background: sc.bg, color: sc.text }}
                  >
                    {m.data.signal}
                  </span>
                </div>
              </div>

              {/* Percentile gauge */}
              <ToxicityGauge percentile={m.data.percentile} signal={m.data.signal} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Toxicity Gauge SVG ──

function ToxicityGauge({ percentile, signal }: { percentile: number; signal: string }) {
  const W = 200;
  const H = 14;
  const barW = W - 30;
  const sc = getSignalColor(signal);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 16 }}>
      {/* Background */}
      <rect x={0} y={4} width={barW} height={6} fill="rgba(255,255,255,0.03)" />

      {/* Gradient zones */}
      <rect x={0} y={4} width={barW * 0.33} height={6} fill="rgba(34,197,94,0.1)" />
      <rect x={barW * 0.33} y={4} width={barW * 0.34} height={6} fill="rgba(234,179,8,0.1)" />
      <rect x={barW * 0.67} y={4} width={barW * 0.33} height={6} fill="rgba(239,68,68,0.1)" />

      {/* Zone lines */}
      <line x1={barW * 0.33} y1={4} x2={barW * 0.33} y2={10} stroke="rgba(255,255,255,0.08)" strokeWidth={0.5} />
      <line x1={barW * 0.67} y1={4} x2={barW * 0.67} y2={10} stroke="rgba(255,255,255,0.08)" strokeWidth={0.5} />

      {/* Fill */}
      <rect x={0} y={4} width={(percentile / 100) * barW} height={6} fill={sc.text} opacity={0.4} />

      {/* Indicator marker */}
      <rect
        x={(percentile / 100) * barW - 1}
        y={2}
        width={2}
        height={10}
        fill={sc.text}
      />

      {/* Percentile text */}
      <text
        x={barW + 6}
        y={9}
        fill={sc.text}
        fontSize={7}
        fontFamily="monospace"
        fontWeight="bold"
      >
        {percentile}p
      </text>
    </svg>
  );
}

// ── 4. Dark Pool Tab ──

function DarkPoolTab({ data }: { data: any }) {
  const t = useT();
  const venues = data?.darkPool ?? [];
  const darkTotal = data?.darkPoolTotal;
  const litTotal = data?.litTotal;
  const maxPct = Math.max(...venues.map((v: any) => v.pct), 1);

  return (
    <div className="px-3 py-2">
      <div className="mb-2">
        <span className="text-[7px] font-black uppercase tracking-wider text-neutral-600">
          {tr(t, 'emmDarkPool', 'Dark Pool Activity')}
        </span>
      </div>

      {/* Dark vs Lit split */}
      {darkTotal != null && litTotal != null && (
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[7px] font-black uppercase tracking-wider text-neutral-600">DARK VS LIT SPLIT</span>
        </div>
        <DarkLitBar dark={darkTotal} lit={litTotal} />
        <div className="flex items-center justify-between mt-1">
          <span className="text-[7px] font-mono text-neutral-500">DARK {darkTotal.toFixed(1)}%</span>
          <span className="text-[7px] font-mono text-neutral-500">LIT {litTotal.toFixed(1)}%</span>
        </div>
      </div>
      )}

      {/* Venue breakdown */}
      <div className="mb-1">
        <span className="text-[7px] font-black uppercase tracking-wider text-neutral-600">VENUE BREAKDOWN</span>
      </div>
      <div className="space-y-1.5">
        {venues.map((v: any) => (
          <div
            key={v.venue}
            className="flex items-center gap-2 py-1 hover:bg-blue-400/[0.02] transition-colors"
          >
            <span className="text-[8px] font-bold w-10 shrink-0" style={{ color: ACCENT }}>
              {v.venue}
            </span>
            <div className="flex-1 h-3 bg-white/[0.03] relative">
              <div
                className="absolute inset-y-0 left-0"
                style={{
                  width: `${(v.pct / maxPct) * 100}%`,
                  background: ACCENT,
                  opacity: 0.35,
                }}
              />
            </div>
            <span className="text-[8px] font-bold tabular-nums text-neutral-300 w-10 text-right">
              {v.pct.toFixed(1)}%
            </span>
            <span className="text-[7px] tabular-nums text-neutral-500 w-12 text-right">
              {fmtCompact(v.volume)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Dark vs Lit bar ──

function DarkLitBar({ dark, lit }: { dark: number; lit: number }) {
  const W = 260;
  const H = 16;
  const darkW = (dark / (dark + lit)) * W;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 20 }}>
      <rect x={0} y={0} width={darkW} height={H} fill="rgba(96,165,250,0.4)" />
      <rect x={darkW} y={0} width={W - darkW} height={H} fill="rgba(255,255,255,0.06)" />
      <text x={darkW / 2} y={H / 2 + 1} textAnchor="middle" dominantBaseline="middle" fill={ACCENT} fontSize={7} fontFamily="monospace" fontWeight="bold">
        DARK
      </text>
      <text x={darkW + (W - darkW) / 2} y={H / 2 + 1} textAnchor="middle" dominantBaseline="middle" fill="#a1a1aa" fontSize={7} fontFamily="monospace" fontWeight="bold">
        LIT
      </text>
    </svg>
  );
}

// ── 5. Retail vs Institutional Flow Tab ──

function FlowTab({ data }: { data: any }) {
  const t = useT();
  const flow = data?.flow;

  if (!flow) {
    return (
      <div className="text-center py-8 text-neutral-500 text-[9px] font-mono uppercase">
        No flow data
      </div>
    );
  }

  const series = flow.timeSeries ?? [];

  return (
    <div className="px-3 py-2">
      <div className="mb-2">
        <span className="text-[7px] font-black uppercase tracking-wider text-neutral-600">
          {tr(t, 'emmFlow', 'Retail vs Institutional Flow')}
        </span>
      </div>

      {/* Flow split cards */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {/* Retail card */}
        <div className="border border-border/20 p-2">
          <div className="flex items-center gap-1.5 mb-1.5">
            <BarChart3 className="w-3 h-3 text-blue-400" />
            <span className="text-[8px] font-bold uppercase" style={{ color: ACCENT }}>RETAIL</span>
            <span
              className="text-[6px] font-black uppercase px-1 py-[1px] ml-auto"
              style={{
                background: flow.retailSentiment === 'BULLISH' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
                color: flow.retailSentiment === 'BULLISH' ? GREEN : RED,
              }}
            >
              {flow.retailSentiment}
            </span>
          </div>
          <div className="text-[14px] font-bold tabular-nums text-white mb-1">
            {flow.retailPct.toFixed(1)}%
          </div>
          <FlowSplitBar buy={flow.retailBuyPct} sell={flow.retailSellPct} />
          <div className="flex items-center justify-between mt-1">
            <span className="text-[6px] font-mono" style={{ color: GREEN }}>BUY {flow.retailBuyPct.toFixed(1)}%</span>
            <span className="text-[6px] font-mono" style={{ color: RED }}>SELL {flow.retailSellPct.toFixed(1)}%</span>
          </div>
        </div>

        {/* Institutional card */}
        <div className="border border-border/20 p-2">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Shield className="w-3 h-3 text-blue-400" />
            <span className="text-[8px] font-bold uppercase" style={{ color: ACCENT }}>INSTITUTIONAL</span>
            <span
              className="text-[6px] font-black uppercase px-1 py-[1px] ml-auto"
              style={{
                background: flow.instSentiment === 'BULLISH' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
                color: flow.instSentiment === 'BULLISH' ? GREEN : RED,
              }}
            >
              {flow.instSentiment}
            </span>
          </div>
          <div className="text-[14px] font-bold tabular-nums text-white mb-1">
            {flow.institutionalPct.toFixed(1)}%
          </div>
          <FlowSplitBar buy={flow.instBuyPct} sell={flow.instSellPct} />
          <div className="flex items-center justify-between mt-1">
            <span className="text-[6px] font-mono" style={{ color: GREEN }}>BUY {flow.instBuyPct.toFixed(1)}%</span>
            <span className="text-[6px] font-mono" style={{ color: RED }}>SELL {flow.instSellPct.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      {/* Intraday flow composition chart */}
      <div className="mb-1">
        <span className="text-[7px] font-black uppercase tracking-wider text-neutral-600">
          INTRADAY FLOW COMPOSITION
        </span>
      </div>
      <FlowAreaChart series={series} />

      {/* Legend */}
      <div className="flex items-center gap-4 mt-1">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2" style={{ background: 'rgba(96,165,250,0.5)' }} />
          <span className="text-[6px] font-mono text-neutral-600 uppercase">Retail</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2" style={{ background: 'rgba(234,179,8,0.5)' }} />
          <span className="text-[6px] font-mono text-neutral-600 uppercase">Institutional</span>
        </div>
      </div>
    </div>
  );
}

// ── Flow Split Bar ──

function FlowSplitBar({ buy, sell }: { buy: number; sell: number }) {
  const W = 120;
  const H = 8;
  const total = buy + sell;
  const buyW = total > 0 ? (buy / total) * W : W / 2;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 10 }}>
      <rect x={0} y={0} width={buyW} height={H} fill="rgba(34,197,94,0.5)" />
      <rect x={buyW} y={0} width={W - buyW} height={H} fill="rgba(239,68,68,0.5)" />
    </svg>
  );
}

// ── Flow Area Chart ──

function FlowAreaChart({ series }: { series: any[] }) {
  const W = 280;
  const H = 80;
  const PAD = { top: 4, right: 4, bottom: 14, left: 4 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  if (series.length === 0) return null;

  const xStep = chartW / (series.length - 1);

  // Retail is bottom, institutional is top (stacked to 100%)
  const retailPath = series
    .map((p, i) => {
      const x = PAD.left + i * xStep;
      const y = PAD.top + chartH - (p.retail / 100) * chartH;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const retailAreaD = retailPath +
    ` L${(PAD.left + (series.length - 1) * xStep).toFixed(1)},${PAD.top + chartH}` +
    ` L${PAD.left},${PAD.top + chartH} Z`;

  const instPath = series
    .map((p, i) => {
      const x = PAD.left + i * xStep;
      const y = PAD.top + (p.retail / 100) * chartH; // institutional is inverted
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const instAreaD = instPath +
    ` L${(PAD.left + (series.length - 1) * xStep).toFixed(1)},${PAD.top}` +
    ` L${PAD.left},${PAD.top} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 90 }}>
      {/* Grid */}
      <line x1={PAD.left} y1={PAD.top + chartH / 2} x2={W - PAD.right} y2={PAD.top + chartH / 2} stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} strokeDasharray="2,2" />

      {/* 50% label */}
      <text x={W - PAD.right + 1} y={PAD.top + chartH / 2 + 2} fill="#52525b" fontSize={5} fontFamily="monospace">50%</text>

      {/* Institutional area (top) */}
      <path d={instAreaD} fill="rgba(234,179,8,0.15)" />
      <path d={instPath} fill="none" stroke="rgba(234,179,8,0.5)" strokeWidth={0.8} />

      {/* Retail area (bottom) */}
      <path d={retailAreaD} fill="rgba(96,165,250,0.15)" />
      <path d={retailPath} fill="none" stroke="rgba(96,165,250,0.5)" strokeWidth={0.8} />

      {/* Time labels */}
      {series.filter((_: any, i: number) => i % 3 === 0 || i === series.length - 1).map((p: any, idx: number) => {
        const origIdx = series.indexOf(p);
        const x = PAD.left + origIdx * xStep;
        return (
          <text
            key={idx}
            x={x}
            y={H - 2}
            textAnchor="middle"
            fill="#52525b"
            fontSize={5}
            fontFamily="monospace"
          >
            {p.time}
          </text>
        );
      })}
    </svg>
  );
}

// ── 6. Market Impact Tab ──

function ImpactTab({ data }: { data: any }) {
  const t = useT();
  const impacts = data?.marketImpact ?? [];

  // Group by size
  const sizes = [...new Set(impacts.map((i: any) => i.size))] as string[];

  return (
    <div>
      <div className="px-3 pt-2 pb-1">
        <span className="text-[7px] font-black uppercase tracking-wider text-neutral-600">
          {tr(t, 'emmImpact', 'Estimated Market Impact')}
        </span>
      </div>
      <table className="w-full text-[9px] font-mono">
        <thead className="sticky top-0 bg-black/95 text-[7px] font-black uppercase tracking-wider text-neutral-600 border-b border-border/20">
          <tr>
            <th className="px-2 py-1.5 text-left font-bold">Size</th>
            <th className="px-2 py-1.5 text-left font-bold">Stock</th>
            <th className="px-2 py-1.5 text-right font-bold">Temp</th>
            <th className="px-2 py-1.5 text-right font-bold">Perm</th>
            <th className="px-2 py-1.5 text-right font-bold">Total</th>
            <th className="px-2 py-1.5 text-right font-bold">Cost</th>
            <th className="px-2 py-1.5 text-center font-bold">Impact Profile</th>
          </tr>
        </thead>
        <tbody>
          {sizes.map((size) => {
            const rows = impacts.filter((i: any) => i.size === size);
            return rows.map((impact: any, idx: number) => (
              <tr
                key={`${impact.size}-${impact.stock}`}
                className="border-b border-border/20 hover:bg-blue-400/[0.02] transition-colors"
              >
                {idx === 0 && (
                  <td
                    className="px-2 py-1.5 text-neutral-400 font-bold"
                    rowSpan={rows.length}
                    style={{ borderRight: '1px solid rgba(255,255,255,0.05)' }}
                  >
                    ${size}
                  </td>
                )}
                <td className="px-2 py-1.5">
                  <span className="font-bold" style={{ color: ACCENT }}>{impact.stock}</span>
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  <span style={{ color: YELLOW }}>{fmtBps(impact.temporary)}</span>
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  <span style={{ color: RED }}>{fmtBps(impact.permanent)}</span>
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  <span className="font-bold" style={{ color: impact.totalBps > 5 ? RED : impact.totalBps > 2 ? YELLOW : GREEN }}>
                    {fmtBps(impact.totalBps)}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums text-neutral-300">
                  {fmtDollar(impact.cost)}
                </td>
                <td className="px-2 py-1.5">
                  <ImpactBar temporary={impact.temporary} permanent={impact.permanent} max={20} />
                </td>
              </tr>
            ));
          })}
        </tbody>
      </table>

      {/* Impact Legend */}
      <div className="flex items-center gap-4 px-3 py-2 border-t border-border/20">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2" style={{ background: 'rgba(234,179,8,0.6)' }} />
          <span className="text-[6px] font-mono text-neutral-600 uppercase">Temporary Impact</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2" style={{ background: 'rgba(239,68,68,0.6)' }} />
          <span className="text-[6px] font-mono text-neutral-600 uppercase">Permanent Impact</span>
        </div>
      </div>
    </div>
  );
}

// ── Impact Bar SVG ──

function ImpactBar({ temporary, permanent, max }: { temporary: number; permanent: number; max: number }) {
  const W = 70;
  const H = 10;
  const scale = max > 0 ? (W - 2) / max : 1;
  const tempW = Math.max(temporary * scale, 0.5);
  const permW = Math.max(permanent * scale, 0.5);

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block mx-auto">
      <rect x={0} y={0} width={W} height={H} fill="rgba(255,255,255,0.02)" />
      <rect x={1} y={1} width={tempW} height={H - 2} fill="rgba(234,179,8,0.6)" />
      <rect x={1 + tempW} y={1} width={permW} height={H - 2} fill="rgba(239,68,68,0.6)" />
    </svg>
  );
}
