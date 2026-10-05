import { useMemo } from 'react';
import { useHeatMap, type HeatMapStock, type SectorData } from '../../api/hooks/use-heat-map';
import { useAppStore } from '../../stores/use-app-store';
import { useT } from '../../i18n';
import { HeatLegend, HeatTreemap, PeerRows, TileContent, pct, tone } from '../common/heat-treemap';

// Square brand icons (own background, SVG so they stay sharp maximised); unknown tickers 404 and the logo is dropped
const logoUrl = (symbol: string) => `https://assets.parqet.com/logos/symbol/${symbol}`;
const hideBrokenLogo = (e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.display = 'none'; };

const CAP = 3;
const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 2 });

interface StockItem { id: string; weight: number; change: number; stock: HeatMapStock }
interface SectorGroup { id: string; items: StockItem[]; sector: SectorData }

const header = ({ sector }: SectorGroup) => (
  <>
    <span className="uppercase tracking-wider text-neutral truncate">{sector.sector}</span>
    <span className={`ml-auto shrink-0 font-bold ${tone(sector.sectorChange)}`}>{pct(sector.sectorChange)}</span>
  </>
);

const tile = ({ stock }: StockItem, w: number, h: number) => (
  <TileContent
    label={stock.symbol}
    sub={stock.name}
    change={stock.changePercent}
    w={w}
    h={h}
    icon={(size) => (
      <img src={logoUrl(stock.symbol)} alt="" width={size} height={size} draggable={false} decoding="async" referrerPolicy="no-referrer" onError={hideBrokenLogo} className="rounded-sm ring-1 ring-on-accent/25" style={{ width: size, height: size }} />
    )}
  />
);

const tooltip = ({ stock }: StockItem, { sector, items }: SectorGroup) => (
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
      <PeerRows items={items} current={stock.symbol} cap={CAP} name={(i) => (
        <>
          <span className="w-11 shrink-0 font-bold">{i.id}</span>
          <span className="truncate">{i.stock.name}</span>
        </>
      )} />
    </div>
  </>
);

export function HeatMapPanel() {
  const t = useT();
  const { data, isLoading } = useHeatMap();
  const selected = useAppStore((s) => s.selectedSymbol);
  const setSelectedSymbol = useAppStore((s) => s.setSelectedSymbol);

  const sectors = data ?? [];
  const groups = useMemo<SectorGroup[]>(() => (data ?? []).map((sector) => ({
    id: sector.sector,
    sector,
    // ponytail: missing cap gets a mid-size weight
    items: sector.stocks.map((stock) => ({ id: stock.symbol, weight: stock.marketCap || 1e10, change: stock.changePercent, stock })),
  })), [data]);
  const onPick = useMemo(() => ({
    stock: (i: StockItem) => setSelectedSymbol(i.id),
    sector: (g: SectorGroup) => setSelectedSymbol(g.sector.sectorSymbol),
  }), [setSelectedSymbol]);

  const advancers = sectors.reduce((n, s) => n + s.stocks.filter((st) => st.changePercent > 0).length, 0);
  const decliners = sectors.reduce((n, s) => n + s.stocks.filter((st) => st.changePercent < 0).length, 0);
  const sectorsUp = sectors.filter((s) => s.sectorChange >= 0).length;

  return (
    <div className="h-full flex flex-col bg-black overflow-hidden @container">
      {sectors.length > 0 && (
        <div className="flex items-center gap-3 px-2.5 h-7 border-b border-border shrink-0 text-micro font-mono">
          <span className="text-bullish">{sectorsUp} {t('hmSectorsUp')}</span>
          <span className="text-bearish">{sectors.length - sectorsUp} {t('hmSectorsDown')}</span>
          <span className="text-neutral hidden @min-[360px]:inline">
            <span className="text-bullish">▲ {advancers}</span> · <span className="text-bearish">▼ {decliners}</span>
          </span>
          <HeatLegend cap={CAP} className="ml-auto hidden @min-[560px]:flex" />
        </div>
      )}

      {isLoading && !data && (
        <div className="flex flex-col items-center justify-center flex-1 gap-2">
          <div className="w-5 h-5 border-2 border-accent/30 border-t-accent animate-spin" />
          <span className="text-mini font-mono text-neutral uppercase tracking-widest">{t('loading')}</span>
        </div>
      )}

      {!isLoading && sectors.length === 0 && (
        <div className="flex items-center justify-center flex-1">
          <span className="text-mini font-mono text-neutral uppercase tracking-widest">{t('hmNoData')}</span>
        </div>
      )}

      {sectors.length > 0 && (
        <HeatTreemap
          groups={groups}
          cap={CAP}
          selected={selected}
          onPick={onPick.stock}
          onPickGroup={onPick.sector}
          header={header}
          tile={tile}
          tooltip={tooltip}
        />
      )}
    </div>
  );
}
