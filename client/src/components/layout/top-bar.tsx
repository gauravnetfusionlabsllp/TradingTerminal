import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../../stores/use-app-store';
import { useT, LOCALE_LABELS, type Locale } from '../../i18n';
import { Search, Bell, Settings, LayoutGrid, Maximize2, Minimize2, Globe } from 'lucide-react';
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

  return (
    <header className="bg-panel border-b border-border flex items-center justify-between px-2 h-10 shrink-0 z-20 sticky top-0">
      <div className="flex items-center gap-3 min-w-0 flex-1 self-stretch">
        <div className="flex shrink-0 items-center gap-2 px-2 py-1 text-white font-bold uppercase tracking-widest text-xs" aria-label="SGFX Terminal">
          <span className="block h-4 w-[62px] [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: logoSvg }} />
          <span className="text-neutral/60 text-[9px]">TERMINAL</span>
        </div>
        <div className="h-5 w-px bg-border mx-1" />
        <span className="shrink-0 text-xs font-mono text-neutral px-2 py-0.5 border border-border bg-black">
          {localTime}
        </span>
        <div className="h-5 w-px bg-border shrink-0" />
        <WorkspaceTabs />
      </div>

      <div className="flex shrink-0 items-center gap-3 pl-3">
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="flex items-center gap-2 bg-black border border-border px-2 py-1 text-[11px] font-mono text-neutral hover:border-accent hover:text-accent transition-colors w-56 xl:w-72"
        >
          <Search className="w-3.5 h-3.5 shrink-0" />
          <span className="flex-1 text-left uppercase tracking-wider truncate">{t('search')}</span>
          <kbd className="hidden sm:inline-flex px-1 bg-border text-neutral text-[9px] font-bold">ALT+K</kbd>
        </button>

        <div className="flex items-center gap-2">
          {/* Panel Toggle */}
          <div className="relative" ref={panelMenuRef}>
            <button
              onClick={() => setPanelMenuOpen(!panelMenuOpen)}
              className={`flex items-center gap-1.5 text-neutral hover:text-accent transition-colors px-2 py-1 border border-transparent hover:border-border bg-black ${
                panelMenuOpen ? 'text-accent border-border' : ''
              }`}
              title={t('togglePanels')}
              aria-label={t('togglePanels')}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[9px] font-mono font-black tracking-widest uppercase">Panels</span>
            </button>
            <PanelToggleMenu open={panelMenuOpen} onClose={() => setPanelMenuOpen(false)} containerRef={panelMenuRef} />
          </div>

          {/* Fullscreen */}
          <button
            onClick={() => {
              if (document.fullscreenElement) {
                document.exitFullscreen();
              } else {
                document.documentElement.requestFullscreen();
              }
            }}
            className="text-neutral hover:text-accent transition-colors p-1.5 border border-transparent hover:border-border bg-black"
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
              className={`text-neutral hover:text-accent transition-colors p-1.5 border border-transparent hover:border-border bg-black ${
                notifPanelOpen ? 'text-accent border-border' : ''
              }`}
              aria-label={t('notifications')}
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 flex items-center justify-center px-1 bg-bearish text-white text-[9px] font-bold leading-none">
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
              className={`text-neutral hover:text-accent transition-colors p-1.5 border border-transparent hover:border-border bg-black ${
                settingsPanelOpen ? 'text-accent border-border' : ''
              }`}
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
              className={`text-neutral hover:text-accent transition-colors p-1.5 border border-transparent hover:border-border bg-black ${langMenuOpen ? 'text-accent border-border' : ''}`}
              aria-label={t('language')}
            >
              <Globe className="w-4 h-4" />
            </button>
            {langMenuOpen && (
              <div className="absolute right-0 top-full mt-1 bg-black border border-border z-50 py-1">
                {(Object.entries(LOCALE_LABELS) as [Locale, string][]).map(([code, label]) => (
                  <button
                    key={code}
                    onClick={() => { setLocale(code); setLangMenuOpen(false); }}
                    className={`block w-full text-left px-4 py-1.5 text-[11px] font-mono whitespace-nowrap ${
                      locale === code ? 'text-accent bg-accent/5' : 'text-neutral hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="h-5 w-px bg-border mx-1" />

        <UserMenu />

        <div className="h-5 w-px bg-border mx-1" />

        <div className="flex items-center gap-1.5 px-2 py-1 border border-border bg-black">
          <div
            className={`w-2 h-2 ${
              wsConnected ? 'bg-bullish' : 'bg-bearish'
            }`}
          />
          <span className={`text-[10px] font-bold font-mono uppercase tracking-widest ${wsConnected ? 'text-bullish' : 'text-bearish'}`}>
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
