// Self-check for lib/trade-events.ts (bridge hub events → cached lists). Run: npx tsx scripts/check-trade-events.mts
import assert from 'node:assert/strict';
import { applyPosition, applyOrder, applyDeal, pnlRate } from '../src/lib/trade-events.ts';

const pos = { ticket: 1, symbol: 'EURUSD', side: 'BUY' as const, volume: 0.1, openPrice: 1.1, currentPrice: 1.1, stopLoss: 0, takeProfit: 0, profit: 0, swap: 0, openTime: '' };
const other = { ...pos, ticket: 2 };

// Positions: add appends, update replaces in place (rows don't jump), delete removes, unknown delete is a no-op
let ps = applyPosition([], 'PositionAdded', pos);
ps = applyPosition(ps, 'PositionAdded', other);
ps = applyPosition(ps, 'PositionUpdated', { ...pos, stopLoss: 1.09 });
assert.deepEqual(ps.map((p) => [p.ticket, p.stopLoss]), [[1, 1.09], [2, 0]]);
ps = applyPosition(ps, 'PositionDeleted', pos);
assert.deepEqual(ps.map((p) => p.ticket), [2]);
assert.equal(applyPosition(ps, 'PositionDeleted', { ...pos, ticket: 99 }), ps);

// Orders: a market order passes through the order system (STARTED → FILLED) and must never show as pending
const mkt = { ticket: 10, symbol: 'EURUSD', type: 'BUY', volume: 0.1, price: 0, stopLoss: 0, takeProfit: 0, setupTime: '', state: 'STARTED' };
assert.deepEqual(applyOrder([], 'OrderAdded', mkt), []);
const lim = { ...mkt, ticket: 11, type: 'BUY_LIMIT', price: 1.09, state: 'PLACED' };
let os = applyOrder([], 'OrderAdded', lim);
assert.equal(os.length, 1);
os = applyOrder(os, 'OrderUpdated', { ...lim, price: 1.085 });
assert.equal(os[0].price, 1.085);
assert.deepEqual(applyOrder(os, 'OrderUpdated', { ...lim, state: 'CANCELED' }), []); // terminal state
assert.deepEqual(applyOrder(os, 'OrderDeleted', { ...lim, state: 'FILLED' }), []); // deleted = filled, not cancelled

// Deals: hub payloads have no fee — defaulted so Net never turns NaN; a repeated DealAdded doesn't duplicate
const deal = { ticket: 20, orderTicket: 10, positionId: 1, symbol: 'EURUSD', action: 'BUY' as const, entry: 'IN', volume: 0.1, price: 1.1, profit: 0, commission: -0.7, swap: 0, time: '2026-09-24T10:00:00Z', comment: '' } as any;
let ds = applyDeal([], 'DealAdded', deal);
ds = applyDeal(ds, 'DealAdded', deal);
assert.equal(ds.length, 1);
assert.equal(ds[0].fee, 0);
assert.equal(applyDeal(ds, 'DealDeleted', deal).length, 0);

// P&L rate: unknown at the open price (a fresh position), inferred once it has moved
assert.equal(pnlRate(pos), null);
assert.ok(Math.abs(pnlRate({ ...pos, currentPrice: 1.102, profit: 20 })! - 10_000) < 1e-6);
assert.ok(Math.abs(pnlRate({ ...pos, side: 'SELL', currentPrice: 1.102, profit: -20 })! - 10_000) < 1e-6);

console.log('trade-events: all assertions passed');
