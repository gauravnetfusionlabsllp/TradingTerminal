import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { squarify } from '../../lib/treemap';

// Diverging scale: flat grey → green / red, saturating at ±cap %. Fixed across themes: tiles are their own surface with white ink
const FLAT = [58, 63, 78];
const UP = [30, 142, 78];
const DOWN = [204, 48, 56];
export function heatColor(chg: number, cap: number): string {
  const t = Math.min(Math.abs(chg) / cap, 1);
  const to = chg >= 0 ? UP : DOWN;
  return `rgb(${FLAT.map((f, i) => Math.round(f + (to[i] - f) * t)).join(',')})`;
}

export const pct = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(2)}%`;
export const tone = (n: number) => (n >= 0 ? 'text-bullish' : 'text-bearish');
export const CHAR_W = 0.62; // JetBrains Mono advance per em

const HEADER_H = 18;

export interface HeatItem { id: string; weight: number; change: number }
export interface HeatGroup<T extends HeatItem> { id: string; items: T[] }
interface Tile<T, G> { item: T; group: G; x: number; y: number; w: number; h: number }
interface Block<G> { group: G; x: number; y: number; w: number; h: number; header: boolean }

/** Groups sized by their items' combined weight, items by their own; edges snapped to whole pixels so seams stay crisp */
function layout<T extends HeatItem, G extends HeatGroup<T>>(groups: G[], width: number, height: number) {
  const byId = new Map(groups.map((g) => [g.id, g]));
  const snap = (x: number, y: number, w: number, h: number) => {
    const l = Math.round(x), t = Math.round(y);
    return { x: l, y: t, w: Math.round(x + w) - l, h: Math.round(y + h) - t };
  };
  const blocks: Block<G>[] = [];
  const tiles: Tile<T, G>[] = [];
  const items = groups.map((g) => ({ id: g.id, weight: g.items.reduce((a, i) => a + i.weight, 0) }));
  for (const r of squarify(items, { x: 0, y: 0, w: width, h: height })) {
    const group = byId.get(r.id)!;
    const b = snap(r.x + 1, r.y + 1, Math.max(r.w - 2, 0), Math.max(r.h - 2, 0)); // 2px gutter between groups
    const header = b.h >= 56 && b.w >= 64;
    blocks.push({ group, ...b, header });
    const top = b.y + (header ? HEADER_H : 0);
    const byItem = new Map(group.items.map((i) => [i.id, i]));
    for (const ir of squarify(group.items, { x: b.x, y: top, w: b.w, h: b.h - (top - b.y) })) {
      const t = snap(ir.x, ir.y, ir.w, ir.h);
      tiles.push({ item: byItem.get(ir.id)!, group, ...t, w: Math.max(t.w - 1, 0), h: Math.max(t.h - 1, 0) }); // 1px seam
    }
  }
  return { blocks, tiles };
}

/** Content grows with the tile: nothing → label → + change → + icon → + subtitle */
export function TileContent({ label, sub, change, icon, w, h }: {
  label: string;
  sub?: string;
  change: number;
  icon?: (size: number) => ReactNode;
  w: number;
  h: number;
}) {
  const text = pct(change);
  const room = w - 8;
  const lbl = Math.min(32, Math.sqrt(w * h) / 5, room / (CHAR_W * label.length), h * 0.6);
  if (lbl < 9) return null;
  const chg = Math.min(lbl * 0.7, room / (CHAR_W * text.length));
  const showChg = chg >= 9 && (lbl + chg) * 1.2 <= h - 4;
  let used = (lbl + (showChg ? chg : 0)) * 1.2;
  const size = Math.floor(Math.min(64, Math.sqrt(w * h) / 3.2, room, h - used - 14));
  const showIcon = !!icon && showChg && size >= 20;
  if (showIcon) used += size + 4;
  const subFs = Math.min(12, lbl * 0.45);
  const showSub = !!sub && showChg && subFs >= 10 && used + subFs * 1.3 <= h - 8;
  return (
    <>
      {showIcon && <span className="mb-1 shrink-0 flex">{icon!(size)}</span>}
      <span className="font-bold leading-[1.2]" style={{ fontSize: lbl }}>{label}</span>
      {showSub && <span className="leading-[1.3] opacity-75 truncate max-w-full px-1" style={{ fontSize: subFs }}>{sub}</span>}
      {showChg && <span className="font-medium leading-[1.2] opacity-90" style={{ fontSize: chg }}>{text}</span>}
    </>
  );
}

/** The heat scale key, in the same colours as the tiles */
export function HeatLegend({ cap, className = '' }: { cap: number; className?: string }) {
  return (
    <div className={`flex ${className}`} aria-label="Colour scale: daily change">
      {[-3, -2, -1, 0, 1, 2, 3].map((i) => {
        const v = (i * cap) / 3;
        return (
          <span key={i} className="w-9 py-px text-center text-on-accent" style={{ backgroundColor: heatColor(v, cap) }}>
            {`${v > 0 ? '+' : v < 0 ? '−' : ''}${+Math.abs(v).toFixed(1)}%`}
          </span>
        );
      })}
    </div>
  );
}

/**
 * A treemap that fills whatever the dock gives it (tab, split, maximised) and re-lays out on every resize — it never
 * scrolls. Callers supply the words: group strip, tile content, tooltip.
 */
export function HeatTreemap<T extends HeatItem, G extends HeatGroup<T>>({ groups, cap, selected, onPick, onPickGroup, header, tile, tooltip }: {
  groups: G[];
  cap: number;
  selected?: string | null;
  onPick: (item: T) => void;
  onPickGroup?: (group: G) => void;
  header: (group: G) => ReactNode;
  tile: (item: T, w: number, h: number) => ReactNode;
  tooltip: (item: T, group: G) => ReactNode;
}) {
  const areaRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hover, setHover] = useState<Tile<T, G> | null>(null);

  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.floor(e.contentRect.width), h: Math.floor(e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { blocks, tiles } = useMemo(
    () => (size.w > 0 && size.h > 0 ? layout<T, G>(groups, size.w, size.h) : { blocks: [], tiles: [] }),
    [groups, size],
  );

  // Tiles don't re-render on hover: only the tooltip does
  const layer = useMemo(() => (
    <>
      {blocks.filter((b) => b.header).map((b) => {
        const Strip = onPickGroup ? 'button' : 'div';
        return (
          <Strip
            key={b.group.id}
            {...(onPickGroup && { type: 'button' as const, onClick: () => onPickGroup(b.group) })}
            className={`absolute flex items-center gap-1.5 px-1 text-micro font-mono leading-none ${onPickGroup ? 'hover:bg-hover transition-colors' : ''}`}
            style={{ left: b.x, top: b.y, width: b.w, height: HEADER_H - 1 }}
          >
            {header(b.group)}
          </Strip>
        );
      })}
      {tiles.map((t) => (
        <button
          key={t.item.id}
          type="button"
          aria-label={`${t.item.id} ${pct(t.item.change)}`}
          onClick={() => onPick(t.item)}
          onMouseEnter={() => setHover(t)}
          className="absolute flex flex-col items-center justify-center overflow-hidden font-mono text-on-accent [text-shadow:0_1px_1px_rgb(0_0_0/0.35)] hover:shadow-[inset_0_0_0_2px_var(--color-on-accent)]"
          style={{ left: t.x, top: t.y, width: t.w, height: t.h, backgroundColor: heatColor(t.item.change, cap) }}
        >
          {tile(t.item, t.w, t.h)}
          {/* the charted symbol: the corner flag (drawn inline: .corner-flag would force position: relative) */}
          {selected === t.item.id && <span className="absolute top-0 right-0 w-2 h-2 bg-accent [clip-path:polygon(0_0,100%_0,100%_100%)]" />}
        </button>
      ))}
    </>
  ), [blocks, tiles, cap, selected, onPick, onPickGroup, header, tile]);

  // Follow the pointer by moving the tooltip directly: no React render per mouse move
  const onMove = (e: React.MouseEvent) => {
    const tip = tipRef.current, area = areaRef.current;
    if (!tip || !area) return;
    const r = area.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const left = x + 14 + tip.offsetWidth > r.width ? x - 14 - tip.offsetWidth : x + 14;
    const top = Math.min(y + 14, r.height - tip.offsetHeight);
    tip.style.transform = `translate(${Math.max(left, 0)}px, ${Math.max(top, 0)}px)`;
  };

  return (
    <div ref={areaRef} className="relative flex-1 min-h-0 overflow-hidden" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      {layer}
      <div
        ref={tipRef}
        className={`absolute left-0 top-0 z-10 w-64 pointer-events-none bg-raised border border-border shadow-lg font-mono ${hover ? '' : 'hidden'}`}
      >
        {hover && <div key={hover.item.id}>{tooltip(hover.item, hover.group)}</div>}
      </div>
    </div>
  );
}

/** Tooltip list of a tile's group, the hovered one highlighted */
export function PeerRows<T extends HeatItem>({ items, current, cap, name }: { items: T[]; current: string; cap: number; name: (item: T) => ReactNode }) {
  return items.map((i) => (
    <div key={i.id} className={`flex items-center gap-2 px-2.5 text-micro ${i.id === current ? 'bg-hover text-fg' : 'text-neutral'}`}>
      <span className="w-1.5 h-1.5 shrink-0" style={{ backgroundColor: heatColor(i.change, cap) }} />
      {name(i)}
      <span className={`ml-auto shrink-0 ${tone(i.change)}`}>{pct(i.change)}</span>
    </div>
  ));
}
