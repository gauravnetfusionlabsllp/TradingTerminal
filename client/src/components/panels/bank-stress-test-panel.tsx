import { useState } from 'react';
import { useBankStressTest } from '../../api/hooks/use-bank-stress-test';
import { ShieldCheck, RefreshCw } from 'lucide-react';

// ── Helpers ──

function resultBadgeStyle(result: string): string {
  if (result === 'PASS') return 'text-green-400 bg-green-500/10 border border-green-500/30';
  if (result === 'CONDITIONAL') return 'text-yellow-400 bg-yellow-500/10 border border-yellow-500/30';
  return 'text-red-400 bg-red-500/10 border border-red-500/30';
}

function cet1Color(val: number): string {
  if (val >= 10) return 'text-green-400';
  if (val >= 7) return 'text-yellow-400';
  if (val >= 4.5) return 'text-orange-400';
  return 'text-red-400';
}

function drawdownColor(val: number): string {
  if (val >= -2) return 'text-green-400';
  if (val >= -4) return 'text-yellow-400';
  return 'text-red-400';
}

function fmtAssets(n: number): string {
  if (n >= 1000) return '$' + (n / 1000).toFixed(1) + 'T';
  return '$' + n + 'B';
}

// ── Main Panel ──

export function BankStressTestPanel() {
  const { data: rawData, isLoading, refetch } = useBankStressTest();
  const data = rawData;
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const selectedBank = selectedIdx !== null ? data?.banks?.[selectedIdx] : null;

  return (
    <div className="h-full flex flex-col bg-black overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#050505] border-b border-border/30 shrink-0">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-violet-400" />
          <span className="text-[9px] font-black font-mono uppercase tracking-tighter text-violet-400">
            Bank Stress Test
          </span>
          <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-wider">
            {data?.framework}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {data?.scenario && <span className="text-[7px] font-mono font-bold text-violet-400/70 uppercase px-1.5 py-0.5 bg-violet-400/10 border border-violet-400/30">
            {data.scenario}
          </span>}
          <span className="text-[7px] font-mono text-neutral-600">
            {data?.asOfDate}
          </span>
          <button
            onClick={() => refetch()}
            className="p-1 text-neutral-500 hover:text-violet-400 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto no-scrollbar">
        {isLoading && !rawData && (
          <div className="text-center py-8 text-violet-400 text-[9px] font-mono uppercase animate-pulse">
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
            {data.overview && <OverviewBar overview={data.overview} />}
            <BankResultsTable
              banks={data.banks ?? []}
              selectedIdx={selectedIdx}
              onSelect={setSelectedIdx}
            />
            {selectedBank?.detail && <BankDetail bank={selectedBank} />}
            <ScenarioAssumptions assumptions={data.scenarioAssumptions ?? []} />
            <LossDistribution losses={data.lossDistribution ?? []} />
            {data.capitalRequirements && <CapitalRequirements requirements={data.capitalRequirements} />}
          </>
        )}
      </div>
    </div>
  );
}

// ── Overview Stats Bar ──

