import { useAppStore } from '../../stores/use-app-store';
import { useT } from '../../i18n';
import { LEGAL_URL } from '../../lib/legal';
import { KeyboardHUD } from '../common/keyboard-hud';

export function StatusBar() {
  const wsConnected = useAppStore((s) => s.wsConnected);
  const t = useT();

  return (
    <footer className="bg-panel border-t border-border h-6 flex items-center justify-between px-4 shrink-0 text-micro text-neutral z-20">
      <div className="flex items-center gap-4">
        <KeyboardHUD />
        <span className="hidden lg:inline h-3 w-px bg-border" />
        <span className="hidden lg:inline">{t('disclaimer')}</span>
        <a href={LEGAL_URL} target="_blank" rel="noopener noreferrer" className="hidden lg:inline hover:text-fg">{t('privacyPolicy')}</a>
        <a href={LEGAL_URL} target="_blank" rel="noopener noreferrer" className="hidden lg:inline hover:text-fg">{t('termsOfService')}</a>
      </div>

      <div className="flex items-center gap-1.5 ml-auto">
        <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-bullish' : 'bg-bearish'}`} />
        <span className={wsConnected ? 'text-bullish' : 'text-bearish'}>
          {wsConnected ? t('wsSecure') : t('wsReconnecting')}
        </span>
      </div>
    </footer>
  );
}
