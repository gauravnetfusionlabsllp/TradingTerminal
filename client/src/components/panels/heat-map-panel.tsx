import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useHeatMap, type HeatMapStock, type SectorData } from '../../api/hooks/use-heat-map';
import { useAppStore } from '../../stores/use-app-store';
import { useT } from '../../i18n';
import { squarify } from '../../lib/treemap';

// Square brand icons (own background, SVG so they stay sharp maximised); unknown tickers 404 and the logo is dropped
const logoUrl = (symbol: string) => `https://assets.parqet.com/logos/symbol/${symbol}`;
const hideBrokenLogo = (e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.display = 'none'; };

// Diverging scale: flat grey → green / red, saturating at ±3%. Fixed across themes: tiles are their own surface with white ink
const FLAT = [58, 63, 78];
const UP = [30, 142, 78];
const DOWN = [204, 48, 56];
const CAP = 3;
function tileColor(chg: number): string {
  const t = Math.min(Math.abs(chg) / CAP, 1);
  const to = chg >= 0 ? UP : DOWN;
  return `rgb(${FLAT.map((f, i) => Math.round(f + (to[i] - f) * t)).join(',')})`;
}

const pct = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(2)}%`;
const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 2 });
const tone = (n: number) => (n >= 0 ? 'text-bullish' : 'text-bearish');

const HEADER_H = 18;
const CHAR_W = 0.62; // JetBrains Mono advance per em

interface Tile { stock: HeatMapStock; sector: SectorData; x: number; y: number; w: number; h: number }
interface Block { sector: SectorData; x: number; y: number; w: number; h: number; header: boolean }

/** Sectors sized by their stocks' combined cap, stocks by their own cap; edges snapped to whole pixels so seams stay crisp */
function layout(sectors: SectorData[], width: number, height: number) {
  const cap = (s: HeatMapStock) => s.marketCap || 1e10; // ponytail: missing cap gets a mid-size weight
  const byName = new Map(sectors.map((s) => [s.sector, s]));
  const snap = (x: number, y: number, w: number, h: number) => {
    const l = Math.round(x), t = Math.round(y);
    return { x: l, y: t, w: Math.round(x + w) - l, h: Math.round(y + h) - t };
  };
  const blocks: Block[] = [];
  const tiles: Tile[] = [];
  const items = sectors.map((s) => ({ id: s.sector, weight: s.stocks.reduce((a, st) => a + cap(st), 0) }));
  for (const r of squarify(items, { x: 0, y: 0, w: width, h: height })) {
    const sector = byName.get(r.id)!;
    const b = snap(r.x + 1, r.y + 1, Math.max(r.w - 2, 0), Math.max(r.h - 2, 0)); // 2px gutter between sectors
    const header = b.h >= 56 && b.w >= 64;
    blocks.push({ sector, ...b, header });
    const top = b.y + (header ? HEADER_H : 0);
    const stockItems = sector.stocks.map((st) => ({ id: st.symbol, weight: cap(st) }));
    const bySym = new Map(sector.stocks.map((st) => [st.symbol, st]));
    for (const sr of squarify(stockItems, { x: b.x, y: top, w: b.w, h: b.h - (top - b.y) })) {
      const t = snap(sr.x, sr.y, sr.w, sr.h);
      tiles.push({ stock: bySym.get(sr.id)!, sector, ...t, w: Math.max(t.w - 1, 0), h: Math.max(t.h - 1, 0) }); // 1px seam between stocks
    }
  }
  return { blocks, tiles };
}

/** Content grows with the tile: nothing → symbol → + change → + logo */
function TileContent({ stock, w, h }: { stock: HeatMapStock; w: number; h: number }) {
  const change = pct(stock.changePercent);
  const room = w - 8;
  const sym = Math.min(32, Math.sqrt(w * h) / 5, room / (CHAR_W * stock.symbol.length), h * 0.6);
  if (sym < 9) return null;
  const chg = Math.min(sym * 0.7, room / (CHAR_W * change.length));
  const showChg = chg >= 9 && (sym + chg) * 1.2 <= h - 4;
  const textH = (sym + (showChg ? chg : 0)) * 1.2;
  const logo = Math.floor(Math.min(64, Math.sqrt(w * h) / 3.2, room, h - textH - 14));
  return (
    <>
      {showChg && logo >= 20 && (
        <img src={logoUrl(stock.symbol)} alt="" width={logo} height={logo} draggable={false} decoding="async" referrerPolicy="no-referrer" onError={hideBrokenLogo} className="mb-1 shrink-0 rounded-sm ring-1 ring-on-accent/25" style={{ width: logo, height: logo }} />
      )}
      <span className="font-bold leading-[1.2]" style={{ fontSize: sym }}>{stock.symbol}</span>
      {showChg && <span className="font-medium leading-[1.2] opacity-90" style={{ fontSize: chg }}>{change}</span>}
    </>
  );
}

const TreemapLayer = memo(function TreemapLayer({ blocks, tiles, selected, onPick, onHover }: {
  blocks: Block[];
  tiles: Tile[];
  selected: string | null;
  onPick: (symbol: string) => void;
  onHover: (tile: Tile | null) => void;
}) {
  return (
    <>
      {blocks.filter((b) => b.header).map((b) => (
        <button
          key={b.sector.sector}
          type="button"
          onClick={() => onPick(b.sector.sectorSymbol)}
          title={`Chart ${b.sector.sectorSymbol}`}
          className="absolute flex items-center gap-1.5 px-1 text-micro font-mono leading-none hover:bg-hover transition-colors"
          style={{ left: b.x, top: b.y, width: b.w, height: HEADER_H - 1 }}
        >
          <span className="uppercase tracking-wider text-neutral truncate">{b.sector.sector}</span>
          <span className={`ml-auto shrink-0 font-bold ${tone(b.sector.sectorChange)}`}>{pct(b.sector.sectorChange)}</span>
        </button>
      ))}
      {tiles.map((t) => (
        <button
          key={t.stock.symbol}
          type="button"
          aria-label={`${t.stock.symbol} ${pct(t.stock.changePercent)}`}
          onClick={() => onPick(t.stock.symbol)}
          onMouseEnter={() => onHover(t)}
          className="absolute flex flex-col items-center justify-center overflow-hidden font-mono text-on-accent [text-shadow:0_1px_1px_rgb(0_0_0/0.35)] hover:shadow-[inset_0_0_0_2px_var(--color-on-accent)]"
          style={{ left: t.x, top: t.y, width: t.w, height: t.h, backgroundColor: tileColor(t.stock.changePercent) }}
        >
          <TileContent stock={t.stock} w={t.w} h={t.h} />
          {/* the charted symbol: the corner flag (drawn inline: .corner-flag would force position: relative) */}
          {selected === t.stock.symbol && <span className="absolute top-0 right-0 w-2 h-2 bg-accent [clip-path:polygon(0_0,100%_0,100%_100%)]" />}
        </button>
      ))}
    </>
  );
});

function Tooltip({ tile }: { tile: Tile }) {
  const { stock, sector } = tile;
  return (
    <>
      <div className="flex items-center gap-2 px-2.5 py-2">
        <img src={logoUrl(stock.symbol)} alt="" referrerPolicy="no-referrer" onError={hideBrokenLogo} className="w-8 h-8 shrink-0 rounded-sm" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-bold text-fg">{stock.symbol}</span>
            <span className={`ml-auto text-xs font-bold ${tone(stock.changePercent)}`}>{pct(stock.changePercent)}</span>
          </div>
          <div className="flex items-baseline gap-2 text-micro text-neutral">
            <span className="truncate">{stock.name}</span>
            <span className="ml-auto shrink-0 text-fg">{stock.price.toFixed(2)}</span>
          </div>
        </div>
      </div>
      <div className="flex gap-3 px-2.5 pb-2 text-micro text-neutral">
        <span>Mkt cap <span className="text-fg">{stock.marketCap ? compact.format(stock.marketCap) : '—'}</span></span>
        <span>Vol <span className="text-fg">{stock.volume ? compact.format(stock.volume) : '—'}</span></span>
      </div>
      <div className="border-t border-border py-1">
        <div className="flex px-2.5 pb-0.5 text-micro uppercase tracking-wider text-neutral">
          <span className="truncate">{sector.sector}</span>
          <span className={`ml-auto pl-2 ${tone(sector.sectorChange)}`}>{sector.sectorSymbol} {pct(sector.sectorChange)}</span>
        </div>
        {sector.stocks.map((s) => (
          <div key={s.symbol} className={`flex items-center gap-2 px-2.5 text-micro ${s.symbol === stock.symbol ? 'bg-hover text-fg' : 'text-neutral'}`}>
            <span className="w-1.5 h-1.5 shrink-0" style={{ backgroundColor: tileColor(s.changePercent) }} />
            <span className="w-11 shrink-0 font-bold">{s.symbol}</span>
            <span className="truncate">{s.name}</span>
            <span className={`ml-auto shrink-0 ${tone(s.changePercent)}`}>{pct(s.changePercent)}</span>
          </div>
        ))}
      </div>
    </>
  );
}

const LEGEND = [-3, -2, -1, 0, 1, 2, 3];

export function HeatMapPanel() {
  const t = useT();
  const { data, isLoading } = useHeatMap();
  const selected = useAppStore((s) => s.selectedSymbol);
  const setSelectedSymbol = useAppStore((s) => s.setSelectedSymbol);
  const areaRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hover, setHover] = useState<Tile | null>(null);

  const sectors = data ?? [];
  const hasData = sectors.length > 0;

  // Fill whatever the dock gives us (tab, split, maximised): re-lay out on every resize, never scroll
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.floor(e.contentRect.width), h: Math.floor(e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [hasData]);

  const { blocks, tiles } = useMemo(
    () => (size.w > 0 && size.h > 0 ? layout(sectors, size.w, size.h) : { blocks: [], tiles: [] }),
    [sectors, size],
  );

  // Follow the pointer by moving the tooltip directly: no React render per mouse move
  const onMove = (e: React.MouseEvent) => {
    const tip = tipRef.current, area = areaRef.current;
    if (!tip || !area) return;
    const r = area.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const left = x + 14 + tip.offsetWidth > r.width ? x - 14 - tip.offsetWidth : x + 14;
    const top = Math.min(Math.max(y + 14, 0), r.height - tip.offsetHeight);
    tip.style.transform = `translate(${Math.max(left, 0)}px, ${Math.max(top, 0)}px)`;
  };

  const advancers = sectors.reduce((n, s) => n + s.stocks.filter((st) => st.changePercent > 0).length, 0);
  const decliners = sectors.reduce((n, s) => n + s.stocks.filter((st) => st.changePercent < 0).length, 0);
  const sectorsUp = sectors.filter((s) => s.sectorChange >= 0).length;

  return (
    <div className="h-full flex flex-col bg-black overflow-hidden @container">
      {hasData && (
        <div className="flex items-center gap-3 px-2.5 h-7 border-b border-border shrink-0 text-micro font-mono">
          <span className="text-bullish">{sectorsUp} {t('hmSectorsUp')}</span>
          <span className="text-bearish">{sectors.length - sectorsUp} {t('hmSectorsDown')}</span>
          <span className="text-neutral hidden @min-[360px]:inline">
            <span className="text-bullish">▲ {advancers}</span> · <span className="text-bearish">▼ {decliners}</span>
          </span>
          <div className="ml-auto hidden @min-[560px]:flex" aria-label="Colour scale: daily change">
            {LEGEND.map((v) => (
              <span key={v} className="w-9 py-px text-center text-on-accent" style={{ backgroundColor: tileColor(v) }}>
                {v === 0 ? '0%' : `${v > 0 ? '+' : '−'}${Math.abs(v)}%`}
              </span>
            ))}
          </div>
        </div>
      )}

      {isLoading && !data && (
        <div className="flex flex-col items-center justify-center flex-1 gap-2">
          <div className="w-5 h-5 border-2 border-accent/30 border-t-accent animate-spin" />
          <span className="text-mini font-mono text-neutral uppercase tracking-widest">{t('loading')}</span>
        </div>
      )}

      {!isLoading && !hasData && (
        <div className="flex items-center justify-center flex-1">
          <span className="text-mini font-mono text-neutral uppercase tracking-widest">{t('hmNoData')}</span>
        </div>
      )}

      {hasData && (
        <div ref={areaRef} className="relative flex-1 min-h-0 overflow-hidden" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
          <TreemapLayer blocks={blocks} tiles={tiles} selected={selected} onPick={setSelectedSymbol} onHover={setHover} />
          <div
            ref={tipRef}
            className={`absolute left-0 top-0 z-10 w-64 pointer-events-none bg-raised border border-border shadow-lg font-mono ${hover ? '' : 'hidden'}`}
          >
            {hover && <Tooltip key={hover.stock.symbol} tile={hover} />}
          </div>
        </div>
      )}
    </div>
  );
}
