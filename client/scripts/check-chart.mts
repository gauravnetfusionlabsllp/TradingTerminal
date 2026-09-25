// Self-check for live tick folding + chart view keeping + on-chart trading rules. Run: npx tsx scripts/check-chart.mts
import assert from 'node:assert/strict';
import { tickBucket, foldTick, mergeLive, type Bar } from '../src/lib/live-candles.ts';
import { keepView } from '../src/lib/chart-view.ts';
import { snap, pendingTypesAt, levelSide, levelsError, pipSize, pips, levelAtPips, pendingTypeFor, draftEntry, draftRef, stackChips } from '../src/lib/chart-trading.ts';

const bar = (timestamp: number, close: number): Bar => ({ timestamp, open: close, high: close, low: close, close, volume: 5 });
const M5 = 300;
const OFFSET = 3 * 3600; // server ≈ UTC+3

// Bucketing: UTC tick → server-time M5 open → back to UTC; stale / REST (no ts) ticks ignored; unknown offset = null
const now = Date.UTC(2026, 8, 23, 12, 7, 30);
assert.equal(tickBucket(now, OFFSET, M5, now), Date.UTC(2026, 8, 23, 12, 5) / 1000);
assert.equal(tickBucket(undefined, OFFSET, M5, now), undefined);
assert.equal(tickBucket(now - 61_000, OFFSET, M5, now), undefined);
assert.equal(tickBucket(now, null, M5, now), null);
// H4 buckets follow server midnight, not UTC midnight: 12:07 UTC = 15:07 server → 12:00 server = 09:00 UTC
assert.equal(tickBucket(now, OFFSET, 14_400, now), Date.UTC(2026, 8, 23, 9) / 1000);

const base = [bar(0, 1.1), bar(300, 1.2)];

// Same bucket updates the newest bar (high/low/close), keeps its open and volume
let tail = foldTick([], base[1], 1.25, 300);
tail = foldTick(tail, base[1], 1.15, 300);
assert.deepEqual(tail, [{ timestamp: 300, open: 1.2, high: 1.25, low: 1.15, close: 1.15, volume: 5 }]);
assert.deepEqual(mergeLive(base, tail).map((b) => b.close), [1.1, 1.15]);

// Rollover opens a new bar; an older bucket is ignored
tail = foldTick(tail, base[1], 1.3, 600);
assert.equal(tail.length, 2);
assert.deepEqual(tail[1], { timestamp: 600, open: 1.3, high: 1.3, low: 1.3, close: 1.3, volume: 0 });
assert.equal(foldTick(tail, base[1], 9, 300).at(-1)!.close, 1.3);
assert.deepEqual(mergeLive(base, tail).map((b) => b.timestamp), [0, 300, 600]);

// Unknown offset: tick just moves the newest bar
assert.equal(foldTick(tail, base[1], 1.31, null).at(-1)!.close, 1.31);

// Refetch that already contains bar 600 absorbs the tail's older bars; the tail still wins on the shared bar
const refetched = [...base, bar(600, 1.29)];
assert.deepEqual(mergeLive(refetched, tail).map((b) => [b.timestamp, b.close]), [[0, 1.1], [300, 1.2], [600, 1.3]]);
tail = foldTick(tail, refetched[2], 1.35, 600);
assert.deepEqual(tail.map((b) => b.timestamp), [600]);
assert.equal(mergeLive(refetched, tail).length, 3);

// ── keepView (lightweight-charts range across setData) ──
// Older page prepended (300 → 600 bars): same right-anchored window
assert.deepEqual(keepView({ from: 183, to: 302 }, 300, 600, 0), { from: 483, to: 602 });
// At the live edge (3-bar right margin) a new bar shifts the window by 1
assert.deepEqual(keepView({ from: 183, to: 302 }, 300, 301, 1), { from: 184, to: 303 });
// Scrolled back: a new bar leaves the visible bars where they were
assert.deepEqual(keepView({ from: 100, to: 200 }, 300, 301, 1), { from: 100, to: 200 });
// Prepend + append together while scrolled back: still the same bars (indices shift by the prepended count)
assert.deepEqual(keepView({ from: 100, to: 200 }, 300, 601, 1), { from: 400, to: 500 });
// Tick on the last bar (no new bar): nothing moves
assert.deepEqual(keepView({ from: 183, to: 302 }, 300, 300, 0), { from: 183, to: 302 });

// ── On-chart trading rules ──
// bid 1.1000 / ask 1.1002: below both → buy limit + sell stop; inside the spread → both limits; above → buy stop + sell limit
assert.deepEqual(pendingTypesAt(1.0990, 1.1000, 1.1002), ['BUY_LIMIT', 'SELL_STOP']);
assert.deepEqual(pendingTypesAt(1.1001, 1.1000, 1.1002), ['BUY_LIMIT', 'SELL_LIMIT']);
assert.deepEqual(pendingTypesAt(1.1010, 1.1000, 1.1002), ['BUY_STOP', 'SELL_LIMIT']);
assert.ok(!pendingTypesAt(1.1010, 1.1000, 1.1002).includes('BUY_LIMIT')); // dragged buy limit above ask → refused

