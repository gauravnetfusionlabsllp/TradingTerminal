import { useEffect, useMemo, useState } from 'react';
import { useAppStore, type ThemeSetting } from '../stores/use-app-store';

export type Theme = 'dark' | 'light';

const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)');
const resolve = (s: ThemeSetting): Theme => (s === 'system' ? (darkQuery().matches ? 'dark' : 'light') : s);

// data-theme is written synchronously on every store change (not in an effect), so anything reading the tokens
// during the re-render that follows — the charts — already sees the new theme's values
let applied: Theme | null = null; // not the DOM: index.html's pre-paint script sets data-theme but not the meta
function apply() {
  const t = resolve(useAppStore.getState().settings.theme);
  if (applied === t) return;
  applied = t;
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#070b14' : '#e6eaf0');
}
apply();
useAppStore.subscribe(apply);
darkQuery().addEventListener('change', apply);

/** The theme actually on screen: the user's choice, with "system" following the OS */
export function useResolvedTheme(): Theme {
  const setting = useAppStore((s) => s.settings.theme);
  const [osDark, setOsDark] = useState(() => darkQuery().matches);
  useEffect(() => {
    const q = darkQuery();
    const on = () => setOsDark(q.matches);
    q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, []);
  return setting === 'system' ? (osDark ? 'dark' : 'light') : setting;
}

const TOKENS = ['bg', 'panel', 'raised', 'border', 'fg', 'neutral', 'accent', 'accent-ink', 'on-accent', 'bullish', 'bearish', 'orange', 'buy', 'sell'] as const;
export type ChartColors = Record<(typeof TOKENS)[number], string>;

/** Token hexes for canvas code (lightweight-charts can't resolve var()); re-read whenever the theme flips */
export function useChartColors(): ChartColors {
  const theme = useResolvedTheme();
  return useMemo(() => {
    const css = getComputedStyle(document.documentElement);
    return Object.fromEntries(TOKENS.map((t) => [t, css.getPropertyValue(`--color-${t}`).trim()])) as ChartColors;
  }, [theme]); // eslint-disable-line react-hooks/exhaustive-deps -- the DOM is the source; theme is the trigger
}

/** Hex with alpha: alpha('#26c28a', 0.5) → '#26c28a80' */
export const alpha = (hex: string, a: number) => hex + Math.round(a * 255).toString(16).padStart(2, '0');
