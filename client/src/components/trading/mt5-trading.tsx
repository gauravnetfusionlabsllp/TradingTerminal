import { useState, useEffect, useRef } from 'react';
import {
  useMt5Symbols, useMt5Quotes, useMt5Positions, useMt5Orders, useMt5Deals,
  useMt5MarketOrder, useMt5PendingOrder, useMt5ClosePosition, useMt5CancelOrder, useMt5ModifyPosition,
  type Mt5PendingType, type Mt5Position, type Mt5Quote,
} from '../../api/hooks/use-mt5';
import { useAuthStore } from '../../stores/use-auth-store';
import { useAppStore, type OrderDraft } from '../../stores/use-app-store';
import { useT } from '../../i18n';
import { SymbolPicker } from './symbol-picker';
import { SymbolLogo } from '../common/symbol-logo';
import { toMt5 } from '../../lib/symbols';
import {
  levelsError, pipSize, pips, pipText, levelAtPips, pendingTypeFor, draftEntry, draftRef, snap, typeName,
} from '../../lib/chart-trading';
import { pnlRate } from '../../lib/trade-events';
import { AlertTriangle, Lock, LogIn } from 'lucide-react';

type Side = 'BUY' | 'SELL';

// Literal class strings — Tailwind can't see interpolated ones
const SIDE_STYLE = {
  BUY: { on: 'bg-buy border-buy text-on-accent', off: 'border-buy/60 text-accent-ink hover:bg-buy/10', submit: 'bg-buy border-buy text-on-accent hover:bg-buy/90' },
  SELL: { on: 'bg-sell border-sell text-on-accent', off: 'border-sell/60 text-bearish hover:bg-sell/10', submit: 'bg-sell border-sell text-on-accent hover:bg-sell/90' },
};
const KINDS = [['MARKET', 'Market'], ['PENDING', 'Pending']] as const;
const LABEL = 'text-mini text-neutral/60';
const STEP = 'w-7 shrink-0 border border-border text-neutral/70 hover:text-white hover:bg-white/5';
/** One bordered box per ticket field: the input plus its unit / mode / steppers (.ticket-field unborders the input) */
const FIELD = 'ticket-field flex h-8 border border-border rounded-sm bg-raised text-[13px]';
const FIELD_BTN = 'w-8 shrink-0 border-l border-border text-neutral/70 hover:text-white hover:bg-white/5';

/** Bridge gives no symbol digits — trim float noise (1.3308200000000001 → 1.33082). */
export const fmtPrice = (n: number) => String(+n.toFixed(6));
const fmtMoney = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtSigned = (n: number) => `${n >= 0 ? '+' : ''}${fmtMoney(n)}`;
const errMsg = (err: unknown) => (err instanceof Error ? err.message : 'Failed');
const fmtTime = (iso: string) => new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });

/**
 * Floating P&L at a live price: money-per-price-unit inferred from the last REST snapshot (`pnlRate`), applied to
 * the live FIX price. Positions are re-fetched every 5s until a new one can be priced, then every 60s.
 * ponytail: exact while the conversion rate is steady (account-currency quoted symbols); crosses drift up to 60s
 */
export function liveProfit(p: Mt5Position, price: number): number {
  const rate = pnlRate(p);
  // At (or cents from) the open price the rate can't be inferred reliably — keep the snapshot figure
  return rate === null ? p.profit : rate * (price - p.openPrice) * (p.side === 'BUY' ? 1 : -1);
}

const decimals = (n: number) => (fmtPrice(n).split('.')[1] ?? '').length;
/** Bridge sends no symbol digits: the most decimals any known price of the position shows */
const digitsOf = (p: Mt5Position, q?: Mt5Quote) =>
  Math.max(decimals(p.openPrice), decimals(p.currentPrice), q ? Math.max(decimals(q.bid), decimals(q.ask)) : 0);

/** FX-style quote: the pip pair large, a fractional pip (5- and 3-digit quotes) raised small. */
function PipPrice({ value, digits }: { value?: number; digits: number }) {
  if (value == null) return <>--</>;
  const s = value.toFixed(digits);
  if (digits < 2) return <>{s}</>;
  const end = s.length - (digits % 2);
  return (
    <>
      {s.slice(0, end - 2)}
      <span className="text-[22px]">{s.slice(end - 2, end)}</span>
      {end < s.length && <sup className="text-xs">{s.slice(end)}</sup>}
    </>
  );
}

function LoginPrompt() {
  const t = useT();
  const setLoginModalOpen = useAuthStore((s) => s.setLoginModalOpen);
  return (
    <div className="h-full flex flex-col items-center justify-center p-6 gap-4 bg-black">
      <button
        onClick={() => setLoginModalOpen(true)}
        className="flex items-center gap-2 px-4 h-8 rounded-sm bg-accent text-on-accent text-xs font-semibold hover:bg-accent/90 transition-colors"
      >
        <LogIn className="w-4 h-4" />
        {t('loginWithMt5')}
      </button>
    </div>
  );
}

