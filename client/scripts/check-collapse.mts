// Self-check for panel collapse size math. Run: npx tsx scripts/check-collapse.mts
import assert from 'node:assert/strict';
import { RAIL, SNAP_PAST, collapseSizes, expandSizes, toWeights, snapTarget } from '../src/lib/panel-collapse.ts';

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

// Collapse: the rail keeps RAIL px, the neighbour across the splitter gets the rest, nothing is lost
const before = [300, 900, 400];
const folded = collapseSizes(before, 0, 1);
assert.deepEqual(folded, [RAIL, 900 + 300 - RAIL, 400]);
assert.equal(sum(folded), sum(before));

// Reopen at the old share: the largest open sibling (the one that got the space) gives it back exactly
const mins = [80, 80, 80];
assert.deepEqual(expandSizes(folded, mins, [false, true, true], 0, 300), before);

// Largest first, then the next — and never below a donor's minimum
assert.deepEqual(expandSizes([RAIL, 200, 150], mins, [false, true, true], 0, 300), [RAIL + 120 + 70, 80, 80]);
// Collapsed siblings never donate
assert.deepEqual(expandSizes([RAIL, RAIL, 500], mins, [false, false, true], 0, 300), [300, RAIL, 228]);

// Weights: proportional, summing to 100, never zero
const w = toWeights([RAIL, 1172, 400]);
assert.ok(Math.abs(sum(w) - 100) < 1e-9);
assert.ok(Math.abs(w[1] / w[2] - 1172 / 400) < 1e-9);

// Snap: only once the pointer is SNAP_PAST beyond the minimum, only for an eligible side
const left = { start: 0, end: 300, min: 80, eligible: true };
const right = { start: 304, end: 1000, min: 80, eligible: true };
assert.equal(snapTarget(80, left, right, 4), null); // at the minimum
assert.equal(snapTarget(80 - SNAP_PAST + 1, left, right, 4), null); // inside the dead zone
assert.equal(snapTarget(80 - SNAP_PAST - 1, left, right, 4), 'before');
assert.equal(snapTarget(80 - SNAP_PAST - 1, { ...left, eligible: false }, right, 4), null);
assert.equal(snapTarget(1000 - 4 - 80 + SNAP_PAST + 1, left, right, 4), 'after');
assert.equal(snapTarget(500, left, right, 4), null); // an ordinary resize

console.log('check-collapse: ok');
