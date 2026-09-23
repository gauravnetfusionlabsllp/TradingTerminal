import { usePharmaPipeline } from '../../api/hooks/use-pharma-pipeline';
import { useT, tr, TFn } from '../../i18n';
import { RefreshCw, FlaskConical } from 'lucide-react';

// i18n helper with fallback
// ── Formatting helpers ──

function fmtVol(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e12) return '$' + (n / 1e12).toFixed(1) + 'T';
  if (abs >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B';
  if (abs >= 1e6) return '$' + (n / 1e6).toFixed(0) + 'M';
  return '$' + n.toFixed(0);
}

function fmtPct(n: number): string {
  return n.toFixed(1) + '%';
}

// ── Badge helpers ──

function phaseBadge(phase: string): { label: string; cls: string } {
  switch (phase) {
    case 'P1':
      return { label: 'P1', cls: 'text-neutral-400 bg-neutral-500/10 border border-neutral-500/30' };
    case 'P2':
      return { label: 'P2', cls: 'text-blue-400 bg-blue-500/10 border border-blue-500/30' };
    case 'P3':
      return { label: 'P3', cls: 'text-yellow-400 bg-yellow-500/10 border border-yellow-500/30' };
    case 'FILED':
      return { label: 'FILED', cls: 'text-orange-400 bg-orange-500/10 border border-orange-500/30' };
    case 'APPROVED':
      return { label: 'APPR', cls: 'text-green-400 bg-green-500/10 border border-green-500/30' };
    default:
      return { label: phase, cls: 'text-neutral-400 bg-neutral-500/10 border border-neutral-500/30' };
  }
}

function modalityBadge(modality: string): { label: string; cls: string } {
  switch (modality) {
    case 'mAb':
      return { label: 'mAb', cls: 'text-cyan-400 bg-cyan-500/10 border border-cyan-500/30' };
    case 'SM':
      return { label: 'SM', cls: 'text-violet-400 bg-violet-500/10 border border-violet-500/30' };
    case 'ADC':
      return { label: 'ADC', cls: 'text-pink-400 bg-pink-500/10 border border-pink-500/30' };
    case 'Gene Tx':
      return { label: 'GENE', cls: 'text-amber-400 bg-amber-500/10 border border-amber-500/30' };
    default:
      return { label: modality, cls: 'text-neutral-400 bg-neutral-500/10 border border-neutral-500/30' };
  }
}

function dateTypeBadge(type: string): { label: string; cls: string } {
  switch (type) {
    case 'PDUFA':
      return { label: 'PDUFA', cls: 'text-red-400 bg-red-500/10 border border-red-500/30' };
    case 'AdComm':
      return { label: 'ADCOM', cls: 'text-orange-400 bg-orange-500/10 border border-orange-500/30' };
    case 'P3 Readout':
      return { label: 'P3 READ', cls: 'text-yellow-400 bg-yellow-500/10 border border-yellow-500/30' };
    case 'P2 Readout':
      return { label: 'P2 READ', cls: 'text-blue-400 bg-blue-500/10 border border-blue-500/30' };
    default:
      return { label: type.toUpperCase(), cls: 'text-neutral-400 bg-neutral-500/10 border border-neutral-500/30' };
  }
}

function consensusBadge(consensus: string): { label: string; cls: string } {
  switch (consensus) {
    case 'Positive':
      return { label: 'POSITIVE', cls: 'text-green-400 bg-green-500/10 border border-green-500/30' };
    case 'Cautious':
      return { label: 'CAUTIOUS', cls: 'text-yellow-400 bg-yellow-500/10 border border-yellow-500/30' };
    case 'Mixed':
      return { label: 'MIXED', cls: 'text-orange-400 bg-orange-500/10 border border-orange-500/30' };
    case 'Negative':
      return { label: 'NEGATIVE', cls: 'text-red-400 bg-red-500/10 border border-red-500/30' };
    default:
      return { label: consensus.toUpperCase(), cls: 'text-neutral-400 bg-neutral-500/10 border border-neutral-500/30' };
  }
}

