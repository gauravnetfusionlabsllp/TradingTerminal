import { useMemo } from 'react';
import { Cable, Coins, Droplet, Flame, Globe, Wheat, type LucideIcon } from 'lucide-react';
import {
  useMacroHeatmap,
  type MacroCategory,
  type MacroIndicator,
  type MacroRegion,
  type RegionSentiment,
  type GlobalSentiment,
} from '../../api/hooks/use-macro-heatmap';
import { useAppStore } from '../../stores/use-app-store';
import { useT, tr } from '../../i18n';
import { CHAR_W, HeatLegend, HeatTreemap, PeerRows, TileContent, pct, tone } from '../common/heat-treemap';

// Index moves are smaller than single stocks', so the scale saturates sooner
const CAP = 1.5;

const SHORT: Record<string, string> = { '^GSPC': 'SPX', '^STOXX50E': 'SX5E', 'DX-Y.NYB': 'DXY' };
const short = (symbol: string) => SHORT[symbol] ?? symbol.replace(/^\^|=F$|-USD$/g, '');

const CATEGORY: Record<MacroCategory, string> = {
  equity: 'Equity', rate: 'Rates', credit: 'Credit', fx: 'FX', vol: 'Volatility', commodity: 'Commodity', crypto: 'Crypto',
};

// Every tile gets a square badge: the market's flag, the coin's logo, or a commodity glyph
const REGION_FLAG: Record<string, string> = { US: 'us', Europe: 'eu' };
const SYMBOL_FLAG: Record<string, string | null> = {
  EWJ: 'jp', '^N225': 'jp', FXI: 'cn', MCHI: 'cn', KWEB: 'cn', '^HSI': 'hk', EEM: null, IGOV: null,
};
const COMMODITY: Record<string, { Icon: LucideIcon; bg: string }> = {
  'CL=F': { Icon: Droplet, bg: '#26303d' },
  'NG=F': { Icon: Flame, bg: '#1f5fbf' },
  'GC=F': { Icon: Coins, bg: '#b08a1e' },
  'HG=F': { Icon: Cable, bg: '#a8582a' },
  DBA: { Icon: Wheat, bg: '#5f7d2a' },
};
const hideBroken = (e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.display = 'none'; };

function Badge({ ind, region, size }: { ind: MacroIndicator; region: string; size: number }) {
  const box = { width: size, height: size };
  const img = (src: string) => (
    <img src={src} alt="" width={size} height={size} draggable={false} decoding="async" referrerPolicy="no-referrer" onError={hideBroken} className="rounded-sm ring-1 ring-on-accent/25 object-cover" style={box} />
  );
  if (ind.category === 'crypto') return img(`https://assets.parqet.com/logos/crypto/${ind.symbol.replace('-USD', '')}`);
  const flag = ind.symbol in SYMBOL_FLAG ? SYMBOL_FLAG[ind.symbol] : REGION_FLAG[region];
  if (flag) return img(`https://cdn.jsdelivr.net/npm/flag-icons@7/flags/1x1/${flag}.svg`);
  const { Icon, bg } = COMMODITY[ind.symbol] ?? { Icon: Globe, bg: '#34425a' };
  return (
    <span className="rounded-sm ring-1 ring-on-accent/25 flex items-center justify-center text-on-accent" style={{ ...box, background: bg }}>
      <Icon style={{ width: size * 0.58, height: size * 0.58 }} strokeWidth={2} />
    </span>
  );
}

const SENTIMENT: Record<RegionSentiment, { label: string; cls: string }> = {
  bullish: { label: 'BULL', cls: 'text-bullish' },
  neutral: { label: 'NEUT', cls: 'text-neutral' },
  bearish: { label: 'BEAR', cls: 'text-bearish' },
};
const GLOBAL: Record<GlobalSentiment, { label: string; cls: string }> = {
  risk_on: { label: 'RISK ON', cls: 'text-bullish' },
  mixed: { label: 'MIXED', cls: 'text-orange' },
  risk_off: { label: 'RISK OFF', cls: 'text-bearish' },
};

