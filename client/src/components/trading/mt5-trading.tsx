import { useState, useEffect, useRef } from 'react';
import {
  useMt5Symbols, useMt5Quotes, useMt5Positions, useMt5Orders,
  useMt5MarketOrder, useMt5PendingOrder, useMt5ClosePosition, useMt5CancelOrder,
  type Mt5PendingType, type Mt5Position,
} from '../../api/hooks/use-mt5';
import { useAuthStore } from '../../stores/use-auth-store';
import { useAppStore } from '../../stores/use-app-store';
import { useT } from '../../i18n';
import { SymbolPicker } from './symbol-picker';
import { AlertTriangle, Lock, LogIn } from 'lucide-react';

type Kind = 'MARKET' | 'LIMIT' | 'STOP';

// Literal class strings — Tailwind can't see interpolated ones
const SIDE_STYLE = {
  BUY: { on: 'bg-bullish/15 border-bullish', off: 'border-border hover:border-bullish/60', text: 'text-bullish', submit: 'bg-bullish/15 border-bullish text-bullish hover:bg-bullish/25' },
  SELL: { on: 'bg-bearish/15 border-bearish', off: 'border-border hover:border-bearish/60', text: 'text-bearish', submit: 'bg-bearish/15 border-bearish text-bearish hover:bg-bearish/25' },
};
const KINDS = [['MARKET', 'Market'], ['LIMIT', 'Limit'], ['STOP', 'Stop']] as const;
const ROW = 'grid grid-cols-[4.5rem_1fr] items-center gap-2';
const LABEL = 'text-[10px] text-neutral/60';
const STEP = 'w-7 shrink-0 border border-border text-neutral/70 hover:text-white hover:bg-white/5';

/** Bridge gives no symbol digits — trim float noise (1.3308200000000001 → 1.33082). */
export const fmtPrice = (n: number) => String(+n.toFixed(6));
const fmtMoney = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const errMsg = (err: unknown) => (err instanceof Error ? err.message : 'Failed');
const fmtTime = (iso: string) => new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });

/**
 * Floating P&L at a live price. The bridge gives no contract size or conversion rate, so money-per-price-unit
 * is inferred from the last 5s poll (profit / move) and applied to the live FIX price.
 * ponytail: exact while the conversion rate is steady (account-currency quoted symbols); crosses drift until the next poll
 */
export function liveProfit(p: Mt5Position, price: number): number {
  const dir = p.side === 'BUY' ? 1 : -1;
  const polledMove = (p.currentPrice - p.openPrice) * dir;
  // At (or cents from) the open price the rate can't be inferred reliably — keep the polled figure
  if (Math.abs(polledMove) < 1e-9 || Math.abs(p.profit) < 0.1) return p.profit;
  return (p.profit / polledMove) * (price - p.openPrice) * dir;
}

const decimals = (n: number) => (fmtPrice(n).split('.')[1] ?? '').length;

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
      {end < s.length && <sup className="text-[11px]">{s.slice(end)}</sup>}
    </>
  );
}

function NumField({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <label className={ROW}>
      <span className={LABEL}>{label}</span>
      <input type="number" step="any" min="0" value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)} className="w-full h-7 text-[12px] text-right" />
    </label>
  );
}

function LoginPrompt() {
  const t = useT();
  const setLoginModalOpen = useAuthStore((s) => s.setLoginModalOpen);
  return (
    <div className="h-full flex flex-col items-center justify-center p-6 gap-4 bg-black">
      <button
        onClick={() => setLoginModalOpen(true)}
        className="flex items-center gap-2 px-4 py-2 border border-accent text-accent text-[11px] font-black uppercase tracking-widest hover:bg-accent hover:text-black transition-colors"
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
      <span className="text-[10px] font-mono text-bearish flex-1">{msg}</span>
      {onDismiss && <button onClick={onDismiss} className="text-bearish/60 hover:text-bearish">✕</button>}
    </div>
  );
}

const Empty = ({ label }: { label: string }) => (
  <div className="flex items-center justify-center h-32">
    <span className="text-[10px] font-mono text-neutral uppercase">{label}</span>
  </div>
);

