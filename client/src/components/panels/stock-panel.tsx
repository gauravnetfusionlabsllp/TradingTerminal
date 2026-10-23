import { useEffect, useRef, useState } from 'react';
import { useMt5Symbols, useMt5Quotes } from '../../api/hooks/use-mt5';
import { fmtPrice } from '../trading/mt5-trading';
import { SymbolPicker, tradeModeLabel } from '../trading/symbol-picker';
import { useAuthStore } from '../../stores/use-auth-store';
import { useAppStore } from '../../stores/use-app-store';
import { useT, type TranslationKey } from '../../i18n';
import { GlassCard } from '../common/glass-card';
import { ConfirmDialog } from '../common/confirm-dialog';
import { SymbolLogo } from '../common/symbol-logo';
import { Search, X, TrendingUp, TrendingDown, Plus, FolderPlus, List, Columns } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { lazy, Suspense } from 'react';

const MultiChart = lazy(() => import('./multi-chart').then(m => ({ default: m.MultiChart })));

export function StockPanel() {
  const t = useT();
  const user = useAuthStore((s) => s.user);
  const setLoginModalOpen = useAuthStore((s) => s.setLoginModalOpen);
  const stockPanelView = useAppStore((s) => s.stockPanelView);
  const setSelectedSymbol = useAppStore((s) => s.setSelectedSymbol);

  // Watchlist + chart are MT5 data scoped to the logged-in account
  if (!user) {
    return (
      <GlassCard className="h-full flex flex-col items-center justify-center">
        <button
          onClick={() => setLoginModalOpen(true)}
          className="px-4 h-8 rounded-sm bg-accent text-on-accent text-xs font-semibold hover:bg-accent/90 transition-colors"
        >
          {t('loginWithMt5')}
        </button>
      </GlassCard>
    );
  }

  return (
    <AnimatePresence mode="wait">
      {stockPanelView === 'compare' ? (
        <motion.div key="compare" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="h-full">
          <CompareWrapper />
        </motion.div>
      ) : (
        <motion.div key="list" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="h-full">
          <WatchlistView onSelect={setSelectedSymbol} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function CompareWrapper() {
  const t = useT();
  const setStockPanelView = useAppStore((s) => s.setStockPanelView);
  const clearCompare = useAppStore((s) => s.clearCompare);
  return (
    <GlassCard
      headerRight={
        <div className="flex items-center gap-1">
          <button onClick={clearCompare} className="text-neutral hover:text-bearish transition-colors p-1 text-mini font-mono">{t('clearCompare')}</button>
          <button onClick={() => setStockPanelView('watchlist')} className="text-neutral hover:text-white transition-colors p-1">
            <List className="w-3.5 h-3.5" />
          </button>
        </div>
      }
      className="h-full flex flex-col"
    >
      <MultiChart />
    </GlassCard>
  );
}

function WatchlistView({
  onSelect,
}: {
  onSelect: (symbol: string) => void;
}) {
  const t = useT();
  const { data: allowed } = useMt5Symbols();
  const [isAddingTab, setIsAddingTab] = useState(false);
  const [newTabName, setNewTabName] = useState('');
  const [deleteTabTarget, setDeleteTabTarget] = useState<string | null>(null);

  const activeTab = useAppStore(s => s.activeWatchlistTab);
  const tabs = useAppStore(s => s.watchlistTabs);
  const tabSymbols = useAppStore(s => s.tabSymbols);
  const setActiveTab = useAppStore(s => s.setActiveWatchlistTab);
  const addTab = useAppStore(s => s.addWatchlistTab);
  const removeTab = useAppStore(s => s.removeWatchlistTab);
  const addSymbolToTab = useAppStore(s => s.addSymbolToTab);
  const removeSymbolFromTab = useAppStore(s => s.removeSymbolFromTab);
  const selectedSymbol = useAppStore(s => s.selectedSymbol);

  const TAB_KEYS: Record<string, TranslationKey> = { WATCHLIST: 'watchlist', HOLDING: 'holding' };
  const tabLabel = (tab: string) => TAB_KEYS[tab] ? t(TAB_KEYS[tab]) : tab;

  // Rows = only what the user added to this tab (in added order), limited to symbols this account may trade.
  // Only these rows get a live subscription — never the whole allowed list.
  const allItems = allowed ?? [];
  const modeBySymbol = new Map(allItems.map(s => [s.symbol, s.tradeMode]));
  const filteredItems = (tabSymbols[activeTab] || [])
    .filter(symbol => modeBySymbol.has(symbol))
    .map(symbol => ({ symbol, tradeMode: modeBySymbol.get(symbol)! }));

  const { data: quotes } = useMt5Quotes(filteredItems.map(i => i.symbol));

  const handleAddTab = () => {
    if (newTabName.trim()) {
      addTab(newTabName.trim());
      setNewTabName('');
      setIsAddingTab(false);
    }
  };

  const handleDeleteTab = (e: React.MouseEvent, tabName: string) => {
    e.stopPropagation();
    if (tabName === 'WATCHLIST' || tabName === 'HOLDING') return;
    setDeleteTabTarget(tabName);
  };

  const confirmDeleteTab = () => {
    if (deleteTabTarget) {
      removeTab(deleteTabTarget);
      setDeleteTabTarget(null);
    }
  };

  // Columns drop out as the panel narrows (container queries): SPREAD below 300px, MODE below 420px
  const gridCols = 'grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)] @min-[300px]:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.7fr)] @min-[420px]:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.7fr)_minmax(0,0.6fr)]';

  return (
    <GlassCard
      className="h-full flex flex-col"
    >
      {/* Tab Bar + view toggle */}
      <div className="flex items-center px-2 bg-black/40 border-b border-border/30 overflow-x-auto no-scrollbar shrink-0">
        <div className="flex flex-1">
          {tabs.map(tab => (
            <div key={tab} className="relative group/tab">
              <button
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-mini font-black uppercase tracking-widest border-b-2 transition-all flex items-center gap-2 ${
                  activeTab === tab
                    ? 'border-accent text-accent-ink bg-accent/5'
                    : 'border-transparent text-neutral hover:text-gray-300 hover:bg-white/5'
                }`}
              >
                {tabLabel(tab)}
                {tab !== 'WATCHLIST' && tab !== 'HOLDING' && (
                  <X
                    className="w-2.5 h-2.5 opacity-0 group-hover/tab:opacity-100 hover:text-bearish transition-all"
                    onClick={(e) => handleDeleteTab(e, tab)}
                  />
                )}
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={() => setIsAddingTab(true)}
          className="p-2 text-neutral hover:text-accent-ink transition-colors"
          title={t('addNewTab')}
        >
          <FolderPlus className="w-3.5 h-3.5" />
        </button>
      </div>

      <AnimatePresence>
        {isAddingTab && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-4 py-2 bg-accent/10 border-b border-accent/20 flex gap-2 overflow-hidden"
          >
            <input
              autoFocus
              value={newTabName}
              onChange={e => setNewTabName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddTab()}
              placeholder={t('tabNamePlaceholder')}
              className="flex-1 bg-black/40 border border-border/50 px-2 py-1 text-mini font-mono text-white outline-none focus:border-accent"
            />
            <button onClick={handleAddTab} className="p-1 text-accent-ink hover:bg-accent/20">
              <Plus className="w-4 h-4" />
            </button>
            <button onClick={() => setIsAddingTab(false)} className="p-1 text-neutral hover:bg-white/10">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="px-3 py-2 border-b border-border/30 bg-black/20">
        <SymbolPicker
          symbols={allItems}
          clearOnSelect
          onSelect={(sym) => addSymbolToTab(sym, activeTab)}
          placeholder={t('addToTab').replace('{tab}', tabLabel(activeTab))}
        />
      </div>

      <div className="@container overflow-auto flex-1 no-scrollbar">
        <div>
          {/* Header */}
          <div className={`grid ${gridCols} gap-x-2 px-3 py-1.5 border-b border-border/20 text-micro font-black text-neutral/50 uppercase tracking-[0.15em]`}>
            <span>{t('asset')}</span>
            <span className="text-right">BID</span>
            <span className="text-right">ASK</span>
            <span className="text-right hidden @min-[300px]:block">SPREAD</span>
            <span className="text-right hidden @min-[420px]:block">MODE</span>
          </div>
          {/* Rows */}
          {filteredItems.map((item) => {
            const q = quotes?.[item.symbol];
            return (
              <div
                key={item.symbol}
                className={`grid ${gridCols} gap-x-2 px-3 py-2 border-b border-border/5 cursor-pointer transition-colors group items-center ${item.symbol === selectedSymbol ? 'bg-accent/10 shadow-[inset_2px_0_0_var(--color-accent)]' : 'hover:bg-white/[0.03]'}`}
                onClick={() => onSelect(item.symbol)}
              >
                <div className="relative flex items-center gap-1.5 min-w-0">
                  <SymbolLogo symbol={item.symbol} />
                  <span className="font-mono font-black text-white text-[12px] group-hover:text-cyan-300 transition-colors truncate">{item.symbol}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeSymbolFromTab(item.symbol, activeTab);
                    }}
                    aria-label={`Remove ${item.symbol}`}
                    // Floats over the name's end on hover: a reserved slot would leave the logo'd name too little room
                    className="absolute right-0 bg-panel text-neutral hover:text-bearish opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <TickPrice value={q?.bid} />
                <TickPrice value={q?.ask} />
                <span className="text-right font-mono text-mini text-neutral/60 truncate hidden @min-[300px]:block">
                  {q ? fmtPrice(q.ask - q.bid) : '--'}
                </span>
                <span className="text-right font-mono text-mini text-neutral/60 uppercase truncate hidden @min-[420px]:block">
                  {tradeModeLabel(item.tradeMode)}
                </span>
              </div>
            );
          })}
          {filteredItems.length === 0 && (
            <div className="px-4 py-12 text-center text-neutral/40 text-mini font-mono uppercase tracking-[0.2em]">
              {t('noDataInTab').replace('{tab}', tabLabel(activeTab))}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={deleteTabTarget !== null}
        title={t('deleteTabTitle')}
        description={t('deleteTabDesc')}
        confirmLabel={t('confirm')}
        cancelLabel={t('cancel')}
        variant="danger"
        onConfirm={confirmDeleteTab}
        onCancel={() => setDeleteTabTarget(null)}
      />
    </GlassCard>
  );
}

/**
 * Live price cell: coloured by last tick direction, soft wash (index.css .tick-price) restarts on every tick.
 * Imperative on purpose — at FIX tick rates per-symbol React state/timers would churn and drop flashes.
 */
export function TickPrice({ value, dp }: { value?: number; dp?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(value);
  // Pad to the most decimals seen so trailing-zero ticks don't make the number jump width (or a fixed dp when given)
  const digits = useRef(0);
  if (value !== undefined) digits.current = dp ?? Math.max(digits.current, fmtPrice(value).split('.')[1]?.length ?? 0);

  useEffect(() => {
    const el = ref.current, p = prev.current;
    prev.current = value;
    if (!el || p === undefined || value === undefined || p === value) return;
    el.dataset.tick = value > p ? 'up' : 'down';
    el.getAnimations().forEach(a => { a.cancel(); a.play(); }); // restart even on same-direction ticks
  }, [value]);

  return (
    <span ref={ref} className="tick-price justify-self-end max-w-full truncate px-1 rounded-sm font-mono text-xs font-bold text-white tabular-nums">
      {value !== undefined ? value.toFixed(digits.current) : '--'}
    </span>
  );
}

