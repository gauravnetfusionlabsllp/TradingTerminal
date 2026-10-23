// Self-check for MT5 ⇄ Yahoo symbol mapping. Run: npx tsx scripts/check-symbols.mts
import assert from 'node:assert/strict';
import { mt5Base, toYahoo, toMt5 } from '../src/lib/symbols.ts';

// Account-type suffixes
assert.equal(mt5Base('EURUSD.ecn'), 'EURUSD');
assert.equal(mt5Base('EURUSDm'), 'EURUSD');
assert.equal(mt5Base('S&P500.std'), 'S&P500');
assert.equal(mt5Base('COCOAcash.stdc'), 'COCOA');

// Each rule
const cases: [string, string][] = [
  ['EURUSD', 'EURUSD=X'], ['AUDCHF.ecn', 'AUDCHF=X'], ['USDJPYm', 'USDJPY=X'], ['USDTRY', 'USDTRY=X'],
  ['XAUUSD', 'GC=F'], ['XAGUSD.std', 'SI=F'], ['XPT', 'PL=F'], ['USOIL', 'CL=F'], ['XBRUSD', 'BZ=F'], ['XNGUSD', 'NG=F'],
  ['US30', '^DJI'], ['S&P500.e', '^GSPC'], ['NAS100', '^NDX'], ['GER40', '^GDAXI'], ['DE40.imf', '^GDAXI'], ['China50.CNT', 'XIN9.FGI'], ['DXY', 'DX-Y.NYB'],
  ['BTCUSD', 'BTC-USD'], ['DOGEUSDT', 'DOGE-USD'], ['DSHUSD', 'DASH-USD'], ['USDTUSD', 'USDT-USD'], ['DOGUSD.i', 'DOGE-USD'],
  ['GCZ26', 'GC=F'], ['GCZ_26i', 'GC=F'], ['SI_Z26', 'SI=F'], ['CL20DEC2025', 'CL=F'], ['DJ30U26', 'YM=F'], ['NQZ26', 'NQ=F'], ['GC.Z25', 'GC=F'], ['CL.K24', 'CL=F'], ['ES.M24', 'ES=F'],
  ['RELIANCE FUT 25 AUG 26', 'RELIANCE.NS'], ['M&M_FUT_28_JUL_26', 'M&M.NS'], ['RELIANCEFUT25AUG26', 'RELIANCE.NS'], ['NIFTY FUT 30 JUN 26', '^NSEI'],
  ['NIFTY25JUL2024 FUT', '^NSEI'], ['GC27-DEC-24 FUT', 'GC=F'], ['NIFTYH26', '^NSEI'], ['RELIANCEAPR', 'RELIANCE.NS'], ['BANKNIFTYMAR', '^NSEBANK'],
  ['360ONE FUT 25 AUG 26', '360ONE.NS'], ['JP225Roll.CNT', '^N225'], ['XAUUSD_80340', 'GC=F'], ['HKG.33.CNT', '^HSI'],
  ['ADS.de', 'ADS.DE'], ['AIR.fr', 'AIR.PA'], ['BRKB', 'BRK-B'], ['AAPL', 'AAPL'],
];
for (const [mt5, yahoo] of cases) assert.equal(toYahoo(mt5), yahoo, mt5);

// Yahoo tickers are left alone (idempotent), and so are ambiguous stock tickers
for (const s of ['EURUSD=X', 'GC=F', '^DJI', 'BTC-USD', 'RELIANCE.NS', 'DX-Y.NYB', 'CL', 'ES', 'SI', 'NG', 'GOLD', 'WTI', 'XAUEUR']) {
  assert.equal(toYahoo(s), s, s);
}

// Reverse: Yahoo → the account's MT5 name, preferring the table order, then the plain name
const allowed = ['EURUSD', 'EURUSD.ecn', 'XAU', 'XAUUSD', 'XAUUSDm', 'US30', 'BTCUSD', 'ESU26', 'AAPL'].map((symbol) => ({ symbol }));
assert.equal(toMt5('EURUSD=X', allowed), 'EURUSD');
assert.equal(toMt5('GC=F', allowed), 'XAUUSD');
assert.equal(toMt5('^DJI', allowed), 'US30');
assert.equal(toMt5('BTC-USD', allowed), 'BTCUSD');
assert.equal(toMt5('ES=F', allowed), 'ESU26');
assert.equal(toMt5('AAPL', allowed), 'AAPL');
assert.equal(toMt5('EURUSD.ecn', allowed), 'EURUSD.ecn'); // already tradable: kept as is
assert.equal(toMt5('MSFT', allowed), undefined);
assert.equal(toMt5('GBPUSD=X', allowed), undefined);
// Accounts that only carry suffixed names
assert.equal(toMt5('EURUSD=X', [{ symbol: 'EURUSDm' }, { symbol: 'GBPUSDm' }]), 'EURUSDm');
assert.equal(toMt5('GC=F', [{ symbol: 'XAUUSD.std' }]), 'XAUUSD.std');

console.log('symbols: all checks passed');