function biosimilarBadge(status: string): { label: string; cls: string } {
  switch (status) {
    case 'Approved':
      return { label: 'APPROVED', cls: 'text-green-400 bg-green-500/10 border border-green-500/30' };
    case 'Filed':
      return { label: 'FILED', cls: 'text-orange-400 bg-orange-500/10 border border-orange-500/30' };
    case 'Phase 3':
      return { label: 'PHASE 3', cls: 'text-yellow-400 bg-yellow-500/10 border border-yellow-500/30' };
    case 'Phase 1':
      return { label: 'PHASE 1', cls: 'text-blue-400 bg-blue-500/10 border border-blue-500/30' };
    case 'In Development':
      return { label: 'IN DEV', cls: 'text-neutral-400 bg-neutral-500/10 border border-neutral-500/30' };
    default:
      return { label: status.toUpperCase(), cls: 'text-neutral-400 bg-neutral-500/10 border border-neutral-500/30' };
  }
}

// ── Section Header ──

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="px-3 py-1 border-b border-emerald-400/30 flex items-center gap-2">
      <div className="w-1 h-1 bg-emerald-400" />
      <span className="text-[7px] font-black font-mono uppercase tracking-widest text-emerald-400">
        {label}
      </span>
    </div>
  );
}

// ── Overview Section ──

