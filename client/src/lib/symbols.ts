/**
 * MT5 ⇄ Yahoo symbol mapping: Yahoo-backed analytics panels follow the MT5 selection (EURUSD → EURUSD=X), and
 * panels that select Yahoo tickers (Futures: GC=F) can drive the MT5 chart and ticket (→ XAUUSD).
 * Only unambiguous MT5 forms are translated — bare futures roots and a few names are real Yahoo stock tickers
 * (CL Colgate, ES Eversource, NG NovaGold, SI Silvergate, GOLD Barrick, WTI W&T Offshore) and stock panels select
 * those too, so they pass through untouched.
 */

const ISO = new Set('USD EUR GBP JPY CHF AUD NZD CAD SGD HKD NOK SEK DKK PLN HUF CZK TRY ZAR MXN CNH CNY INR THB ILS RUB KRW SAR AED BRL'.split(' '));
const METALS = new Set(['XAU', 'XAG', 'XPT', 'XPD']);

// Order matters for toMt5: the first MT5 name per Yahoo ticker is the preferred one.
// ponytail: Yahoo has no spot metals (XAUUSD=X is "not found") — front-month futures stand in, a few $ off spot
const ALIAS: Record<string, string> = {
  XAUUSD: 'GC=F', XAU: 'GC=F', XAGUSD: 'SI=F', XAG: 'SI=F', SILVER: 'SI=F',
  XPTUSD: 'PL=F', XPT: 'PL=F', XPDUSD: 'PA=F', XPD: 'PA=F', COPPER: 'HG=F',
  USOIL: 'CL=F', XTIUSD: 'CL=F', USOUSD: 'CL=F', UKOIL: 'BZ=F', XBRUSD: 'BZ=F', UKOUSD: 'BZ=F', BRENT: 'BZ=F',
  XNGUSD: 'NG=F', NATGAS: 'NG=F', COCOA: 'CC=F',
  US30: '^DJI', DJ30: '^DJI', US500: '^GSPC', SPX500: '^GSPC', 'S&P500': '^GSPC',
  NAS100: '^NDX', ND100: '^NDX', USNDX: '^NDX', USTECH: '^NDX',
  GER40: '^GDAXI', DAX40: '^GDAXI', DE40: '^GDAXI', GERMAN: '^GDAXI', UK100: '^FTSE', JPN225: '^N225', JP225: '^N225',
  FRENCH: '^FCHI', CAC40: '^FCHI', ESX50: '^STOXX50E', ESTOX: '^STOXX50E', ESP35: '^IBEX', HSI50: '^HSI',
  AUS200: '^AXJO', AEX25: '^AEX', SMI20: '^SSMI', CHINA50: 'XIN9.FGI', NIFTY: '^NSEI', BANKNIFTY: '^NSEBANK',
  DXY: 'DX-Y.NYB', 'HKG.33': '^HSI', BRKB: 'BRK-B', VISA: 'V',
};
const COIN: Record<string, string> = {
  DSH: 'DASH', LNK: 'LINK', AVX: 'AVAX', WAV: 'WAVES', SHI: 'SHIB', SHB: 'SHIB', ALG: 'ALGO', ATM: 'ATOM', AVE: 'AAVE',
  COM: 'COMP', DOG: 'DOGE', INC: '1INCH', MAN: 'MANA', NER: 'NEAR', SND: 'SAND', XBN: 'BNB', XET: 'ETH', XLC: 'LTC',
};
// Futures roots → continuous series. A root alone (CL, ES…) is a stock ticker, so these need an expiry or "FUT".
const FUTURE: Record<string, string> = {
  GC: 'GC=F', SI: 'SI=F', CL: 'CL=F', NG: 'NG=F', HG: 'HG=F', ES: 'ES=F', NQ: 'NQ=F', ZN: 'ZN=F', DJ: 'YM=F', DJ30: 'YM=F',
  NIFTY: '^NSEI', BANKNIFTY: '^NSEBANK',
};
const MONTHS = 'JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC';
// Z26 · Z_26 · _Z26 · .Z26 · 20DEC2025 · 27-DEC-24
const EXPIRY = `[._]?(?:[FGHJKMNQUVXZ]_?\\d{2}|\\d{2}-?(?:${MONTHS})-?\\d{2,4})`;
const DATED_RE = new RegExp(`^(${Object.keys(FUTURE).join('|')})${EXPIRY}$`);
// "RELIANCE FUT 25 AUG 26", "M&M_FUT_28_JUL_26", "RELIANCEFUT25AUG26", "GC27DEC2024 FUT"
const FUT_RE = new RegExp(`^([A-Z0-9&-]+?)(?:${EXPIRY})?[ _]?FUT(?:[ _\\d]|$)`);
// NSE monthly contracts: "RELIANCEAPR", "BANKNIFTYMAR" (6+ chars, so no US ticker can match)
const NSE_MONTH_RE = new RegExp(`^([A-Z&-]{3,})(?:${MONTHS})$`);
const EXCHANGE: Record<string, string> = { de: '.DE', fr: '.PA' };
const YAHOO_FORM = /[=^]|-USD$|\.(NS|BO|DE|PA|L|AS|SW|T|HK|SS|SZ|TO|AX|NYB|FGI|SI|MI|MC)$/;

