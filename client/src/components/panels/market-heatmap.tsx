import { useMemo } from 'react';
import { useWatchlist, type WatchlistItem } from '../../api/hooks/use-watchlist';
import { useAppStore } from '../../stores/use-app-store';

interface TileData {
  symbol: string;
  price: number;
  changePercent: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

function getHeatmapColor(change: number): string {
  if (change > 3) return '#00ff00'; // Bright Green
  if (change > 1.5) return 'var(--color-green-500)';
  if (change > 0) return 'var(--color-green-700)';
  if (change === 0) return 'var(--color-zinc-800)';
  if (change > -1.5) return 'var(--color-red-900)';
  if (change > -3) return 'var(--color-red-700)';
  return 'var(--color-red-500)'; // Bright Red
}

function computeTreemap(items: WatchlistItem[]): TileData[] {
  const valid = items
    .filter((it) => it.quote)
    .map((it) => ({
      symbol: it.symbol,
      price: it.quote!.price,
      changePercent: it.quote!.changePercent ?? 0,
      weight: it.quote!.marketCap ?? 1,
    }))
    .sort((a, b) => b.weight - a.weight);

  if (valid.length === 0) return [];

  const totalWeight = valid.reduce((s, v) => s + v.weight, 0);

  const tiles: TileData[] = [];

  function layout(
    entries: typeof valid,
    x: number,
    y: number,
    w: number,
    h: number,
    horizontal: boolean,
  ) {
    if (entries.length === 0) return;
    if (entries.length === 1) {
      tiles.push({
        symbol: entries[0].symbol,
        price: entries[0].price,
        changePercent: entries[0].changePercent,
        x, y, width: w, height: h,
      });
      return;
    }

    const subTotal = entries.reduce((s, e) => s + e.weight, 0);
    let acc = 0;
    let splitIdx = 0;
    for (let i = 0; i < entries.length - 1; i++) {
      acc += entries[i].weight;
      if (acc >= subTotal / 2) {
        splitIdx = i + 1;
        break;
      }
    }
    if (splitIdx === 0) splitIdx = 1;

    const ratio = acc / subTotal;
    const left = entries.slice(0, splitIdx);
    const right = entries.slice(splitIdx);

    if (horizontal) {
      layout(left, x, y, w * ratio, h, !horizontal);
      layout(right, x + w * ratio, y, w * (1 - ratio), h, !horizontal);
    } else {
      layout(left, x, y, w, h * ratio, !horizontal);
      layout(right, x, y + h * ratio, w, h * (1 - ratio), !horizontal);
    }
  }

  layout(valid, 0, 0, 100, 100, true);
  return tiles;
}

export function MarketHeatmap() {
  const { data: items } = useWatchlist();
  const setSelectedSymbol = useAppStore((s) => s.setSelectedSymbol);

  const tiles = useMemo(() => computeTreemap(items || []), [items]);

  if (tiles.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-neutral text-mini font-mono uppercase tracking-widest bg-black">
        NO MARKET DATA AVAILABLE
      </div>
    );
  }

  return (
    <div className="flex-1 relative min-h-0 overflow-hidden bg-black">
      {tiles.map((tile) => (
        <button
          key={tile.symbol}
          onClick={() => setSelectedSymbol(tile.symbol)}
          className="absolute flex flex-col items-center justify-center transition-colors border border-black hover:border-white z-0 hover:z-10"
          style={{
            left: `${tile.x}%`,
            top: `${tile.y}%`,
            width: `${tile.width}%`,
            height: `${tile.height}%`,
            backgroundColor: getHeatmapColor(tile.changePercent),
          }}
        >
          <span className="font-mono font-bold text-black text-[12px] leading-none mix-blend-plus-lighter" style={{ color: Math.abs(tile.changePercent) > 1.5 ? 'var(--color-black)' : 'var(--color-white)' }}>
            {tile.symbol}
          </span>
          {tile.width > 8 && tile.height > 12 && (
            <>
              <span className="font-mono text-mini mt-0.5 font-bold" style={{ color: Math.abs(tile.changePercent) > 1.5 ? 'var(--color-black)' : 'var(--color-white)' }}>
                {tile.changePercent >= 0 ? '+' : ''}{tile.changePercent.toFixed(2)}%
              </span>
              <span className="font-mono text-mini mt-0.5" style={{ color: Math.abs(tile.changePercent) > 1.5 ? 'rgba(0,0,0,0.7)' : 'color-mix(in srgb, var(--color-white) 70%, transparent)' }}>
                {tile.price.toFixed(2)}
              </span>
            </>
          )}
        </button>
      ))}
    </div>
  );
}
