// Self-check for the SGFX theme tokens. Run: npx tsx scripts/check-theme.mts
// Every colour token has a light value, text tokens stay readable (WCAG AA) in both themes, and the old
// black-terminal literals don't creep back into components.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const block = (start: string) => {
  const i = css.indexOf(start);
  assert.ok(i >= 0, `index.css has no ${start}`);
  return css.slice(i, css.indexOf('}', i));
};
const hexes = (src: string) => Object.fromEntries([...src.matchAll(/--color-([a-z-]+):\s*(#[0-9a-f]{6})\b/gi)].map(([, k, v]) => [k, v]));
const dark = hexes(block('@theme'));
const light = hexes(block('[data-theme="light"]'));

for (const k of Object.keys(dark)) assert.ok(light[k], `--color-${k} has no light value`);

const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const TEXT = ['fg', 'neutral', 'accent-ink', 'bullish', 'bearish', 'orange'];
for (const [name, t] of [['dark', dark], ['light', light]] as const) {
  for (const fg of TEXT) for (const bg of ['panel', 'raised']) {
    const c = contrast(t[fg], t[bg]);
    assert.ok(c >= 4.5, `${name}: ${fg} on ${bg} is ${c.toFixed(2)}:1, needs 4.5`);
  }
  for (const bg of ['accent', 'sell']) {
    const c = contrast(t['on-accent'], t[bg]);
    assert.ok(c >= 4.5, `${name}: on-accent on ${bg} is ${c.toFixed(2)}:1, needs 4.5`);
  }
}

// Old terminal literals that bypass the theme
const BANNED: [RegExp, string][] = [
  [/bg-\[#0[0-9a-f]{2,5}\]/i, 'hardcoded near-black background (use bg-raised / bg-panel)'],
  [/#ff9900/i, 'the old amber accent (use accent / accent-ink)'],
  [/rgba\(\s*255\s*,\s*255\s*,\s*255\s*,/, 'white rgba (use color-mix with var(--color-fg))'],
  [/text-\[[5-8](?:\.5)?px\]/, 'text under 9px (use text-micro)'],
];
const bad: string[] = [];
const walk = (d: string) => {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.tsx')) readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
      for (const [re, why] of BANNED) if (re.test(line)) bad.push(`${p}:${i + 1}  ${why}`);
    });
  }
};
walk(new URL('../src/components', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
assert.deepEqual(bad, [], `\n${bad.join('\n')}`);

console.log(`theme ok: ${Object.keys(dark).length} colour tokens, contrast AA in dark and light`);
