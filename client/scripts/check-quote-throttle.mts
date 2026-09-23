// Self-check for the live-price throttle setting. Run: npx tsx scripts/check-quote-throttle.mts
import assert from 'node:assert/strict';
import { createQuoteThrottle } from '../src/lib/quote-throttle.ts';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const q = (symbol: string, bid: number) => ({ symbol, bid });
let ms = 0;
const writes: Record<string, { symbol: string; bid: number }>[] = [];
const push = createQuoteThrottle((w) => writes.push(w), () => ms);

// Off: every batch is written on arrival
push([q('EURUSD', 1)]);
push([q('EURUSD', 2)]);
assert.deepEqual(writes, [{ EURUSD: q('EURUSD', 1) }, { EURUSD: q('EURUSD', 2) }]);

// On: first batch goes out at once, the rest of the window merges into one trailing write (latest per symbol wins)
ms = 100;
writes.length = 0;
await sleep(ms);
push([q('EURUSD', 3)]);
push([q('EURUSD', 4), q('GBPUSD', 1)]);
push([q('EURUSD', 5)]);
assert.equal(writes.length, 1);
await sleep(150);
assert.deepEqual(writes, [{ EURUSD: q('EURUSD', 3) }, { EURUSD: q('EURUSD', 5), GBPUSD: q('GBPUSD', 1) }]);

// Switching off mid-window writes what was pending with the new batch — and nothing stale lands afterwards
writes.length = 0;
push([q('GBPUSD', 2)]); // inside the window opened by the trailing write → pending
assert.equal(writes.length, 0);
ms = 0;
push([q('EURUSD', 6)]);
assert.deepEqual(writes, [{ GBPUSD: q('GBPUSD', 2), EURUSD: q('EURUSD', 6) }]);
await sleep(150);
assert.equal(writes.length, 1);

// Settings saved before the throttle fields existed still get their defaults (persist merge is deep for settings)
const saved = JSON.stringify({ state: { settings: { soundEnabled: true, tickerSpeed: 40 } }, version: 0 });
(globalThis as any).localStorage = { getItem: () => saved, setItem() {}, removeItem() {} };
const { useAppStore } = await import('../src/stores/use-app-store.ts');
const { settings } = useAppStore.getState();
assert.equal(settings.soundEnabled, true);
assert.equal(settings.tickerSpeed, 40);
assert.equal(settings.quoteThrottle, true);
assert.equal(settings.quoteThrottleMs, 100);

console.log('quote throttle: ok');