function ErrorBar({ msg, onDismiss }: { msg: string; onDismiss?: () => void }) {
  if (!msg) return null;
  return (
    <div role="alert" className="px-3 py-2 bg-bearish/10 border-b border-bearish/30 flex items-center gap-2">
      <AlertTriangle className="w-3 h-3 text-bearish shrink-0" />
      <span className="text-mini font-mono text-bearish flex-1">{msg}</span>
      {onDismiss && <button onClick={onDismiss} className="text-bearish/60 hover:text-bearish">✕</button>}
    </div>
  );
}

const Empty = ({ label }: { label: string }) => (
  <div className="flex items-center justify-center h-32">
    <span className="text-mini font-mono text-neutral uppercase">{label}</span>
  </div>
);

/** Order ticket panel. Picking Sell or Buy arms the order: its preview appears on the chart, where dragging its lines
 *  edits these fields (the draft is shared). Confirm sends it; ✕ / Esc / Cancel disarms. */
export function Mt5Ticket() {
  const t = useT();
  const user = useAuthStore((s) => s.user);
  const readOnly = user?.readOnly ?? false;
  const watchlist = useAppStore((s) => s.tabSymbols[s.activeWatchlistTab]);
  const selectedSymbol = useAppStore((s) => s.selectedSymbol);
  const addLogEntry = useAppStore((s) => s.addLogEntry);
  const draft = useAppStore((s) => s.orderDraft);
  const patchDraft = useAppStore((s) => s.patchDraft);
  const { symbol, side, kind, volume, price, sl, tp } = draft;

  const { data: symbols = [] } = useMt5Symbols();
  const marketOrder = useMt5MarketOrder();
  const pendingOrder = useMt5PendingOrder();
  const [result, setResult] = useState('');
  const digitsRef = useRef({ symbol: '', digits: 0 });

  // Default to the first watchlist symbol (never an arbitrary allowed one — whatever is picked gets a live
  // subscription)
  useEffect(() => {
    if (symbol || !symbols.length) return;
    const first = watchlist?.find((w) => symbols.some((s) => s.symbol === w));
    if (first) patchDraft({ symbol: first });
  }, [symbols, symbol, watchlist, patchDraft]);

  // Follow the selection from any panel — mapped to this account's MT5 name (GC=F → XAUUSD), ignored if it can't
  // be traded. A new symbol disarms the order (patchDraft drops side and levels), so it can't go out elsewhere.
  useEffect(() => {
    const mt5 = selectedSymbol && toMt5(selectedSymbol, symbols);
    if (mt5) patchDraft({ symbol: mt5 });
  }, [selectedSymbol, symbols, patchDraft]);

  const { data: quotes } = useMt5Quotes(symbol ? [symbol] : []);
  const quote = quotes?.[symbol];
  // Bridge sends no symbol digits and fmtPrice trims trailing zeros — keep the most decimals seen for this
  // symbol so prices don't jitter in width and pips read right
  if (quote) {
    const d = Math.max(decimals(quote.bid), decimals(quote.ask));
    const prev = digitsRef.current;
    digitsRef.current = { symbol, digits: prev.symbol === symbol ? Math.max(prev.digits, d) : d };
  }
  const digits = digitsRef.current.symbol === symbol ? digitsRef.current.digits : 0;

  if (!user) return <LoginPrompt />;

  const busy = marketOrder.isPending || pendingOrder.isPending;
  const pip = pipSize(digits);
  const entry = side ? draftEntry(draft, quote) : 0;
  const bad = side ? levelsError(side, draftRef(draft, quote), sl, tp) : null;
  const pendingType = kind === 'PENDING' && side && quote && price ? pendingTypeFor(side, price, quote.bid, quote.ask) : null;
  const valid = !!symbol && Number(volume) > 0 && !bad && (kind === 'MARKET' || !!pendingType);
  const action = side && `${typeName(pendingType ?? side)} ${volume} lots${kind === 'PENDING' && price ? ` @ ${fmtPrice(price)}` : ''}`;
  const spread = quote && digits ? ((quote.ask - quote.bid) / pip).toFixed(1) : null;

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!side || !valid || busy || readOnly) return;
    setResult('');
    const common = { symbol, volume: Number(volume), stopLoss: sl, takeProfit: tp };
    const desc = pendingType ? `${pendingType} ${volume} ${symbol} @ ${fmtPrice(price)}` : `${side} ${volume} ${symbol} @ MKT`;
    try {
      const r = pendingType
        ? await pendingOrder.mutateAsync({ ...common, orderType: pendingType, price })
        : await marketOrder.mutateAsync({ ...common, side });
      setResult(`#${r.orderTicket} ${desc}${r.price ? ` → ${fmtPrice(r.price)}` : ''}`);
      addLogEntry({ type: 'trade', message: `[MT5] ${desc}` });
      patchDraft({ side: null, sl: 0, tp: 0 });
    } catch (err) {
      // Never auto-retry: the bridge can report a timeout for an order that did fill — positions refresh on settle
      setResult(`Error: ${errMsg(err)}`);
    }
  };

  // A pending order starts 10 pips out on its limit side — valid as it stands, then nudged or dragged into place
  const startPrice = (s: Side | null) => (quote ? snap(s === 'SELL' ? quote.bid + 10 * pip : quote.ask - 10 * pip, digits) : 0);

  const pickSide = (s: Side) => {
    if (readOnly) return;
    setResult('');
    const patch: Partial<OrderDraft> = { side: s };
    // Flipping sides mirrors the levels around the entry: the SL stays a stop, the TP a target, same distance
    const e = side && side !== s ? draftEntry(draft, quote) : 0;
    if (e && sl) patch.sl = snap(2 * e - sl, digits);
    if (e && tp) patch.tp = snap(2 * e - tp, digits);
    if (kind === 'PENDING' && !price) patch.price = startPrice(s);
    patchDraft(patch);
  };
  const pickKind = (k: OrderDraft['kind']) =>
    patchDraft({ kind: k, ...(k === 'PENDING' && !price ? { price: startPrice(side) } : {}) });
  const stepVolume = (dir: number) =>
    patchDraft({ volume: String(Math.max(0.01, +((Number(volume) || 0) + dir * 0.01).toFixed(2))) });
  const stepPrice = (dir: number) => patchDraft({ price: snap((price || startPrice(side)) + dir * pip, digits) });

  const tile = (s: Side) => {
    const on = side === s;
    return (
      <button type="button" onClick={() => pickSide(s)} aria-pressed={on} aria-disabled={readOnly || undefined}
        className={`flex-1 min-w-0 px-3 pt-1.5 pb-3 border rounded-sm transition-colors duration-100 motion-reduce:transition-none ${
          s === 'BUY' ? 'text-right' : 'text-left'} ${on ? SIDE_STYLE[s].on : SIDE_STYLE[s].off}`}>
        <div className="text-mini opacity-80">{t(s === 'BUY' ? 'buy' : 'sell')}</div>
        <div className="text-[15px] font-bold leading-tight tabular-nums">
          <PipPrice value={quote && (s === 'BUY' ? quote.ask : quote.bid)} digits={digits} />
        </div>
      </button>
    );
  };

  const pendingNote = !side ? '' : !price ? 'Enter a price' : !quote ? '' : pendingType ? typeName(pendingType)
    : 'At the market: set it above or below';

  return (
    <form onSubmit={send} noValidate
      onKeyDown={(e) => { if (e.key === 'Escape' && side) { e.preventDefault(); patchDraft({ side: null }); } }}
      className="@container h-full overflow-auto no-scrollbar bg-black p-2">
      <div className="grid gap-x-4 gap-y-3 @lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <SymbolPicker
              className="flex-1 min-w-0"
              symbols={symbols}
              value={symbol}
              onSelect={(s) => patchDraft({ symbol: s })}
              placeholder={t('symbolPlaceholder')}
            />
            <span className="shrink-0 flex items-center gap-1 text-mini text-neutral/50" title={user.name ?? undefined}>
              {readOnly && <span title={t('investorReadOnly')}><Lock className="w-3 h-3 text-orange" /></span>}
              #{user.mt5Login}
            </span>
          </div>

          {/* Picking a side arms the order: its preview appears on the chart */}
          <div className="relative flex gap-1.5">
            {tile('SELL')}
            {tile('BUY')}
            {spread && (
              <span title="Spread" className="absolute left-1/2 -translate-x-1/2 -bottom-2 px-1.5 py-px rounded-sm bg-raised border border-border text-micro text-neutral tabular-nums whitespace-nowrap">
                {spread} pips
              </span>
            )}
          </div>

          <div role="group" aria-label="Order type" className="flex h-8 p-0.5 gap-0.5 border border-border rounded-sm">
            {KINDS.map(([k, label]) => (
              <button key={k} type="button" onClick={() => pickKind(k)} aria-pressed={kind === k}
                className={`flex-1 rounded-sm text-xs ${kind === k ? 'bg-white/10 text-white' : 'text-neutral/60 hover:text-neutral'}`}>
                {label}
              </button>
            ))}
          </div>

          {kind === 'PENDING' && (
            <div className="flex flex-col gap-1">
              <label htmlFor="ticket-price" className={LABEL}>{t('price')}</label>
              <div className={FIELD}>
                <input id="ticket-price" type="number" step="any" min="0" value={price || ''} placeholder="Price"
                  onChange={(e) => patchDraft({ price: Number(e.target.value) || 0 })}
                  aria-invalid={(!!side && !!quote && !!price && !pendingType) || undefined} aria-describedby="ticket-price-note"
                  className="flex-1 h-full" />
                <button type="button" onClick={() => stepPrice(-1)} disabled={!quote} aria-label="Price down a pip" className={FIELD_BTN}>−</button>
                <button type="button" onClick={() => stepPrice(1)} disabled={!quote} aria-label="Price up a pip" className={FIELD_BTN}>+</button>
              </div>
              {pendingNote && (
                <p id="ticket-price-note" className={`text-mini ${pendingType ? 'text-neutral' : 'text-bearish'}`}>{pendingNote}</p>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="ticket-volume" className={LABEL}>Volume</label>
            <div className={FIELD}>
              <input id="ticket-volume" type="number" step="0.01" min="0.01" value={volume}
                onChange={(e) => patchDraft({ volume: e.target.value })} className="flex-1 h-full" />
              <span className="flex items-center pr-2 text-mini text-neutral/60">Lots</span>
              <button type="button" onClick={() => stepVolume(-1)} aria-label="Fewer lots" className={FIELD_BTN}>−</button>
              <button type="button" onClick={() => stepVolume(1)} aria-label="More lots" className={FIELD_BTN}>+</button>
            </div>
          </div>

          <LevelField field="tp" label="Take profit" level={tp} side={side} entry={entry} digits={digits}
            error={bad?.startsWith('TP') ? bad : null} onSet={(v) => patchDraft({ tp: v })} />
          <LevelField field="sl" label={t('stopLoss')} level={sl} side={side} entry={entry} digits={digits}
            error={bad?.startsWith('SL') ? bad : null} onSet={(v) => patchDraft({ sl: v })} />

          <div className="flex flex-col gap-1.5 mt-1">
            <button type="submit" disabled={readOnly || busy || !side || !valid}
              className={`h-10 border rounded-sm text-xs font-semibold ${side ? SIDE_STYLE[side].submit : 'border-border text-neutral'}`}>
              {readOnly ? t('investorReadOnly') : busy ? t('submitting') : action ? `Confirm ${action}` : 'Pick Sell or Buy'}
            </button>
            {side && !readOnly && (
              <button type="button" onClick={() => patchDraft({ side: null })} disabled={busy}
                className="h-8 border border-border rounded-sm text-xs text-neutral hover:text-white">
                {t('cancel')}
              </button>
            )}
          </div>

          {result && (
            <p role="status" className={`text-mini ${result.startsWith('Error') ? 'text-bearish' : 'text-bullish'}`}>{result}</p>
          )}
        </div>

        <p className="text-mini leading-snug text-neutral/40 @lg:col-span-2">{t('earlyAccessTrading')}</p>
      </div>
    </form>
  );
}

/**
 * Take profit / stop loss as a price or a distance in pips, ✕ to clear, ± a pip at a time. With no level set, ± puts
 * one 10 pips out on its own side of the entry (needs a side). The readout gives the other unit.
 */
function LevelField({ field, label, level, side, entry, digits, error, onSet }: {
  field: 'sl' | 'tp'; label: string; level: number; side: Side | null; entry: number; digits: number;
  error: string | null; onSet: (level: number) => void;
}) {
  const [mode, setMode] = useState<'price' | 'pips'>('price');
  // While typing, the field keeps what was typed: a pips distance would otherwise re-derive on every tick
  const [typed, setTyped] = useState<string | null>(null);
  const id = `ticket-${field}`;
  const dir = side && entry > 0 ? side : null;
  const dist = dir && level ? pips(dir, entry, level, digits) : null;
  const value = typed ?? (!level ? '' : mode === 'price' ? fmtPrice(level) : dist == null ? '' : String(Math.abs(dist)));

  const type = (v: string) => {
    setTyped(v);
    const n = Number(v);
    if (!(n > 0)) onSet(0);
    else if (mode === 'price') onSet(n);
    else if (dir) onSet(levelAtPips(dir, field, entry, n, digits));
  };
  const step = (by: 1 | -1) => {
    setTyped(null);
    if (!level) { if (dir) onSet(levelAtPips(dir, field, entry, 10, digits)); }
    else if (mode === 'pips' && dir && dist != null) onSet(levelAtPips(dir, field, entry, Math.max(1, Math.abs(dist) + by), digits));
    else onSet(snap(level + by * pipSize(digits), digits));
  };

  const note = error ?? (!level ? null : mode === 'price' ? (dist == null ? null : pipText(dist)) : `@ ${fmtPrice(level)}`);
  const noSide = mode === 'pips' && !dir;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className={LABEL}>{label}</label>
      <div className={FIELD}>
        <input id={id} type="number" step="any" min="0" value={value} disabled={noSide}
          placeholder={noSide ? 'Pick a side' : 'Not set'}
          onChange={(e) => type(e.target.value)} onBlur={() => setTyped(null)}
          aria-invalid={!!error || undefined} aria-describedby={note ? `${id}-note` : undefined}
          className="flex-1 h-full" />
        {level > 0 && (
          <button type="button" onClick={() => { setTyped(null); onSet(0); }} aria-label={`Clear ${label.toLowerCase()}`}
            className="px-2 text-neutral/60 hover:text-white">✕</button>
        )}
        <select value={mode} onChange={(e) => { setTyped(null); setMode(e.target.value as 'price' | 'pips'); }}
          aria-label={`${label} as`} className="bg-transparent border-l border-border px-1.5 text-mini text-neutral cursor-pointer outline-none">
          <option value="price">Price</option>
          <option value="pips">Pips</option>
        </select>
        <button type="button" onClick={() => step(-1)} disabled={!level && !dir} aria-label={`${label} down`} className={FIELD_BTN}>−</button>
        <button type="button" onClick={() => step(1)} disabled={!level && !dir} aria-label={`${label} up`} className={FIELD_BTN}>+</button>
      </div>
      {note && (
        <p id={`${id}-note`} className={`text-mini tabular-nums ${error || (dist != null && dist < 0) ? 'text-bearish' : 'text-neutral'}`}>{note}</p>
      )}
    </div>
  );
}

/**
 * Inline SL / TP editor under a position row. Each level shows the P&L it would lock in and its distance from the
 * closing price. Empty = no level; only changed levels are sent (0 removes one).
 */
function StopsEditor({ p, price, digits, onDone, onError }: {
  p: Mt5Position; price: number; digits: number; onDone: () => void; onError: (msg: string) => void;
}) {
  const t = useT();
  const addLogEntry = useAppStore((s) => s.addLogEntry);
  const modify = useMt5ModifyPosition();
  // fmtPrice, not toFixed(digits): digits is inferred and may be short — never round an existing level
  const [sl, setSl] = useState(p.stopLoss ? fmtPrice(p.stopLoss) : '');
  const [tp, setTp] = useState(p.takeProfit ? fmtPrice(p.takeProfit) : '');
  const slN = Number(sl) || 0;
  const tpN = Number(tp) || 0;
  const bad = levelsError(p.side, price, slN, tpN);
  const badField = bad?.startsWith('SL') ? 'sl' : bad ? 'tp' : null;
  const change = {
    ...(Math.abs(slN - p.stopLoss) > 1e-9 ? { stopLoss: slN } : {}),
    ...(Math.abs(tpN - p.takeProfit) > 1e-9 ? { takeProfit: tpN } : {}),
  };
  const dirty = Object.keys(change).length > 0;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bad || !dirty || modify.isPending) return;
    try {
      await modify.mutateAsync({ ticket: p.ticket, ...change });
      addLogEntry({ type: 'trade', message: `[MT5] MODIFY #${p.ticket} ${p.symbol} SL ${fmtPrice(slN)} TP ${fmtPrice(tpN)}` });
      onDone();
    } catch (err) {
      onError(errMsg(err)); // stay open so the levels can be fixed and sent again
    }
  };

  const field = (key: 'sl' | 'tp', label: string, value: string, set: (v: string) => void, level: number, autoFocus?: boolean) => {
    const pnl = level ? liveProfit(p, level) : 0;
    const invalid = badField === key;
    return (
      <div className="grid grid-cols-[4.5rem_minmax(0,10rem)_1fr] items-center gap-2">
        <label htmlFor={`${p.ticket}-${key}`} className={LABEL}>{label}</label>
        <div className="flex h-7">
          <input id={`${p.ticket}-${key}`} type="number" min="0" step={10 ** -digits} value={value} placeholder="Not set"
            autoFocus={autoFocus} onChange={(e) => set(e.target.value)} aria-invalid={invalid || undefined}
            aria-describedby={invalid ? `${p.ticket}-stops-error` : undefined}
            className="flex-1 min-w-0 h-7 text-[12px] text-right" />
          <button type="button" onClick={() => set('')} disabled={!value} aria-label={`Remove ${label.toLowerCase()}`}
            className={`${STEP} border-l-0 text-mini`}>✕</button>
        </div>
        {/* An invalid level can't be hit — its readout dims instead of promising a P&L */}
        <span className={`text-mini font-mono tabular-nums whitespace-nowrap ${invalid ? 'opacity-30' : ''}`}
          title="If hit: P&L at this level, distance from the closing price">
          {level ? (
            <>
              <span className={pnl >= 0 ? 'text-bullish' : 'text-bearish'}>{fmtSigned(pnl)}</span>
              <span className="text-neutral/40 ml-2">{Math.round(Math.abs(level - price) * 10 ** digits)} pts</span>
            </>
          ) : <span className="text-neutral/30">—</span>}
        </span>
      </div>
    );
  };

  return (
    <form onSubmit={save} noValidate onKeyDown={(e) => { if (e.key === 'Escape') onDone(); }}
      className="mt-2 pt-2 border-t border-border/30 flex flex-col gap-1.5">
      {field('sl', t('stopLoss'), sl, setSl, slN, true)}
      {field('tp', 'Take profit', tp, setTp, tpN)}
      {bad && <p id={`${p.ticket}-stops-error`} role="alert" className="text-mini text-bearish">{bad}</p>}
      <div className="flex justify-end gap-1 mt-0.5">
        <button type="button" onClick={onDone} className="h-7 px-3 border border-border text-mini text-neutral hover:text-white">
          {t('cancel')}
        </button>
        <button type="submit" disabled={!!bad || !dirty || modify.isPending}
          className="h-7 px-3 border border-accent text-accent-ink text-mini font-bold hover:bg-accent/15">
          {modify.isPending ? t('submitting') : 'Save SL/TP'}
        </button>
      </div>
    </form>
  );
}

