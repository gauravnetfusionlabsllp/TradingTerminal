import { useAppStore } from '../../stores/use-app-store';
import { useT } from '../../i18n';
import { LEGAL_URL } from '../../lib/legal';

export function StatusBar() {
  const wsConnected = useAppStore((s) => s.wsConnected);
  const t = useT();

  return (
    <footer className="bg-panel border-t border-border h-7 flex items-center justify-between px-2 shrink-0 text-[10px] font-mono text-neutral z-20 uppercase tracking-wider">
      <div className="hidden lg:flex items-center gap-3 text-neutral/40 text-[9px]">
        <span>{t('disclaimer')}</span>
        <a href={LEGAL_URL} target="_blank" rel="noopener noreferrer" className="hover:text-neutral uppercase tracking-widest">{t('privacyPolicy')}</a>
        <a href={LEGAL_URL} target="_blank" rel="noopener noreferrer" className="hover:text-neutral uppercase tracking-widest">{t('termsOfService')}</a>
      </div>

      <div className="flex items-center gap-4 ml-auto">
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 ${wsConnected ? 'bg-bullish' : 'bg-bearish'}`} />
          <span className={`font-bold ${wsConnected ? 'text-bullish' : 'text-bearish'}`}>
            {wsConnected ? t('wsSecure') : t('wsReconnecting')}
          </span>
        </div>
      </div>
    </footer>
  );
}
