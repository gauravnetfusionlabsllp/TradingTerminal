import { useState, useMemo, useCallback } from 'react';
import {
  useSectorHeatmap,
  type SectorEntry,
  type SectorStock,
} from '../../api/hooks/use-sector-heatmap';
import { useAppStore } from '../../stores/use-app-store';
import { useT, tr, TFn } from '../../i18n';
import { RefreshCw, Grid3X3 } from 'lucide-react';
import { squarify, type TreemapItem } from '../../lib/treemap';

// ── i18n helper with fallback ──

// ── Constants ──

const ACCENT = 'var(--color-amber-500)'; // amber-400

// ── Color helpers ──

function getHeatColor(changePct: number): string {
  const abs = Math.min(Math.abs(changePct), 3);
  const intensity = abs / 3; // 0..1

  if (Math.abs(changePct) < 0.05) return 'var(--color-zinc-800)'; // zinc-800 for ~0%

  if (changePct > 0) {
    // Green: from emerald-900 (#064e3b) to emerald-500 (#10b981)
    const r = Math.round(6 + intensity * (16 - 6));
    const g = Math.round(78 + intensity * (185 - 78));
    const b = Math.round(59 + intensity * (129 - 59));
    return `rgb(${r},${g},${b})`;
  } else {
    // Red: from red-900 (#7f1d1d) to red-500 (#ef4444)
    const r = Math.round(127 + intensity * (239 - 127));
    const g = Math.round(29 + intensity * (68 - 29));
    const b = Math.round(29 + intensity * (68 - 29));
    return `rgb(${r},${g},${b})`;
  }
}

function getTextColor(changePct: number): string {
  if (changePct > 0) return 'var(--color-emerald-300)'; // emerald-300
  if (changePct < 0) return 'var(--color-red-300)'; // red-300
  return 'color-mix(in srgb, var(--color-white) 50%, transparent)';
}

function fmtPct(n: number): string {
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
}

function fmtMarketCap(n: number): string {
  if (n >= 1e12) return (n / 1e12).toFixed(1) + 'T';
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(0) + 'M';
  return String(Math.round(n));
}

// ── Treemap SVG component ──