/** Order ticket panel. */
export function Mt5Ticket() {
  const t = useT();
  const user = useAuthStore((s) => s.user);
  const readOnly = user?.readOnly ?? false;
  const watchlist = useAppStore((s) => s.tabSymbols[s.activeWatchlistTab]);
  const selectedSymbol = useAppStore((s) => s.selectedSymbol);
  const addLogEntry = useAppStore((s) => s.addLogEntry);

  const { data: symbols = [] } = useMt5Symbols();
  const marketOrder = useMt5MarketOrder();
  const pendingOrder = useMt5PendingOrder();

  const [symbol, setSymbol] = useState('');
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [kind, setKind] = useState<Kind>('MARKET');
  const [volume, setVolume] = useState('0.01');
  const [price, setPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState('');
  const digitsRef = useRef({ symbol: '', digits: 0 });
  // Any ticket edit disarms a pending confirm so the armed order can't go out with different params
  const disarm = <T,>(set: (v: T) => void) => (v: T) => { set(v); setConfirm(false); };

  // Default to the first watchlist symbol (never an arbitrary allowed one — whatever is picked gets a live
  // subscription)
  useEffect(() => {
    if (symbol || !symbols.length) return;
    const first = watchlist?.find((w) => symbols.some((s) => s.symbol === w));
    if (first) setSymbol(first);
  }, [symbols, symbol, watchlist]);

  // Follow the Market Watch / Positions selection — only to symbols this account can trade (other panels set
  // Yahoo tickers). Disarm a pending confirm so the next click can't send the armed order on a different symbol.
  useEffect(() => {
    if (!selectedSymbol || !symbols.some((s) => s.symbol === selectedSymbol)) return;
    setSymbol(selectedSymbol);
    setConfirm(false);
  }, [selectedSymbol, symbols]);

  const { data: quotes } = useMt5Quotes(symbol ? [symbol] : []);
  const quote = quotes?.[symbol];
  // Bridge sends no symbol digits and fmtPrice trims trailing zeros — keep the most decimals seen for this
  // symbol so prices don't jitter in width and the spread reads in points
  if (quote) {
    const d = Math.max(decimals(quote.bid), decimals(quote.ask));
    const prev = digitsRef.current;
    digitsRef.current = { symbol, digits: prev.symbol === symbol ? Math.max(prev.digits, d) : d };
  }
  const digits = digitsRef.current.symbol === symbol ? digitsRef.current.digits : 0;

  if (!user) return <LoginPrompt />;

  const busy = marketOrder.isPending || pendingOrder.isPending;
  const orderType = `${side}_${kind}` as Mt5PendingType;
  const desc = kind === 'MARKET' ? `${side} ${volume} ${symbol} @ MKT` : `${orderType} ${volume} ${symbol} @ ${price}`;

  const handleOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirm) {
      setConfirm(true);
      return;
    }
    setConfirm(false);
    setResult('');
    const common = { symbol, volume: Number(volume), stopLoss: Number(stopLoss) || 0, takeProfit: Number(takeProfit) || 0 };
    try {
      const r = kind === 'MARKET'
        ? await marketOrder.mutateAsync({ ...common, side })
        : await pendingOrder.mutateAsync({ ...common, orderType, price: Number(price) });
      setResult(`#${r.orderTicket} ${desc}${r.price ? ` → ${fmtPrice(r.price)}` : ''}`);
      addLogEntry({ type: 'trade', message: `[MT5] ${desc}` });
    } catch (err) {
      // Never auto-retry: the bridge can report a timeout for an order that did fill — positions refresh on settle
      setResult(`Error: ${errMsg(err)}`);
    }
  };

  const spread = quote ? Math.round((quote.ask - quote.bid) * 10 ** digits) : null;
  const valid = !!symbol && Number(volume) > 0 && (kind === 'MARKET' || Number(price) > 0);
  const action = `${t(side === 'BUY' ? 'buy' : 'sell')} ${volume} ${symbol}${kind === 'MARKET' ? '' : ` ${kind} @ ${price}`}`;

  const pickKind = (k: Kind) => {
    disarm(setKind)(k);
    // Pending orders start from the live price — nudge it rather than type it out
    if (k !== 'MARKET' && !price && quote) setPrice((side === 'BUY' ? quote.ask : quote.bid).toFixed(digits));
  };
  const stepVolume = (dir: number) =>
    disarm(setVolume)(String(Math.max(0.01, +((Number(volume) || 0) + dir * 0.01).toFixed(2))));

  const sideButton = (s: 'BUY' | 'SELL') => {
    const st = SIDE_STYLE[s];
    return (
      <button type="button" onClick={() => disarm(setSide)(s)} aria-pressed={side === s}
        className={`px-2.5 py-1.5 border ${s === 'BUY' ? 'text-right' : 'text-left'} ${side === s ? st.on : st.off}`}>
        <div className={`text-[10px] opacity-80 ${st.text}`}>{t(s === 'BUY' ? 'buy' : 'sell')}</div>
        <div className={`text-[14px] font-bold leading-tight tabular-nums ${st.text}`}>
          <PipPrice value={quote && (s === 'BUY' ? quote.ask : quote.bid)} digits={digits} />
        </div>
      </button>
    );
  };

  return (
    <form onSubmit={handleOrder} className="@container h-full overflow-auto no-scrollbar bg-black p-2">
      <div className="grid gap-x-4 gap-y-2 @lg:grid-cols-2">
        {/* Instrument and live price — clicking a price picks the side */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <SymbolPicker
              className="flex-1 min-w-0"
              symbols={symbols}
              value={symbol}
              onSelect={disarm(setSymbol)}
              placeholder={t('symbolPlaceholder')}
            />
            <span className="shrink-0 flex items-center gap-1 text-[10px] text-neutral/50" title={user.name}>
              {readOnly && <span title={t('investorReadOnly')}><Lock className="w-3 h-3 text-amber-400" /></span>}
              #{user.mt5Login}
            </span>
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
            {sideButton('SELL')}
            <span className="text-[10px] text-neutral/50 tabular-nums" title="Spread in points">{spread ?? ''}</span>
            {sideButton('BUY')}
          </div>
        </div>

        {/* Order parameters */}
        <div className="flex flex-col gap-1.5">
          <div className={ROW}>
            <span className={LABEL}>Type</span>
            <div role="group" aria-label="Order type" className="flex h-7 border border-border">
              {KINDS.map(([k, label]) => (
                <button key={k} type="button" onClick={() => pickKind(k)} aria-pressed={kind === k}
                  className={`flex-1 text-[11px] ${kind === k ? 'bg-white/10 text-white' : 'text-neutral/50 hover:text-neutral'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className={ROW}>
            <span className={LABEL}>Lots</span>
            <div className="flex h-7">
              <button type="button" onClick={() => stepVolume(-1)} aria-label="Fewer lots" className={`${STEP} border-r-0`}>−</button>
              <input type="number" step="0.01" min="0.01" value={volume} aria-label="Lots"
                onChange={(e) => disarm(setVolume)(e.target.value)}
                className="flex-1 min-w-0 h-7 text-[12px] text-center" />
              <button type="button" onClick={() => stepVolume(1)} aria-label="More lots" className={`${STEP} border-l-0`}>+</button>
            </div>
          </div>

          {kind !== 'MARKET' && <NumField label={t('price')} value={price} onChange={disarm(setPrice)} />}
          <NumField label={t('stopLoss')} value={stopLoss} onChange={disarm(setStopLoss)} placeholder="Not set" />
          <NumField label="Take profit" value={takeProfit} onChange={disarm(setTakeProfit)} placeholder="Not set" />

          <div className="flex gap-1 mt-1">
            <button type="submit" disabled={readOnly || busy || !valid}
              className={`flex-1 h-9 border text-[11px] font-bold uppercase tracking-wider ${SIDE_STYLE[side].submit} ${confirm ? 'animate-pulse' : ''}`}>
              {readOnly ? t('investorReadOnly') : busy ? t('submitting') : confirm ? `Confirm ${action}` : action}
            </button>
            {confirm && (
              <button type="button" onClick={() => setConfirm(false)} aria-label={t('cancel')}
                className="w-9 border border-border text-neutral hover:text-white">
                ✕
              </button>
            )}
          </div>

          {result && (
            <p role="status" className={`text-[10px] ${result.startsWith('Error') ? 'text-bearish' : 'text-bullish'}`}>{result}</p>
          )}
        </div>

        <p className="text-[9px] leading-snug text-neutral/40 @lg:col-span-2">{t('earlyAccessTrading')}</p>
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

  const { data: positions = [], error: loadError } = useMt5Positions();
  const closePosition = useMt5ClosePosition();
  const [closeVolume, setCloseVolume] = useState<Record<number, string>>({});
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
        <span className="text-[10px] font-mono text-neutral uppercase">
          {t('positions')} <span className="text-white font-bold">{positions.length}</span>
        </span>
        <span className={`text-[10px] font-mono font-bold ${totalProfit >= 0 ? 'text-bullish' : 'text-bearish'}`}>
          {t('unrealizedPl')} {totalProfit >= 0 ? '+' : ''}{fmtMoney(totalProfit)}
        </span>
      </div>

      <div className="flex-1 overflow-auto no-scrollbar">
        <ErrorBar msg={error || (loadError ? errMsg(loadError) : '')} onDismiss={error ? () => setError('') : undefined} />

        {positions.length === 0 ? <Empty label={t('noOpenPositions')} /> : livePositions.map((p) => (
          <div key={p.ticket} className="px-3 py-2 border-b border-border/30 hover:bg-white/[0.02] group">
            <div className="flex items-center justify-between gap-2">
              <button onClick={() => setSelectedSymbol(p.symbol)} className="text-left min-w-0">
                <span className={`text-[9px] font-black mr-1.5 ${p.side === 'BUY' ? 'text-bullish' : 'text-bearish'}`}>{p.side}</span>
                <span className="text-[11px] font-mono font-bold text-white hover:text-accent">{p.symbol}</span>
                <span className="text-[9px] font-mono text-neutral ml-2">{p.volume} @ {fmtPrice(p.openPrice)}</span>
              </button>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-mono text-white/70">{fmtPrice(p.price)}</span>
                <span className={`text-[10px] font-mono font-bold ${p.pnl >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                  {p.pnl >= 0 ? '+' : ''}{fmtMoney(p.pnl)}
                </span>
                {!readOnly && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-all">
                    <input type="number" step="0.01" min="0.01" max={p.volume} aria-label="Lots to close"
                      value={closeVolume[p.ticket] ?? ''} placeholder={String(p.volume)}
                      onChange={(e) => setCloseVolume((cv) => ({ ...cv, [p.ticket]: e.target.value }))}
                      className="w-14 bg-black/60 border border-border/40 px-1 py-0.5 text-[9px] font-mono text-white" />
                    <button onClick={() => handleClose(p.ticket, p.symbol)} disabled={closePosition.isPending}
                      className="text-[8px] font-black uppercase tracking-widest px-2 py-1 border border-bearish/40 text-bearish hover:bg-bearish/20 disabled:opacity-30">
                      {t('closePosition')}
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 mt-0.5 text-[8px] font-mono text-neutral/40">
              <span>#{p.ticket}</span>
              {p.stopLoss > 0 && <span>SL {fmtPrice(p.stopLoss)}</span>}
              {p.takeProfit > 0 && <span>TP {fmtPrice(p.takeProfit)}</span>}
              <span className="ml-auto">{fmtTime(p.openTime)}</span>
            </div>
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
          <div key={o.ticket} className="px-3 py-2 border-b border-border/30 hover:bg-white/[0.02] group">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 border ${
                  o.type.startsWith('BUY') ? 'text-bullish border-bullish/30 bg-bullish/10' : 'text-bearish border-bearish/30 bg-bearish/10'
                }`}>{o.type.replace('_', ' ')}</span>
                <span className="text-[11px] font-mono font-bold text-white">{o.symbol}</span>
                <span className="text-[9px] font-mono text-neutral">{o.volume} @ {fmtPrice(o.price)}</span>
              </div>
              {!readOnly && (
                <button onClick={() => handleCancel(o.ticket, o.symbol)} disabled={cancelOrder.isPending}
                  aria-label={`${t('cancel')} #${o.ticket}`}
                  className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-[8px] font-black uppercase px-1.5 py-0.5 border border-bearish/40 text-bearish hover:bg-bearish/20 transition-all disabled:opacity-30">
                  {t('cancel')}
                </button>
              )}
            </div>
            <div className="flex items-center gap-3 mt-0.5 text-[8px] font-mono text-neutral/40">
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