assert.equal(levelSide('BUY', 1.1, 1.09), 'sl');
assert.equal(levelSide('BUY', 1.1, 1.11), 'tp');
assert.equal(levelSide('SELL', 1.1, 1.11), 'sl');
assert.equal(levelSide('SELL', 1.1, 1.09), 'tp');

assert.equal(levelsError('BUY', 1.1, 1.09, 1.11), null);
assert.equal(levelsError('BUY', 1.1, 0, 0), null);
assert.match(levelsError('BUY', 1.1, 1.11, 0)!, /SL must be below/);
assert.match(levelsError('BUY', 1.1, 0, 1.09)!, /TP must be above/);
assert.equal(levelsError('SELL', 1.1, 1.11, 1.09), null);
assert.match(levelsError('SELL', 1.1, 1.09, 0)!, /SL must be above/);

// Position modify: the reference is the closing price (BUY closes at bid), not the open price. A BUY opened at 1.08
// and now at bid 1.10 may trail its SL into profit (1.09) but not past the market (1.101).
assert.equal(levelsError('BUY', 1.1, 1.09, 1.11), null);
assert.match(levelsError('BUY', 1.1, 1.101, 0)!, /SL must be below/);
// Right-click → '#t: SL/TP → price' on that position (open 1.08): anywhere under the bid is its SL, even above the open
assert.equal(levelSide('BUY', 1.1, 1.085), 'sl');
assert.equal(levelSide('SELL', 1.1, 1.095), 'tp');

// Pips: 10 points on 3- and 5-digit quotes. Gold 4294.161 → SL 4289.327 is −483.4 pips (the Exness readout)
assert.equal(pipSize(5), 0.0001);
assert.equal(pipSize(3), 0.01);
assert.equal(pipSize(2), 0.01);
assert.equal(pips('BUY', 4294.161, 4289.327, 3), -483.4);
assert.equal(pips('SELL', 1.10000, 1.09950, 5), 5);
assert.equal(levelAtPips('BUY', 'sl', 4294.161, 483.4, 3), 4289.327);
assert.equal(levelAtPips('BUY', 'tp', 1.1, -10, 5), 1.101); // a distance: the sign is ignored
assert.equal(levelAtPips('SELL', 'sl', 1.1, 10, 5), 1.101);
assert.equal(levelAtPips('SELL', 'tp', 1.1, 10, 5), 1.099);

// A pending draft's type follows its price; at the market there is none (it would fill)
assert.equal(pendingTypeFor('BUY', 1.0990, 1.1000, 1.1002), 'BUY_LIMIT');
assert.equal(pendingTypeFor('BUY', 1.1010, 1.1000, 1.1002), 'BUY_STOP');
assert.equal(pendingTypeFor('SELL', 1.0990, 1.1000, 1.1002), 'SELL_STOP');
assert.equal(pendingTypeFor('BUY', 1.1002, 1.1000, 1.1002), null);
// A market BUY opens at the ask and closes at the bid (its SL / TP bracket the bid); a pending one uses its price
const q = { bid: 1.1, ask: 1.1002 };
assert.equal(draftEntry({ side: 'BUY', kind: 'MARKET', price: 0 }, q), 1.1002);
assert.equal(draftRef({ side: 'BUY', kind: 'MARKET', price: 0 }, q), 1.1);
assert.equal(draftEntry({ side: 'SELL', kind: 'MARKET', price: 0 }, q), 1.1);
assert.equal(draftRef({ side: 'SELL', kind: 'PENDING', price: 1.2 }, q), 1.2);
assert.equal(draftEntry({ side: 'BUY', kind: 'MARKET', price: 0 }), 0);

// Chips: apart → all at the edge; overlapping → the lower one moves left past the upper; a third overlapping both → past both
assert.deepEqual(stackChips([{ y: 10, h: 20, w: 100 }, { y: 50, h: 20, w: 80 }], 4), [0, 0]);
assert.deepEqual(stackChips([{ y: 18, h: 20, w: 80 }, { y: 10, h: 20, w: 100 }], 4), [104, 0]);
assert.deepEqual(stackChips([{ y: 10, h: 20, w: 100 }, { y: 15, h: 20, w: 50 }, { y: 20, h: 20, w: 30 }], 4), [0, 104, 158]);

assert.equal(snap(1.0850049, 5), 1.085);
assert.equal(snap(151.2346, 3), 151.235);

console.log('chart: all assertions passed');
