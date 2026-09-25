import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Locale } from '../i18n/translations';

interface SavedWatchlist { tabs: string[]; tabSymbols: Record<string, string[]>; active: string }

export type ThemeSetting = 'dark' | 'light' | 'system';

export interface Notification {
  id: number;
  title: string;
  sentiment: string | null;
  symbols: string[];
  time: Date;
  read: boolean;
}

export interface LogEntry {
  time: string;
  message: string;
  type: 'info' | 'ws' | 'trade' | 'alert';
}

export interface UserSettings {
  soundEnabled: boolean;
  autoRefreshInterval: number;
  showTicker: boolean;
  tickerSpeed: number;      // seconds per loop: lower = faster
  theme: ThemeSetting;
  quoteThrottle: boolean;   // off = every live tick batch renders on arrival
  quoteThrottleMs: number;  // on = at most one live price render per this many ms
}

const DEFAULT_SETTINGS: UserSettings = {
  soundEnabled: false,
  autoRefreshInterval: 30,
  showTicker: true,
  tickerSpeed: 80,
  theme: 'dark',
  quoteThrottle: true,
  quoteThrottleMs: 100,
};

export type StockPanelView = 'watchlist' | 'compare';

/** The order being prepared, shared by the ticket and the chart. Levels and price: 0 = not set. */
export interface OrderDraft {
  symbol: string;
  /** null: nothing armed. A side shows the order's preview on the chart until it's sent or cancelled. */
  side: 'BUY' | 'SELL' | null;
  kind: 'MARKET' | 'PENDING';
  volume: string;
  price: number;
  sl: number;
  tp: number;
}

interface AppState {
  selectedSymbol: string | null;
  // Position / order hovered in a panel or on the chart ('p<ticket>' / 'o<ticket>'): its lines stay lit, the rest fade
  tradeFocus: string | null;
  orderDraft: OrderDraft;
  /** A new symbol drops the side and levels: they belong to the old symbol's prices */
  patchDraft: (patch: Partial<OrderDraft>) => void;
  wsConnected: boolean;
  commandPaletteOpen: boolean;
  activeWatchlistTab: string;
  watchlistTabs: string[];
  tabSymbols: Record<string, string[]>;
  // The three fields above are the current MT5 login's watchlist; other logins' copies are parked here
  watchlistOwner: string | null;
  watchlistsByLogin: Record<string, SavedWatchlist>;

  // View control
  stockPanelView: StockPanelView;

  // Multi-Chart Compare
  compareSymbols: string[];

  // Terminal Log
  logEntries: LogEntry[];

  // Keyboard
  shortcutsModalOpen: boolean;

  // Notifications
  notifications: Notification[];
  unreadCount: number;
  notifPanelOpen: boolean;

  // Panels not in the active workspace (derived from the dock model — not persisted)
  hiddenPanels: string[];

  // Settings
  settingsPanelOpen: boolean;
  settings: UserSettings;

  // Locale
  locale: Locale;
  setLocale: (locale: Locale) => void;

