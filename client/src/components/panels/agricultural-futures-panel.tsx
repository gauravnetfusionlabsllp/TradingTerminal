import { useState } from 'react';
import { useAgriculturalFutures } from '../../api/hooks/use-agricultural-futures';

// ── Tab types ──

type Tab = 'markets' | 'crops' | 'exports' | 'weather' | 'curves';

const TABS: { key: Tab; label: string }[] = [
  { key: 'markets', label: 'MARKETS' },
  { key: 'crops', label: 'CROPS' },
  { key: 'exports', label: 'EXPORTS' },
  { key: 'weather', label: 'WEATHER' },
  { key: 'curves', label: 'CURVES' },
];

// ── Formatting helpers ──

function fmtPrice(n: number): string {
  if (n >= 1000) return n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (n >= 10) return n.toFixed(2);
  return n.toFixed(4);
}

function fmtPct(n: number): string {
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
}

function fmtNumber(n: number): string {
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (Math.abs(n) >= 1e3) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return n.toFixed(2);
}

function changeColor(n: number): string {
  if (n > 0) return 'text-green-400';
  if (n < 0) return 'text-red-400';
  return 'text-neutral-400';
}

function conditionColor(ge: number): string {
  if (ge >= 65) return 'text-green-400';
  if (ge >= 50) return 'text-amber-400';
  return 'text-red-400';
}

const CURVE_COMMODITIES = [
  { symbol: 'ZC', label: 'CORN' },
  { symbol: 'ZS', label: 'SOYBEANS' },
  { symbol: 'ZW', label: 'WHEAT' },
  { symbol: 'KC', label: 'COFFEE' },
  { symbol: 'LE', label: 'LIVE CATTLE' },
  { symbol: 'CC', label: 'COCOA' },
];

// ── Main Panel ──

export function AgriculturalFuturesPanel() {
  const { data, isLoading } = useAgriculturalFutures();
  const [activeTab, setActiveTab] = useState<Tab>('markets');
  const [selectedCurve, setSelectedCurve] = useState('ZC');

  const grains = data?.grains ?? [];
  const softs = data?.softs ?? [];
  const livestock = data?.livestock ?? [];
  const cropConditions = data?.cropConditions ?? [];
  const exports = data?.exports ?? [];
  const weather = data?.weather ?? [];
  const curves = data?.curves ?? {};

  if (isLoading && !data) {
    return (
      <div className="h-full flex items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-2">
          <div className="w-4 h-4 border border-green-400/40 border-t-green-400 animate-spin" />
          <div className="text-[9px] font-mono text-neutral-500 uppercase tracking-widest animate-pulse">
            LOADING AGRICULTURAL FUTURES...
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return <div className="flex items-center justify-center h-full text-neutral/40 text-[10px] font-mono uppercase tracking-widest">No data available</div>;
  }

  return (
    <div className="h-full flex flex-col bg-black text-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#050505] border-b border-border/20 shrink-0">
        <span className="text-[9px] font-black font-mono uppercase tracking-tighter text-green-400">
          AGRICULTURAL FUTURES
        </span>
        <span className="text-[7px] font-mono text-neutral-600">
          CME / ICE / USDA
        </span>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-0 px-2 py-1 border-b border-border/20 shrink-0 overflow-x-auto no-scrollbar">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-2 py-0.5 text-[7px] font-mono font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? 'text-green-400 bg-green-500/10 border border-green-500/20'
                : 'text-neutral-600 hover:text-neutral-400 border border-transparent'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        {activeTab === 'markets' && (
          <MarketsTab grains={grains} softs={softs} livestock={livestock} />
        )}
        {activeTab === 'crops' && <CropsTab conditions={cropConditions} />}
        {activeTab === 'exports' && <ExportsTab exports={exports} />}
        {activeTab === 'weather' && <WeatherTab weather={weather} />}
        {activeTab === 'curves' && (
          <CurvesTab
            curves={curves}
            selectedCurve={selectedCurve}
            onSelectCurve={setSelectedCurve}
          />
        )}
      </div>
    </div>
  );
}

// ── Shared sub-components ──

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="px-2 py-1.5 bg-[#080808] border-y border-border/20 mt-0 first:mt-0">
      <span className="text-[8px] font-mono font-black uppercase tracking-wider text-green-400/80">
        {label}
      </span>
    </div>
  );
}

