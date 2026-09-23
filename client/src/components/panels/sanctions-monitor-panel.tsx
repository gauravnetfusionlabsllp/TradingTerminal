import { useState } from 'react';
import { useSanctionsMonitor } from '../../api/hooks/use-sanctions-monitor';
import { RefreshCw, Shield } from 'lucide-react';

// ── Types ──

interface SanctionsRegime {
  target: string;
  type: 'COMPREHENSIVE' | 'TARGETED' | 'SECTORAL';
  imposedBy: string;
  sectors: string[];
  entities: number;
  severity: number;
  risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  measures?: RegimeMeasure[];
  tradeImpact?: TradeImpact;
  exemptions?: string[];
  complianceRequirements?: string[];
}

interface RegimeMeasure {
  name: string;
  description: string;
}

interface TradeImpact {
  preSanctionVolume: string;
  postSanctionVolume: string;
  reductionPct: number;
  estimatedCost: string;
}

interface RecentAction {
  date: string;
  actionType: 'NEW DESIGNATION' | 'REMOVAL' | 'UPDATE' | 'EXPANSION';
  target: string;
  authority: string;
  description: string;
}

interface ComplianceAlert {
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  entity: string;
  issue: string;
  recommendation: string;
}

interface SanctionsMonitorData {
  summary: {
    totalRegimes: number;
    designatedEntities: number;
    newDesignationsYtd: number;
    removalsYtd: number;
    totalTradeAffected: string;
  };
  regimes: SanctionsRegime[];
  recentActions: RecentAction[];
  complianceAlerts: ComplianceAlert[];
}

// ── Color Helpers ──

function typeBadge(type: string): { text: string; bg: string } {
  switch (type) {
    case 'COMPREHENSIVE': return { text: 'text-red-400', bg: 'bg-red-400/10' };
    case 'TARGETED': return { text: 'text-orange-400', bg: 'bg-orange-400/10' };
    case 'SECTORAL': return { text: 'text-yellow-400', bg: 'bg-yellow-400/10' };
    default: return { text: 'text-neutral-400', bg: 'bg-neutral-400/10' };
  }
}

function riskBadge(risk: string): { text: string; bg: string } {
  switch (risk) {
    case 'CRITICAL': return { text: 'text-red-400', bg: 'bg-red-400/10' };
    case 'HIGH': return { text: 'text-orange-400', bg: 'bg-orange-400/10' };
    case 'MEDIUM': return { text: 'text-yellow-400', bg: 'bg-yellow-400/10' };
    case 'LOW': return { text: 'text-green-400', bg: 'bg-green-400/10' };
    default: return { text: 'text-neutral-400', bg: 'bg-neutral-400/10' };
  }
}

function actionColor(actionType: string): string {
  switch (actionType) {
    case 'NEW DESIGNATION': return 'text-red-400';
    case 'REMOVAL': return 'text-green-400';
    case 'UPDATE': return 'text-yellow-400';
    case 'EXPANSION': return 'text-orange-400';
    default: return 'text-neutral-400';
  }
}

function actionBg(actionType: string): string {
  switch (actionType) {
    case 'NEW DESIGNATION': return 'bg-red-400/10';
    case 'REMOVAL': return 'bg-green-400/10';
    case 'UPDATE': return 'bg-yellow-400/10';
    case 'EXPANSION': return 'bg-orange-400/10';
    default: return 'bg-neutral-400/10';
  }
}

function severityBarColor(level: number): string {
  if (level >= 5) return '#f87171';
  if (level >= 4) return '#fb923c';
  if (level >= 3) return '#fbbf24';
  if (level >= 2) return '#facc15';
  return '#4ade80';
}

function alertSeverityBadge(severity: string): { text: string; bg: string } {
  switch (severity) {
    case 'CRITICAL': return { text: 'text-red-400', bg: 'bg-red-400/10' };
    case 'HIGH': return { text: 'text-orange-400', bg: 'bg-orange-400/10' };
    case 'MEDIUM': return { text: 'text-yellow-400', bg: 'bg-yellow-400/10' };
    case 'LOW': return { text: 'text-green-400', bg: 'bg-green-400/10' };
    default: return { text: 'text-neutral-400', bg: 'bg-neutral-400/10' };
  }
}

// ── Severity Bar ──