const price = (n: number) => (n > 0 ? n.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—');

interface MacroItem { id: string; weight: number; change: number; ind: MacroIndicator; region: string }
interface RegionGroup { id: string; items: MacroItem[]; region: MacroRegion }

const header = ({ region }: RegionGroup) => (
  <>
    <span className="uppercase tracking-wider text-neutral truncate">{region.name}</span>
    <span className={`shrink-0 px-1 border border-current leading-[12px] ${SENTIMENT[region.sentiment].cls}`}>{SENTIMENT[region.sentiment].label}</span>
    <span className={`ml-auto shrink-0 font-bold ${tone(region.avgChange)}`}>{pct(region.avgChange)}</span>
  </>
);

// The name when it fits legibly ("S&P 500" over "SPX"), with the ticker under it on big tiles
const tile = ({ ind, region }: MacroItem, w: number, h: number) => {
  const named = (w - 8) / (CHAR_W * ind.name.length) >= 11;
  return (
    <TileContent
      label={named ? ind.name : short(ind.symbol)}
      sub={named ? short(ind.symbol) : undefined}
      change={ind.changePct}
      w={w}
      h={h}
      icon={(size) => <Badge ind={ind} region={region} size={size} />}
    />
  );
};

const tooltip = ({ ind, region }: MacroItem, { items }: RegionGroup) => (
  <>
    <div className="flex items-center gap-2 px-2.5 py-2">
      <Badge ind={ind} region={region} size={32} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-bold text-fg truncate">{ind.name}</span>
          <span className={`ml-auto shrink-0 text-xs font-bold ${tone(ind.changePct)}`}>{pct(ind.changePct)}</span>
        </div>
        <div className="flex items-baseline gap-2 text-micro text-neutral">
          <span className="truncate">{ind.symbol} · {CATEGORY[ind.category]}</span>
          <span className="ml-auto shrink-0 text-fg">{price(ind.price)}</span>
        </div>
      </div>
    </div>
    <div className="border-t border-border py-1">
      <div className="px-2.5 pb-0.5 text-micro uppercase tracking-wider text-neutral">{region}</div>
      <PeerRows items={items} current={ind.symbol} cap={CAP} name={(i) => <span className="truncate">{i.ind.name}</span>} />
    </div>
  </>
);

export function MacroHeatmapPanel() {
  const t = useT();
  const { data, isLoading } = useMacroHeatmap();
  const selected = useAppStore((s) => s.selectedSymbol);
  const setSelectedSymbol = useAppStore((s) => s.setSelectedSymbol);

  const regions = data?.regions ?? [];
  // ponytail: equal weights (no caps for indices, yields, futures) — a region's area is its instrument count
  const groups = useMemo<RegionGroup[]>(() => (data?.regions ?? []).map((region) => ({
    id: region.name,
    region,
    items: region.indicators.map((ind) => ({ id: ind.symbol, weight: 1, change: ind.changePct, ind, region: region.name })),
  })), [data]);
  // Yahoo tickers: the chart and ticket map them to the account's MT5 names (^GSPC → US500, GC=F → XAUUSD)
  const onPick = useMemo(() => (i: MacroItem) => setSelectedSymbol(i.id), [setSelectedSymbol]);

  const regionsUp = regions.filter((r) => r.avgChange >= 0).length;
  const mood = data && GLOBAL[data.globalSentiment];

  return (
    <div className="h-full flex flex-col bg-black overflow-hidden @container">
      {data && regions.length > 0 && (
        <div className="flex items-center gap-3 px-2.5 h-7 border-b border-border shrink-0 text-micro font-mono">
          <span className={`px-1 border border-current font-bold ${mood!.cls}`}>{mood!.label}</span>
          <span className="flex items-center gap-2 text-neutral" title="Risk score: 0 = risk off, 100 = risk on">
            Risk <span className="text-fg font-bold">{data.riskScore}</span>
            <span
              className="relative w-24 h-1.5 hidden @min-[300px]:block"
              style={{ background: 'linear-gradient(90deg, var(--color-bearish), var(--color-neutral), var(--color-bullish))' }}
            >
              <span className="absolute -top-1 -bottom-1 w-0.5 -ml-px bg-fg" style={{ left: `${data.riskScore}%` }} />
            </span>
          </span>
          <span className="hidden @min-[440px]:inline">
            <span className="text-bullish">{regionsUp} up</span> · <span className="text-bearish">{regions.length - regionsUp} down</span>
          </span>
          <HeatLegend cap={CAP} className="ml-auto hidden @min-[640px]:flex" />
        </div>
      )}

      {isLoading && !data && (
        <div className="flex flex-col items-center justify-center flex-1 gap-2">
          <div className="w-5 h-5 border-2 border-accent/30 border-t-accent animate-spin" />
          <span className="text-mini font-mono text-neutral uppercase tracking-widest">{tr(t, 'loading', 'Loading...')}</span>
        </div>
      )}

      {!isLoading && regions.length === 0 && (
        <div className="flex items-center justify-center flex-1">
          <span className="text-mini font-mono text-neutral uppercase tracking-widest">No macro data available</span>
        </div>
      )}

      {regions.length > 0 && (
        <HeatTreemap groups={groups} cap={CAP} selected={selected} onPick={onPick} header={header} tile={tile} tooltip={tooltip} />
      )}
    </div>
  );
}