function OverviewBar({ overview }: { overview: any }) {
  return (
    <div className="border-b border-violet-400/30">
      <div className="grid grid-cols-5 divide-x divide-border/20">
        <div className="px-3 py-2">
          <div className="text-[7px] font-mono text-neutral-500 uppercase tracking-widest font-black">
            Participating Banks
          </div>
          <div className="text-[13px] font-mono font-black text-white tabular-nums mt-0.5">
            {overview.participatingBanks}
          </div>
        </div>
        <div className="px-3 py-2">
          <div className="text-[7px] font-mono text-neutral-500 uppercase tracking-widest font-black">
            Aggregate Shortfall
          </div>
          <div className={`text-[13px] font-mono font-black tabular-nums mt-0.5 ${overview.aggregateShortfall > 0 ? 'text-red-400' : 'text-green-400'}`}>
            ${overview.aggregateShortfall.toFixed(1)}B
          </div>
        </div>
        <div className="px-3 py-2">
          <div className="text-[7px] font-mono text-neutral-500 uppercase tracking-widest font-black">
            Baseline CET1
          </div>
          <div className="text-[13px] font-mono font-black text-white tabular-nums mt-0.5">
            {overview.baselineCET1.toFixed(1)}%
          </div>
        </div>
        <div className="px-3 py-2">
          <div className="text-[7px] font-mono text-neutral-500 uppercase tracking-widest font-black">
            Stressed CET1
          </div>
          <div className={`text-[13px] font-mono font-black tabular-nums mt-0.5 ${cet1Color(overview.stressedCET1)}`}>
            {overview.stressedCET1.toFixed(1)}%
          </div>
        </div>
        <div className="px-3 py-2">
          <div className="text-[7px] font-mono text-neutral-500 uppercase tracking-widest font-black">
            CET1 Drawdown
          </div>
          <div className={`text-[13px] font-mono font-black tabular-nums mt-0.5 ${drawdownColor(overview.drawdown)}`}>
            {overview.drawdown.toFixed(1)}%
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Bank Results Table ──

function BankResultsTable({
  banks,
  selectedIdx,
  onSelect,
}: {
  banks: any[];
  selectedIdx: number | null;
  onSelect: (idx: number | null) => void;
}) {
  return (
    <div className="border-b border-violet-400/30">
      <div className="px-3 py-1 border-b border-border/20 flex items-center gap-1.5">
        <div className="w-1 h-1 bg-violet-400" />
        <span className="text-[7px] font-black font-mono uppercase tracking-widest text-neutral-500">
          Bank Results
        </span>
        <span className="text-[7px] font-mono text-neutral-700 ml-auto">
          {banks.length} institutions
        </span>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-[1fr_50px_70px_65px_65px_70px_60px_65px] px-3 py-1 border-b border-border/20">
        <span className="text-[7px] font-bold font-mono uppercase tracking-wider text-neutral-500">Bank</span>
        <span className="text-[7px] font-bold font-mono uppercase tracking-wider text-neutral-500 text-right">Ctry</span>
        <span className="text-[7px] font-bold font-mono uppercase tracking-wider text-neutral-500 text-right">Assets</span>
        <span className="text-[7px] font-bold font-mono uppercase tracking-wider text-neutral-500 text-right">Base</span>
        <span className="text-[7px] font-bold font-mono uppercase tracking-wider text-neutral-500 text-right">Adv</span>
        <span className="text-[7px] font-bold font-mono uppercase tracking-wider text-neutral-500 text-right">Sev Adv</span>
        <span className="text-[7px] font-bold font-mono uppercase tracking-wider text-neutral-500 text-right">Buffer</span>
        <span className="text-[7px] font-bold font-mono uppercase tracking-wider text-neutral-500 text-right">Result</span>
      </div>

      {/* Table Rows */}
      {banks.map((bank: any, idx: number) => {
        const isSelected = selectedIdx === idx;
        return (
          <div
            key={bank.ticker}
            onClick={() => onSelect(isSelected ? null : idx)}
            className={`grid grid-cols-[1fr_50px_70px_65px_65px_70px_60px_65px] px-3 py-1 border-b border-border/20 cursor-pointer transition-colors ${
              isSelected ? 'bg-violet-400/[0.06]' : 'hover:bg-violet-400/[0.02]'
            }`}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[9px] font-mono font-bold text-white truncate">{bank.name}</span>
              <span className="text-[7px] font-mono text-neutral-600">{bank.ticker}</span>
            </div>
            <span className="text-[9px] font-mono text-neutral-300 text-right tabular-nums">
              {bank.flag} {bank.country}
            </span>
            <span className="text-[9px] font-mono text-neutral-300 text-right tabular-nums">
              {fmtAssets(bank.totalAssets)}
            </span>
            <span className="text-[9px] font-mono text-neutral-300 text-right tabular-nums">
              {bank.baselineCET1.toFixed(1)}%
            </span>
            <span className={`text-[9px] font-mono text-right tabular-nums ${cet1Color(bank.adverseCET1)}`}>
              {bank.adverseCET1.toFixed(1)}%
            </span>
            <span className={`text-[9px] font-mono text-right tabular-nums ${cet1Color(bank.severelyAdverseCET1)}`}>
              {bank.severelyAdverseCET1.toFixed(1)}%
            </span>
            <span className={`text-[9px] font-mono text-right tabular-nums ${
              bank.capitalBuffer >= 2 ? 'text-green-400' : bank.capitalBuffer >= 0 ? 'text-yellow-400' : 'text-red-400'
            }`}>
              {bank.capitalBuffer >= 0 ? '+' : ''}{bank.capitalBuffer.toFixed(1)}%
            </span>
            <div className="flex justify-end">
              <span className={`text-[7px] font-mono font-bold px-1.5 py-0.5 ${resultBadgeStyle(bank.result)}`}>
                {bank.result}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Selected Bank Detail ──

function BankDetail({ bank }: { bank: any }) {
  const losses = bank.detail.stressedLosses;
  const totalLoss = losses.creditLosses + losses.tradingLosses + losses.operationalLosses + losses.otherLosses;
  const path = bank.detail.minCET1Path;

  // SVG mini chart for CET1 path
  const W = 200;
  const H = 50;
  const PAD_X = 6;
  const PAD_Y = 6;
  const minVal = Math.min(...path) - 0.5;
  const maxVal = Math.max(...path) + 0.5;
  const rangeVal = maxVal - minVal || 1;

  const svgPoints = path.map((v: any, i: any) => ({
    x: PAD_X + (i / (path.length - 1)) * (W - PAD_X * 2),
    y: PAD_Y + ((maxVal - v) / rangeVal) * (H - PAD_Y * 2),
  }));

  const pathD = svgPoints.map((p: any, i: any) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaD = `${pathD} L ${svgPoints[svgPoints.length - 1].x.toFixed(1)},${H} L ${svgPoints[0].x.toFixed(1)},${H} Z`;

  const quarters = ['Q0', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5'];

  return (
    <div className="border-b border-violet-400/30 bg-[#030305]">
      <div className="px-3 py-1 border-b border-border/20 flex items-center gap-1.5">
        <div className="w-1 h-1 bg-violet-400" />
        <span className="text-[7px] font-black font-mono uppercase tracking-widest text-neutral-500">
          Detail: {bank.name}
        </span>
        <span className={`text-[7px] font-mono font-bold px-1 py-0.5 ml-auto ${resultBadgeStyle(bank.result)}`}>
          {bank.result}
        </span>
      </div>

      <div className="grid grid-cols-2 divide-x divide-border/20">
        {/* Left: Stressed Losses */}
        <div className="px-3 py-2">
          <div className="text-[7px] font-bold font-mono uppercase tracking-wider text-neutral-500 mb-1.5">
            Stressed Losses Breakdown ($B)
          </div>
          <div className="space-y-1">
            {[
              { label: 'Credit Losses', value: losses.creditLosses },
              { label: 'Trading Losses', value: losses.tradingLosses },
              { label: 'Operational Losses', value: losses.operationalLosses },
              { label: 'Other Losses', value: losses.otherLosses },
            ].map((item: any) => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="text-[8px] font-mono text-neutral-400">{item.label}</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1 bg-neutral-900 relative">
                    <div
                      className="absolute top-0 left-0 h-full bg-violet-400/50"
                      style={{ width: `${(item.value / totalLoss) * 100}%` }}
                    />
                  </div>
                  <span className="text-[9px] font-mono font-bold text-neutral-300 tabular-nums w-12 text-right">
                    {item.value.toFixed(1)}
                  </span>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between pt-1 border-t border-border/20">
              <span className="text-[8px] font-mono font-bold text-neutral-300">Total</span>
              <span className="text-[9px] font-mono font-bold text-red-400 tabular-nums">
                ${totalLoss.toFixed(1)}B
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[8px] font-mono text-neutral-400">Loan Loss Rate</span>
              <span className="text-[9px] font-mono font-bold text-orange-400 tabular-nums">
                {bank.detail.loanLossRate.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        {/* Right: CET1 Path Chart */}
        <div className="px-3 py-2">
          <div className="text-[7px] font-bold font-mono uppercase tracking-wider text-neutral-500 mb-1.5">
            Minimum CET1 Path
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 50 }}>
            {/* 4.5% minimum line */}
            <line
              x1={PAD_X}
              y1={PAD_Y + ((maxVal - 4.5) / rangeVal) * (H - PAD_Y * 2)}
              x2={W - PAD_X}
              y2={PAD_Y + ((maxVal - 4.5) / rangeVal) * (H - PAD_Y * 2)}
              stroke="rgba(239,68,68,0.3)"
              strokeDasharray="3,3"
            />
            <text
              x={W - PAD_X + 2}
              y={PAD_Y + ((maxVal - 4.5) / rangeVal) * (H - PAD_Y * 2) + 3}
              fill="rgba(239,68,68,0.5)"
              fontSize={5}
              fontFamily="monospace"
            >
              4.5%
            </text>

            {/* Area fill */}
            <path d={areaD} fill="rgba(167,139,250,0.08)" />

            {/* Line */}
            <path d={pathD} fill="none" stroke="#a78bfa" strokeWidth={1.5} />

            {/* Points */}
            {svgPoints.map((p: any, i: any) => (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r={2} fill="#a78bfa" />
                <text
                  x={p.x}
                  y={p.y - 5}
                  textAnchor="middle"
                  fill="rgba(255,255,255,0.6)"
                  fontSize={5.5}
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  {path[i].toFixed(1)}%
                </text>
              </g>
            ))}

            {/* Quarter labels */}
            {svgPoints.map((p: any, i: any) => (
              <text
                key={`q-${i}`}
                x={p.x}
                y={H - 1}
                textAnchor="middle"
                fill="rgba(255,255,255,0.2)"
                fontSize={5}
                fontFamily="monospace"
              >
                {quarters[i] || `Q${i}`}
              </text>
            ))}
          </svg>

          <div className="flex items-center justify-between mt-1.5">
            <div>
              <span className="text-[7px] font-mono text-neutral-600">Baseline</span>
              <span className="text-[9px] font-mono font-bold text-white ml-1 tabular-nums">
                {path[0].toFixed(1)}%
              </span>
            </div>
            <div>
              <span className="text-[7px] font-mono text-neutral-600">Trough</span>
              <span className={`text-[9px] font-mono font-bold ml-1 tabular-nums ${cet1Color(Math.min(...path))}`}>
                {Math.min(...path).toFixed(1)}%
              </span>
            </div>
            <div>
              <span className="text-[7px] font-mono text-neutral-600">Drawdown</span>
              <span className="text-[9px] font-mono font-bold text-red-400 ml-1 tabular-nums">
                {(Math.min(...path) - path[0]).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Scenario Assumptions ──

function ScenarioAssumptions({ assumptions }: { assumptions: any[] }) {
  return (
    <div className="border-b border-violet-400/30">
      <div className="px-3 py-1 border-b border-border/20 flex items-center gap-1.5">
        <div className="w-1 h-1 bg-violet-400" />
        <span className="text-[7px] font-black font-mono uppercase tracking-widest text-neutral-500">
          Scenario Assumptions
        </span>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-[1fr_80px_80px_80px] px-3 py-1 border-b border-border/20">
        <span className="text-[7px] font-bold font-mono uppercase tracking-wider text-neutral-500">Metric</span>
        <span className="text-[7px] font-bold font-mono uppercase tracking-wider text-neutral-500 text-right">US</span>
        <span className="text-[7px] font-bold font-mono uppercase tracking-wider text-neutral-500 text-right">EU</span>
        <span className="text-[7px] font-bold font-mono uppercase tracking-wider text-neutral-500 text-right">Global</span>
      </div>

      {assumptions.map((row: any, idx: number) => (
        <div
          key={idx}
          className="grid grid-cols-[1fr_80px_80px_80px] px-3 py-1 border-b border-border/20 hover:bg-violet-400/[0.02]"
        >
          <span className="text-[9px] font-mono text-neutral-300">{row.metric}</span>
          <span className="text-[9px] font-mono text-neutral-300 text-right tabular-nums">{row.us}</span>
          <span className="text-[9px] font-mono text-neutral-300 text-right tabular-nums">{row.eu}</span>
          <span className="text-[9px] font-mono text-neutral-300 text-right tabular-nums">{row.global}</span>
        </div>
      ))}
    </div>
  );
}

// ── Loss Distribution by Category ──

function LossDistribution({ losses }: { losses: any[] }) {
  const maxContribution = Math.max(...losses.map((l: any) => l.contribution));

  return (
    <div className="border-b border-violet-400/30">
      <div className="px-3 py-1 border-b border-border/20 flex items-center gap-1.5">
        <div className="w-1 h-1 bg-violet-400" />
        <span className="text-[7px] font-black font-mono uppercase tracking-widest text-neutral-500">
          Loss Distribution by Category
        </span>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-[1fr_80px_70px_120px] px-3 py-1 border-b border-border/20">
        <span className="text-[7px] font-bold font-mono uppercase tracking-wider text-neutral-500">Category</span>
        <span className="text-[7px] font-bold font-mono uppercase tracking-wider text-neutral-500 text-right">Losses ($B)</span>
        <span className="text-[7px] font-bold font-mono uppercase tracking-wider text-neutral-500 text-right">Loss Rate</span>
        <span className="text-[7px] font-bold font-mono uppercase tracking-wider text-neutral-500 text-right">Contribution</span>
      </div>

      {losses.map((loss: any) => (
        <div
          key={loss.category}
          className="grid grid-cols-[1fr_80px_70px_120px] px-3 py-1 border-b border-border/20 hover:bg-violet-400/[0.02] items-center"
        >
          <span className="text-[9px] font-mono text-neutral-300">{loss.category}</span>
          <span className="text-[9px] font-mono text-neutral-300 text-right tabular-nums">
            {loss.totalLosses.toFixed(1)}
          </span>
          <span className={`text-[9px] font-mono text-right tabular-nums ${
            loss.lossRate >= 10 ? 'text-red-400' : loss.lossRate >= 6 ? 'text-orange-400' : 'text-neutral-300'
          }`}>
            {loss.lossRate.toFixed(1)}%
          </span>
          <div className="flex items-center gap-2 justify-end">
            <div className="w-16 h-1.5 bg-neutral-900 relative">
              <div
                className="absolute top-0 left-0 h-full bg-violet-400/60"
                style={{ width: `${(loss.contribution / maxContribution) * 100}%` }}
              />
            </div>
            <span className="text-[9px] font-mono font-bold text-violet-400 tabular-nums w-10 text-right">
              {loss.contribution.toFixed(1)}%
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Capital Requirements Summary ──

function CapitalRequirements({ requirements }: { requirements: any }) {
  const items = [
    { label: 'Minimum CET1', value: requirements.minimumCET1.toFixed(1) + '%' },
    { label: 'Capital Conservation', value: requirements.capitalConservation.toFixed(1) + '%' },
    { label: 'G-SIB Surcharge', value: requirements.gSIBSurcharge.toFixed(1) + '%' },
    { label: 'Countercyclical', value: requirements.countercyclical.toFixed(1) + '%' },
    { label: 'Stress Capital Buffer', value: requirements.scb.toFixed(1) + '%' },
  ];

  return (
    <div className="border-b border-violet-400/30">
      <div className="px-3 py-1 border-b border-border/20 flex items-center gap-1.5">
        <div className="w-1 h-1 bg-violet-400" />
        <span className="text-[7px] font-black font-mono uppercase tracking-widest text-neutral-500">
          Capital Requirements Summary
        </span>
      </div>

      <div className="px-3 py-2">
        <div className="grid grid-cols-3 gap-x-4 gap-y-1.5">
          {items.map((item: any) => (
            <div key={item.label} className="flex items-center justify-between">
              <span className="text-[8px] font-mono text-neutral-500">{item.label}</span>
              <span className="text-[9px] font-mono font-bold text-neutral-300 tabular-nums">{item.value}</span>
            </div>
          ))}
        </div>

        <div className="mt-2 pt-2 border-t border-border/20 grid grid-cols-2 gap-4">
          <div className="flex items-center justify-between">
            <span className="text-[8px] font-mono font-bold text-neutral-400">Total CET1 Required</span>
            <span className="text-[11px] font-mono font-black text-violet-400 tabular-nums">
              {requirements.totalRequired.toFixed(1)}%
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[8px] font-mono font-bold text-neutral-400">System Min (incl. buffers)</span>
            <span className="text-[11px] font-mono font-black text-white tabular-nums">
              {requirements.systemMin.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
