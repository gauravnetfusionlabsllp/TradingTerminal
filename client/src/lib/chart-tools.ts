// Pure helpers for chart indicators + drawings. No imports so scripts/check-chart-tools.mts can assert them.

/** Color choices for drawings and indicator lines: the indicator palette + green / red for support and resistance */
export const SWATCHES = ['#e4e4e7', '#38bdf8', '#a78bfa', '#f472b6', '#2dd4bf', '#facc15', '#60a5fa', '#e879f9', '#22c55e', '#ef4444'];

/** Open time of the bar holding `t` (largest bar time ≤ t), or null before the first bar. `times` ascending. */
export function snapTime(times: number[], t: number): number | null {
  let lo = 0, hi = times.length - 1, hit = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (times[mid] <= t) { hit = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return hit < 0 ? null : times[hit];
}

/**
 * Drawing anchors on this timeframe's bars (a line drawn on M1 lands on the H4 bars that hold its points).
 * The same array back when nothing moved; null when an anchor is older than the loaded history.
 */
export function snapAnchors<A extends { time: unknown }>(anchors: A[], times: number[]): A[] | null {
  let moved = false;
  const out: A[] = [];
  for (const a of anchors) {
    const t = snapTime(times, a.time as number);
    if (t == null) return null;
    if (t !== a.time) moved = true;
    out.push({ ...a, time: t });
  }
  return moved ? out : anchors;
}

export type PlotKind = 'line' | 'histogram' | 'points' | 'step';

/** Pine plot styles → the series that draws them (area and linebr draw as lines; their gaps come from nulls) */
export function plotKind(style?: string): PlotKind {
  if (style === 'columns' || style === 'histogram') return 'histogram';
  if (style === 'circles' || style === 'cross') return 'points';
  if (style === 'stepline' || style === 'steplinebr') return 'step';
  return 'line';
}

/** Decimals for an indicator pane from its largest |value|: ~4 significant digits (RSI 64.49, EURUSD MACD 0.0001234, OBV 250000) */
export function digitsFor(maxAbs: number): number {
  if (!(maxAbs > 0) || !Number.isFinite(maxAbs)) return 2;
  return Math.min(8, Math.max(0, 3 - Math.floor(Math.log10(maxAbs))));
}

/** Pine marker shapes → the four shapes lightweight-charts draws */
export function markerShape(shape: string): 'circle' | 'square' | 'arrowUp' | 'arrowDown' {
  if (/up/i.test(shape)) return 'arrowUp';
  if (/down/i.test(shape)) return 'arrowDown';
  return shape === 'square' || shape === 'diamond' ? 'square' : 'circle';
}

interface InputDef { id: string; type: string; defval?: unknown }

/** Legend label: short name + the leading length-style inputs ("SMA 20", "MACD 12 26 9"), stopping at the first option/switch */
export function studyLabel(short: string, inputs: InputDef[], values: Record<string, unknown>): string {
  const nums: unknown[] = [];
  for (const i of inputs) {
    if (i.type === 'string' || i.type === 'bool' || nums.length === 3) break;
    if ((i.type === 'int' || i.type === 'float') && !/offset/i.test(i.id)) nums.push(values[i.id] ?? i.defval);
  }
  return [short, ...nums].join(' ');
}

/** "Simple Moving Average (SMA)" → "Simple Moving Average" (the short name is shown beside it) */
export function longName(name: string, short: string): string {
  const s = ` (${short})`;
  return name.endsWith(s) ? name.slice(0, -s.length) : name;
}

const PROPER = new Set(['Fibonacci', 'Fib', 'Gann', "Andrews'", 'Schiff']);

/** Library tool names are Title Case; the UI is sentence case, keeping names of people ("Andrews' pitchfork") */
export function sentenceCase(name: string): string {
  return name.split(' ').map((w, i) => (PROPER.has(w) ? w : i === 0 ? w[0] + w.slice(1).toLowerCase() : w.toLowerCase())).join(' ');
}

/** #rrggbb → rgba() at `alpha` (drawing fills) */
export function tint(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1, 7), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** Text of a text drawing: each tool names its getter differently; undefined for tools without text */
export function textOf(d: object): string | undefined {
  const t = d as { getText?(): string; getNote?(): string; getLabel?(): string };
  return t.getText?.() ?? t.getNote?.() ?? t.getLabel?.();
}

export function setTextOf(d: object, text: string): void {
  const t = d as { setText?(s: string): void; setNote?(s: string): void; setLabel?(s: string): void };
  (t.setText ?? t.setNote ?? t.setLabel)?.call(d, text);
}
