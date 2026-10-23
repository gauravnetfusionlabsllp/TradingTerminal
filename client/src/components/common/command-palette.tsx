import { useState, useEffect, useRef, Fragment, type ReactNode } from 'react';
import {
  Command, TrendingUp, History, LayoutDashboard, LayoutGrid, EyeOff, Sun, Moon, Maximize2, Minimize2,
  Settings, Bell, Keyboard, Globe, RotateCcw, LogIn, LogOut,
} from 'lucide-react';
import { useAppStore } from '../../stores/use-app-store';
import { useAuthStore } from '../../stores/use-auth-store';
import { useAuthActions } from '../../api/hooks/use-auth';
import { useMt5Symbols } from '../../api/hooks/use-mt5';
import { useTickerSearch } from '../../api/hooks/use-watchlist';
import { toMt5 } from '../../lib/symbols';
import { logoFor } from '../../lib/logos';
import { SymbolLogo } from './symbol-logo';
import { useResolvedTheme } from '../../lib/theme';
import { showPanelInLayout, hidePanelInLayout } from '../layout/dock-layout';
import { ALL_PANEL_IDS, PANEL_IDS, getLocalizedPanelName, getPanelDescription } from '../layout/panels';
import { useT, tr, LOCALE_LABELS, type Locale } from '../../i18n';
import { useWorkspaceStore, wsLabel, isModified } from '../../stores/use-workspace-store';

interface Item {
  id: string;
  group: string;
  label: string;
  /** Extra words to match on (English, so they work in every locale) */
  terms?: string;
  hint?: string;
  /** Second line under the label: what a panel shows */
  desc?: string;
  kbd?: string;
  icon: ReactNode;
  run: () => void;
}
type Row = Omit<Item, 'group'>;

const RECENT_KEY = 'sgfx.cmd.recent';
function loadRecent(): string[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : [];
  } catch { return []; }
}
function saveRecent(sym: string) {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify([sym, ...loadRecent().filter((s) => s !== sym)].slice(0, 5))); } catch { /* storage blocked */ }
}

/** Case-insensitive substring match, earliest match first (so prefixes lead) */
function match<T>(items: T[], q: string, key: (x: T) => string): T[] {
  return items
    .map((x) => ({ x, at: key(x).toLowerCase().indexOf(q) }))
    .filter((m) => m.at >= 0)
    .sort((a, b) => a.at - b.at)
    .map((m) => m.x);
}

const ICON = 'w-4 h-4';

export function CommandPalette() {
  const isOpen = useAppStore((s) => s.commandPaletteOpen);
  const setOpen = useAppStore((s) => s.setCommandPaletteOpen);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key === 'k') {
        e.preventDefault();
        setOpen(!isOpen);
      }
      if (e.key === 'Escape' && isOpen) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, setOpen]);

  // Mounted only while open: nothing runs in the background, and every open starts fresh
  return isOpen ? <Palette close={() => setOpen(false)} /> : null;
}