function SectorTreemap({
  sectors,
  width,
  height,
  hoveredSector,
  onHoverSector,
  onClickStock,
}: {
  sectors: SectorEntry[];
  width: number;
  height: number;
  hoveredSector: string | null;
  onHoverSector: (name: string | null) => void;
  onClickStock: (symbol: string) => void;
}) {
  // Build sector-level treemap
  const sectorItems: TreemapItem[] = sectors.map((s) => ({
    id: s.name,
    weight: Math.max(s.marketCap, 1),
  }));

  const sectorRects = squarify(sectorItems, { x: 0, y: 0, w: width, h: height });

  // Build map for quick lookup
  const sectorMap = new Map(sectors.map((s) => [s.name, s]));
  const rectMap = new Map(sectorRects.map((r) => [r.id, r]));

  return (
    <svg width={width} height={height} className="block">
      {sectorRects.map((sr) => {
        const sector = sectorMap.get(sr.id);
        if (!sector) return null;

        const isHovered = hoveredSector === sr.id;
        const GAP = 1;

        // When hovered, show individual stocks inside the sector rect
        if (isHovered && sector.stocks.length > 0) {
          const stockItems: TreemapItem[] = sector.stocks.map((s) => ({
            id: s.symbol,
            weight: Math.max(s.marketCap, 1),
          }));

          const stockRects = squarify(stockItems, {
            x: sr.x + GAP,
            y: sr.y + GAP,
            w: sr.w - GAP * 2,
            h: sr.h - GAP * 2,
          });

          const stockMap = new Map(sector.stocks.map((s) => [s.symbol, s]));

          return (
            <g
              key={sr.id}
              onMouseLeave={() => onHoverSector(null)}
            >
              {/* Sector background border */}
              <rect
                x={sr.x}
                y={sr.y}
                width={sr.w}
                height={sr.h}
                fill={ACCENT}
                fillOpacity={0.3}
              />
              {stockRects.map((stR) => {
                const stock = stockMap.get(stR.id);
                if (!stock) return null;
                const minDim = Math.min(stR.w, stR.h);
                return (
                  <g
                    key={stR.id}
                    onClick={() => onClickStock(stock.symbol)}
                    className="cursor-pointer"
                  >
                    <rect
                      x={stR.x}
                      y={stR.y}
                      width={Math.max(stR.w - 0.5, 0)}
                      height={Math.max(stR.h - 0.5, 0)}
                      fill={getHeatColor(stock.changePct)}
                      stroke="var(--color-black)"
                      strokeWidth={0.5}
                    />
                    {minDim > 20 && (
                      <>
                        <text
                          x={stR.x + stR.w / 2}
                          y={stR.y + stR.h / 2 - (minDim > 35 ? 4 : 0)}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill="var(--color-white)"
                          fontSize={minDim > 50 ? 9 : 7}
                          fontFamily="inherit"
                          fontWeight="bold"
                        >
                          {stock.symbol}
                        </text>
                        {minDim > 35 && (
                          <text
                            x={stR.x + stR.w / 2}
                            y={stR.y + stR.h / 2 + 8}
                            textAnchor="middle"
                            dominantBaseline="central"
                            fill={getTextColor(stock.changePct)}
                            fontSize={7}
                            fontFamily="inherit"
                          >
                            {fmtPct(stock.changePct)}
                          </text>
                        )}
                      </>
                    )}
                  </g>
                );
              })}
            </g>
          );
        }

        // Default: show sector block
        const minDim = Math.min(sr.w, sr.h);
        return (
          <g
            key={sr.id}
            onMouseEnter={() => onHoverSector(sr.id)}
            className="cursor-pointer"
          >
            <rect
              x={sr.x + GAP}
              y={sr.y + GAP}
              width={Math.max(sr.w - GAP * 2, 0)}
              height={Math.max(sr.h - GAP * 2, 0)}
              fill={getHeatColor(sector.changePct)}
              stroke="var(--color-black)"
              strokeWidth={0.5}
            />
            {minDim > 30 && (
              <>
                <text
                  x={sr.x + sr.w / 2}
                  y={sr.y + sr.h / 2 - (minDim > 50 ? 6 : 0)}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="var(--color-white)"
                  fontSize={minDim > 70 ? 10 : 8}
                  fontFamily="inherit"
                  fontWeight="bold"
                >
                  {sector.name.length > 14 && sr.w < 100
                    ? sector.name.slice(0, 12) + '..'
                    : sector.name}
                </text>
                {minDim > 50 && (
                  <text
                    x={sr.x + sr.w / 2}
                    y={sr.y + sr.h / 2 + 9}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={getTextColor(sector.changePct)}
                    fontSize={9}
                    fontFamily="inherit"
                    fontWeight="bold"
                  >
                    {fmtPct(sector.changePct)}
                  </text>
                )}
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── Sector list table ──

function SectorTable({
  sectors,
  onClickStock,
}: {
  sectors: SectorEntry[];
  onClickStock: (symbol: string) => void;
}) {
  // Sort by change% descending (strongest at top)
  const sorted = useMemo(
    () => [...sectors].sort((a, b) => b.changePct - a.changePct),
    [sectors],
  );

  const maxAbsChange = useMemo(
    () => Math.max(...sorted.map((s) => Math.abs(s.changePct)), 0.01),
    [sorted],
  );

  return (
    <div className="w-full">
      {/* Header */}
      <div className="grid grid-cols-[1fr_50px_60px_80px_80px] gap-1 px-2 py-1 border-b border-amber-500/20">
        <span className="text-micro font-mono uppercase tracking-wider text-amber-500/60">Sector</span>
        <span className="text-micro font-mono uppercase tracking-wider text-amber-500/60 text-right">ETF</span>
        <span className="text-micro font-mono uppercase tracking-wider text-amber-500/60 text-right">Chg%</span>
        <span className="text-micro font-mono uppercase tracking-wider text-amber-500/60 text-right">Top Gainer</span>
        <span className="text-micro font-mono uppercase tracking-wider text-amber-500/60 text-right">Top Loser</span>
      </div>
      {/* Rows */}
      {sorted.map((sector) => {
        const gainer = sector.stocks.length > 0
          ? sector.stocks.reduce((best, s) => s.changePct > best.changePct ? s : best, sector.stocks[0])
          : null;
        const loser = sector.stocks.length > 0
          ? sector.stocks.reduce((worst, s) => s.changePct < worst.changePct ? s : worst, sector.stocks[0])
          : null;

        const barWidth = Math.min(Math.abs(sector.changePct) / maxAbsChange, 1) * 100;
        const barColor = sector.changePct >= 0 ? 'var(--color-emerald-500)' : 'var(--color-red-500)';

        return (
          <div key={sector.name} className="grid grid-cols-[1fr_50px_60px_80px_80px] gap-1 px-2 py-0.5 border-b border-white/5 hover:bg-white/[0.02] relative">
            {/* Performance bar background */}
            <div
              className="absolute inset-y-0 left-0 opacity-[0.07]"
              style={{
                width: `${barWidth}%`,
                backgroundColor: barColor,
              }}
            />
            <span className="text-mini font-mono text-white/70 truncate relative z-10">
              {sector.name}
            </span>
            <span className="text-mini font-mono text-white/40 text-right relative z-10">
              {sector.etfSymbol}
            </span>
            <span
              className="text-mini font-mono font-bold text-right relative z-10"
              style={{ color: sector.changePct >= 0 ? 'var(--color-emerald-400)' : 'var(--color-red-400)' }}
            >
              {fmtPct(sector.changePct)}
            </span>
            <span
              className="text-mini font-mono text-right relative z-10 cursor-pointer hover:underline"
              style={{ color: 'var(--color-emerald-400)' }}
              onClick={() => gainer && onClickStock(gainer.symbol)}
            >
              {gainer ? `${gainer.symbol} ${fmtPct(gainer.changePct)}` : '-'}
            </span>
            <span
              className="text-mini font-mono text-right relative z-10 cursor-pointer hover:underline"
              style={{ color: 'var(--color-red-400)' }}
              onClick={() => loser && onClickStock(loser.symbol)}
            >
              {loser ? `${loser.symbol} ${fmtPct(loser.changePct)}` : '-'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Main panel ──

export function SectorHeatmapPanel() {
  const t = useT();
  const { data, isLoading, refetch } = useSectorHeatmap();
  const setSelectedSymbol = useAppStore((s) => s.setSelectedSymbol);
  const [hoveredSector, setHoveredSector] = useState<string | null>(null);
  const [containerSize, setContainerSize] = useState({ w: 600, h: 300 });

  const handleClickStock = useCallback(
    (symbol: string) => setSelectedSymbol(symbol),
    [setSelectedSymbol],
  );

  const sectors = data?.sectors ?? [];
  const summary = data?.summary;

  // Measure container
  const measuredRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerSize({
          w: Math.floor(entry.contentRect.width),
          h: Math.floor(entry.contentRect.height),
        });
      }
    });
    ro.observe(node);
    // Initial measurement
    setContainerSize({
      w: Math.floor(node.clientWidth),
      h: Math.floor(node.clientHeight),
    });
  }, []);

  return (
    <div className="h-full flex flex-col bg-black overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-raised border-b border-amber-500/20 shrink-0">
        <div className="flex items-center gap-2">
          <Grid3X3 className="w-4 h-4" style={{ color: ACCENT }} />
          <span
            className="text-mini font-black font-mono uppercase tracking-tighter"
            style={{ color: ACCENT }}
          >
            {tr(t, 'panelSectorHeatmap', 'SECTOR HEATMAP')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {summary && (
            <>
              <span className="text-micro font-mono text-emerald-400">
                {summary.advancers} adv
              </span>
              <span className="text-micro font-mono text-red-400">
                {summary.decliners} dec
              </span>
            </>
          )}
          <button
            onClick={() => refetch()}
            className="p-1 text-white/30 hover:text-amber-400 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Breadth & strongest/weakest */}
      {summary && (
        <div className="flex items-center gap-3 px-3 py-1 border-b border-amber-500/10 bg-black/40 shrink-0">
          <span className="text-micro font-mono text-white/30">
            Breadth: <span className="text-amber-400">{summary.marketBreadth}%</span>
          </span>
          <span className="text-micro font-mono text-white/30">
            Best: <span className="text-emerald-400">{summary.strongestSector}</span>
          </span>
          <span className="text-micro font-mono text-white/30">
            Worst: <span className="text-red-400">{summary.weakestSector}</span>
          </span>
        </div>
      )}

      {/* Loading state */}
      {isLoading && !data && (
        <div className="flex flex-col items-center justify-center flex-1 gap-2">
          <div
            className="w-5 h-5 border-2 border-t-amber-400 animate-spin"
            style={{ borderColor: 'color-mix(in srgb, var(--color-amber-500) 20%, transparent)', borderTopColor: ACCENT }}
          />
          <span className="text-mini font-mono text-white/30 uppercase tracking-widest">
            {tr(t, 'loading', 'Loading...')}
          </span>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && sectors.length === 0 && (
        <div className="flex items-center justify-center flex-1">
          <span className="text-mini font-mono text-white/20 uppercase tracking-widest">
            No sector data available
          </span>
        </div>
      )}

      {/* Content */}
      {sectors.length > 0 && (
        <div className="flex-1 overflow-auto no-scrollbar flex flex-col">
          {/* Treemap area */}
          <div ref={measuredRef} className="flex-1 min-h-[180px] p-1">
            {containerSize.w > 0 && containerSize.h > 0 && (
              <SectorTreemap
                sectors={sectors}
                width={containerSize.w - 8}
                height={Math.max(containerSize.h - 8, 160)}
                hoveredSector={hoveredSector}
                onHoverSector={setHoveredSector}
                onClickStock={handleClickStock}
              />
            )}
          </div>

          {/* Sector table */}
          <div className="shrink-0 border-t border-amber-500/10 max-h-[200px] overflow-auto no-scrollbar">
            <SectorTable sectors={sectors} onClickStock={handleClickStock} />
          </div>
        </div>
      )}
    </div>
  );
}