/** MT5 name without its account-type suffix: EURUSD.ecn / EURUSDm / S&P500.std → EURUSD / S&P500. */
export function mt5Base(symbol: string): string {
  return symbol
    .replace(/\.[A-Za-z0-9]+$/, '')
    .replace(/(?:Roll|_\d{3,}|_)$/, '') // JP225Roll, XAUUSD_80340, XAUUSD_
    .replace(/^([A-Z0-9&_-]+?)[a-z]+$/, '$1');
}

/** NSE/COMEX futures root → Yahoo: index roots and known contracts map, other NSE roots are `<root>.NS`. */
const futureRoot = (root: string) => FUTURE[root] ?? `${root}.NS`;

/** Yahoo ticker for an MT5 symbol; Yahoo tickers and anything unrecognised (stocks) come back unchanged. */
export function toYahoo(symbol: string): string {
  if (!symbol || YAHOO_FORM.test(symbol)) return symbol;
  const ex = symbol.match(/^(.+)\.(de|fr)$/);
  if (ex) return ex[1] + EXCHANGE[ex[2]];
  const base = mt5Base(symbol).toUpperCase();
  if (ALIAS[base]) return ALIAS[base];
  const fx = base.match(/^([A-Z]{3})([A-Z]{3})$/);
  if (fx && ISO.has(fx[1]) && ISO.has(fx[2])) return `${base}=X`;
  const coin = base.match(/^([A-Z0-9]{2,6}?)USDT?$/);
  if (coin && !ISO.has(coin[1]) && !METALS.has(coin[1])) return `${COIN[coin[1]] ?? coin[1]}-USD`;
  const dated = base.match(DATED_RE) ?? symbol.toUpperCase().match(DATED_RE); // GC.Z25: mt5Base drops the .Z25
  if (dated) return FUTURE[dated[1]];
  // ponytail: MCX commodity futures (CRUDEOIL FUT, GOLDM FUT) become <root>.NS, which Yahoo doesn't have — no data
  const fut = base.match(FUT_RE) ?? base.match(NSE_MONTH_RE);
  if (fut) return futureRoot(fut[1]);
  return symbol;
}

/**
 * The account's MT5 symbol for any symbol (Yahoo ticker or MT5 name), or undefined if it can't trade it.
 * Prefers the table's first name (GC=F → XAUUSD over XAU), then the shortest (EURUSD over EURUSD.ecn) — so
 * accounts that only have suffixed names (EURUSDm) still resolve.
 */
export function toMt5(symbol: string, allowed: { symbol: string }[]): string | undefined {
  if (!symbol) return undefined;
  if (allowed.some((s) => s.symbol === symbol)) return symbol;
  const yahoo = toYahoo(symbol);
  const preferred = Object.keys(ALIAS).filter((k) => ALIAS[k] === yahoo);
  const rank = (s: string) => {
    const i = preferred.indexOf(mt5Base(s).toUpperCase());
    return (i < 0 ? 99 : i) * 1000 + s.length;
  };
  let best: string | undefined;
  for (const { symbol: s } of allowed) {
    if (toYahoo(s) === yahoo && (best === undefined || rank(s) < rank(best))) best = s;
  }
  return best;
}
