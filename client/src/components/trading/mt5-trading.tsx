import { useState, useEffect } from 'react';
import {
  useMt5Symbols, useMt5Quotes, useMt5Positions, useMt5Orders,
  useMt5MarketOrder, useMt5PendingOrder, useMt5ClosePosition, useMt5CancelOrder,
  type Mt5PendingType, type Mt5Position,
} from '../../api/hooks/use-mt5';
import { useAuthStore } from '../../stores/use-auth-store';
import { useAppStore } from '../../stores/use-app-store';
import { useT } from '../../i18n';
import { SymbolPicker } from './symbol-picker';
import { ArrowRightLeft, Wallet, History, AlertTriangle, Lock, LogIn } from 'lucide-react';

type Tab = 'trade' | 'positions' | 'orders';
type Kind = 'MARKET' | 'LIMIT' | 'STOP';

/** Bridge gives no symbol digits — trim float noise (1.3308200000000001 → 1.33082). */
export const fmtPrice = (n: number) => String(+n.toFixed(6));
const fmtMoney = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const errMsg = (err: unknown) => (err instanceof Error ? err.message : 'Failed');

/**
 * Floating P&L at a live price. The bridge gives no contract size or conversion rate, so money-per-price-unit
 * is inferred from the last 5s poll (profit / move) and applied to the live FIX price.
 * ponytail: exact while the conversion rate is steady (account-currency quoted symbols); crosses drift until the next poll
 */
function liveProfit(p: Mt5Position, price: number): number {
  const dir = p.side === 'BUY' ? 1 : -1;
  const polledMove = (p.currentPrice - p.openPrice) * dir;
  // At (or cents from) the open price the rate can't be inferred reliably — keep the polled figure
  if (Math.abs(polledMove) < 1e-9 || Math.abs(p.profit) < 0.1) return p.profit;
  return (p.profit / polledMove) * (price - p.openPrice) * dir;
}

const inputClass = 'w-full bg-black/60 border border-border/40 px-3 py-2 text-[12px] font-mono text-white placeholder:text-neutral/30';

