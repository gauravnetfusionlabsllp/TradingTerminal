import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, RefreshCw, Gauge, Palette, Moon, Sun, Monitor } from 'lucide-react';
import { useAppStore, type UserSettings } from '../../stores/use-app-store';
import { playAlertSound } from '../../lib/alert-sound';
import { useT } from '../../i18n';

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-9 h-5 rounded-full transition-colors ${
        checked ? 'bg-accent' : 'bg-border'
      }`}
    >
      <div
        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-on-accent shadow transition-transform ${
          checked ? 'translate-x-4' : ''
        }`}
      />
    </button>
  );
}

function Slider({
  value,
  min,
  max,
  step,
  label,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  label: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 h-1 accent-accent bg-border/50 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent"
      />
      <span className="text-mini text-neutral w-12 text-right">{label}</span>
    </div>
  );
}

export function SettingsPanel() {
  const open = useAppStore((s) => s.settingsPanelOpen);
  const settings = useAppStore((s) => s.settings);
  const setSettingsPanelOpen = useAppStore((s) => s.setSettingsPanelOpen);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const t = useT();
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        const settingsBtn = (e.target as HTMLElement).closest('[data-settings-btn]');
        if (!settingsBtn) setSettingsPanelOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, setSettingsPanelOpen]);

  const set = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) =>
    updateSettings({ [key]: value });

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={panelRef}
          initial={{ opacity: 0, y: -8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.96 }}
          transition={{ duration: 0.15 }}
          className="absolute right-0 top-full mt-2 w-80 bg-raised border border-border rounded-sm shadow-[0_12px_32px_rgb(0_0_0/0.3)] overflow-hidden z-50"
        >
          {/* Header */}
          <div className="px-4 py-2.5 border-b border-border">
            <span className="text-xs font-semibold text-fg">{t('settings')}</span>
          </div>

          <div className="p-4 space-y-5">
            {/* Notifications group */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-mini font-medium text-neutral">
                <Bell className="w-3 h-3" />
                {t('notifications')}
              </div>
              <div className="space-y-2.5 pl-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-fg">{t('sound')}</span>
                  <Toggle checked={settings.soundEnabled} onChange={(v) => { set('soundEnabled', v); if (v) playAlertSound(); }} />
                </div>
              </div>
            </div>

            {/* Display group */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-mini font-medium text-neutral">
                <Gauge className="w-3 h-3" />
                {t('display')}
              </div>
              <div className="space-y-3 pl-5">
                <div>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-xs text-fg">{t('showTicker')}</span>
                    <Toggle checked={settings.showTicker} onChange={(v) => set('showTicker', v)} />
                  </label>
                  {settings.showTicker && (
                    <div className="mt-2.5">
                      <span className="text-mini text-neutral block mb-1">{t('tickerSpeed')}</span>
                      {/* Stored as seconds per loop; flipped so dragging right speeds it up, shown as a multiple of the 80s default */}
                      <Slider
                        value={220 - settings.tickerSpeed}
                        min={20}
                        max={200}
                        step={10}
                        label={`${(80 / settings.tickerSpeed).toFixed(1)}×`}
                        onChange={(v) => set('tickerSpeed', 220 - v)}
                      />
                    </div>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <RefreshCw className="w-3 h-3 text-neutral" />
                    <span className="text-xs text-fg">{t('autoRefresh')}</span>
                  </div>
                  <Slider
                    value={settings.autoRefreshInterval}
                    min={10}
                    max={120}
                    step={5}
                    label={`${settings.autoRefreshInterval}s`}
                    onChange={(v) => set('autoRefreshInterval', v)}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-fg">{t('throttleQuotes')}</span>
                    <Toggle checked={settings.quoteThrottle} onChange={(v) => set('quoteThrottle', v)} />
                  </div>
                  {settings.quoteThrottle && (
                    <Slider
                      value={settings.quoteThrottleMs}
                      min={100}
                      max={1000}
                      step={50}
                      label={`${settings.quoteThrottleMs}ms`}
                      onChange={(v) => set('quoteThrottleMs', v)}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Theme group */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-mini font-medium text-neutral">
                <Palette className="w-3 h-3" />
                {t('theme')}
              </div>
              <div role="radiogroup" aria-label={t('theme')} className="ml-5 grid grid-cols-3 border border-border rounded-sm overflow-hidden">
                {([['dark', Moon, 'themeDark'], ['light', Sun, 'themeLight'], ['system', Monitor, 'themeSystem']] as const).map(([id, Icon, label]) => (
                  <button
                    key={id}
                    role="radio"
                    aria-checked={settings.theme === id}
                    onClick={() => set('theme', id)}
                    className={`flex items-center justify-center gap-1.5 h-8 text-xs border-r border-border last:border-r-0 transition-colors ${
                      settings.theme === id ? 'bg-accent text-on-accent' : 'text-neutral hover:bg-hover hover:text-fg'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {t(label)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