/** Open positions panel. */
export function Mt5Positions() {
  const t = useT();
  const user = useAuthStore((s) => s.user);
  const readOnly = user?.readOnly ?? false;
  const addLogEntry = useAppStore((s) => s.addLogEntry);
  const setSelectedSymbol = useAppStore((s) => s.setSelectedSymbol);
  const tradeFocus = useAppStore((s) => s.tradeFocus);
  const setTradeFocus = useAppStore((s) => s.setTradeFocus);

  const { data: positions = [], error: loadError } = useMt5Positions();
  const closePosition = useMt5ClosePosition();
  const [closeVolume, setCloseVolume] = useState<Record<number, string>>({});
  const [editing, setEditing] = useState<number | null>(null); // ticket whose SL / TP editor is open
  const [error, setError] = useState('');

  const { data: quotes } = useMt5Quotes([...new Set(positions.map((p) => p.symbol))]);

  if (!user) return <LoginPrompt />;

  const handleClose = async (ticket: number, sym: string) => {
    const v = Number(closeVolume[ticket]) || undefined;
    try {
      await closePosition.mutateAsync({ ticket, volume: v });
      addLogEntry({ type: 'trade', message: `[MT5] CLOSE #${ticket} ${sym}${v ? ` ${v}` : ''}` });
      setCloseVolume(({ [ticket]: _, ...rest }) => rest);
    } catch (err) {
      setError(errMsg(err));
    }
  };

  // Closing price moves with the live feed (BUY closes at bid, SELL at ask), and P&L with it
  const livePositions = positions.map((p) => {
    const q = quotes?.[p.symbol];
    const price = q ? (p.side === 'BUY' ? q.bid : q.ask) : p.currentPrice;
    return { ...p, price, pnl: q ? liveProfit(p, price) : p.profit };
  });
  const totalProfit = livePositions.reduce((sum, p) => sum + p.pnl, 0);

  return (
    <div className="h-full flex flex-col overflow-hidden bg-black">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/30 bg-black/40 shrink-0">
        <span className="text-mini font-mono text-neutral uppercase">
          {t('positions')} <span className="text-white font-bold">{positions.length}</span>
        </span>
        <span className={`text-mini font-mono font-bold ${totalProfit >= 0 ? 'text-bullish' : 'text-bearish'}`}>
          {t('unrealizedPl')} {totalProfit >= 0 ? '+' : ''}{fmtMoney(totalProfit)}
        </span>
      </div>

      <div className="flex-1 overflow-auto no-scrollbar">
        <ErrorBar msg={error || (loadError ? errMsg(loadError) : '')} onDismiss={error ? () => setError('') : undefined} />

        {positions.length === 0 ? <Empty label={t('noOpenPositions')} /> : livePositions.map((p) => (
          <div key={p.ticket} onMouseEnter={() => setTradeFocus(`p${p.ticket}`)} onMouseLeave={() => setTradeFocus(null)}
            className={`px-3 py-2 border-b border-l-2 border-b-border/30 group ${tradeFocus === `p${p.ticket}` ? 'bg-white/[0.05] border-l-accent' : 'border-l-transparent'}`}>
            <div className="flex items-center justify-between gap-2">
              <button onClick={() => setSelectedSymbol(p.symbol)} className="text-left min-w-0">
                <span className={`text-mini font-black mr-1.5 ${p.side === 'BUY' ? 'text-accent-ink' : 'text-bearish'}`}>{p.side}</span>
                <SymbolLogo symbol={p.symbol} className="mr-1" />
                <span className="text-xs font-mono font-bold text-white hover:text-accent-ink">{p.symbol}</span>
                <span className="text-mini font-mono text-neutral ml-2">{p.volume} @ {fmtPrice(p.openPrice)}</span>
              </button>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-mini font-mono text-white/70">{fmtPrice(p.price)}</span>
                <span className={`text-mini font-mono font-bold ${p.pnl >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                  {p.pnl >= 0 ? '+' : ''}{fmtMoney(p.pnl)}
                </span>
                {!readOnly && (
                  <div className={`flex items-center gap-1 transition-all ${editing === p.ticket ? '' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'}`}>
                    <button onClick={() => { setError(''); setEditing(editing === p.ticket ? null : p.ticket); }}
                      aria-expanded={editing === p.ticket} aria-label={`Edit SL/TP #${p.ticket}`}
                      className={`text-micro font-black uppercase tracking-widest px-2 py-1 border ${
                        editing === p.ticket ? 'border-accent text-accent-ink' : 'border-border text-neutral hover:text-white hover:border-neutral/60'
                      }`}>
                      SL/TP
                    </button>
                    <input type="number" step="0.01" min="0.01" max={p.volume} aria-label="Lots to close"
                      value={closeVolume[p.ticket] ?? ''} placeholder={String(p.volume)}
                      onChange={(e) => setCloseVolume((cv) => ({ ...cv, [p.ticket]: e.target.value }))}
                      className="w-14 bg-black/60 border border-border/40 px-1 py-0.5 text-mini font-mono text-white" />
                    <button onClick={() => handleClose(p.ticket, p.symbol)} disabled={closePosition.isPending}
                      className="text-micro font-black uppercase tracking-widest px-2 py-1 border border-bearish/40 text-bearish hover:bg-bearish/20 disabled:opacity-30">
                      {t('closePosition')}
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 mt-0.5 text-micro font-mono text-neutral/40">
              <span>#{p.ticket}</span>
              {p.stopLoss > 0 && <span>SL {fmtPrice(p.stopLoss)}</span>}
              {p.takeProfit > 0 && <span>TP {fmtPrice(p.takeProfit)}</span>}
              <span className="ml-auto">{fmtTime(p.openTime)}</span>
            </div>
            {editing === p.ticket && !readOnly && (
              <StopsEditor key={p.ticket} p={p} price={p.price} digits={digitsOf(p, quotes?.[p.symbol])}
                onDone={() => setEditing(null)} onError={setError} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Pending orders panel. */
export function Mt5Orders() {
  const t = useT();
  const user = useAuthStore((s) => s.user);
  const readOnly = user?.readOnly ?? false;
  const addLogEntry = useAppStore((s) => s.addLogEntry);
  const tradeFocus = useAppStore((s) => s.tradeFocus);
  const setTradeFocus = useAppStore((s) => s.setTradeFocus);

  const { data: orders = [], error: loadError } = useMt5Orders();
  const cancelOrder = useMt5CancelOrder();
  const [error, setError] = useState('');

  if (!user) return <LoginPrompt />;

  const handleCancel = async (ticket: number, sym: string) => {
    try {
      await cancelOrder.mutateAsync({ ticket });
      addLogEntry({ type: 'trade', message: `[MT5] CANCEL #${ticket} ${sym}` });
    } catch (err) {
      setError(errMsg(err));
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-black">
      <div className="flex-1 overflow-auto no-scrollbar">
        <ErrorBar msg={error || (loadError ? errMsg(loadError) : '')} onDismiss={error ? () => setError('') : undefined} />

        {orders.length === 0 ? <Empty label={t('noRecentOrders')} /> : orders.map((o) => (
          <div key={o.ticket} onMouseEnter={() => setTradeFocus(`o${o.ticket}`)} onMouseLeave={() => setTradeFocus(null)}
            className={`px-3 py-2 border-b border-l-2 border-b-border/30 group ${tradeFocus === `o${o.ticket}` ? 'bg-white/[0.05] border-l-accent' : 'border-l-transparent'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`text-mini font-black uppercase px-1.5 py-0.5 border ${
                  o.type.startsWith('BUY') ? 'text-accent-ink border-buy/30 bg-buy/10' : 'text-bearish border-sell/30 bg-sell/10'
                }`}>{o.type.replace('_', ' ')}</span>
                <span className="flex items-center gap-1">
                  <SymbolLogo symbol={o.symbol} />
                  <span className="text-xs font-mono font-bold text-white">{o.symbol}</span>
                </span>
                <span className="text-mini font-mono text-neutral">{o.volume} @ {fmtPrice(o.price)}</span>
              </div>
              {!readOnly && (
                <button onClick={() => handleCancel(o.ticket, o.symbol)} disabled={cancelOrder.isPending}
                  aria-label={`${t('cancel')} #${o.ticket}`}
                  className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-micro font-black uppercase px-1.5 py-0.5 border border-bearish/40 text-bearish hover:bg-bearish/20 transition-all disabled:opacity-30">
                  {t('cancel')}
                </button>
              )}
            </div>
            <div className="flex items-center gap-3 mt-0.5 text-micro font-mono text-neutral/40">
              <span>#{o.ticket}</span>
              {o.stopLoss > 0 && <span>SL {fmtPrice(o.stopLoss)}</span>}
              {o.takeProfit > 0 && <span>TP {fmtPrice(o.takeProfit)}</span>}
              <span className="ml-auto">{fmtTime(o.setupTime)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const PERIODS = [[1, '24h', 'the last 24 hours'], [7, '7d', 'the last 7 days'], [30, '30d', 'the last 30 days'], [90, '90d', 'the last 90 days']] as const;

/** Order history: executed deals (entries and exits), newest first. */
export function Mt5History() {
  const t = useT();
  const user = useAuthStore((s) => s.user);
  const setSelectedSymbol = useAppStore((s) => s.setSelectedSymbol);
  const [days, setDays] = useState<number>(7);
  const { data: deals = [], error, isLoading } = useMt5Deals(days);

  if (!user) return <LoginPrompt />;

  const rows = [...deals].reverse(); // bridge sends oldest first
  const sum = (k: 'profit' | 'commission' | 'swap' | 'fee') => deals.reduce((s, d) => s + d[k], 0);
  const net = sum('profit') + sum('commission') + sum('swap') + sum('fee');
  const period = PERIODS.find(([d]) => d === days)![2];

  return (
    <div className="@container h-full flex flex-col overflow-hidden bg-black">
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-border/30 shrink-0">
        <div role="group" aria-label="Period" className="flex h-6 border border-border">
          {PERIODS.map(([d, label]) => (
            <button key={d} type="button" onClick={() => setDays(d)} aria-pressed={days === d}
              className={`px-2 text-mini font-mono ${days === d ? 'bg-white/10 text-white' : 'text-neutral/50 hover:text-neutral'}`}>
              {label}
            </button>
          ))}
        </div>
        <span className="text-mini font-mono text-neutral tabular-nums whitespace-nowrap"
          title={`Profit ${fmtMoney(sum('profit'))}\nCommission ${fmtMoney(sum('commission'))}\nSwap ${fmtMoney(sum('swap'))}\nFees ${fmtMoney(sum('fee'))}`}>
          {deals.length} {deals.length === 1 ? 'deal' : 'deals'}
          <span className="ml-3">Net </span>
          <span className={`font-bold ${net >= 0 ? 'text-bullish' : 'text-bearish'}`}>{fmtSigned(net)}</span>
        </span>
      </div>

      <div className="flex-1 overflow-auto no-scrollbar">
        <ErrorBar msg={error ? errMsg(error) : ''} />

        {isLoading ? <Empty label={t('loading')} /> : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-1 text-mini font-mono">
            <span className="text-neutral">No deals in {period}</span>
            <span className="text-neutral/40">Trades you open or close show up here.</span>
          </div>
        ) : (
          <table className="deals tabular-nums">
            <thead>
              <tr>
                <th>Time</th><th>Symbol</th><th>Type</th><th>In/Out</th>
                <th className="r">Lots</th><th className="r">Price</th><th className="r">Commission</th><th className="r">Swap</th><th className="r">Profit</th>
                <th className="hidden @2xl:table-cell">Comment</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.ticket} onClick={() => setSelectedSymbol(d.symbol)} className="cursor-pointer"
                  title={`Deal #${d.ticket}\nOrder #${d.orderTicket}\nPosition #${d.positionId}`}>
                  <td className="text-neutral/60">{fmtTime(d.time)}</td>
                  <td className="text-white font-bold"><SymbolLogo symbol={d.symbol} size={12} className="mr-1" />{d.symbol}</td>
                  <td className={`font-bold ${d.action === 'BUY' ? 'text-accent-ink' : 'text-bearish'}`}>{d.action}</td>
                  <td className="text-neutral/70">{d.entry.replace('_', ' ').toLowerCase()}</td>
                  <td className="r text-white/80">{d.volume}</td>
                  <td className="r text-white/80">{fmtPrice(d.price)}</td>
                  <td className="r text-neutral/60">{d.commission ? fmtMoney(d.commission) : '—'}</td>
                  <td className="r text-neutral/60">{d.swap ? fmtMoney(d.swap) : '—'}</td>
                  <td className={`r font-bold ${d.entry === 'IN' ? 'text-neutral/30' : d.profit >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                    {d.entry === 'IN' ? '—' : fmtSigned(d.profit)}
                  </td>
                  <td className="hidden @2xl:table-cell text-neutral/50">{d.comment}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
