// Pure alert logic, evaluated against the live MT5 bid. No I/O here so scripts/check-alerts.ts can import it.
// Conditions (Alert.condition JSON): price_cross {direction:'above'|'below', price}, price_change_pct {pct, basePrice}

const fmt = (n: number) => String(+n.toFixed(6)); // drop float noise, keep FX precision

export function conditionMet(type: string, c: any, bid: number): boolean {
  if (type === 'price_cross') return c.direction === 'above' ? bid >= c.price : bid <= c.price;
  if (type === 'price_change_pct') return c.basePrice > 0 && Math.abs(bid - c.basePrice) / c.basePrice * 100 >= c.pct;
  return false;
}

/** Trigger message when the condition holds at this bid, else null. */
export function checkAlert(type: string, c: any, symbol: string, bid: number): string | null {
  if (!conditionMet(type, c, bid)) return null;
  if (type === 'price_cross') return `${symbol} bid ${c.direction === 'above' ? 'rose above' : 'fell below'} ${fmt(c.price)} (now ${fmt(bid)})`;
  const pct = (bid - c.basePrice) / c.basePrice * 100;
  return `${symbol} moved ${pct >= 0 ? 'up' : 'down'} ${Math.abs(pct).toFixed(2)}% from ${fmt(c.basePrice)} (now ${fmt(bid)})`;
}
