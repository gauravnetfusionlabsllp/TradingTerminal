import { useState, useEffect } from 'react';
import { useT } from '../../i18n';
import { LEGAL_URL } from '../../lib/legal';

const CONSENT_KEY = 'sgfx-cookie-consent';

export function CookieConsent() {
  const t = useT();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(CONSENT_KEY)) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const accept = () => {
    localStorage.setItem(CONSENT_KEY, '1');
    setVisible(false);
  };

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] w-full max-w-lg px-4">
      <div className="bg-raised border border-border rounded-sm px-4 py-3 flex items-center gap-4 text-mini text-neutral shadow-[0_12px_32px_rgb(0_0_0/0.3)]">
        <p className="flex-1 leading-relaxed">
          {t('cookieConsent')}{' '}
          <a href={LEGAL_URL} target="_blank" rel="noopener noreferrer" className="text-accent-ink hover:underline">{t('privacyPolicy')}</a>
          {' '}{t('and')}{' '}
          <a href={LEGAL_URL} target="_blank" rel="noopener noreferrer" className="text-accent-ink hover:underline">{t('termsOfService')}</a>.
        </p>
        <button
          onClick={accept}
          className="shrink-0 h-7 px-3 rounded-sm bg-accent text-on-accent text-xs font-semibold hover:bg-accent/90"
        >
          {t('cookieAccept')}
        </button>
      </div>
    </div>
  );
}
