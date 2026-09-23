import { useCommoditySpreads } from '../../api/hooks/use-commodity-spreads';
import { useT, tr, TFn } from '../../i18n';

// ── Formatting helpers ──

function fmtNum(n: number, decimals = 2): string {
  return n.toFixed(decimals);
}

function fmtSign(n: number, decimals = 2): string {
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(decimals)}`;
}

function fmtPct(n: number): string {
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

// ── Color helpers ──

function changeColor(n: number): string {
  if (n > 0) return 'text-green-400';
  if (n < 0) return 'text-red-400';
  return 'text-neutral-500';
}

function structureLabel(s: string): { label: string; color: string } {
  if (s === 'contango') return { label: 'CONTANGO', color: 'text-red-400' };
  if (s === 'backwardation') return { label: 'BACKWDN', color: 'text-green-400' };
  return { label: 'FLAT', color: 'text-neutral-500' };
}

function percentileColor(p: number): string {
  if (p >= 80) return 'text-red-400';
  if (p >= 60) return 'text-amber-400';
  if (p <= 20) return 'text-green-400';
  if (p <= 40) return 'text-blue-400';
  return 'text-neutral-400';
}

function zScoreColor(z: number): string {
  if (z >= 2) return 'text-red-400';
  if (z >= 1) return 'text-amber-400';
  if (z <= -2) return 'text-green-400';
  if (z <= -1) return 'text-blue-400';
  return 'text-neutral-400';
}

// ── Mock data types / shapes ──

interface CalendarSpread {
  commodity: string;
  front: number;
  secondMonth: number;
  spread: number;
  structure: string;
}

interface CrackSpread {
  type: string;
  value: number;
  change: number;
  avg1m: number;
  percentile: number;
}

interface CrushSpread {
  type: string;
  value: number;
  change: number;
  avg1m: number;
  percentile: number;
}

interface InterCommoditySpread {
  name: string;
  value: number;
  historicalAvg: number;
  zScore: number;
}

// ── Main Panel ──

export function CommoditySpreadsPanel() {
  const t = useT();
  const { data, isLoading } = useCommoditySpreads();

  const calendarSpreads: CalendarSpread[] = data?.calendarSpreads ?? [];
  const crackSpreads: CrackSpread[] = data?.crackSpreads ?? [];
  const crushSpreads: CrushSpread[] = data?.crushSpreads ?? [];
  const interCommoditySpreads: InterCommoditySpread[] = data?.interCommoditySpreads ?? [];

  if (isLoading && !data) {
    return (
      <div className="h-full flex flex-col bg-black">
        <Header t={t} />
        <div className="flex-1 flex items-center justify-center">
          <span className="text-[9px] font-mono text-amber-400 uppercase tracking-wider animate-pulse">
            Loading...
          </span>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="h-full flex flex-col bg-black">
        <Header t={t} />
        <div className="flex items-center justify-center h-full text-neutral/40 text-[10px] font-mono uppercase tracking-widest">No data available</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-black overflow-hidden">
      <Header t={t} />

      <div className="flex-1 overflow-auto no-scrollbar">
        {/* Calendar Spreads */}
        <CalendarSpreadsSection spreads={calendarSpreads} t={t} />

        {/* Crack Spreads */}
        <ProcessingSpreadsSection
          title={tr(t, 'csCrackSpreads', 'CRACK SPREADS')}
          spreads={crackSpreads}
        />

        {/* Crush Spreads */}
        <ProcessingSpreadsSection
          title={tr(t, 'csCrushSpreads', 'CRUSH SPREADS')}
          spreads={crushSpreads}
        />

        {/* Inter-Commodity Spreads */}
        <InterCommoditySpreadsSection spreads={interCommoditySpreads} t={t} />
      </div>
    </div>
  );
}

// ── Header ──

function Header({ t }: { t: ReturnType<typeof useT> }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-[#050505] border-b border-border/20 shrink-0">
      <div className="w-0.5 h-3 bg-amber-400" />
      <span className="text-[9px] font-mono font-black uppercase tracking-wider text-amber-400">
        {tr(t, 'csCommoditySpreads', 'COMMODITY SPREADS')}
      </span>
    </div>
  );
}

// ── Calendar Spreads Section ──

function CalendarSpreadsSection({
  spreads,
  t,
}: {
  spreads: CalendarSpread[];
  t: ReturnType<typeof useT>;
}) {
  return (
    <div className="border-b border-border/20">
      <div className="px-3 py-1 border-b border-border/20 bg-[#030303]">
        <span className="text-[9px] font-mono font-black uppercase tracking-wider text-neutral-500">
          {tr(t, 'csCalendarSpreads', 'CALENDAR SPREADS')}
        </span>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_64px_64px_56px_72px] gap-0 px-3 py-0.5 border-b border-border/20 bg-[#020202]">
        <span className="text-[9px] font-mono uppercase tracking-wider text-neutral-600">
          COMMODITY
        </span>
        <span className="text-[9px] font-mono uppercase tracking-wider text-neutral-600 text-right">
          FRONT
        </span>
        <span className="text-[9px] font-mono uppercase tracking-wider text-neutral-600 text-right">
          2ND MTH
        </span>
        <span className="text-[9px] font-mono uppercase tracking-wider text-neutral-600 text-right">
          SPREAD
        </span>
        <span className="text-[9px] font-mono uppercase tracking-wider text-neutral-600 text-right">
          STRUCTURE
        </span>
      </div>

      {spreads.map((s) => {
        const struc = structureLabel(s.structure);
        return (
          <div
            key={s.commodity}
            className="grid grid-cols-[1fr_64px_64px_56px_72px] gap-0 px-3 py-[3px] border-b border-border/20 hover:bg-amber-400/[0.02] transition-colors items-center"
          >
            <span className="text-[9px] font-mono font-bold text-white truncate">
              {s.commodity}
            </span>
            <span className="text-[9px] font-mono text-white text-right">
              {fmtNum(s.front)}
            </span>
            <span className="text-[9px] font-mono text-white text-right">
              {fmtNum(s.secondMonth)}
            </span>
            <span className={`text-[9px] font-mono font-bold text-right ${changeColor(s.spread)}`}>
              {fmtSign(s.spread)}
            </span>
            <span className={`text-[9px] font-mono font-bold text-right ${struc.color}`}>
              {struc.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Crack / Crush Spreads Section (shared layout) ──

function ProcessingSpreadsSection({
  title,
  spreads,
}: {
  title: string;
  spreads: (CrackSpread | CrushSpread)[];
}) {
  return (
    <div className="border-b border-border/20">
      <div className="px-3 py-1 border-b border-border/20 bg-[#030303]">
        <span className="text-[9px] font-mono font-black uppercase tracking-wider text-neutral-500">
          {title}
        </span>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_56px_56px_56px_48px] gap-0 px-3 py-0.5 border-b border-border/20 bg-[#020202]">
        <span className="text-[9px] font-mono uppercase tracking-wider text-neutral-600">
          TYPE
        </span>
        <span className="text-[9px] font-mono uppercase tracking-wider text-neutral-600 text-right">
          VALUE
        </span>
        <span className="text-[9px] font-mono uppercase tracking-wider text-neutral-600 text-right">
          CHG
        </span>
        <span className="text-[9px] font-mono uppercase tracking-wider text-neutral-600 text-right">
          1M AVG
        </span>
        <span className="text-[9px] font-mono uppercase tracking-wider text-neutral-600 text-right">
          PCTL
        </span>
      </div>

      {spreads.map((s) => (
        <div
          key={s.type}
          className="grid grid-cols-[1fr_56px_56px_56px_48px] gap-0 px-3 py-[3px] border-b border-border/20 hover:bg-amber-400/[0.02] transition-colors items-center"
        >
          <span className="text-[9px] font-mono font-bold text-white truncate">
            {s.type}
          </span>
          <span className="text-[9px] font-mono text-white text-right">
            {fmtNum(s.value)}
          </span>
          <span className={`text-[9px] font-mono font-bold text-right ${changeColor(s.change)}`}>
            {fmtSign(s.change)}
          </span>
          <span className="text-[9px] font-mono text-neutral-500 text-right">
            {fmtNum(s.avg1m)}
          </span>
          <span className={`text-[9px] font-mono font-bold text-right ${percentileColor(s.percentile)}`}>
            {s.percentile}%
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Inter-Commodity Spreads Section ──

function InterCommoditySpreadsSection({
  spreads,
  t,
}: {
  spreads: InterCommoditySpread[];
  t: ReturnType<typeof useT>;
}) {
  return (
    <div className="border-b border-border/20">
      <div className="px-3 py-1 border-b border-border/20 bg-[#030303]">
        <span className="text-[9px] font-mono font-black uppercase tracking-wider text-neutral-500">
          {tr(t, 'csInterCommodity', 'INTER-COMMODITY')}
        </span>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_64px_64px_48px] gap-0 px-3 py-0.5 border-b border-border/20 bg-[#020202]">
        <span className="text-[9px] font-mono uppercase tracking-wider text-neutral-600">
          RATIO / SPREAD
        </span>
        <span className="text-[9px] font-mono uppercase tracking-wider text-neutral-600 text-right">
          VALUE
        </span>
        <span className="text-[9px] font-mono uppercase tracking-wider text-neutral-600 text-right">
          HIST AVG
        </span>
        <span className="text-[9px] font-mono uppercase tracking-wider text-neutral-600 text-right">
          Z-SCORE
        </span>
      </div>

      {spreads.map((s) => (
        <div
          key={s.name}
          className="grid grid-cols-[1fr_64px_64px_48px] gap-0 px-3 py-[3px] border-b border-border/20 hover:bg-amber-400/[0.02] transition-colors items-center"
        >
          <span className="text-[9px] font-mono font-bold text-white truncate">
            {s.name}
          </span>
          <span className="text-[9px] font-mono text-white text-right">
            {fmtNum(s.value, Math.abs(s.value) < 1 ? 5 : 2)}
          </span>
          <span className="text-[9px] font-mono text-neutral-500 text-right">
            {fmtNum(s.historicalAvg, Math.abs(s.historicalAvg) < 1 ? 5 : 2)}
          </span>
          <span className={`text-[9px] font-mono font-bold text-right ${zScoreColor(s.zScore)}`}>
            {fmtSign(s.zScore)}
          </span>
        </div>
      ))}
    </div>
  );
}