function OverviewSection({ overview, t }: { overview: any; t: ReturnType<typeof useT> }) {
  const metrics = [
    { label: tr(t, 'ppTotalTrials', 'Total Trials'), value: overview.totalTrials.toLocaleString() },
    { label: tr(t, 'ppPhase1', 'Phase 1'), value: overview.phase1.toLocaleString() },
    { label: tr(t, 'ppPhase2', 'Phase 2'), value: overview.phase2.toLocaleString() },
    { label: tr(t, 'ppPhase3', 'Phase 3'), value: overview.phase3.toLocaleString() },
    { label: tr(t, 'ppApprovals', 'Approvals YTD'), value: String(overview.approvalsYTD) },
    { label: tr(t, 'ppAvgTime', 'Avg Time to Approval'), value: overview.avgTimeToApproval.toFixed(1) + ' yrs' },
    { label: tr(t, 'ppAvgRD', 'Avg R&D Cost'), value: fmtVol(overview.avgRDCost) },
  ];

  return (
    <div className="border-b border-emerald-400/30">
      <SectionHeader label={tr(t, 'ppOverview', 'Pipeline Overview')} />
      <div className="grid grid-cols-7 gap-px bg-border/10">
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

// ── Major Pipeline Section ──

function PipelineSection({ pipeline, t }: { pipeline: any[]; t: ReturnType<typeof useT> }) {
  return (
    <div className="border-b border-emerald-400/30">
      <SectionHeader label={tr(t, 'ppPipeline', 'Major Pipeline')} />
      <div className="grid grid-cols-[1.2fr_1fr_1.2fr_0.5fr_0.5fr_0.7fr_0.5fr_0.4fr] px-3 py-0.5 border-b border-border/20 text-[7px] font-black font-mono text-neutral-600 uppercase tracking-wider">
        <span>{tr(t, 'ppDrug', 'Drug')}</span>
        <span>{tr(t, 'ppCompany', 'Company')}</span>
        <span>{tr(t, 'ppIndication', 'Indication')}</span>
        <span className="text-center">{tr(t, 'ppPhase', 'Phase')}</span>
        <span className="text-center">{tr(t, 'ppModality', 'Mod.')}</span>
        <span className="text-right">{tr(t, 'ppPeakSales', 'Peak Sales')}</span>
        <span className="text-right">{tr(t, 'ppPOS', 'POS %')}</span>
        <span className="text-right">{tr(t, 'ppComp', 'Comp')}</span>
      </div>
      {pipeline.map((p: any) => {
        const phase = phaseBadge(p.phase);
        const mod = modalityBadge(p.modality);
        return (
          <div
            key={p.drug}
            className="grid grid-cols-[1.2fr_1fr_1.2fr_0.5fr_0.5fr_0.7fr_0.5fr_0.4fr] px-3 py-1 border-b border-border/20 hover:bg-emerald-400/[0.02] transition-colors items-center"
          >
            <span className="text-[8px] font-mono font-bold text-white truncate">{p.drug}</span>
            <span className="text-[7px] font-mono text-neutral-400 truncate">{p.company}</span>
            <span className="text-[7px] font-mono text-neutral-300 truncate">{p.indication}</span>
            <div className="flex justify-center">
              <span className={`text-[6px] font-black font-mono uppercase px-1 py-0 ${phase.cls}`}>
                {phase.label}
              </span>
            </div>
            <div className="flex justify-center">
              <span className={`text-[6px] font-black font-mono uppercase px-1 py-0 ${mod.cls}`}>
                {mod.label}
              </span>
            </div>
            <span className="text-[8px] font-mono font-bold text-white text-right tabular-nums">
              {fmtVol(p.peakSales)}
            </span>
            <span className={`text-[8px] font-mono font-bold text-right tabular-nums ${p.pos >= 70 ? 'text-green-400' : p.pos >= 50 ? 'text-yellow-400' : 'text-orange-400'}`}>
              {p.pos}%
            </span>
            <span className="text-[8px] font-mono text-neutral-400 text-right tabular-nums">
              {p.competitors}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── PDUFA / Catalyst Calendar Section ──

function CatalystSection({ catalysts, t }: { catalysts: any[]; t: ReturnType<typeof useT> }) {
  return (
    <div className="border-b border-emerald-400/30">
      <SectionHeader label={tr(t, 'ppCatalysts', 'PDUFA / Catalyst Calendar')} />
      <div className="grid grid-cols-[1.1fr_1fr_1.1fr_0.6fr_0.7fr_0.6fr] px-3 py-0.5 border-b border-border/20 text-[7px] font-black font-mono text-neutral-600 uppercase tracking-wider">
        <span>{tr(t, 'ppDrug', 'Drug')}</span>
        <span>{tr(t, 'ppCompany', 'Company')}</span>
        <span>{tr(t, 'ppIndication', 'Indication')}</span>
        <span className="text-center">{tr(t, 'ppType', 'Type')}</span>
        <span className="text-right">{tr(t, 'ppDate', 'Date')}</span>
        <span className="text-center">{tr(t, 'ppConsensus', 'Consensus')}</span>
      </div>
      {catalysts.map((c: any, idx: any) => {
        const dtBadge = dateTypeBadge(c.dateType);
        const consBadge = consensusBadge(c.consensus);
        return (
          <div
            key={idx}
            className="grid grid-cols-[1.1fr_1fr_1.1fr_0.6fr_0.7fr_0.6fr] px-3 py-1 border-b border-border/20 hover:bg-emerald-400/[0.02] transition-colors items-center"
          >
            <span className="text-[8px] font-mono font-bold text-white truncate">{c.drug}</span>
            <span className="text-[7px] font-mono text-neutral-400 truncate">{c.company}</span>
            <span className="text-[7px] font-mono text-neutral-300 truncate">{c.indication}</span>
            <div className="flex justify-center">
              <span className={`text-[6px] font-black font-mono uppercase px-1 py-0 ${dtBadge.cls}`}>
                {dtBadge.label}
              </span>
            </div>
            <span className="text-[8px] font-mono text-emerald-400/80 text-right tabular-nums">
              {c.date}
            </span>
            <div className="flex justify-center">
              <span className={`text-[6px] font-black font-mono uppercase px-1 py-0 ${consBadge.cls}`}>
                {consBadge.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Patent Cliffs Section ──

function PatentCliffsSection({ patents, t }: { patents: any[]; t: ReturnType<typeof useT> }) {
  return (
    <div className="border-b border-emerald-400/30">
      <SectionHeader label={tr(t, 'ppPatents', 'Patent Cliffs')} />
      <div className="grid grid-cols-[1fr_1fr_0.7fr_0.6fr_0.5fr_0.7fr_0.6fr] px-3 py-0.5 border-b border-border/20 text-[7px] font-black font-mono text-neutral-600 uppercase tracking-wider">
        <span>{tr(t, 'ppDrug', 'Drug')}</span>
        <span>{tr(t, 'ppCompany', 'Company')}</span>
        <span className="text-right">{tr(t, 'ppSales', 'Sales')}</span>
        <span className="text-right">{tr(t, 'ppExpiry', 'Expiry')}</span>
        <span className="text-right">{tr(t, 'ppGenerics', 'Gen.')}</span>
        <span className="text-right">{tr(t, 'ppRevAtRisk', 'Rev at Risk')}</span>
        <span className="text-center">{tr(t, 'ppBiosimilar', 'Biosimilar')}</span>
      </div>
      {patents.map((p: any) => {
        const biosBadge = biosimilarBadge(p.biosimilarStatus);
        return (
          <div
            key={p.drug}
            className="grid grid-cols-[1fr_1fr_0.7fr_0.6fr_0.5fr_0.7fr_0.6fr] px-3 py-1 border-b border-border/20 hover:bg-emerald-400/[0.02] transition-colors items-center"
          >
            <span className="text-[8px] font-mono font-bold text-white truncate">{p.drug}</span>
            <span className="text-[7px] font-mono text-neutral-400 truncate">{p.company}</span>
            <span className="text-[8px] font-mono font-bold text-white text-right tabular-nums">
              {fmtVol(p.currentSales)}
            </span>
            <span className="text-[8px] font-mono text-red-400/80 text-right tabular-nums">
              {p.patentExpiry}
            </span>
            <span className="text-[8px] font-mono text-neutral-400 text-right tabular-nums">
              {p.genericCompetitors}
            </span>
            <span className="text-[8px] font-mono font-bold text-red-400 text-right tabular-nums">
              {fmtVol(p.revenueAtRisk)}
            </span>
            <div className="flex justify-center">
              <span className={`text-[6px] font-black font-mono uppercase px-1 py-0 ${biosBadge.cls}`}>
                {biosBadge.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Therapeutic Area Breakdown Section ──

function TherapeuticAreaSection({ areas, t }: { areas: any[]; t: ReturnType<typeof useT> }) {
  const maxTrials = Math.max(...areas.map((a: any) => a.activeTrials));

  return (
    <div className="border-b border-emerald-400/30">
      <SectionHeader label={tr(t, 'ppTherapeutic', 'Therapeutic Area Breakdown')} />
      <div className="grid grid-cols-[1.2fr_1.5fr_0.6fr_0.7fr_0.8fr] px-3 py-0.5 border-b border-border/20 text-[7px] font-black font-mono text-neutral-600 uppercase tracking-wider">
        <span>{tr(t, 'ppArea', 'Area')}</span>
        <span>{tr(t, 'ppActiveTrials', 'Active Trials')}</span>
        <span className="text-right">{tr(t, 'ppP3', 'P3')}</span>
        <span className="text-right">{tr(t, 'ppRecent', 'Approvals')}</span>
        <span className="text-right">{tr(t, 'ppMarketSize', 'Mkt Size')}</span>
      </div>
      {areas.map((a: any) => (
        <div
          key={a.area}
          className="grid grid-cols-[1.2fr_1.5fr_0.6fr_0.7fr_0.8fr] px-3 py-1 border-b border-border/20 hover:bg-emerald-400/[0.02] transition-colors items-center"
        >
          <span className="text-[8px] font-mono font-bold text-white truncate">{a.area}</span>
          <div className="flex items-center gap-1.5">
            <div className="flex-1 h-2 bg-white/[0.03] overflow-hidden">
              <div
                className="h-full bg-emerald-500"
                style={{ width: `${(a.activeTrials / maxTrials) * 100}%`, opacity: 0.7 }}
              />
            </div>
            <span className="text-[7px] font-mono font-bold text-emerald-400 tabular-nums w-8 text-right">
              {a.activeTrials.toLocaleString()}
            </span>
          </div>
          <span className="text-[8px] font-mono font-bold text-yellow-400 text-right tabular-nums">
            {a.p3Programs}
          </span>
          <span className="text-[8px] font-mono text-neutral-300 text-right tabular-nums">
            {a.recentApprovals}
          </span>
          <span className="text-[8px] font-mono font-bold text-white text-right tabular-nums">
            {fmtVol(a.marketSize)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── R&D Spending Section ──

function RDSpendingSection({ rdData, t }: { rdData: any[]; t: ReturnType<typeof useT> }) {
  return (
    <div className="border-b border-emerald-400/30">
      <SectionHeader label={tr(t, 'ppRD', 'R&D Spending')} />
      <div className="grid grid-cols-[1.2fr_0.7fr_0.6fr_0.6fr_0.5fr_0.5fr] px-3 py-0.5 border-b border-border/20 text-[7px] font-black font-mono text-neutral-600 uppercase tracking-wider">
        <span>{tr(t, 'ppCompany', 'Company')}</span>
        <span className="text-right">{tr(t, 'ppRDSpend', 'R&D Spend')}</span>
        <span className="text-right">{tr(t, 'ppRDRatio', 'R&D/Rev')}</span>
        <span className="text-right">{tr(t, 'ppAssets', 'Assets')}</span>
        <span className="text-right">{tr(t, 'ppP3Assets', 'P3')}</span>
        <span className="text-right">{tr(t, 'ppApprov', 'Appr.')}</span>
      </div>
      {rdData.map((r: any) => (
        <div
          key={r.company}
          className="grid grid-cols-[1.2fr_0.7fr_0.6fr_0.6fr_0.5fr_0.5fr] px-3 py-1 border-b border-border/20 hover:bg-emerald-400/[0.02] transition-colors items-center"
        >
          <span className="text-[8px] font-mono font-bold text-white truncate">{r.company}</span>
          <span className="text-[8px] font-mono font-bold text-white text-right tabular-nums">
            {fmtVol(r.rdSpend)}
          </span>
          <span className={`text-[8px] font-mono font-bold text-right tabular-nums ${r.rdRevenueRatio >= 23 ? 'text-emerald-400' : 'text-neutral-300'}`}>
            {fmtPct(r.rdRevenueRatio)}
          </span>
          <span className="text-[8px] font-mono text-neutral-300 text-right tabular-nums">
            {r.pipelineAssets}
          </span>
          <span className="text-[8px] font-mono font-bold text-yellow-400 text-right tabular-nums">
            {r.p3Assets}
          </span>
          <span className="text-[8px] font-mono text-green-400 text-right tabular-nums">
            {r.recentApprovals}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Main Panel ──

export function PharmaPipelinePanel() {
  const t = useT();
  const { data, isLoading, refetch } = usePharmaPipeline();

  const d = data;

  return (
    <div className="h-full flex flex-col bg-black overflow-hidden text-[9px] font-mono">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#050505] border-b border-emerald-400/30 shrink-0">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-[9px] font-black font-mono uppercase tracking-tighter text-emerald-400">
            {tr(t, 'ppTitle', 'Pharma Pipeline')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[7px] font-mono text-neutral-500 tabular-nums">
            {d?.overview?.totalTrials?.toLocaleString() ?? '--'} trials
          </span>
          <span className="text-[7px] font-mono font-bold text-emerald-400 tabular-nums">
            {d?.overview?.approvalsYTD ?? '--'} FDA YTD
          </span>
          <button
            onClick={() => refetch()}
            className="p-0.5 text-neutral-500 hover:text-emerald-400 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {isLoading && !data ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-2">
              <div className="w-5 h-5 border-2 border-emerald-400/30 border-t-emerald-400 animate-spin" />
              <span className="text-[10px] text-white/40 uppercase tracking-widest">
                {tr(t, 'loading', 'Loading...')}
              </span>
            </div>
          </div>
        ) : !d ? (
          <div className="flex items-center justify-center h-full text-neutral/40 text-[10px] font-mono uppercase tracking-widest">No data available</div>
        ) : (
          <>
            <OverviewSection overview={d.overview} t={t} />
            <PipelineSection pipeline={d.pipeline} t={t} />
            <CatalystSection catalysts={d.catalysts} t={t} />
            <PatentCliffsSection patents={d.patentCliffs} t={t} />
            <TherapeuticAreaSection areas={d.therapeuticAreas} t={t} />
            <RDSpendingSection rdData={d.rdSpending} t={t} />
          </>
        )}
      </div>
    </div>
  );
}