  setSelectedSymbol: (symbol: string | null) => void;
  setTradeFocus: (owner: string | null) => void;
  setWsConnected: (connected: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setActiveWatchlistTab: (tab: string) => void;
  addWatchlistTab: (name: string) => void;
  removeWatchlistTab: (name: string) => void;
  addSymbolToTab: (symbol: string, tab: string) => void;
  removeSymbolFromTab: (symbol: string, tab: string) => void;
  loadWatchlistFor: (login: string) => void;

  // View control actions
  setStockPanelView: (view: StockPanelView) => void;

  // Compare actions
  addToCompare: (symbol: string) => void;
  removeFromCompare: (symbol: string) => void;
  clearCompare: () => void;

  // Terminal Log actions
  addLogEntry: (entry: Omit<LogEntry, 'time'>) => void;
  clearLog: () => void;

  // Keyboard actions
  setShortcutsModalOpen: (open: boolean) => void;

  // Notification actions
  setNotifPanelOpen: (open: boolean) => void;
  addNotification: (notif: Omit<Notification, 'read'>) => void;
  markRead: (id: number) => void;
  markAllRead: () => void;

  // Panel visibility actions

  // Settings actions
  setSettingsPanelOpen: (open: boolean) => void;
  updateSettings: (patch: Partial<UserSettings>) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      selectedSymbol: null,
      tradeFocus: null,
      orderDraft: { symbol: '', side: null, kind: 'MARKET', volume: '0.01', price: 0, sl: 0, tp: 0 },
      patchDraft: (patch) => set(({ orderDraft: d }) => ({
        orderDraft: patch.symbol !== undefined && patch.symbol !== d.symbol
          ? { ...d, side: null, price: 0, sl: 0, tp: 0, ...patch }
          : { ...d, ...patch },
      })),
      wsConnected: false,
      commandPaletteOpen: false,
      activeWatchlistTab: 'WATCHLIST',
      watchlistTabs: ['WATCHLIST', 'HOLDING'],
      tabSymbols: {
        'WATCHLIST': [],
        'HOLDING': []
      },
      watchlistOwner: null,
      watchlistsByLogin: {},

      // View control
      stockPanelView: 'watchlist',

      // Multi-Chart Compare
      compareSymbols: [],

      // Terminal Log
      logEntries: [],

      // Keyboard
      shortcutsModalOpen: false,

      // Notifications
      notifications: [],
      unreadCount: 0,
      notifPanelOpen: false,

      // Panel visibility
      hiddenPanels: [],

      // Settings
      settingsPanelOpen: false,
      settings: DEFAULT_SETTINGS,

      // Locale
      locale: 'en' as Locale,
      setLocale: (locale) => set({ locale }),

      setSelectedSymbol: (symbol) => set({ selectedSymbol: symbol }),
      setTradeFocus: (owner) => set({ tradeFocus: owner }),
      setWsConnected: (connected) => set({ wsConnected: connected }),
      setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
      setActiveWatchlistTab: (tab) => set({ activeWatchlistTab: tab }),
      addWatchlistTab: (name) => set((state) => ({
        watchlistTabs: [...state.watchlistTabs, name.toUpperCase()],
        tabSymbols: { ...state.tabSymbols, [name.toUpperCase()]: [] }
      })),
      removeWatchlistTab: (name) => set((state) => {
        const newTabs = state.watchlistTabs.filter(t => t !== name);
        const newTabSymbols = { ...state.tabSymbols };
        delete newTabSymbols[name];
        return {
          watchlistTabs: newTabs,
          tabSymbols: newTabSymbols,
          activeWatchlistTab: state.activeWatchlistTab === name ? 'WATCHLIST' : state.activeWatchlistTab
        };
      }),
      addSymbolToTab: (symbol, tab) => set((state) => {
        const currentSymbols = state.tabSymbols[tab] || [];
        if (currentSymbols.includes(symbol)) return state;
        return {
          tabSymbols: {
            ...state.tabSymbols,
            [tab]: [...currentSymbols, symbol]
          }
        };
      }),
      removeSymbolFromTab: (symbol, tab) => set((state) => ({
        tabSymbols: {
          ...state.tabSymbols,
          [tab]: (state.tabSymbols[tab] || []).filter(s => s !== symbol)
        }
      })),
      loadWatchlistFor: (login) => set((state) => {
        if (state.watchlistOwner === login) return state;
        // Park the outgoing account's list (an ownerless pre-MT5 list is dropped), then load this login's
        const parked = state.watchlistOwner === null ? state.watchlistsByLogin : {
          ...state.watchlistsByLogin,
          [state.watchlistOwner]: { tabs: state.watchlistTabs, tabSymbols: state.tabSymbols, active: state.activeWatchlistTab },
        };
        const next = parked[login] ?? { tabs: ['WATCHLIST', 'HOLDING'], tabSymbols: { WATCHLIST: [], HOLDING: [] }, active: 'WATCHLIST' };
        return {
          watchlistOwner: login,
          watchlistsByLogin: parked,
          watchlistTabs: next.tabs,
          tabSymbols: next.tabSymbols,
          activeWatchlistTab: next.active,
        };
      }),

      // View control actions
      setStockPanelView: (view) => set({ stockPanelView: view }),

      // Compare actions
      addToCompare: (symbol) => set((state) => {
        if (state.compareSymbols.includes(symbol) || state.compareSymbols.length >= 4) return state;
        return { compareSymbols: [...state.compareSymbols, symbol] };
      }),
      removeFromCompare: (symbol) => set((state) => ({
        compareSymbols: state.compareSymbols.filter(s => s !== symbol),
      })),
      clearCompare: () => set({ compareSymbols: [] }),

      // Terminal Log actions
      addLogEntry: (entry) => set((state) => {
        const now = new Date();
        const time = now.toTimeString().slice(0, 8);
        const newEntry: LogEntry = { ...entry, time };
        return { logEntries: [newEntry, ...state.logEntries].slice(0, 100) };
      }),
      clearLog: () => set({ logEntries: [] }),

      // Keyboard actions
      setShortcutsModalOpen: (open) => set({ shortcutsModalOpen: open }),

      // Notification actions
      setNotifPanelOpen: (open) => set((state) => ({
        notifPanelOpen: open,
        // Close settings if opening notifications
        settingsPanelOpen: open ? false : state.settingsPanelOpen,
      })),
      addNotification: (notif) => set((state) => {
        const newNotif: Notification = { ...notif, read: false };
        const notifications = [newNotif, ...state.notifications].slice(0, 50);
        return { notifications, unreadCount: state.unreadCount + 1 };
      }),
      markRead: (id) => set((state) => {
        const found = state.notifications.find((n) => n.id === id && !n.read);
        if (!found) return state;
        return {
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
          unreadCount: Math.max(0, state.unreadCount - 1),
        };
      }),
      markAllRead: () => set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, read: true })),
        unreadCount: 0,
      })),

      // Panel visibility actions

      // Settings actions
      setSettingsPanelOpen: (open) => set((state) => ({
        settingsPanelOpen: open,
        // Close notifications if opening settings
        notifPanelOpen: open ? false : state.notifPanelOpen,
      })),
      updateSettings: (patch) => set((state) => ({
        settings: { ...state.settings, ...patch },
      })),
    }),
    {
      name: 'trading-terminal-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        watchlistTabs: state.watchlistTabs,
        tabSymbols: state.tabSymbols,
        activeWatchlistTab: state.activeWatchlistTab,
        watchlistOwner: state.watchlistOwner,
        watchlistsByLogin: state.watchlistsByLogin,
        settings: state.settings,
        stockPanelView: state.stockPanelView,
        compareSymbols: state.compareSymbols,
        locale: state.locale,
      }),
      // Default merge is shallow: a saved `settings` would drop fields added since — keep their defaults
      merge: (persisted, current) => {
        const p = persisted as Partial<AppState> | undefined;
        const settings = { ...current.settings, ...p?.settings };
        if (!['dark', 'light', 'system'].includes(settings.theme)) settings.theme = 'dark'; // retired 'midnight'
        return { ...current, ...p, settings };
      },
    }
  )
);
