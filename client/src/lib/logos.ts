/**
 * MT5 symbol → logo files in public/logos (from github.com/nvstly/icons, fetched by scripts/fetch-logos.mts).
 * FX pairs get two currency flags, metals and indices a flag, crypto the coin, US stocks the company.
 * Anything ambiguous gets nothing: a missing logo is fine, another company's logo is not.
 */
import { mt5Base, toYahoo } from './symbols';
import available from './logos.json';

const HAVE = new Set<string>(available);

const FLAG: Record<string, string> = {
  'GC=F': 'XAU', 'SI=F': 'XAG',
  '^DJI': 'USD', '^GSPC': 'USD', '^NDX': 'USD', 'DX-Y.NYB': 'USD', 'YM=F': 'USD', 'ES=F': 'USD', 'NQ=F': 'USD',
  '^GDAXI': 'EUR', '^FCHI': 'EUR', '^STOXX50E': 'EUR', '^IBEX': 'EUR', '^AEX': 'EUR',
  '^FTSE': 'GBP', '^N225': 'JPY', '^HSI': 'HKD', '^SSMI': 'CHF', '^AXJO': 'AUD',
};
// European listings the broker carries without an exchange suffix: their US namesakes are other companies (AI = C3.ai)
const NOT_US = new Set('DBK EVK DWNI HMSO DWS DHER FME FIE AMUN DIM CON BOSS GNC AI DG GLEN FRAS CDI HIK HLMA GRG'.split(' '));

/** Logo keys ('fx/EUR', 'crypto/BTC', 'stock/AAPL') for a symbol, whether or not they've been downloaded. */
export function logoKeys(symbol: string): string[] {
  const raw = symbol.toUpperCase();
  if (/^GOLD./.test(raw)) return ['fx/XAU']; // bare GOLD is Barrick
  if (raw.startsWith('SILVER')) return ['fx/XAG'];
  const metal = mt5Base(symbol).toUpperCase().match(/^(XAU|XAG|XPT|XPD)([A-Z]{3})$/);
  if (metal) return [`fx/${metal[1]}`, `fx/${metal[2]}`];
  const y = toYahoo(symbol);
  const fx = y.match(/^([A-Z]{3})([A-Z]{3})=X$/);
  if (fx) return [`fx/${fx[1]}`, `fx/${fx[2]}`];
  const coin = y.match(/^(.+)-USD$/);
  if (coin) return [`crypto/${coin[1]}`];
  if (FLAG[y]) return [`fx/${FLAG[y]}`];
  // Stocks: bare US tickers only — toYahoo leaves them untouched, so "Sofi" stays SOFI (mt5Base would make it S)
  const t = y.replace(/\.(N|xnys|xnas)$/i, '').replace('-', '').toUpperCase();
  return /^[A-Z]{1,5}$/.test(t) && !NOT_US.has(t) ? [`stock/${t}`] : [];
}

const cache = new Map<string, string[]>();

/** Logo URLs for a symbol: none, one, or two (FX pair); only when every file is downloaded. */
export function logoFor(symbol: string): string[] {
  let urls = cache.get(symbol);
  if (!urls) {
    const keys = logoKeys(symbol);
    urls = keys.length && keys.every((k) => HAVE.has(k)) ? keys.map((k) => `/logos/${k}.png`) : [];
    cache.set(symbol, urls);
  }
  return urls;
}
