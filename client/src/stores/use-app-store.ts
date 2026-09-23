import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Locale } from '../i18n/translations';

interface SavedWatchlist { tabs: string[]; tabSymbols: Record<string, string[]>; active: string }

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
  tickerSpeed: number;
  theme: 'dark' | 'midnight';
  quoteThrottle: boolean;   // off = every live tick batch renders on arrival
  quoteThrottleMs: number;  // on = at most one live price render per this many ms
}

const DEFAULT_SETTINGS: UserSettings = {
  soundEnabled: false,
  autoRefreshInterval: 30,
  tickerSpeed: 80,
  theme: 'dark',
  quoteThrottle: true,
  quoteThrottleMs: 100,
};

export type StockPanelView = 'watchlist' | 'heatmap' | 'compare';

interface AppState {
  selectedSymbol: string | null;
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

  // Panel visibility
  hiddenPanels: string[];

  // Settings
  settingsPanelOpen: boolean;
  settings: UserSettings;

  // Locale
  locale: Locale;
  setLocale: (locale: Locale) => void;

  setSelectedSymbol: (symbol: string | null) => void;
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
  hidePanel: (panelId: string) => void;
  showPanel: (panelId: string) => void;

  // Settings actions
  setSettingsPanelOpen: (open: boolean) => void;
  updateSettings: (patch: Partial<UserSettings>) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      selectedSymbol: null,
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
      hidePanel: (panelId) => set((state) => ({
        hiddenPanels: state.hiddenPanels.includes(panelId)
          ? state.hiddenPanels
          : [...state.hiddenPanels, panelId],
      })),
      showPanel: (panelId) => set((state) => ({
        hiddenPanels: state.hiddenPanels.filter((id) => id !== panelId),
      })),

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
        hiddenPanels: state.hiddenPanels,
        locale: state.locale,
      }),
      // Default merge is shallow: a saved `settings` would drop fields added since — keep their defaults
      merge: (persisted, current) => {
        const p = persisted as Partial<AppState> | undefined;
        return { ...current, ...p, settings: { ...current.settings, ...p?.settings } };
      },
    }
  )
);
