import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../../stores/use-app-store';
import { useT, LOCALE_LABELS, type Locale } from '../../i18n';
import { Search, Bell, Settings, LayoutGrid, Maximize2, Minimize2, Globe, Sun, Moon } from 'lucide-react';
import { useResolvedTheme } from '../../lib/theme';
import { NotificationPanel } from '../common/notification-panel';
import { SettingsPanel } from '../common/settings-panel';
import { PanelToggleMenu } from '../common/panel-toggle-menu';
import { UserMenu } from '../auth/user-menu';
import { WorkspaceTabs } from './workspace-tabs';
import logoSvg from '../../assets/logo.svg?raw';

export function TopBar() {
  const [localTime, setLocalTime] = useState(getLocalTime());
  const wsConnected = useAppStore((s) => s.wsConnected);
  const setCommandPaletteOpen = useAppStore((s) => s.setCommandPaletteOpen);

  const notifPanelOpen = useAppStore((s) => s.notifPanelOpen);
  const setNotifPanelOpen = useAppStore((s) => s.setNotifPanelOpen);
  const unreadCount = useAppStore((s) => s.unreadCount);

  const settingsPanelOpen = useAppStore((s) => s.settingsPanelOpen);
  const setSettingsPanelOpen = useAppStore((s) => s.setSettingsPanelOpen);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const resolved = useResolvedTheme();
  const t = useT();

  const locale = useAppStore((s) => s.locale);
  const setLocale = useAppStore((s) => s.setLocale);

  const [panelMenuOpen, setPanelMenuOpen] = useState(false);
  const panelMenuRef = useRef<HTMLDivElement>(null);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  useEffect(() => {
    if (!langMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(e.target as Node)) setLangMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [langMenuOpen]);

  useEffect(() => {
    const interval = setInterval(() => setLocalTime(getLocalTime()), 1000);
    return () => clearInterval(interval);
  }, []);

  const iconBtn = (on: boolean) =>
    `grid place-items-center h-7 w-7 transition-colors ${on ? 'text-fg bg-hover' : 'text-neutral hover:text-fg hover:bg-hover'}`;

  return (
    <header className="bg-panel border-b border-border flex items-center justify-between pl-4 pr-3 h-10 shrink-0 z-20 sticky top-0">
      <div className="flex items-center gap-4 min-w-0 flex-1 self-stretch">
        <div className="flex shrink-0 items-center gap-2.5 text-fg" aria-label="SGFX Terminal">
          <span className="block h-[18px] w-[70px] [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: logoSvg }} />
          <span className="text-mini font-medium text-neutral">Terminal</span>
        </div>
        <span className="shrink-0 text-mini text-neutral">{localTime}</span>
        <div className="h-4 w-px bg-border shrink-0" />
        <WorkspaceTabs />
      </div>

      <div className="flex shrink-0 items-center gap-3 pl-3">
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="flex items-center gap-2 h-7 bg-raised border border-border rounded-sm px-2.5 text-xs text-neutral hover:border-neutral/50 hover:text-fg transition-colors w-56 xl:w-72"
        >
          <Search className="w-3.5 h-3.5 shrink-0" />
          <span className="flex-1 text-left truncate">{t('search')}</span>
          <kbd className="hidden sm:inline-flex items-center h-4 px-1 border border-border rounded-sm text-micro text-neutral">Alt K</kbd>
        </button>

        <div className="flex items-center gap-0.5">
          {/* Panel Toggle */}
          <div className="relative" ref={panelMenuRef}>
            <button
              onClick={() => setPanelMenuOpen(!panelMenuOpen)}
              className={`flex items-center gap-1.5 h-7 px-2 transition-colors ${panelMenuOpen ? 'text-fg bg-hover' : 'text-neutral hover:text-fg hover:bg-hover'}`}
              title={t('togglePanels')}
              aria-label={t('togglePanels')}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-xs">Panels</span>
            </button>
            <PanelToggleMenu open={panelMenuOpen} onClose={() => setPanelMenuOpen(false)} containerRef={panelMenuRef} />
          </div>

          {/* Light / dark */}
          <button
            onClick={() => updateSettings({ theme: resolved === 'dark' ? 'light' : 'dark' })}
            className={iconBtn(false)}
            title={t('toggleTheme')}
            aria-label={t('toggleTheme')}
          >
            {resolved === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Fullscreen */}
          <button
            onClick={() => {
              if (document.fullscreenElement) {
                document.exitFullscreen();
              } else {
                document.documentElement.requestFullscreen();
              }
            }}
            className={iconBtn(false)}
            title={isFullscreen ? t('exitFullscreen') : t('fullscreen')}
            aria-label={isFullscreen ? t('exitFullscreen') : t('fullscreen')}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Bell / Notifications */}
          <div className="relative">
            <button
              data-bell-btn
              onClick={() => setNotifPanelOpen(!notifPanelOpen)}
              className={iconBtn(notifPanelOpen)}
              aria-label={t('notifications')}
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-0 right-0 min-w-[14px] h-3.5 flex items-center justify-center px-1 rounded-full bg-bearish text-on-accent text-micro font-semibold leading-none">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
            <NotificationPanel />
          </div>

          {/* Settings */}
          <div className="relative">
            <button
              data-settings-btn
              onClick={() => setSettingsPanelOpen(!settingsPanelOpen)}
              className={iconBtn(settingsPanelOpen)}
              aria-label={t('settings')}
            >
              <Settings className="w-4 h-4" />
            </button>
            <SettingsPanel />
          </div>

          {/* Language */}
          <div className="relative" ref={langMenuRef}>
            <button
              onClick={() => setLangMenuOpen(!langMenuOpen)}
              className={iconBtn(langMenuOpen)}
              aria-label={t('language')}
            >
              <Globe className="w-4 h-4" />
            </button>
            {langMenuOpen && (
              <div className="absolute right-0 top-full mt-1 bg-raised border border-border rounded-sm shadow-[0_12px_32px_rgb(0_0_0/0.3)] z-50 py-1">
                {(Object.entries(LOCALE_LABELS) as [Locale, string][]).map(([code, label]) => (
                  <button
                    key={code}
                    onClick={() => { setLocale(code); setLangMenuOpen(false); }}
                    className={`block w-full text-left px-4 py-1.5 text-xs whitespace-nowrap ${
                      locale === code ? 'text-accent-ink bg-accent/10' : 'text-neutral hover:text-fg hover:bg-hover'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="h-4 w-px bg-border" />

        <UserMenu />

        <div className="flex items-center gap-1.5 pl-1" title={wsConnected ? t('live') : t('offline')}>
          <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-bullish' : 'bg-bearish'}`} />
          <span className={`text-mini font-medium ${wsConnected ? 'text-bullish' : 'text-bearish'}`}>
            {wsConnected ? t('live') : t('offline')}
          </span>
        </div>
      </div>
    </header>
  );
}

function getLocalTime() {
  const d = new Date();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone.split('/').pop()?.replace(/_/g, ' ') || '';
  return `${time} ${tz}`;
}
