import { useState, useMemo } from 'react';
import { useGlobalDebtClock } from '../../api/hooks/use-global-debt-clock';
import { Banknote } from 'lucide-react';

// ── Formatting helpers ──

function fmtTrillions(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}Q`;
  return `$${n.toFixed(2)}T`;
}

function fmtBillions(n: number): string {
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(2)}T`;
  return `$${n.toFixed(0)}B`;
}

function fmtPerCapita(n: number): string {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

// ── Color helpers ──

function debtGdpColor(v: number): string {
  if (v > 150) return 'text-red-400';
  if (v > 100) return 'text-orange-400';
  if (v > 60) return 'text-yellow-400';
  return 'text-green-400';
}

function ratingColor(rating: string): string {
  if (rating.startsWith('AAA')) return 'text-emerald-400';
  if (rating.startsWith('AA')) return 'text-green-400';
  if (rating.startsWith('A')) return 'text-yellow-400';
  if (rating.startsWith('BBB')) return 'text-orange-400';
  return 'text-red-400';
}

function ratingBg(rating: string): string {
  if (rating.startsWith('AAA')) return 'bg-emerald-400/10 border-emerald-400/30';
  if (rating.startsWith('AA')) return 'bg-green-400/10 border-green-400/30';
  if (rating.startsWith('A')) return 'bg-yellow-400/10 border-yellow-400/30';
  if (rating.startsWith('BBB')) return 'bg-orange-400/10 border-orange-400/30';
  return 'bg-red-400/10 border-red-400/30';
}

function deficitColor(v: number): string {
  if (v < 0) return 'text-red-400';
  return 'text-emerald-400';
}

function interestRevenueColor(v: number): string {
  if (v > 25) return 'text-red-400';
  if (v > 15) return 'text-orange-400';
  if (v > 10) return 'text-yellow-400';
  return 'text-green-400';
}

// ── Section header component ──

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-red-400/30">
      <div className="w-1 h-1 bg-red-400" />
      <span className="text-[7px] font-black uppercase tracking-widest text-red-400">{title}</span>
    </div>
  );
}

// ── Main Component ──