function ColHeader({ children, align }: { children: React.ReactNode; align?: 'right' | 'center' }) {
  return (
    <span
      className={`text-[7px] font-mono font-black text-neutral-500 uppercase tracking-wider ${
        align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
      }`}
    >
      {children}
    </span>
  );
}

// ── Markets Tab ──

function MarketsTab({ grains, softs, livestock }: { grains: any[]; softs: any[]; livestock: any[] }) {
  return (
    <>
      <SectionHeader label="GRAINS & OILSEEDS" />
      <div className="grid grid-cols-[1.2fr_0.6fr_0.5fr_0.4fr_0.8fr] px-2 py-0.5 border-b border-border/20 bg-[#030303]">
        <ColHeader>CONTRACT</ColHeader>
        <ColHeader align="right">PRICE</ColHeader>
        <ColHeader align="right">CHG%</ColHeader>
        <ColHeader align="right">BASIS</ColHeader>
        <ColHeader align="right">52W RANGE</ColHeader>
      </div>
      {grains.map((g: any) => (
        <CommodityRow key={g.symbol} item={g} />
      ))}

      <SectionHeader label="SOFTS" />
      <div className="grid grid-cols-[1.2fr_0.6fr_0.5fr_0.4fr_0.8fr] px-2 py-0.5 border-b border-border/20 bg-[#030303]">
        <ColHeader>CONTRACT</ColHeader>
        <ColHeader align="right">PRICE</ColHeader>
        <ColHeader align="right">CHG%</ColHeader>
        <ColHeader align="right">BASIS</ColHeader>
        <ColHeader align="right">52W RANGE</ColHeader>
      </div>
      {softs.map((s: any) => (
        <CommodityRow key={s.symbol} item={s} />
      ))}

      <SectionHeader label="LIVESTOCK" />
      <div className="grid grid-cols-[1.2fr_0.6fr_0.5fr_0.4fr_0.8fr] px-2 py-0.5 border-b border-border/20 bg-[#030303]">
        <ColHeader>CONTRACT</ColHeader>
        <ColHeader align="right">PRICE</ColHeader>
        <ColHeader align="right">CHG%</ColHeader>
        <ColHeader align="right">BASIS</ColHeader>
        <ColHeader align="right">52W RANGE</ColHeader>
      </div>
      {livestock.map((l: any) => (
        <CommodityRow key={l.symbol} item={l} />
      ))}

      <div className="h-4" />
    </>
  );
}

