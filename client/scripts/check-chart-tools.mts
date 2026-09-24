// Self-check for the chart indicator/drawing helpers. Run: npx tsx scripts/check-chart-tools.mts
import assert from 'node:assert/strict';
import { snapTime, snapAnchors, plotKind, digitsFor, markerShape, studyLabel, longName, sentenceCase, tint, textOf, setTextOf } from '../src/lib/chart-tools.ts';

// Bars at 0, 300, 600 (M5): a time inside a bar snaps to its open; before the first bar there is none
const times = [0, 300, 600];
assert.equal(snapTime(times, 0), 0);
assert.equal(snapTime(times, 299), 0);
assert.equal(snapTime(times, 300), 300);
assert.equal(snapTime(times, 9999), 600);
assert.equal(snapTime(times, -1), null);
assert.equal(snapTime([], 5), null);

// Anchors: unchanged → same array (so a save can tell nothing moved); moved → snapped copies; too old → null
const exact = [{ time: 300, price: 1 }];
assert.equal(snapAnchors(exact, times), exact);
assert.deepEqual(snapAnchors([{ time: 310, price: 1 }, { time: 600, price: 2 }], times), [{ time: 300, price: 1 }, { time: 600, price: 2 }]);
assert.equal(snapAnchors([{ time: -5, price: 1 }], times), null);

assert.equal(plotKind('columns'), 'histogram');
assert.equal(plotKind('histogram'), 'histogram');
assert.equal(plotKind('circles'), 'points');
assert.equal(plotKind('cross'), 'points');
assert.equal(plotKind('stepline'), 'step');
assert.equal(plotKind('steplinebr'), 'step');
assert.equal(plotKind('linebr'), 'line');
assert.equal(plotKind(undefined), 'line');

assert.equal(digitsFor(64.49), 2); // RSI
assert.equal(digitsFor(0.00051), 7); // EURUSD MACD
assert.equal(digitsFor(250000), 0); // OBV
assert.equal(digitsFor(0), 2); // all-zero / empty
assert.equal(digitsFor(NaN), 2);

assert.equal(markerShape('labelUp'), 'arrowUp');
assert.equal(markerShape('triangleDown'), 'arrowDown');
assert.equal(markerShape('diamond'), 'square');
assert.equal(markerShape('xcross'), 'circle');

// Label stops at the first option/switch and skips source + offset
const sma = [
  { id: 'len', type: 'int', defval: 9 }, { id: 'src', type: 'source', defval: 'close' }, { id: 'offset', type: 'int', defval: 0 },
  { id: 'maType', type: 'string', defval: 'None' }, { id: 'maLength', type: 'int', defval: 14 },
];
assert.equal(studyLabel('SMA', sma, { len: 20 }), 'SMA 20');
assert.equal(studyLabel('SMA', sma, {}), 'SMA 9');
const macd = [{ id: 'f', type: 'int', defval: 12 }, { id: 's', type: 'int', defval: 26 }, { id: 'g', type: 'int', defval: 9 }, { id: 'x', type: 'int', defval: 1 }];
assert.equal(studyLabel('MACD', macd, {}), 'MACD 12 26 9');
assert.equal(studyLabel('VWAP', [], {}), 'VWAP');

assert.equal(longName('Simple Moving Average (SMA)', 'SMA'), 'Simple Moving Average');
assert.equal(longName('MACD', 'MACD'), 'MACD');

assert.equal(sentenceCase('Fibonacci Retracement'), 'Fibonacci retracement');
assert.equal(sentenceCase("Andrews' Pitchfork"), "Andrews' pitchfork");
assert.equal(sentenceCase('Trend-Based Fib Time'), 'Trend-based Fib time');
assert.equal(sentenceCase('Trend Line'), 'Trend line');

assert.equal(tint('#38bdf8', 0.08), 'rgba(56, 189, 248, 0.08)');

// Text accessors follow each tool's own getter/setter name
class Note { t = 'a'; getText() { return this.t; } setText(s: string) { this.t = s; } }
class Pin { l = 'p'; getLabel() { return this.l; } setLabel(s: string) { this.l = s; } }
const n = new Note(), p = new Pin();
setTextOf(n, 'b'); setTextOf(p, 'q');
assert.equal(textOf(n), 'b');
assert.equal(textOf(p), 'q');
assert.equal(textOf({}), undefined);

console.log('chart-tools: all assertions passed');
