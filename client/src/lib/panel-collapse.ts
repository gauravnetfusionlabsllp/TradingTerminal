// Size math for collapsing dock panels past their minimum. Pure — checked by scripts/check-collapse.mts

export type Axis = 'w' | 'h';

/** Width of a collapsed rail — the tab strip's height, so a rail is the strip turned on its side */
export const RAIL = 28;
/** How far past a panel's minimum the pointer must go before release collapses it */
export const SNAP_PAST = 32;
/** A reopened panel is never smaller than this, however small it was when it collapsed */
export const OPEN_MIN: Record<Axis, number> = { w: 240, h: 160 };
/** Tabset attributes a collapse overrides — snapshotted first and put back on reopen */
export const MANAGED = ['minWidth', 'maxWidth', 'minHeight', 'maxHeight', 'classNameTabStrip'] as const;

/** Child i shrinks to a rail; the space it frees goes to child `into` (the one across the dragged splitter) */
export function collapseSizes(sizes: number[], i: number, into: number): number[] {
  const out = [...sizes];
  out[into] += out[i] - RAIL;
  out[i] = RAIL;
  return out;
}

/** Grow child i to `target`, taking from the largest open siblings first, never below their minimum */
export function expandSizes(sizes: number[], mins: number[], open: boolean[], i: number, target: number): number[] {
  const out = [...sizes];
  let need = target - out[i];
  const donors = out.map((_, j) => j).filter((j) => j !== i && open[j]).sort((a, b) => out[b] - out[a]);
  for (const j of donors) {
    if (need <= 0) break;
    const give = Math.min(need, Math.max(0, out[j] - mins[j]));
    out[j] -= give;
    out[i] += give;
    need -= give;
  }
  return out;
}

/** Pixel sizes → flexlayout weights, normalised the way its own splitter does */
export function toWeights(sizes: number[]): number[] {
  const sum = sizes.reduce((a, b) => a + b, 0);
  return sizes.map((s) => (Math.max(0.1, s) * 100) / sum);
}

export interface Side { start: number; end: number; min: number; eligible: boolean }

/**
 * Which neighbour of a dragged splitter would collapse on release. `pos` is where the splitter's leading
 * edge would be if flexlayout didn't clamp it — measured from the pointer, since the outline stops at the minimum.
 */
export function snapTarget(pos: number, before: Side, after: Side, splitter: number): 'before' | 'after' | null {
  if (before.eligible && pos - before.start < before.min - SNAP_PAST) return 'before';
  if (after.eligible && after.end - (pos + splitter) < after.min - SNAP_PAST) return 'after';
  return null;
}