export function GlobalDebtClockPanel() {
  const { data: hookData, isLoading } = useGlobalDebtClock();
  const data: any = hookData;

  const [selectedCountry, setSelectedCountry] = useState<string>('United States');

  const selectedDetail = useMemo(() => {
    const list = data?.sovereignDebt ?? [];
    return list.find((c: any) => c.country === selectedCountry) || list[0];
  }, [data, selectedCountry]);

  const sortedSovereign = useMemo(() => {
    return [...(data?.sovereignDebt ?? [])].sort((a: any, b: any) => b.totalDebt - a.totalDebt);
  }, [data]);

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full text-neutral/40 text-[10px] font-mono uppercase tracking-widest">{isLoading ? 'Loading...' : 'No data available'}</div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-black overflow-hidden text-[9px] font-mono">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#050505] border-b border-red-400/30 shrink-0">
        <div className="flex items-center gap-2">
          <Banknote className="w-4 h-4 text-red-400" />
          <span className="text-[9px] font-black font-mono uppercase tracking-tighter text-red-400">
            GLOBAL DEBT CLOCK
          </span>
        </div>
        {data.globalAggregate && (
        <div className="flex items-center gap-3">
          <span className="text-[12px] font-black text-white tabular-nums">
            {fmtTrillions(data.globalAggregate.totalGlobalDebt)}
          </span>
          <span className="text-[8px] font-bold text-red-400 tabular-nums">
            +{data.globalAggregate.growthRate}% YoY
          </span>
        </div>
        )}
      </div>

      <div className="flex-1 overflow-auto no-scrollbar">
        {/* Section 2: Global Aggregate */}
        {data.globalAggregate && (<>
        <SectionHeader title="GLOBAL DEBT AGGREGATE" />
        <div className="grid grid-cols-3 gap-px bg-border/10">
          {[
            { label: 'TOTAL GLOBAL DEBT', value: fmtTrillions(data.globalAggregate.totalGlobalDebt), sub: `${fmtPct(data.globalAggregate.debtToGdp)} OF GDP` },
            { label: 'GOVERNMENT DEBT', value: fmtTrillions(data.globalAggregate.governmentDebt), sub: 'SOVEREIGN' },
            { label: 'CORPORATE DEBT', value: fmtTrillions(data.globalAggregate.corporateDebt), sub: 'NON-FINANCIAL' },
            { label: 'HOUSEHOLD DEBT', value: fmtTrillions(data.globalAggregate.householdDebt), sub: 'CONSUMER' },
            { label: 'FINANCIAL DEBT', value: fmtTrillions(data.globalAggregate.financialDebt), sub: 'BANKS & FI' },
            { label: 'DEBT-TO-GDP', value: fmtPct(data.globalAggregate.debtToGdp), sub: `+${data.globalAggregate.growthRate}% GROWTH` },
          ].map((item: any) => (
            <div key={item.label} className="bg-black px-3 py-2 hover:bg-red-400/[0.02] transition-colors">
              <div className="text-[7px] font-bold text-neutral-500 uppercase tracking-wider">{item.label}</div>
              <div className="text-[14px] font-black text-white mt-0.5 tabular-nums">{item.value}</div>
              <div className="text-[6px] text-neutral-600 uppercase">{item.sub}</div>
            </div>
          ))}
        </div>
        </>)}

        {/* Section 3: Sovereign Debt Table */}
        <SectionHeader title="SOVEREIGN DEBT RANKINGS" />
        <div className="overflow-x-auto">
          <table className="w-full text-[8px] font-mono">
            <thead>
              <tr className="border-b border-red-400/30 bg-white/[0.02]">
                <th className="text-left py-1.5 px-2 text-[7px] font-black text-neutral-500 uppercase tracking-wider whitespace-nowrap">COUNTRY</th>
                <th className="text-right py-1.5 px-2 text-[7px] font-black text-neutral-500 uppercase tracking-wider whitespace-nowrap">TOTAL DEBT</th>
                <th className="text-right py-1.5 px-2 text-[7px] font-black text-neutral-500 uppercase tracking-wider whitespace-nowrap">DEBT/GDP</th>
                <th className="text-right py-1.5 px-2 text-[7px] font-black text-neutral-500 uppercase tracking-wider whitespace-nowrap">DEFICIT</th>
                <th className="text-right py-1.5 px-2 text-[7px] font-black text-neutral-500 uppercase tracking-wider whitespace-nowrap">INTEREST</th>
                <th className="text-right py-1.5 px-2 text-[7px] font-black text-neutral-500 uppercase tracking-wider whitespace-nowrap">INT/REV</th>
                <th className="text-center py-1.5 px-2 text-[7px] font-black text-neutral-500 uppercase tracking-wider whitespace-nowrap">RATING</th>
                <th className="text-right py-1.5 px-2 text-[7px] font-black text-neutral-500 uppercase tracking-wider whitespace-nowrap">PER CAPITA</th>
              </tr>
            </thead>
            <tbody>
              {sortedSovereign.map((c: any, i: any) => (
                <tr
                  key={c.country}
                  onClick={() => setSelectedCountry(c.country)}
                  className={`border-b border-border/20 hover:bg-red-400/[0.02] transition-colors cursor-pointer ${
                    selectedCountry === c.country ? 'bg-red-400/[0.04]' : i % 2 === 0 ? 'bg-black' : 'bg-white/[0.01]'
                  }`}
                >
                  <td className="py-1.5 px-2 whitespace-nowrap">
                    <span className="mr-1">{c.flag}</span>
                    <span className="text-white font-bold text-[8px]">{c.country}</span>
                  </td>
                  <td className="text-right py-1.5 px-2 text-white font-bold tabular-nums">{fmtTrillions(c.totalDebt)}</td>
                  <td className={`text-right py-1.5 px-2 font-bold tabular-nums ${debtGdpColor(c.debtToGdp)}`}>{fmtPct(c.debtToGdp)}</td>
                  <td className={`text-right py-1.5 px-2 font-bold tabular-nums ${deficitColor(c.deficit)}`}>{c.deficit > 0 ? '+' : ''}{c.deficit.toFixed(1)}%</td>
                  <td className="text-right py-1.5 px-2 text-neutral-400 tabular-nums">{fmtBillions(c.interestPayments)}</td>
                  <td className={`text-right py-1.5 px-2 font-bold tabular-nums ${interestRevenueColor(c.interestToRevenue)}`}>{fmtPct(c.interestToRevenue)}</td>
                  <td className="text-center py-1.5 px-2">
                    <span className={`px-1.5 py-0.5 text-[6px] font-black border ${ratingColor(c.rating)} ${ratingBg(c.rating)}`}>
                      {c.rating}
                    </span>
                  </td>
                  <td className="text-right py-1.5 px-2 text-neutral-400 tabular-nums">{fmtPerCapita(c.perCapita)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Section 4: Selected Country Detail */}
        {selectedDetail && (
          <>
            <SectionHeader title={`${selectedDetail.flag} ${selectedDetail.country.toUpperCase()} - DEBT DETAIL`} />
            <div className="px-3 py-2">
              {/* Debt Sustainability Indicators */}
              <div className="grid grid-cols-4 gap-px bg-border/10 mb-2">
                {[
                  { label: 'DEBT/GDP', value: fmtPct(selectedDetail.debtToGdp), color: debtGdpColor(selectedDetail.debtToGdp) },
                  { label: 'DEFICIT/GDP', value: `${selectedDetail.deficit > 0 ? '+' : ''}${selectedDetail.deficit.toFixed(1)}%`, color: deficitColor(selectedDetail.deficit) },
                  { label: 'INT/REVENUE', value: fmtPct(selectedDetail.interestToRevenue), color: interestRevenueColor(selectedDetail.interestToRevenue) },
                  { label: 'PER CAPITA', value: fmtPerCapita(selectedDetail.perCapita), color: 'text-white' },
                ].map((ind: any) => (
                  <div key={ind.label} className="bg-black px-2 py-1.5 hover:bg-red-400/[0.02] transition-colors">
                    <div className="text-[6px] font-bold text-neutral-600 uppercase tracking-wider">{ind.label}</div>
                    <div className={`text-[11px] font-black tabular-nums ${ind.color}`}>{ind.value}</div>
                  </div>
                ))}
              </div>

              {/* Composition bars */}
              <div className="text-[7px] font-black uppercase tracking-widest text-neutral-500 mb-1.5">DEBT COMPOSITION</div>
              <div className="space-y-1.5 mb-2">
                {/* Domestic vs Foreign */}
                <div>
                  <div className="flex justify-between text-[6px] text-neutral-500 mb-0.5">
                    <span>DOMESTIC {selectedDetail.domesticPct}%</span>
                    <span>FOREIGN {selectedDetail.foreignPct}%</span>
                  </div>
                  <div className="flex h-1.5 bg-white/[0.03] overflow-hidden">
                    <div className="bg-red-400/60" style={{ width: `${selectedDetail.domesticPct}%` }} />
                    <div className="bg-orange-400/60" style={{ width: `${selectedDetail.foreignPct}%` }} />
                  </div>
                </div>
                {/* Short vs Long Term */}
                <div>
                  <div className="flex justify-between text-[6px] text-neutral-500 mb-0.5">
                    <span>SHORT-TERM {selectedDetail.shortTermPct}%</span>
                    <span>LONG-TERM {selectedDetail.longTermPct}%</span>
                  </div>
                  <div className="flex h-1.5 bg-white/[0.03] overflow-hidden">
                    <div className="bg-yellow-400/60" style={{ width: `${selectedDetail.shortTermPct}%` }} />
                    <div className="bg-emerald-400/60" style={{ width: `${selectedDetail.longTermPct}%` }} />
                  </div>
                </div>
                {/* Fixed vs Floating */}
                <div>
                  <div className="flex justify-between text-[6px] text-neutral-500 mb-0.5">
                    <span>FIXED {selectedDetail.fixedPct}%</span>
                    <span>FLOATING {selectedDetail.floatingPct}%</span>
                  </div>
                  <div className="flex h-1.5 bg-white/[0.03] overflow-hidden">
                    <div className="bg-sky-400/60" style={{ width: `${selectedDetail.fixedPct}%` }} />
                    <div className="bg-purple-400/60" style={{ width: `${selectedDetail.floatingPct}%` }} />
                  </div>
                </div>
              </div>

              {/* 5-Year Debt Trajectory */}
              <div className="text-[7px] font-black uppercase tracking-widest text-neutral-500 mb-1">DEBT/GDP TRAJECTORY (5Y)</div>
              <DebtTrajectoryChart projections={selectedDetail.projections} />
            </div>
          </>
        )}

        {/* Section 5: Debt Growth Trajectory Table */}
        <SectionHeader title="DEBT/GDP PROJECTIONS - TOP 10 ECONOMIES" />
        <div className="overflow-x-auto">
          <table className="w-full text-[8px] font-mono">
            <thead>
              <tr className="border-b border-red-400/30 bg-white/[0.02]">
                <th className="text-left py-1.5 px-2 text-[7px] font-black text-neutral-500 uppercase tracking-wider whitespace-nowrap">COUNTRY</th>
                <th className="text-right py-1.5 px-2 text-[7px] font-black text-neutral-500 uppercase tracking-wider whitespace-nowrap">2026</th>
                <th className="text-right py-1.5 px-2 text-[7px] font-black text-neutral-500 uppercase tracking-wider whitespace-nowrap">2027</th>
                <th className="text-right py-1.5 px-2 text-[7px] font-black text-neutral-500 uppercase tracking-wider whitespace-nowrap">2028</th>
                <th className="text-right py-1.5 px-2 text-[7px] font-black text-neutral-500 uppercase tracking-wider whitespace-nowrap">2029</th>
                <th className="text-right py-1.5 px-2 text-[7px] font-black text-neutral-500 uppercase tracking-wider whitespace-nowrap">2030</th>
                <th className="text-right py-1.5 px-2 text-[7px] font-black text-neutral-500 uppercase tracking-wider whitespace-nowrap">CHG</th>
              </tr>
            </thead>
            <tbody>
              {(data.debtGrowthTrajectory ?? []).map((c: any, i: any) => {
                const change = c.y2030 - c.y2026;
                return (
                  <tr
                    key={c.country}
                    className={`border-b border-border/20 hover:bg-red-400/[0.02] transition-colors ${
                      i % 2 === 0 ? 'bg-black' : 'bg-white/[0.01]'
                    }`}
                  >
                    <td className="py-1.5 px-2 whitespace-nowrap">
                      <span className="mr-1">{c.flag}</span>
                      <span className="text-white font-bold text-[8px]">{c.country}</span>
                    </td>
                    <td className={`text-right py-1.5 px-2 tabular-nums ${debtGdpColor(c.y2026)}`}>{fmtPct(c.y2026)}</td>
                    <td className={`text-right py-1.5 px-2 tabular-nums ${debtGdpColor(c.y2027)}`}>{fmtPct(c.y2027)}</td>
                    <td className={`text-right py-1.5 px-2 tabular-nums ${debtGdpColor(c.y2028)}`}>{fmtPct(c.y2028)}</td>
                    <td className={`text-right py-1.5 px-2 tabular-nums ${debtGdpColor(c.y2029)}`}>{fmtPct(c.y2029)}</td>
                    <td className={`text-right py-1.5 px-2 font-bold tabular-nums ${debtGdpColor(c.y2030)}`}>{fmtPct(c.y2030)}</td>
                    <td className={`text-right py-1.5 px-2 font-bold tabular-nums ${change > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {change > 0 ? '+' : ''}{change.toFixed(1)}pp
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Section 6: Global Interest Burden */}
        {data.globalInterestBurden && (<>
        <SectionHeader title="GLOBAL INTEREST BURDEN" />
        <div className="px-3 py-2">
          <div className="grid grid-cols-2 gap-px bg-border/10 mb-2">
            <div className="bg-black px-3 py-2 hover:bg-red-400/[0.02] transition-colors">
              <div className="text-[7px] font-bold text-neutral-500 uppercase tracking-wider">TOTAL GLOBAL INTEREST</div>
              <div className="text-[16px] font-black text-red-400 mt-0.5 tabular-nums">{fmtTrillions(data.globalInterestBurden.totalInterest)}</div>
            </div>
            <div className="bg-black px-3 py-2 hover:bg-red-400/[0.02] transition-colors">
              <div className="text-[7px] font-bold text-neutral-500 uppercase tracking-wider">AS % OF GLOBAL GDP</div>
              <div className="text-[16px] font-black text-orange-400 mt-0.5 tabular-nums">{fmtPct(data.globalInterestBurden.asPercentOfGdp)}</div>
            </div>
          </div>

          <div className="text-[7px] font-black uppercase tracking-widest text-neutral-500 mb-1">FASTEST GROWING INTEREST BURDEN</div>
          <div className="overflow-x-auto">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b border-red-400/30 bg-white/[0.02]">
                  <th className="text-left py-1 px-2 text-[7px] font-black text-neutral-500 uppercase tracking-wider">COUNTRY</th>
                  <th className="text-right py-1 px-2 text-[7px] font-black text-neutral-500 uppercase tracking-wider">INTEREST</th>
                  <th className="text-right py-1 px-2 text-[7px] font-black text-neutral-500 uppercase tracking-wider">GROWTH</th>
                  <th className="text-left py-1 px-2 text-[7px] font-black text-neutral-500 uppercase tracking-wider">BURDEN</th>
                </tr>
              </thead>
              <tbody>
                {(data.globalInterestBurden.fastestGrowing ?? []).map((c: any, i: any) => {
                  const maxInterest = Math.max(...data.globalInterestBurden.fastestGrowing.map((x: any) => x.interest));
                  const barPct = maxInterest > 0 ? (c.interest / maxInterest) * 100 : 0;
                  return (
                    <tr
                      key={c.country}
                      className={`border-b border-border/20 hover:bg-red-400/[0.02] transition-colors ${
                        i % 2 === 0 ? 'bg-black' : 'bg-white/[0.01]'
                      }`}
                    >
                      <td className="py-1 px-2 whitespace-nowrap">
                        <span className="mr-1">{c.flag}</span>
                        <span className="text-white font-bold">{c.country}</span>
                      </td>
                      <td className="text-right py-1 px-2 text-neutral-400 tabular-nums">{fmtBillions(c.interest)}</td>
                      <td className="text-right py-1 px-2 text-red-400 font-bold tabular-nums">+{c.growthRate.toFixed(1)}%</td>
                      <td className="py-1 px-2 w-24">
                        <div className="h-1.5 bg-white/[0.03] overflow-hidden">
                          <div className="h-full bg-red-400/50" style={{ width: `${barPct}%` }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        </>)}

        {/* Section 7: Debt Composition by Country */}
        <SectionHeader title="DEBT COMPOSITION BY COUNTRY" />
        <div className="px-3 py-2">
          <div className="flex items-center gap-4 mb-2 text-[6px] font-mono text-neutral-500">
            <div className="flex items-center gap-1">
              <div className="w-2 h-1.5 bg-red-400/60" />
              <span>DOMESTIC</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-1.5 bg-orange-400/60" />
              <span>FOREIGN</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-1.5 bg-yellow-400/60" />
              <span>SHORT-TERM</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-1.5 bg-emerald-400/60" />
              <span>LONG-TERM</span>
            </div>
          </div>
          {sortedSovereign.slice(0, 10).map((c: any) => (
            <div key={c.country} className="mb-1.5 hover:bg-red-400/[0.02] transition-colors px-1 py-0.5">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[7px] font-bold text-white/60">
                  <span className="mr-1">{c.flag}</span>{c.country}
                </span>
                <span className="text-[7px] text-neutral-500 tabular-nums">{fmtTrillions(c.totalDebt)}</span>
              </div>
              {/* Domestic/Foreign bar */}
              <div className="flex h-1 bg-white/[0.03] overflow-hidden mb-0.5">
                <div className="bg-red-400/60 h-full" style={{ width: `${c.domesticPct}%` }} />
                <div className="bg-orange-400/60 h-full" style={{ width: `${c.foreignPct}%` }} />
              </div>
              {/* Short/Long term bar */}
              <div className="flex h-1 bg-white/[0.03] overflow-hidden">
                <div className="bg-yellow-400/60 h-full" style={{ width: `${c.shortTermPct}%` }} />
                <div className="bg-emerald-400/60 h-full" style={{ width: `${c.longTermPct}%` }} />
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-3 py-2 border-t border-red-400/30">
          <p className="text-[7px] font-mono text-neutral-600 leading-relaxed">
            Not real-time.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Debt Trajectory Mini Chart ──

function DebtTrajectoryChart({ projections }: { projections: number[] }) {
  if (!projections || projections.length < 2) return null;

  const W = 200;
  const H = 40;
  const PAD_X = 4;
  const PAD_Y = 6;

  const minV = Math.min(...projections) - 2;
  const maxV = Math.max(...projections) + 2;
  const rangeV = maxV - minV || 1;

  const scaleX = (i: number) => PAD_X + (i / (projections.length - 1)) * (W - PAD_X * 2);
  const scaleY = (v: number) => PAD_Y + ((maxV - v) / rangeV) * (H - PAD_Y * 2);

  const linePath = projections
    .map((v: any, i: any) => `${i === 0 ? 'M' : 'L'} ${scaleX(i).toFixed(1)},${scaleY(v).toFixed(1)}`)
    .join(' ');

  const fillPath = `${linePath} L ${scaleX(projections.length - 1).toFixed(1)},${H} L ${scaleX(0).toFixed(1)},${H} Z`;

  const increasing = projections[projections.length - 1] > projections[0];
  const lineColor = increasing ? '#f87171' : '#4ade80';
  const fillColor = increasing ? 'rgba(248,113,113,0.08)' : 'rgba(74,222,128,0.08)';

  const years = ['2026', '2027', '2028', '2029', '2030'];

  return (
    <svg viewBox={`0 0 ${W} ${H + 10}`} className="w-full" style={{ height: 45 }}>
      <path d={fillPath} fill={fillColor} />
      <path d={linePath} fill="none" stroke={lineColor} strokeWidth={1.5} />
      {projections.map((v: any, i: any) => (
        <g key={i}>
          <circle cx={scaleX(i)} cy={scaleY(v)} r={1.5} fill={lineColor} />
          <text
            x={scaleX(i)}
            y={H + 8}
            textAnchor="middle"
            fill="rgba(255,255,255,0.2)"
            fontSize={5}
            fontFamily="monospace"
          >
            {years[i]}
          </text>
        </g>
      ))}
      {/* Start and end labels */}
      <text
        x={scaleX(0)}
        y={scaleY(projections[0]) - 4}
        textAnchor="start"
        fill={lineColor}
        fontSize={6}
        fontFamily="monospace"
        fontWeight="bold"
      >
        {projections[0].toFixed(0)}%
      </text>
      <text
        x={scaleX(projections.length - 1)}
        y={scaleY(projections[projections.length - 1]) - 4}
        textAnchor="end"
        fill={lineColor}
        fontSize={6}
        fontFamily="monospace"
        fontWeight="bold"
      >
        {projections[projections.length - 1].toFixed(0)}%
      </text>
    </svg>
  );
}
