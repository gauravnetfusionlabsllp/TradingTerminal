// Self-check for the FIX bridge's stale replay on subscribe (QA #26): npx tsx scripts/check-market-feed.ts
// Runs market-feed against a fake FIX bridge and a fake MT5 bridge tick endpoint.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { WebSocketServer, type WebSocket } from 'ws';

const MT5 = { bid: 4120.96, ask: 4121.1 };
let bridgeUp = true;
const bridge = createServer((req, res) => {
  const symbol = decodeURIComponent(req.url!.split('?')[0].split('/').pop()!);
  setTimeout(() => { // a live tick can land while the call is in flight
    res.statusCode = bridgeUp ? 200 : 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ symbol, ...MT5, last: 0 }));
  }, 30);
}).listen(0);
const fix = new WebSocketServer({ port: 0 });
await Promise.all([once(bridge, 'listening'), once(fix, 'listening')]);
process.env.MT5_BRIDGE_URL = `http://localhost:${(bridge.address() as AddressInfo).port}`;
process.env.MARKET_FEED_URL = `ws://localhost:${(fix.address() as AddressInfo).port}`;

const feed = await import('../src/services/market-feed.js');
const got: { symbol: string; bid: number; ask: number; ts: number }[] = [];
feed.setHandlers({ onQuote: (q) => got.push(q), onStatus() {} });
feed.startMarketFeed();
const [upstream] = (await once(fix, 'connection')) as [WebSocket];

const fixTs = (ms: number) => { const s = new Date(ms).toISOString(); return `${s.slice(0, 10).replaceAll('-', '')}-${s.slice(11, 23)}`; };
const snap = (symbol: string, bid: number, ask: number, ms: number) => upstream.send(JSON.stringify({
  type: 'snapshot', symbol, ts: fixTs(ms), entries: [{ type: 'bid', price: bid }, { type: 'ask', price: ask }],
}));
const settle = () => new Promise((r) => setTimeout(r, 250));
const twoDaysAgo = Date.now() - 2 * 86_400_000;

// 1. Days-old replay, nothing held yet → MT5's last tick instead, keeping the old ts
feed.acquire('XAUUSD.r');
snap('XAUUSD.r', 4046.49, 4046.63, twoDaysAgo);
await settle();
assert.deepEqual(got, [{ symbol: 'XAUUSD.r', ...MT5, ts: twoDaysAgo }]);

// 2. Live ticks pass through untouched; a later replay never overwrites what we hold
const now = Date.now();
snap('XAUUSD.r', 4121.12, 4121.26, now);
snap('XAUUSD.r', 4046.49, 4046.63, twoDaysAgo);
await settle();
assert.deepEqual(got.slice(1), [{ symbol: 'XAUUSD.r', bid: 4121.12, ask: 4121.26, ts: now }]);
assert.equal(feed.lastQuote('XAUUSD.r')?.bid, 4121.12);

// 3. A live tick landing while the MT5 call is in flight wins
got.length = 0;
feed.acquire('XAUUSD.d');
snap('XAUUSD.d', 4040, 4040.27, twoDaysAgo);
await new Promise((r) => setTimeout(r, 10));
snap('XAUUSD.d', 4120.87, 4121.14, Date.now());
await settle();
assert.deepEqual(got.map((q) => q.bid), [4120.87]);

// 4. MT5 bridge down → the replay is still shown (previous behaviour) rather than nothing
got.length = 0;
bridgeUp = false;
feed.acquire('XAGUSD.d');
snap('XAGUSD.d', 52.026, 52.091, twoDaysAgo);
await settle();
assert.deepEqual(got, [{ symbol: 'XAGUSD.d', bid: 52.026, ask: 52.091, ts: twoDaysAgo }]);

feed.stopMarketFeed();
fix.close();
bridge.close();
console.log('check-market-feed: ok');