function SeverityBar({ level, max = 5 }: { level: number; max?: number }) {
  const pct = Math.min((level / max) * 100, 100);
  const color = severityBarColor(level);

  return (
    <div className="flex items-center gap-1">
      <div className="w-10 h-1.5 bg-white/[0.04] relative overflow-hidden">
        <div
          className="absolute top-0 left-0 h-full"
          style={{ width: `${pct}%`, backgroundColor: color, opacity: 0.7 }}
        />
      </div>
      <span className="text-[7px] font-mono font-bold tabular-nums" style={{ color }}>
        {level}
      </span>
    </div>
  );
}

// ── Section Header ──

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 border-b border-red-400/30">
      <div className="w-1 h-1 shrink-0 bg-red-400" />
      <span className="text-[7px] font-black font-mono uppercase tracking-widest text-red-400">
        {title}
      </span>
    </div>
  );
}

// ── Summary Bar ──

function SummaryBar({ summary }: { summary: SanctionsMonitorData['summary'] }) {
  const metrics = [
    { label: 'NEW DESIGNATIONS YTD', value: summary.newDesignationsYtd.toLocaleString(), color: 'text-red-400' },
    { label: 'REMOVALS YTD', value: summary.removalsYtd.toLocaleString(), color: 'text-green-400' },
    { label: 'TOTAL TRADE AFFECTED', value: summary.totalTradeAffected, color: 'text-orange-400' },
  ];

  return (
    <div className="grid grid-cols-3 border-b border-red-400/30 bg-black">
      {metrics.map((m) => (
        <div key={m.label} className="px-2 py-1.5 border-r border-red-400/10 last:border-r-0">
          <div className="text-[6px] font-mono uppercase tracking-wider text-neutral-500">
            {m.label}
          </div>
          <div className={`text-[10px] font-mono font-bold ${m.color}`}>
            {m.value}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Regimes Table ──

function RegimesTable({
  regimes,
  selectedTarget,
  onSelect,
}: {
  regimes: SanctionsRegime[];
  selectedTarget: string | null;
  onSelect: (target: string | null) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[9px] font-mono">
        <thead className="sticky top-0 bg-[#080808] z-10">
          <tr className="border-b border-border/20">
            <ThCell label="Target" align="left" />
            <ThCell label="Type" align="left" />
            <ThCell label="Imposed By" align="left" />
            <ThCell label="Sectors" align="left" />
            <ThCell label="Entities" align="right" />
            <ThCell label="Severity" align="left" />
            <ThCell label="Risk" align="left" />
          </tr>
        </thead>
        <tbody>
          {regimes.map((r) => {
            const tb = typeBadge(r.type);
            const rb = riskBadge(r.risk);
            const isSelected = selectedTarget === r.target;

            return (
              <tr
                key={r.target}
                className={`border-b border-border/10 cursor-pointer transition-colors ${
                  isSelected ? 'bg-red-400/[0.06]' : 'hover:bg-red-400/[0.02]'
                }`}
                onClick={() => onSelect(isSelected ? null : r.target)}
              >
                <td className="px-1.5 py-1 whitespace-nowrap text-left">
                  <span className="text-white font-bold">{r.target}</span>
                </td>
                <td className="px-1.5 py-1 whitespace-nowrap text-left">
                  <span className={`text-[7px] font-black px-1 py-0.5 uppercase ${tb.text} ${tb.bg}`}>
                    {r.type}
                  </span>
                </td>
                <td className="px-1.5 py-1 whitespace-nowrap text-left text-neutral-400">
                  {r.imposedBy}
                </td>
                <td className="px-1.5 py-1 text-left text-neutral-500 max-w-[140px] truncate">
                  {r.sectors.join(', ')}
                </td>
                <td className="px-1.5 py-1 whitespace-nowrap text-right text-neutral-300 font-bold tabular-nums">
                  {r.entities.toLocaleString()}
                </td>
                <td className="px-1.5 py-1 whitespace-nowrap text-left">
                  <SeverityBar level={r.severity} />
                </td>
                <td className="px-1.5 py-1 whitespace-nowrap text-left">
                  <span className={`text-[7px] font-black px-1 py-0.5 uppercase ${rb.text} ${rb.bg}`}>
                    {r.risk}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Selected Regime Detail ──

function RegimeDetail({ regime }: { regime: SanctionsRegime }) {
  return (
    <div className="px-3 py-2 border-b border-red-400/30 bg-[#050505]">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[8px] font-black font-mono uppercase tracking-wider text-red-400">
          {regime.target} — DETAIL
        </span>
        <span className={`text-[6px] font-black px-1 py-0.5 uppercase ${typeBadge(regime.type).text} ${typeBadge(regime.type).bg}`}>
          {regime.type}
        </span>
      </div>

      {/* Key Measures */}
      {regime.measures && regime.measures.length > 0 && (
        <div className="mb-2">
          <div className="text-[7px] font-bold font-mono uppercase tracking-wider text-neutral-500 mb-1">
            KEY MEASURES
          </div>
          {regime.measures.map((m, i) => (
            <div key={i} className="flex items-start gap-2 py-0.5">
              <span className="text-[7px] font-mono font-bold text-red-400 shrink-0 w-1">-</span>
              <div>
                <span className="text-[8px] font-mono font-bold text-white/70">{m.name}</span>
                <span className="text-[7px] font-mono text-neutral-500 ml-1">{m.description}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Trade Impact */}
      {regime.tradeImpact && (
        <div className="mb-2">
          <div className="text-[7px] font-bold font-mono uppercase tracking-wider text-neutral-500 mb-1">
            TRADE IMPACT
          </div>
          <div className="grid grid-cols-4 gap-2">
            <div>
              <div className="text-[6px] font-mono text-neutral-600 uppercase">PRE-SANCTION</div>
              <div className="text-[9px] font-mono font-bold text-neutral-300">{regime.tradeImpact.preSanctionVolume}</div>
            </div>
            <div>
              <div className="text-[6px] font-mono text-neutral-600 uppercase">POST-SANCTION</div>
              <div className="text-[9px] font-mono font-bold text-neutral-300">{regime.tradeImpact.postSanctionVolume}</div>
            </div>
            <div>
              <div className="text-[6px] font-mono text-neutral-600 uppercase">REDUCTION</div>
              <div className="text-[9px] font-mono font-bold text-red-400">-{regime.tradeImpact.reductionPct.toFixed(1)}%</div>
            </div>
            <div>
              <div className="text-[6px] font-mono text-neutral-600 uppercase">EST. COST</div>
              <div className="text-[9px] font-mono font-bold text-orange-400">{regime.tradeImpact.estimatedCost}</div>
            </div>
          </div>
        </div>
      )}

      {/* Exemptions */}
      {regime.exemptions && regime.exemptions.length > 0 && (
        <div className="mb-2">
          <div className="text-[7px] font-bold font-mono uppercase tracking-wider text-neutral-500 mb-1">
            EXEMPTIONS
          </div>
          <div className="flex flex-wrap gap-1">
            {regime.exemptions.map((e, i) => (
              <span key={i} className="text-[7px] font-mono text-green-400/70 bg-green-400/[0.06] px-1 py-0.5">
                {e}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Compliance Requirements */}
      {regime.complianceRequirements && regime.complianceRequirements.length > 0 && (
        <div>
          <div className="text-[7px] font-bold font-mono uppercase tracking-wider text-neutral-500 mb-1">
            COMPLIANCE REQUIREMENTS
          </div>
          {regime.complianceRequirements.map((c, i) => (
            <div key={i} className="flex items-start gap-2 py-0.5">
              <span className="text-[7px] font-mono font-bold text-yellow-400 shrink-0">!</span>
              <span className="text-[7px] font-mono text-neutral-400">{c}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Recent Actions Feed ──

function RecentActionsFeed({ actions }: { actions: RecentAction[] }) {
  return (
    <div className="max-h-[200px] overflow-auto no-scrollbar">
      {actions.map((a, i) => (
        <div
          key={i}
          className="flex items-start gap-2 px-3 py-1.5 border-b border-border/10 hover:bg-red-400/[0.02] transition-colors"
        >
          <span className="text-[7px] font-mono text-neutral-600 shrink-0 tabular-nums w-16">
            {a.date}
          </span>
          <span className={`text-[6px] font-black font-mono uppercase px-1 py-0.5 shrink-0 ${actionColor(a.actionType)} ${actionBg(a.actionType)}`}>
            {a.actionType}
          </span>
          <div className="flex-1 min-w-0">
            <span className="text-[8px] font-mono font-bold text-white/70">{a.target}</span>
            <span className="text-[7px] font-mono text-neutral-600 ml-1">({a.authority})</span>
            <div className="text-[7px] font-mono text-neutral-500 truncate">{a.description}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Compliance Alerts ──

function ComplianceAlerts({ alerts }: { alerts: ComplianceAlert[] }) {
  return (
    <div>
      {alerts.map((a, i) => {
        const badge = alertSeverityBadge(a.severity);
        return (
          <div
            key={i}
            className="flex items-start gap-2 px-3 py-1.5 border-b border-border/10 hover:bg-red-400/[0.02] transition-colors"
          >
            <span className={`text-[6px] font-black font-mono uppercase px-1 py-0.5 shrink-0 ${badge.text} ${badge.bg}`}>
              {a.severity}
            </span>
            <div className="flex-1 min-w-0">
              <span className="text-[8px] font-mono font-bold text-white/70">{a.entity}</span>
              <div className="text-[7px] font-mono text-neutral-500">{a.issue}</div>
              <div className="text-[7px] font-mono text-yellow-400/60 mt-0.5">{a.recommendation}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Table header cell ──

function ThCell({ label, align }: { label: string; align: 'left' | 'right' }) {
  return (
    <th
      className={`px-1.5 py-1 text-[7px] font-mono font-bold uppercase tracking-wider text-neutral-500 whitespace-nowrap ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      {label}
    </th>
  );
}

// ── Main Panel ──

export function SanctionsMonitorPanel() {
  const { data: rawData, isLoading } = useSanctionsMonitor();
  const [selectedRegime, setSelectedRegime] = useState<string | null>(null);

  const data = rawData as SanctionsMonitorData | undefined;

  const selectedRegimeData = selectedRegime
    ? data?.regimes?.find((r) => r.target === selectedRegime)
    : null;

  return (
    <div className="h-full flex flex-col bg-black overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#050505] border-b border-red-400/30 shrink-0">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-red-400" />
          <span className="text-[9px] font-black font-mono uppercase tracking-wider text-red-400">
            SANCTIONS MONITOR
          </span>
        </div>
        <div className="flex items-center gap-3">
          {data?.summary && (
            <>
              <div className="flex items-center gap-1">
                <span className="text-[7px] font-mono text-neutral-600 uppercase">REGIMES</span>
                <span className="text-[9px] font-mono font-bold text-red-400 tabular-nums">
                  {data.summary.totalRegimes}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[7px] font-mono text-neutral-600 uppercase">ENTITIES</span>
                <span className="text-[9px] font-mono font-bold text-neutral-300 tabular-nums">
                  {data.summary.designatedEntities.toLocaleString()}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Loading */}
      {isLoading && !rawData && (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-[9px] font-mono text-red-400 uppercase tracking-wider animate-pulse">
            LOADING...
          </span>
        </div>
      )}

      {/* No data */}
      {!data && !isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-[9px] font-mono text-neutral-600 uppercase">
            NO DATA AVAILABLE
          </span>
        </div>
      )}

      {/* Content */}
      {data && (
        <div className="flex-1 overflow-auto no-scrollbar text-[9px] font-mono">
          {/* Summary Bar */}
          {data.summary && <SummaryBar summary={data.summary} />}

          {/* Sanctions Regimes Table */}
          {data.regimes && data.regimes.length > 0 && (
            <>
              <SectionHeader title="SANCTIONS REGIMES" />
              <RegimesTable
                regimes={data.regimes}
                selectedTarget={selectedRegime}
                onSelect={setSelectedRegime}
              />
            </>
          )}

          {/* Selected Regime Detail */}
          {selectedRegimeData && <RegimeDetail regime={selectedRegimeData} />}

          {/* Recent Actions Feed */}
          {data.recentActions && data.recentActions.length > 0 && (
            <>
              <SectionHeader title="RECENT ACTIONS" />
              <RecentActionsFeed actions={data.recentActions} />
            </>
          )}

          {/* Compliance Alerts */}
          {data.complianceAlerts && data.complianceAlerts.length > 0 && (
            <>
              <SectionHeader title="COMPLIANCE ALERTS" />
              <ComplianceAlerts alerts={data.complianceAlerts} />
            </>
          )}

          {/* Bottom padding */}
          <div className="h-2" />
        </div>
      )}
    </div>
  );
}