function Palette({ close }: { close: () => void }) {
  const setSelectedSymbol = useAppStore((s) => s.setSelectedSymbol);
  const hiddenPanels = useAppStore((s) => s.hiddenPanels);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const setSettingsPanelOpen = useAppStore((s) => s.setSettingsPanelOpen);
  const setNotifPanelOpen = useAppStore((s) => s.setNotifPanelOpen);
  const setShortcutsModalOpen = useAppStore((s) => s.setShortcutsModalOpen);
  const locale = useAppStore((s) => s.locale);
  const setLocale = useAppStore((s) => s.setLocale);
  const user = useAuthStore((s) => s.user);
  const setLoginModalOpen = useAuthStore((s) => s.setLoginModalOpen);
  const { logout } = useAuthActions();
  const space = useWorkspaceStore((s) => s.byOwner[s.owner]);
  const switchWorkspace = useWorkspaceStore((s) => s.switchTo);
  const resetWorkspace = useWorkspaceStore((s) => s.reset);
  const resolved = useResolvedTheme();
  const { data: symbols = [] } = useMt5Symbols();

  const t = useT();
  const [input, setInput] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const q = input.trim().toLowerCase();
  // ".xyz" is the raw ticker form: search on what follows the dot
  const sq = q.startsWith('.') ? q.slice(1) : q;
  const { data: yahoo } = useTickerSearch(sq.length >= 2 ? sq : '');

  // ── Rows ──
  const openSymbol = (sym: string) => {
    setSelectedSymbol(sym);
    // Tradable symbols also bring the chart up; Yahoo-only ones just drive the analytics panels
    if (toMt5(sym, symbols)) showPanelInLayout(PANEL_IDS.TECHNICAL_CHART);
    saveRecent(sym);
  };
  const symRow = (sym: string, hint?: string, icon = <TrendingUp className={ICON} />): Row =>
    ({ id: `sym-${sym}`, label: sym, hint, icon: logoFor(sym).length ? <SymbolLogo symbol={sym} size={16} /> : icon, run: () => openSymbol(sym) });

  const fullscreen = !!document.fullscreenElement;
  const activeWs = space?.list.find((w) => w.key === space.active);
  const commands: Row[] = [
    {
      id: 'theme', label: t('toggleTheme'), terms: 'theme dark light mode',
      icon: resolved === 'dark' ? <Sun className={ICON} /> : <Moon className={ICON} />,
      run: () => updateSettings({ theme: resolved === 'dark' ? 'light' : 'dark' }),
    },
    {
      id: 'fullscreen', label: fullscreen ? t('exitFullscreen') : t('fullscreen'), terms: 'fullscreen',
      icon: fullscreen ? <Minimize2 className={ICON} /> : <Maximize2 className={ICON} />,
      run: () => { void (fullscreen ? document.exitFullscreen() : document.documentElement.requestFullscreen()); },
    },
    { id: 'settings', label: t('settings'), terms: 'settings preferences', icon: <Settings className={ICON} />, run: () => setSettingsPanelOpen(true) },
    { id: 'notifications', label: t('notifications'), terms: 'notifications alerts', icon: <Bell className={ICON} />, run: () => setNotifPanelOpen(true) },
    {
      id: 'shortcuts', label: tr(t, 'cmdShortcuts', 'Keyboard shortcuts'), terms: 'keyboard shortcuts help hotkeys',
      kbd: '?', icon: <Keyboard className={ICON} />, run: () => setShortcutsModalOpen(true),
    },
    ...(Object.entries(LOCALE_LABELS) as [Locale, string][])
      .filter(([code]) => code !== locale)
      .map(([code, name]): Row => ({
        id: `lang-${code}`, label: `${t('language')}: ${name}`, terms: 'language', icon: <Globe className={ICON} />, run: () => setLocale(code),
      })),
    ...(activeWs && isModified(activeWs)
      ? [{ id: 'ws-reset', label: t('wsReset'), hint: wsLabel(activeWs, t), terms: 'reset workspace layout', icon: <RotateCcw className={ICON} />, run: () => resetWorkspace(activeWs.key) }]
      : []),
    user
      ? { id: 'logout', label: t('logout'), terms: 'sign out log out', icon: <LogOut className={ICON} />, run: logout }
      : { id: 'login', label: t('login'), terms: 'sign in log in mt5', icon: <LogIn className={ICON} />, run: () => setLoginModalOpen(true) },
  ];

  const workspaces: Row[] = match(
    (space?.list ?? []).map((w, i) => ({ w, i })), q, ({ w }) => wsLabel(w, t),
  ).map(({ w, i }) => ({
    id: `ws-${w.key}`,
    label: wsLabel(w, t),
    hint: w.key === space?.active ? tr(t, 'cmdCurrent', 'Current') : undefined,
    kbd: i < 9 ? `Alt ${i + 1}` : undefined,
    icon: <LayoutDashboard className={ICON} />,
    run: () => switchWorkspace(w.key),
  }));

  const groups: [string, Row[]][] = [];
  if (!q) {
    groups.push(
      [tr(t, 'cmdRecent', 'Recent symbols'), loadRecent().map((s) => symRow(s, undefined, <History className={ICON} />))],
      [tr(t, 'cmdWorkspaces', 'Workspaces'), workspaces],
      // Languages only once you type, to keep the opening list short
      [tr(t, 'cmdCommands', 'Commands'), commands.filter((c) => !c.id.startsWith('lang-'))],
    );
  } else {
    const account = sq ? match(symbols, sq, (s) => s.symbol).slice(0, 6).map((s) => symRow(s.symbol)) : [];
    // Yahoo matches by company name too; map onto the account's MT5 name when it trades there (gold → XAUUSD)
    const seen = new Set(account.map((r) => r.label));
    const search: Row[] = [];
    for (const y of (sq.length >= 2 ? yahoo ?? [] : []).slice(0, 5)) {
      const sym = toMt5(y.symbol, symbols) ?? y.symbol;
      if (seen.has(sym)) continue;
      seen.add(sym);
      search.push(symRow(sym, y.name));
    }
    const raw = q.startsWith('.') ? sq.toUpperCase() : '';
    if (raw && !seen.has(raw)) account.unshift({ ...symRow(raw), id: `raw-${raw}`, label: `${tr(t, 'cmdGoTo', 'Go to')} ${raw}` });

    // Name first in the key, so name hits outrank description hits ("calendar" → Economic calendar before others)
    const panelKey = (id: string) => `${getLocalizedPanelName(id)} ${getPanelDescription(id)}`;
    const panels: Row[] = match(ALL_PANEL_IDS, q, panelKey).slice(0, 8).flatMap((id) => {
      const name = getLocalizedPanelName(id);
      const shown = !hiddenPanels.includes(id);
      const open: Row = {
        id: `panel-${id}`,
        label: `${shown ? tr(t, 'cmdGoTo', 'Go to') : tr(t, 'cmdOpen', 'Open')} ${name}`,
        desc: getPanelDescription(id) || undefined,
        icon: <LayoutGrid className={ICON} />,
        run: () => showPanelInLayout(id),
      };
      return shown
        ? [open, { id: `hide-${id}`, label: `${tr(t, 'cmdHide', 'Hide')} ${name}`, icon: <EyeOff className={ICON} />, run: () => hidePanelInLayout(id) }]
        : [open];
    });

    groups.push(
      [tr(t, 'cmdSymbols', 'Symbols'), account],
      [t('catPanels'), panels],
      [tr(t, 'cmdWorkspaces', 'Workspaces'), workspaces],
      [tr(t, 'cmdCommands', 'Commands'), match(commands, q, (c) => `${c.label} ${c.terms ?? ''}`)],
      // Yahoo last: it answers almost any word, so it would bury exact panel/command hits
      [tr(t, 'cmdSearchResults', 'More symbols'), search],
    );
  }
  const items: Item[] = groups.flatMap(([group, rows]) => rows.map((r) => ({ ...r, group })));

  const execute = (item?: Item) => {
    if (!item) return;
    item.run();
    close();
  };

  const move = (delta: number) => {
    if (!items.length) return;
    const next = (activeIndex + delta + items.length) % items.length;
    setActiveIndex(next);
    listRef.current?.querySelector(`[data-idx="${next}"]`)?.scrollIntoView({ block: 'nearest' });
  };

  // Plain dim, no backdrop blur: over a live dashboard it re-blurs the whole screen every tick,
  // which lags typing badly without a GPU (RDP / VPS). Opens with a 120ms pop, closes instantly.
  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4">
      <div className="absolute inset-0 bg-bg/70" onClick={close} />

      <div className="animate-pop w-full max-w-xl bg-raised border border-border rounded-sm shadow-[0_24px_64px_rgb(0_0_0/0.35)] overflow-hidden z-10">
        <div className="flex items-center gap-3 px-4 h-12 border-b border-border">
          <Command className="w-4 h-4 text-neutral" />
          <input
            type="text"
            autoFocus
            value={input}
            onChange={(e) => { setInput(e.target.value); setActiveIndex(0); }}
            placeholder={t('cmdPlaceholder')}
            className="flex-1 bg-transparent border-none outline-none text-fg text-sm placeholder:text-neutral"
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
              else if (e.key === 'Enter') { e.preventDefault(); execute(items[activeIndex]); }
            }}
          />
          <div className="flex items-center gap-1.5 px-1.5 h-5 rounded-sm border border-border text-micro text-neutral">
            ESC
          </div>
        </div>

        <div ref={listRef} className="max-h-[350px] overflow-y-auto p-2 no-scrollbar">
          {items.length > 0 ? (
            items.map((item, index) => (
              <Fragment key={item.id}>
                {item.group !== items[index - 1]?.group && (
                  <div className="px-3 pt-2 pb-1 text-mini text-neutral/70">{item.group}</div>
                )}
                <button
                  data-idx={index}
                  onClick={() => execute(item)}
                  onMouseMove={() => index !== activeIndex && setActiveIndex(index)}
                  className={`w-full flex items-center gap-3 px-3 rounded-sm text-sm ${item.desc ? 'py-1.5' : 'h-8'} ${
                    index === activeIndex ? 'bg-accent/15 text-fg' : 'text-neutral'
                  }`}
                >
                  <span className={`shrink-0 ${index === activeIndex ? 'text-accent-ink' : ''}`}>{item.icon}</span>
                  <span className="flex-1 min-w-0 text-left">
                    <span className="block truncate">{item.label}</span>
                    {item.desc && <span className="block truncate text-mini text-neutral" title={item.desc}>{item.desc}</span>}
                  </span>
                  {item.hint && <span className="text-mini text-neutral truncate max-w-[45%]">{item.hint}</span>}
                  {item.kbd && (
                    <kbd className="px-1 h-4 inline-flex items-center rounded-sm border border-border text-micro text-neutral shrink-0">{item.kbd}</kbd>
                  )}
                </button>
              </Fragment>
            ))
          ) : (
            <div className="py-8 text-center text-neutral text-xs italic">
              {t('cmdNoResults')}
            </div>
          )}
        </div>

        <div className="px-4 h-9 border-t border-border flex justify-between items-center">
          <div className="flex gap-4">
            <span className="text-mini text-neutral flex items-center gap-1">
              <kbd className="px-1 h-4 inline-flex items-center rounded-sm border border-border">↑↓</kbd> {t('navigate')}
            </span>
            <span className="text-mini text-neutral flex items-center gap-1">
              <kbd className="px-1 h-4 inline-flex items-center rounded-sm border border-border">Enter</kbd> {t('execute')}
            </span>
          </div>
          <span className="text-micro text-neutral">SGFX Terminal</span>
        </div>
      </div>
    </div>
  );
}
