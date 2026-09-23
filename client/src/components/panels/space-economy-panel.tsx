import { Rocket } from 'lucide-react';
import { useSpaceEconomy } from '../../api/hooks/use-space-economy';

// --- Component ---

export function SpaceEconomyPanel() {
  const { data: apiData, isLoading } = useSpaceEconomy();
  const data = apiData as any;

  const overview = data?.overview;
  const launches = data?.launches || [];
  const constellations = data?.constellations || [];
  const companies = data?.companies || [];
  const govBudgets = data?.govBudgets || [];
  const orbitalEnv = data?.orbitalEnvironment;

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full text-neutral/40 text-[10px] font-mono uppercase tracking-widest">{isLoading ? 'Loading...' : 'No data available'}</div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-black text-[9px] font-mono overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#050505] border-b border-violet-400/30 shrink-0">
        <div className="flex items-center gap-2">
          <Rocket className="w-3.5 h-3.5 text-violet-400" />
          <span className="text-[9px] font-black uppercase tracking-tighter text-violet-400">
            SPACE ECONOMY
          </span>
        </div>
        {overview && <div className="flex items-center gap-3 text-[8px] text-neutral/40 tabular-nums">
          <span>MKT SIZE <span className="text-violet-400 font-bold">${overview.marketSize}B</span></span>
          <span>LAUNCHES YTD <span className="text-violet-400 font-bold">{overview.launchesYtd}</span></span>
        </div>}
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-auto no-scrollbar">

        {/* Overview */}
        {overview && <div className="border-b border-violet-400/30">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.01]">
            <div className="w-1 h-1 bg-violet-400" />
            <span className="text-[7px] font-black uppercase tracking-widest text-violet-400">Overview</span>
          </div>
          <div className="grid grid-cols-3 gap-px bg-border/10">
            {[
              { label: 'MARKET SIZE', value: `$${overview.marketSize}B` },
              { label: 'COMMERCIAL', value: `${overview.commercialShare}%` },
              { label: 'GOVERNMENT', value: `${overview.govShare}%` },
              { label: 'LAUNCHES YTD', value: `${overview.launchesYtd}` },
              { label: 'SATELLITES DEPLOYED', value: overview.satellitesDeployed.toLocaleString() },
              { label: 'VC INVESTMENT', value: `$${overview.vcInvestment}B` },
            ].map((item: any) => (
              <div key={item.label} className="bg-black px-3 py-1.5">
                <div className="text-[7px] text-neutral/35 font-bold uppercase tracking-wider">{item.label}</div>
                <div className="text-[12px] font-black text-violet-400 mt-0.5 tabular-nums">{item.value}</div>
              </div>
            ))}
          </div>
          <div className="px-3 py-1.5 bg-black border-t border-border/20">
            <div className="text-[7px] text-neutral/35 font-bold uppercase tracking-wider">ANNUAL GROWTH RATE</div>
            <div className="text-[12px] font-black text-emerald-400 tabular-nums">+{overview.growthRate}%</div>
          </div>
        </div>}

        {/* Launch Activity */}
        <div className="border-b border-violet-400/30">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.01]">
            <div className="w-1 h-1 bg-violet-400" />
            <span className="text-[7px] font-black uppercase tracking-widest text-violet-400">Launch Activity</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-violet-400/30 bg-white/[0.02]">
                  {['PROVIDER', 'LAUNCHES', 'SUCCESS %', 'PAYLOAD KG', 'COST/KG', 'VEHICLE', 'TYPE', 'NEXT LAUNCH'].map((h: any) => (
                    <th key={h} className="text-left py-1.5 px-2 text-[7px] font-black text-neutral/40 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {launches.map((l: any, i: any) => (
                  <tr key={l.provider} className={`border-b border-border/20 hover:bg-violet-400/[0.02] transition-colors ${i % 2 === 0 ? 'bg-black' : 'bg-white/[0.01]'}`}>
                    <td className="py-1.5 px-2 text-white font-bold whitespace-nowrap">{l.provider}</td>
                    <td className="py-1.5 px-2 text-violet-400 font-bold tabular-nums">{l.launchesYtd}</td>
                    <td className="py-1.5 px-2 tabular-nums">
                      <span className={l.successRate >= 99 ? 'text-emerald-400' : l.successRate >= 95 ? 'text-amber-400' : 'text-red-400'}>
                        {l.successRate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-1.5 px-2 text-neutral/60 tabular-nums">{l.payloadKg.toLocaleString()}</td>
                    <td className="py-1.5 px-2 text-neutral/60 tabular-nums">${l.costPerKg.toLocaleString()}</td>
                    <td className="py-1.5 px-2 text-neutral/50 whitespace-nowrap">{l.vehicle}</td>
                    <td className="py-1.5 px-2">
                      {l.reusable ? (
                        <span className="px-1 py-0.5 text-[7px] font-black uppercase bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">REUSE</span>
                      ) : (
                        <span className="px-1 py-0.5 text-[7px] font-black uppercase bg-neutral/5 text-neutral/30 border border-neutral/10">EXPEND</span>
                      )}
                    </td>
                    <td className="py-1.5 px-2 text-neutral/40 tabular-nums whitespace-nowrap">{l.nextLaunch}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Satellite Constellations */}
        <div className="border-b border-violet-400/30">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.01]">
            <div className="w-1 h-1 bg-violet-400" />
            <span className="text-[7px] font-black uppercase tracking-widest text-violet-400">Satellite Constellations</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-violet-400/30 bg-white/[0.02]">
                  {['CONSTELLATION', 'OPERATOR', 'DEPLOYED/PLANNED', 'ALT (KM)', 'PURPOSE', 'REV EST ($B)'].map((h: any) => (
                    <th key={h} className="text-left py-1.5 px-2 text-[7px] font-black text-neutral/40 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {constellations.map((c: any, i: any) => {
                  const pct = c.planned > 0 ? ((c.deployed / c.planned) * 100).toFixed(0) : '0';
                  return (
                    <tr key={c.constellation} className={`border-b border-border/20 hover:bg-violet-400/[0.02] transition-colors ${i % 2 === 0 ? 'bg-black' : 'bg-white/[0.01]'}`}>
                      <td className="py-1.5 px-2 text-white font-bold whitespace-nowrap">{c.constellation}</td>
                      <td className="py-1.5 px-2 text-neutral/50 whitespace-nowrap">{c.operator}</td>
                      <td className="py-1.5 px-2 tabular-nums whitespace-nowrap">
                        <span className="text-violet-400 font-bold">{c.deployed.toLocaleString()}</span>
                        <span className="text-neutral/30">/{c.planned.toLocaleString()}</span>
                        <span className="text-neutral/25 ml-1">({pct}%)</span>
                      </td>
                      <td className="py-1.5 px-2 text-neutral/50 tabular-nums">{c.altitude}</td>
                      <td className="py-1.5 px-2 text-neutral/50 whitespace-nowrap">{c.purpose}</td>
                      <td className="py-1.5 px-2 text-violet-400/80 tabular-nums font-bold">
                        {c.revenueEstimate > 0 ? `$${c.revenueEstimate}B` : '--'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Space Companies */}
        <div className="border-b border-violet-400/30">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.01]">
            <div className="w-1 h-1 bg-violet-400" />
            <span className="text-[7px] font-black uppercase tracking-widest text-violet-400">Space Companies</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-violet-400/30 bg-white/[0.02]">
                  {['COMPANY', 'MKT CAP ($B)', 'REV GROWTH', 'EBITDA %', 'STOCK YTD', 'SECTOR'].map((h: any) => (
                    <th key={h} className="text-left py-1.5 px-2 text-[7px] font-black text-neutral/40 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {companies.map((c: any, i: any) => (
                  <tr key={c.company} className={`border-b border-border/20 hover:bg-violet-400/[0.02] transition-colors ${i % 2 === 0 ? 'bg-black' : 'bg-white/[0.01]'}`}>
                    <td className="py-1.5 px-2 whitespace-nowrap">
                      <span className="text-white font-bold">{c.company}</span>
                      <span className="text-neutral/30 ml-1">({c.ticker})</span>
                    </td>
                    <td className="py-1.5 px-2 text-violet-400 font-bold tabular-nums">${c.marketCap.toFixed(1)}</td>
                    <td className="py-1.5 px-2 tabular-nums">
                      <span className={c.revenueGrowth >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                        {c.revenueGrowth >= 0 ? '+' : ''}{c.revenueGrowth.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-1.5 px-2 tabular-nums">
                      <span className={c.ebitdaMargin >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                        {c.ebitdaMargin.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-1.5 px-2 tabular-nums font-bold">
                      {c.stockYtd !== null ? (
                        <span className={c.stockYtd >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                          {c.stockYtd >= 0 ? '+' : ''}{c.stockYtd.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-neutral/25">Private</span>
                      )}
                    </td>
                    <td className="py-1.5 px-2">
                      <span className="px-1 py-0.5 text-[7px] font-black uppercase bg-violet-400/10 text-violet-400/70 border border-violet-400/20">
                        {c.sector}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Government Budgets */}
        <div className="border-b border-violet-400/30">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.01]">
            <div className="w-1 h-1 bg-violet-400" />
            <span className="text-[7px] font-black uppercase tracking-widest text-violet-400">Government Budgets</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-violet-400/30 bg-white/[0.02]">
                  {['AGENCY', 'BUDGET ($B)', 'YOY CHANGE', 'KEY PROGRAMS'].map((h: any) => (
                    <th key={h} className="text-left py-1.5 px-2 text-[7px] font-black text-neutral/40 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {govBudgets.map((g: any, i: any) => (
                  <tr key={g.agency} className={`border-b border-border/20 hover:bg-violet-400/[0.02] transition-colors ${i % 2 === 0 ? 'bg-black' : 'bg-white/[0.01]'}`}>
                    <td className="py-1.5 px-2 text-white font-bold whitespace-nowrap">{g.agency}</td>
                    <td className="py-1.5 px-2 text-violet-400 font-bold tabular-nums">${g.budget.toFixed(1)}</td>
                    <td className="py-1.5 px-2 tabular-nums font-bold">
                      <span className={g.yoyChange >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                        {g.yoyChange >= 0 ? '+' : ''}{g.yoyChange.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-1.5 px-2">
                      <div className="flex flex-wrap gap-1">
                        {g.keyPrograms.map((p: any) => (
                          <span key={p} className="px-1 py-0.5 text-[7px] font-bold bg-white/[0.03] text-neutral/40 border border-border/20">
                            {p}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Orbital Environment */}
        {orbitalEnv && <div className="border-b border-violet-400/30">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.01]">
            <div className="w-1 h-1 bg-violet-400" />
            <span className="text-[7px] font-black uppercase tracking-widest text-violet-400">Orbital Environment</span>
          </div>
          <div className="grid grid-cols-3 gap-px bg-border/10">
            {[
              { label: 'TRACKED OBJECTS', value: orbitalEnv.trackedObjects.toLocaleString(), color: 'text-violet-400' },
              { label: 'ACTIVE SATELLITES', value: orbitalEnv.activeSatellites.toLocaleString(), color: 'text-emerald-400' },
              { label: 'DEBRIS', value: orbitalEnv.debris.toLocaleString(), color: 'text-red-400' },
              { label: 'COLLISION RISK EVENTS', value: orbitalEnv.collisionRiskEvents.toString(), color: 'text-amber-400' },
              { label: 'CONJUNCTION WARNINGS', value: orbitalEnv.conjunctionWarnings.toLocaleString(), color: 'text-amber-400' },
            ].map((item: any) => (
              <div key={item.label} className="bg-black px-3 py-1.5">
                <div className="text-[7px] text-neutral/35 font-bold uppercase tracking-wider">{item.label}</div>
                <div className={`text-[12px] font-black mt-0.5 tabular-nums ${item.color}`}>{item.value}</div>
              </div>
            ))}
            <div className="bg-black px-3 py-1.5">
              <div className="text-[7px] text-neutral/35 font-bold uppercase tracking-wider">DEORBIT INITIATIVES</div>
              <div className="text-[12px] font-black text-violet-400 mt-0.5 tabular-nums">{orbitalEnv.deorbitInitiatives.length}</div>
            </div>
          </div>
          <div className="px-3 py-1.5 border-t border-border/20">
            <div className="text-[7px] text-neutral/35 font-bold uppercase tracking-wider mb-1">ACTIVE DEORBIT PROGRAMS</div>
            <div className="flex flex-wrap gap-1">
              {orbitalEnv.deorbitInitiatives.map((d: any) => (
                <span key={d} className="px-1.5 py-0.5 text-[7px] font-bold bg-violet-400/5 text-violet-400/60 border border-violet-400/15">
                  {d}
                </span>
              ))}
            </div>
          </div>
        </div>}

        {/* Footer */}
        <div className="px-3 py-2">
          <p className="text-[7px] text-neutral/25 leading-relaxed">
            Market size includes launch services, satellite manufacturing, ground equipment, and space applications.
          </p>
        </div>
      </div>
    </div>
  );
}
