// Self-check for MT5 symbol → logo keys. Run: npx tsx scripts/check-logos.mts
import assert from 'node:assert/strict';
import { logoKeys } from '../src/lib/logos.ts';

const cases: [string, string[]][] = [
  ['EURUSD.std', ['fx/EUR', 'fx/USD']], ['GBPJPYm', ['fx/GBP', 'fx/JPY']], ['USDTRY.stdk', ['fx/USD', 'fx/TRY']],
  ['XAUUSDm', ['fx/XAU', 'fx/USD']], ['XAUEUR.e', ['fx/XAU', 'fx/EUR']], ['XAUUSD_80340', ['fx/XAU', 'fx/USD']],
  ['GC.Z25', ['fx/XAU']], ['XAU.G25i', ['fx/XAU']], ['Gold10.J25', ['fx/XAU']], ['GOLD 1KG 995', ['fx/XAU']], ['Silver.May', ['fx/XAG']],
  ['BTCUSD.ecn', ['crypto/BTC']], ['DSHUSDz', ['crypto/DASH']], ['SHIUSDT', ['crypto/SHIB']], ['DOGUSD.i', ['crypto/DOGE']],
  ['AAPL', ['stock/AAPL']], ['CVS.N', ['stock/CVS']], ['FSLR.xnas', ['stock/FSLR']], ['Sofi', ['stock/SOFI']],
  ['VISA', ['stock/V']], ['BRKB', ['stock/BRKB']], ['GOLD', ['stock/GOLD']], // bare GOLD is Barrick, as in symbols.ts
  ['DJ30.std', ['fx/USD']], ['ND100m', ['fx/USD']], ['ES.Z25', ['fx/USD']], ['DAX40m', ['fx/EUR']], ['UK100', ['fx/GBP']],
];
for (const [symbol, keys] of cases) assert.deepEqual(logoKeys(symbol), keys, symbol);

// No logo rather than a wrong one
for (const s of ['RIO.uk', 'ADS.de', 'AI', 'DG', 'RELIANCE_FUT_28_JUL_26', 'NIFTY25JUL2024FUT', 'KC.H24', 'XTIUSD', 'USOILz', 'ETHUSDi*', 'NFT25']) {
  assert.deepEqual(logoKeys(s), [], s);
}

console.log('logos: all checks passed');