function CommodityRow({ item }: { item: any }) {
  const rangePct =
    item.w52High !== item.w52Low
      ? ((item.price - item.w52Low) / (item.w52High - item.w52Low)) * 100
      : 50;

  return (
    <div className="grid grid-cols-[1.2fr_0.6fr_0.5fr_0.4fr_0.8fr] px-2 py-1 border-b border-border/5 hover:bg-green-400/[0.02] transition-colors">
      <div className="flex flex-col min-w-0">
        <span className="text-[9px] font-mono font-bold text-white leading-tight">{item.name}</span>
        <span className="text-[7px] font-mono text-neutral-600 leading-tight">{item.symbol}</span>
      </div>
      <div className="flex flex-col items-end self-center">
        <span className="text-[9px] font-mono font-bold text-white/80">{fmtPrice(item.price)}</span>
        <span className={`text-[7px] font-mono font-bold ${changeColor(item.change)}`}>
          {item.change >= 0 ? '+' : ''}
          {typeof item.change === 'number' && Math.abs(item.change) < 1
            ? item.change.toFixed(4)
            : item.change.toFixed(2)}
        </span>
      </div>
      <span className={`text-[9px] font-mono font-bold text-right self-center ${changeColor(item.changePct)}`}>
        {fmtPct(item.changePct)}
      </span>
      <span className={`text-[8px] font-mono text-right self-center ${changeColor(item.basis)}`}>
        {item.basis >= 0 ? '+' : ''}
        {item.basis.toFixed(2)}
      </span>
      <div className="flex flex-col items-end self-center gap-0.5">
        <div className="flex items-center gap-1 text-[7px] font-mono text-neutral-500">
          <span>{fmtPrice(item.w52Low)}</span>
          <span>-</span>
          <span>{fmtPrice(item.w52High)}</span>
        </div>
        <div className="w-full h-1 bg-neutral-800 relative">
          <div
            className="absolute top-0 left-0 h-full bg-green-400/30"
            style={{ width: `${Math.min(100, Math.max(0, rangePct))}%` }}
          />
          <div
            className="absolute top-0 w-0.5 h-full bg-green-400"
            style={{ left: `${Math.min(100, Math.max(0, rangePct))}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ── Crops Tab ──

function CropsTab({ conditions }: { conditions: any[] }) {
  if (!conditions.length) {
    return (
      <div className="h-full flex items-center justify-center">
        <span className="text-[9px] font-mono text-neutral-600 uppercase tracking-wider">
          NO CROP CONDITION DATA AVAILABLE
        </span>
      </div>
    );
  }

  return (
    <>
      <SectionHeader label="USDA CROP CONDITIONS (% OF PLANTED AREA)" />
      <table className="w-full text-[9px] font-mono">
        <thead className="sticky top-0 bg-black/95 text-[7px] font-black text-neutral-500 uppercase tracking-wider border-b border-border/20">
          <tr>
            <th className="px-2 py-1 text-left">CROP</th>
            <th className="px-2 py-1 text-right">EXCL</th>
            <th className="px-2 py-1 text-right">GOOD</th>
            <th className="px-2 py-1 text-right">FAIR</th>
            <th className="px-2 py-1 text-right">POOR</th>
            <th className="px-2 py-1 text-right">V.POOR</th>
            <th className="px-2 py-1 text-right">G/E %</th>
            <th className="px-2 py-1 text-right">WK CHG</th>
            <th className="px-2 py-1 text-right">YOY</th>
          </tr>
        </thead>
        <tbody>
          {conditions.map((c: any) => {
            const geChange = c.goodExcellent - c.prevWeek;
            const yoyChange = c.goodExcellent - c.prevYear;
            return (
              <tr
                key={c.crop}
                className="border-b border-border/5 hover:bg-green-400/[0.02] transition-colors"
              >
                <td className="px-2 py-1 font-bold text-green-400">{c.crop}</td>
                <td className="px-2 py-1 text-right text-green-400/80">{c.excellent}%</td>
                <td className="px-2 py-1 text-right text-green-400/60">{c.good}%</td>
                <td className="px-2 py-1 text-right text-amber-400/60">{c.fair}%</td>
                <td className="px-2 py-1 text-right text-red-400/60">{c.poor}%</td>
                <td className="px-2 py-1 text-right text-red-400/80">{c.veryPoor}%</td>
                <td className={`px-2 py-1 text-right font-bold ${conditionColor(c.goodExcellent)}`}>
                  {c.goodExcellent}%
                </td>
                <td className={`px-2 py-1 text-right font-bold ${changeColor(geChange)}`}>
                  {geChange >= 0 ? '+' : ''}
                  {geChange}
                </td>
                <td className={`px-2 py-1 text-right font-bold ${changeColor(yoyChange)}`}>
                  {yoyChange >= 0 ? '+' : ''}
                  {yoyChange}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Summary bar */}
      <div className="px-2 py-2 border-t border-border/20 bg-[#050505]">
        <div className="text-[7px] font-mono text-neutral-500 uppercase tracking-wider mb-1">
          CONDITION SUMMARY
        </div>
        <div className="grid grid-cols-3 gap-2">
          {conditions.slice(0, 3).map((c: any) => (
            <div key={c.crop} className="border border-border/20 p-1.5">
              <div className="text-[7px] font-mono text-neutral-500 uppercase">{c.crop}</div>
              <div className="flex items-center gap-1 mt-0.5">
                <div className="flex-1 h-1.5 bg-neutral-800 flex overflow-hidden">
                  <div className="bg-green-500/80" style={{ width: `${c.excellent}%` }} />
                  <div className="bg-green-400/50" style={{ width: `${c.good}%` }} />
                  <div className="bg-amber-400/50" style={{ width: `${c.fair}%` }} />
                  <div className="bg-red-400/50" style={{ width: `${c.poor}%` }} />
                  <div className="bg-red-500/80" style={{ width: `${c.veryPoor}%` }} />
                </div>
                <span className={`text-[8px] font-mono font-bold ${conditionColor(c.goodExcellent)}`}>
                  {c.goodExcellent}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="h-4" />
    </>
  );
}

// ── Exports Tab ──

function ExportsTab({ exports: exportData }: { exports: any[] }) {
  if (!exportData.length) {
    return (
      <div className="h-full flex items-center justify-center">
        <span className="text-[9px] font-mono text-neutral-600 uppercase tracking-wider">
          NO EXPORT DATA AVAILABLE
        </span>
      </div>
    );
  }

  return (
    <>
      <SectionHeader label="WEEKLY EXPORT INSPECTIONS (THOUSAND MT)" />
      <table className="w-full text-[9px] font-mono">
        <thead className="sticky top-0 bg-black/95 text-[7px] font-black text-neutral-500 uppercase tracking-wider border-b border-border/20">
          <tr>
            <th className="px-2 py-1 text-left">COMMODITY</th>
            <th className="px-2 py-1 text-right">WEEKLY</th>
            <th className="px-2 py-1 text-right">YR AGO</th>
            <th className="px-2 py-1 text-right">WK VS YA</th>
            <th className="px-2 py-1 text-right">MKT YEAR</th>
            <th className="px-2 py-1 text-right">YA TOTAL</th>
            <th className="px-2 py-1 text-right">YOY %</th>
          </tr>
        </thead>
        <tbody>
          {exportData.map((e: any) => {
            const weeklyVsYa = e.yearAgo > 0 ? ((e.weeklyInspections - e.yearAgo) / e.yearAgo) * 100 : 0;
            return (
              <tr
                key={e.commodity}
                className="border-b border-border/5 hover:bg-green-400/[0.02] transition-colors"
              >
                <td className="px-2 py-1 font-bold text-green-400">{e.commodity}</td>
                <td className="px-2 py-1 text-right text-white/80 font-bold">
                  {fmtNumber(e.weeklyInspections)}
                </td>
                <td className="px-2 py-1 text-right text-white/40">{fmtNumber(e.yearAgo)}</td>
                <td className={`px-2 py-1 text-right font-bold ${changeColor(weeklyVsYa)}`}>
                  {fmtPct(weeklyVsYa)}
                </td>
                <td className="px-2 py-1 text-right text-white/80">{fmtNumber(e.marketYearTotal)}</td>
                <td className="px-2 py-1 text-right text-white/40">{fmtNumber(e.yearAgoTotal)}</td>
                <td className={`px-2 py-1 text-right font-bold ${changeColor(e.yoyPct)}`}>
                  {e.yoyPct >= 0 ? '\u25B2' : '\u25BC'} {fmtPct(e.yoyPct)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Pace vs year-ago comparison bars */}
      <div className="px-2 py-2 border-t border-border/20 bg-[#050505]">
        <div className="text-[7px] font-mono text-neutral-500 uppercase tracking-wider mb-1.5">
          MARKETING YEAR PACE VS YEAR AGO
        </div>
        <div className="space-y-1.5">
          {exportData.map((e: any) => {
            const pace = e.yearAgoTotal > 0 ? (e.marketYearTotal / e.yearAgoTotal) * 100 : 100;
            return (
              <div key={e.commodity} className="flex items-center gap-2">
                <span className="text-[8px] font-mono text-green-400/80 w-16 shrink-0">
                  {e.commodity}
                </span>
                <div className="flex-1 h-1.5 bg-neutral-800 relative">
                  <div
                    className={`h-full ${pace >= 100 ? 'bg-green-400/50' : 'bg-amber-400/50'}`}
                    style={{ width: `${Math.min(120, pace)}%` }}
                  />
                  <div className="absolute top-0 left-full h-full w-px bg-neutral-600" style={{ left: '100%' }} />
                </div>
                <span className={`text-[8px] font-mono font-bold w-10 text-right ${pace >= 100 ? 'text-green-400' : 'text-amber-400'}`}>
                  {pace.toFixed(0)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="h-4" />
    </>
  );
}

// ── Weather Tab ──

function WeatherTab({ weather }: { weather: any[] }) {
  if (!weather.length) {
    return (
      <div className="h-full flex items-center justify-center">
        <span className="text-[9px] font-mono text-neutral-600 uppercase tracking-wider">
          NO WEATHER DATA AVAILABLE
        </span>
      </div>
    );
  }

  return (
    <>
      <SectionHeader label="DROUGHT MONITOR & GROWING CONDITIONS" />
      <table className="w-full text-[9px] font-mono">
        <thead className="sticky top-0 bg-black/95 text-[7px] font-black text-neutral-500 uppercase tracking-wider border-b border-border/20">
          <tr>
            <th className="px-2 py-1 text-left">REGION</th>
            <th className="px-2 py-1 text-left">DROUGHT LEVEL</th>
            <th className="px-2 py-1 text-right">AREA %</th>
            <th className="px-2 py-1 text-left">CONDITION</th>
            <th className="px-2 py-1 text-left">TEMP</th>
            <th className="px-2 py-1 text-left">PRECIP</th>
          </tr>
        </thead>
        <tbody>
          {weather.map((w: any) => {
            const severityColor =
              w.areaPct >= 30
                ? 'text-red-400'
                : w.areaPct >= 10
                  ? 'text-amber-400'
                  : 'text-green-400';
            const condColor =
              w.condition === 'Favorable'
                ? 'text-green-400'
                : w.condition === 'Stressed'
                  ? 'text-red-400'
                  : 'text-amber-400';
            const severityBg =
              w.areaPct >= 30
                ? 'bg-red-500/10 border-red-500/20'
                : w.areaPct >= 10
                  ? 'bg-amber-500/10 border-amber-500/20'
                  : 'bg-green-500/10 border-green-500/20';
            return (
              <tr
                key={w.region}
                className="border-b border-border/5 hover:bg-green-400/[0.02] transition-colors"
              >
                <td className="px-2 py-1.5 font-bold text-green-400">{w.region}</td>
                <td className="px-2 py-1.5">
                  <span
                    className={`px-1 py-0.5 text-[7px] font-mono font-black uppercase tracking-wider border ${severityBg} ${severityColor}`}
                  >
                    {w.droughtLevel}
                  </span>
                </td>
                <td className={`px-2 py-1.5 text-right font-bold ${severityColor}`}>
                  {w.areaPct.toFixed(1)}%
                </td>
                <td className={`px-2 py-1.5 font-bold ${condColor}`}>{w.condition}</td>
                <td className="px-2 py-1.5 text-white/60">{w.temp}</td>
                <td className="px-2 py-1.5 text-white/60">{w.precip}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Drought severity summary */}
      <div className="px-2 py-2 border-t border-border/20 bg-[#050505]">
        <div className="text-[7px] font-mono text-neutral-500 uppercase tracking-wider mb-1.5">
          DROUGHT AREA COVERAGE BY REGION
        </div>
        <div className="space-y-1">
          {weather.map((w: any) => {
            const barColor =
              w.areaPct >= 30
                ? 'bg-red-400/60'
                : w.areaPct >= 10
                  ? 'bg-amber-400/60'
                  : 'bg-green-400/40';
            return (
              <div key={w.region} className="flex items-center gap-2">
                <span className="text-[7px] font-mono text-neutral-400 w-24 shrink-0 truncate">
                  {w.region}
                </span>
                <div className="flex-1 h-1 bg-neutral-800">
                  <div className={`h-full ${barColor}`} style={{ width: `${Math.min(100, w.areaPct)}%` }} />
                </div>
                <span className="text-[7px] font-mono text-neutral-500 w-8 text-right">
                  {w.areaPct.toFixed(0)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="h-4" />
    </>
  );
}

// ── Curves Tab ──

function CurvesTab({
  curves,
  selectedCurve,
  onSelectCurve,
}: {
  curves: Record<string, any[]>;
  selectedCurve: string;
  onSelectCurve: (sym: string) => void;
}) {
  const curveData = curves[selectedCurve] ?? [];

  return (
    <>
      {/* Commodity selector */}
      <div className="flex items-center gap-0 px-2 py-1.5 border-b border-border/20 bg-[#050505] overflow-x-auto no-scrollbar">
        {CURVE_COMMODITIES.map((c) => (
          <button
            key={c.symbol}
            onClick={() => onSelectCurve(c.symbol)}
            className={`px-2 py-0.5 text-[7px] font-mono font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${
              selectedCurve === c.symbol
                ? 'text-green-400 bg-green-500/10 border border-green-500/20'
                : 'text-neutral-600 hover:text-neutral-400 border border-transparent'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <SectionHeader
        label={`FORWARD CURVE - ${CURVE_COMMODITIES.find((c) => c.symbol === selectedCurve)?.label ?? selectedCurve}`}
      />

      {curveData.length === 0 ? (
        <div className="h-32 flex items-center justify-center">
          <span className="text-[9px] font-mono text-neutral-600 uppercase tracking-wider">
            NO CURVE DATA AVAILABLE
          </span>
        </div>
      ) : (
        <>
          {/* Visual bar representation of the curve */}
          <div className="px-3 py-3 border-b border-border/20">
            <div className="flex items-end gap-1 h-20">
              {(() => {
                const prices = curveData.map((d: any) => d.price);
                const minP = Math.min(...prices);
                const maxP = Math.max(...prices);
                const range = maxP - minP || 1;
                return curveData.map((d: any, i: number) => {
                  const heightPct = ((d.price - minP) / range) * 70 + 30;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <span className={`text-[7px] font-mono font-bold ${changeColor(d.change)}`}>
                        {fmtPrice(d.price)}
                      </span>
                      <div className="w-full flex justify-center">
                        <div
                          className="w-3/4 bg-green-400/30 border-t border-green-400/60"
                          style={{ height: `${heightPct}%` }}
                        />
                      </div>
                      <span className="text-[6px] font-mono text-neutral-500 uppercase">
                        {d.month}
                      </span>
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          {/* Table */}
          <table className="w-full text-[9px] font-mono">
            <thead className="sticky top-0 bg-black/95 text-[7px] font-black text-neutral-500 uppercase tracking-wider border-b border-border/20">
              <tr>
                <th className="px-2 py-1 text-left">CONTRACT</th>
                <th className="px-2 py-1 text-right">PRICE</th>
                <th className="px-2 py-1 text-right">CHANGE</th>
                <th className="px-2 py-1 text-right">SPREAD</th>
                <th className="px-2 py-1 text-right">STRUCTURE</th>
              </tr>
            </thead>
            <tbody>
              {curveData.map((d: any, i: number) => {
                const spread = i > 0 ? d.price - curveData[i - 1].price : 0;
                const structure =
                  i === 0
                    ? '-'
                    : spread > 0
                      ? 'CONTANGO'
                      : spread < 0
                        ? 'BACKWRDN'
                        : 'FLAT';
                const structureColor =
                  structure === 'CONTANGO'
                    ? 'text-amber-400'
                    : structure === 'BACKWRDN'
                      ? 'text-green-400'
                      : 'text-neutral-500';
                return (
                  <tr
                    key={i}
                    className="border-b border-border/5 hover:bg-green-400/[0.02] transition-colors"
                  >
                    <td className="px-2 py-1 font-bold text-green-400">{d.month}</td>
                    <td className="px-2 py-1 text-right text-white/80 font-bold">
                      {fmtPrice(d.price)}
                    </td>
                    <td className={`px-2 py-1 text-right font-bold ${changeColor(d.change)}`}>
                      {d.change >= 0 ? '+' : ''}
                      {typeof d.change === 'number' && Math.abs(d.change) < 1
                        ? d.change.toFixed(4)
                        : d.change.toFixed(2)}
                    </td>
                    <td className={`px-2 py-1 text-right ${i === 0 ? 'text-neutral-600' : changeColor(spread)}`}>
                      {i === 0
                        ? '-'
                        : `${spread >= 0 ? '+' : ''}${Math.abs(spread) < 1 ? spread.toFixed(4) : spread.toFixed(2)}`}
                    </td>
                    <td className={`px-2 py-1 text-right text-[8px] font-bold ${structureColor}`}>
                      {structure}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}

      <div className="h-4" />
    </>
  );
}
