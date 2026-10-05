// Self-check for alert trigger logic: npx tsx scripts/check-alerts.ts
import assert from 'node:assert/strict';
import { checkAlert, conditionMet } from '../src/services/alerts/alert-types.js';

const above = { direction: 'above', price: 1.085 };
const below = { direction: 'below', price: 1.085 };
assert.equal(conditionMet('price_cross', above, 1.08499), false);
assert.equal(conditionMet('price_cross', above, 1.085), true); // boundary fires
assert.equal(conditionMet('price_cross', below, 1.08501), false);
assert.equal(conditionMet('price_cross', below, 1.085), true);
assert.match(checkAlert('price_cross', above, 'EURUSD', 1.0862)!, /EURUSD bid rose above 1.085 \(now 1.0862\)/);

const pct = { pct: 1, basePrice: 100 };
assert.equal(checkAlert('price_change_pct', pct, 'XAUUSD', 100.99), null);
assert.match(checkAlert('price_change_pct', pct, 'XAUUSD', 101)!, /moved up 1\.00%/);
assert.match(checkAlert('price_change_pct', pct, 'XAUUSD', 98.5)!, /moved down 1\.50%/);
assert.equal(conditionMet('price_change_pct', { pct: 1, basePrice: 0 }, 5), false); // no base → never fires

assert.equal(conditionMet('volume_spike', { multiplier: 2 }, 1), false); // legacy types never fire
console.log('check-alerts: ok');
