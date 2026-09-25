// Self-check for the heat map treemap layout. Run: npx tsx scripts/check-treemap.mts
import assert from 'node:assert/strict';
import { squarify } from '../src/lib/treemap.ts';

const box = { x: 10, y: 20, w: 800, h: 450 };
const items = [3400, 3100, 2900, 800, 700, 300, 250, 90, 40].map((weight, i) => ({ id: `S${i}`, weight }));
const rects = squarify(items, box);
const total = items.reduce((a, i) => a + i.weight, 0);
const eps = 1e-6;

// Every item placed once, inside the box, with area proportional to its weight
assert.equal(rects.length, items.length);
for (const r of rects) {
  assert.ok(r.x >= box.x - eps && r.y >= box.y - eps && r.x + r.w <= box.x + box.w + eps && r.y + r.h <= box.y + box.h + eps, `${r.id} outside`);
  const want = (items.find((i) => i.id === r.id)!.weight / total) * box.w * box.h;
  assert.ok(Math.abs(r.w * r.h - want) < 1e-3, `${r.id} area ${r.w * r.h} ≠ ${want}`);
}

// No two tiles overlap, so together they fill the box exactly (no scroll, no holes)
for (const a of rects) for (const b of rects) {
  if (a === b) continue;
  const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  assert.ok(ox <= eps || oy <= eps, `${a.id} overlaps ${b.id}`);
}

// All-zero weights fall back to an even grid
assert.equal(squarify([{ id: 'a', weight: 0 }, { id: 'b', weight: 0 }], box).length, 2);

console.log('treemap: ok');
