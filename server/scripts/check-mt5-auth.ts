// Self-check for JWT signing and M1 bar aggregation. Run: npx tsx scripts/check-mt5-auth.ts
import assert from 'node:assert/strict';
import { signJwt, verifyJwt } from '../src/lib/jwt.js';
import { aggregateBars, TIMEFRAMES } from '../src/routes/mt5.js';

// JWT round trip
const token = signJwt({ sub: 7, login: 123456, ro: true }, 60);
const claims = verifyJwt(token);
assert.equal(claims?.sub, 7);
assert.equal(claims?.login, 123456);
assert.equal(claims?.ro, true);

// Tampered payload (escalate to trader) is rejected
const [h, , s] = token.split('.');
const forged = Buffer.from(JSON.stringify({ sub: 7, login: 123456, ro: false, iat: 0, exp: 9e9 })).toString('base64url');
assert.equal(verifyJwt(`${h}.${forged}.${s}`), null);

// alg:none / swapped header is rejected
const none = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
assert.equal(verifyJwt(`${none}.${token.split('.')[1]}.`), null);
assert.equal(verifyJwt(`${none}.${token.split('.')[1]}.${s}`), null);

// Expired and garbage tokens are rejected
assert.equal(verifyJwt(signJwt({ sub: 1, login: 1, ro: false }, -1)), null);
assert.equal(verifyJwt('not.a.jwt'), null);
assert.equal(verifyJwt(''), null);

// M1 → M5 aggregation across a bucket boundary
const t0 = Date.UTC(2026, 0, 5, 10, 0) / 1000;
const bar = (min: number, o: number, hi: number, lo: number, c: number, v: number) => ({
  time: t0 + min * 60, open: o, high: hi, low: lo, close: c, volume: v,
});
const m1 = [
  bar(0, 1.0, 1.2, 0.9, 1.1, 10),
  bar(1, 1.1, 1.5, 1.0, 1.4, 5),
  bar(4, 1.4, 1.4, 0.8, 1.3, 1),
  bar(5, 1.3, 1.6, 1.2, 1.5, 2),
];
assert.deepEqual(aggregateBars(m1, TIMEFRAMES.M5), [
  { time: t0, open: 1.0, high: 1.5, low: 0.8, close: 1.3, volume: 16 },
  { time: t0 + 300, open: 1.3, high: 1.6, low: 1.2, close: 1.5, volume: 2 },
]);
assert.equal(m1[0].high, 1.2, 'cached M1 input must not be mutated');
assert.deepEqual(aggregateBars([], 60), []);

// M3 buckets start on multiples of 3 min; H4 buckets on 00/04/08… of the (server) day — never straddling a day chunk
assert.deepEqual(aggregateBars(m1, TIMEFRAMES.M3).map((c) => (c.time - t0) / 60), [0, 3]);
assert.deepEqual(aggregateBars(m1, TIMEFRAMES.H4).map((c) => c.time), [Date.UTC(2026, 0, 5, 8) / 1000]);
for (const tf of Object.values(TIMEFRAMES)) assert.equal(86_400 % tf, 0, `${tf}s must divide a day`);

console.log('check-mt5-auth: all assertions passed');