export function Mt5Trading() {
  const t = useT();
  const user = useAuthStore((s) => s.user);
  const setLoginModalOpen = useAuthStore((s) => s.setLoginModalOpen);
  const readOnly = user?.readOnly ?? false;
  const tradingCoin = useAppStore((s) => s.tradingCoin);
  const watchlist = useAppStore((s) => s.tabSymbols[s.activeWatchlistTab]);
  const addLogEntry = useAppStore((s) => s.addLogEntry);

  const { data: symbols = [] } = useMt5Symbols();
  const { data: positions = [], error: loadError } = useMt5Positions();
  const { data: orders = [] } = useMt5Orders();
  const marketOrder = useMt5MarketOrder();
  const pendingOrder = useMt5PendingOrder();
  const closePosition = useMt5ClosePosition();
  const cancelOrder = useMt5CancelOrder();

  const [tab, setTab] = useState<Tab>('trade');
  const [symbol, setSymbol] = useState('');
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [kind, setKind] = useState<Kind>('MARKET');
  const [volume, setVolume] = useState('0.01');
  const [price, setPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [closeVolume, setCloseVolume] = useState<Record<number, string>>({});
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  // Default to the first watchlist symbol (never an arbitrary allowed one — whatever is picked gets a live
  // subscription); follow external selection (news, watchlist) when it's tradable here
  useEffect(() => {
    if (symbol || !symbols.length) return;
    const first = watchlist?.find((w) => symbols.some((s) => s.symbol === w));
    if (first) setSymbol(first);
  }, [symbols, symbol, watchlist]);
  useEffect(() => {
    if (tradingCoin && symbols.some((s) => s.symbol === tradingCoin)) setSymbol(tradingCoin);
  }, [tradingCoin, symbols]);

  // Live prices for the ticket symbol + every open position — nothing else from the allowed list
  const { data: quotes } = useMt5Quotes([...new Set([symbol, ...positions.map((p) => p.symbol)])].filter(Boolean));
  const quote = quotes?.[symbol];

  if (!user) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 gap-4">
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

  const handleCancel = async (ticket: number, sym: string) => {
    try {
      await cancelOrder.mutateAsync({ ticket });
      addLogEntry({ type: 'trade', message: `[MT5] CANCEL #${ticket} ${sym}` });
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
  const tabs: { id: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'trade', label: t('trade'), icon: <ArrowRightLeft className="w-3 h-3" /> },
    { id: 'positions', label: t('positions'), icon: <Wallet className="w-3 h-3" />, badge: positions.length },
    { id: 'orders', label: t('orders'), icon: <History className="w-3 h-3" />, badge: orders.length },
  ];
  const shownError = error || (loadError ? errMsg(loadError) : '');

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Account bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/30 bg-black/40 shrink-0">
        <span className="text-[10px] font-mono text-neutral">
          MT5 <span className="text-white font-bold">#{user.mt5Login}</span>
          {user.name && <span className="ml-2 text-neutral/60">{user.name}</span>}
        </span>
        <span className={`text-[10px] font-mono font-bold ${totalProfit >= 0 ? 'text-bullish' : 'text-bearish'}`}>
          {t('unrealizedPl')} {totalProfit >= 0 ? '+' : ''}{fmtMoney(totalProfit)}
        </span>
      </div>

      {readOnly && (
        <div className="px-3 py-1.5 bg-amber-500/[0.08] border-b border-amber-500/30 shrink-0 flex items-center gap-2">
          <Lock className="w-3 h-3 text-amber-400 shrink-0" />
          <span className="text-[9px] font-mono font-bold text-amber-400 uppercase tracking-wider">{t('investorReadOnly')}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border/30 bg-black/40 shrink-0">
        {tabs.map((tb) => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-[9px] font-black uppercase tracking-widest border-b-2 ${
              tab === tb.id
                ? 'border-accent text-accent bg-accent/5'
                : 'border-transparent text-neutral/50 hover:text-neutral hover:bg-white/[0.02]'
            }`}
          >
            {tb.icon}
            {tb.label}
            {!!tb.badge && <span className="text-[8px] bg-accent/20 text-accent px-1 min-w-[14px] text-center">{tb.badge}</span>}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto no-scrollbar">
        {shownError && (
          <div role="alert" className="px-3 py-2 bg-bearish/10 border-b border-bearish/30 flex items-center gap-2">
            <AlertTriangle className="w-3 h-3 text-bearish shrink-0" />
            <span className="text-[10px] font-mono text-bearish flex-1">{shownError}</span>
            {error && <button onClick={() => setError('')} className="text-bearish/60 hover:text-bearish">✕</button>}
          </div>
        )}

        {/* Trade */}
        {tab === 'trade' && (
          <form onSubmit={handleOrder} className="flex flex-col gap-2 p-3">
            <SymbolPicker
              symbols={symbols}
              value={symbol}
              onSelect={(s) => { setSymbol(s); setConfirm(false); }}
              placeholder={t('symbolPlaceholder')}
            />

            {/* Live quote */}
            <div className="grid grid-cols-2 gap-1 text-center font-mono">
              <div className="py-1 border border-border/20">
                <div className="text-[8px] text-neutral/50 uppercase">Bid</div>
                <div className="text-[13px] font-bold text-bearish">{quote ? fmtPrice(quote.bid) : '--'}</div>
              </div>
              <div className="py-1 border border-border/20">
                <div className="text-[8px] text-neutral/50 uppercase">Ask</div>
                <div className="text-[13px] font-bold text-bullish">{quote ? fmtPrice(quote.ask) : '--'}</div>
              </div>
            </div>

            {/* Side */}
            <div className="grid grid-cols-2 gap-1">
              <button type="button" onClick={() => { setSide('BUY'); setConfirm(false); }}
                className={`py-2 text-[11px] font-black uppercase tracking-widest border ${side === 'BUY' ? 'bg-bullish/20 text-bullish border-bullish' : 'bg-black text-neutral/50 border-border/30'}`}>
                {t('buy')}
              </button>
              <button type="button" onClick={() => { setSide('SELL'); setConfirm(false); }}
                className={`py-2 text-[11px] font-black uppercase tracking-widest border ${side === 'SELL' ? 'bg-bearish/20 text-bearish border-bearish' : 'bg-black text-neutral/50 border-border/30'}`}>
                {t('sell')}
              </button>
            </div>

            {/* Order kind */}
            <div className="flex gap-1">
              {(['MARKET', 'LIMIT', 'STOP'] as const).map((k) => (
                <button key={k} type="button" onClick={() => { setKind(k); setConfirm(false); }}
                  className={`flex-1 py-1 text-[8px] font-bold uppercase tracking-widest border ${kind === k ? 'text-accent border-accent bg-accent/5' : 'text-neutral/40 border-border/20'}`}>
                  {k}
                </button>
              ))}
            </div>

            <input type="number" step="0.01" min="0.01" value={volume} aria-label="Lots"
              onChange={(e) => { setVolume(e.target.value); setConfirm(false); }}
              placeholder="Lots" className={inputClass} />

            {kind !== 'MARKET' && (
              <input type="number" step="any" value={price} aria-label={t('price')}
                onChange={(e) => { setPrice(e.target.value); setConfirm(false); }}
                placeholder={t('price')} className={inputClass} />
            )}

            <div className="grid grid-cols-2 gap-1">
              <input type="number" step="any" value={stopLoss} aria-label={t('stopLoss')}
                onChange={(e) => { setStopLoss(e.target.value); setConfirm(false); }}
                placeholder={t('stopLoss')} className={inputClass} />
              <input type="number" step="any" value={takeProfit} aria-label="Take profit"
                onChange={(e) => { setTakeProfit(e.target.value); setConfirm(false); }}
                placeholder="Take Profit" className={inputClass} />
            </div>

            {confirm ? (
              <div className="flex gap-1">
                <button type="submit" disabled={busy}
                  className={`flex-1 py-2.5 text-[11px] font-black uppercase tracking-widest border animate-pulse ${
                    side === 'BUY' ? 'bg-bullish/30 text-bullish border-bullish' : 'bg-bearish/30 text-bearish border-bearish'
                  }`}>
                  CONFIRM {desc}
                </button>
                <button type="button" onClick={() => setConfirm(false)}
                  className="px-3 py-2.5 text-[11px] font-black uppercase tracking-widest border border-border/30 text-neutral hover:text-white">
                  ✕
                </button>
              </div>
            ) : (
              <button type="submit"
                disabled={readOnly || busy || !symbol || !(Number(volume) > 0) || (kind !== 'MARKET' && !(Number(price) > 0))}
                className={`py-2.5 text-[11px] font-black uppercase tracking-widest border disabled:opacity-30 ${
                  side === 'BUY' ? 'bg-bullish/20 text-bullish border-bullish' : 'bg-bearish/20 text-bearish border-bearish'
                }`}>
                {busy ? t('submitting') : `${t(side === 'BUY' ? 'buy' : 'sell')} ${symbol}`}
              </button>
            )}

            {result && (
              <p className={`text-[10px] font-mono ${result.startsWith('Error') ? 'text-bearish' : 'text-bullish'}`}>{result}</p>
            )}
          </form>
        )}

        {/* Positions */}
        {tab === 'positions' && (
          positions.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <span className="text-[10px] font-mono text-neutral uppercase">{t('noOpenPositions')}</span>
            </div>
          ) : livePositions.map((p) => {
            return (
            <div key={p.ticket} className="px-3 py-2 border-b border-border/30 hover:bg-white/[0.02] group">
              <div className="flex items-center justify-between gap-2">
                <button onClick={() => { setSymbol(p.symbol); setTab('trade'); }} className="text-left min-w-0">
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
                <span className="ml-auto">{new Date(p.openTime).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })}</span>
              </div>
            </div>
            );
          })
        )}

        {/* Orders */}
        {tab === 'orders' && (
          orders.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <span className="text-[10px] font-mono text-neutral uppercase">{t('noRecentOrders')}</span>
            </div>
          ) : orders.map((o) => (
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
                <span className="ml-auto">{new Date(o.setupTime).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
