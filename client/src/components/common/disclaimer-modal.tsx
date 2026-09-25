import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/use-auth-store';
import { useT } from '../../i18n';
import { LEGAL_URL } from '../../lib/legal';
import { AlertTriangle } from 'lucide-react';

const DISCLAIMER_KEY = 'sgfx-disclaimer-accepted';

export function DisclaimerModal() {
  const t = useT();
  const user = useAuthStore((s) => s.user);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (user && !localStorage.getItem(DISCLAIMER_KEY)) {
      setVisible(true);
    }
  }, [user]);

  if (!visible) return null;

  const accept = () => {
    localStorage.setItem(DISCLAIMER_KEY, '1');
    setVisible(false);
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-bg/80">
      <div className="relative w-full max-w-md bg-panel border border-border shadow-[0_24px_64px_rgb(0_0_0/0.35)] p-8 mx-4">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5 text-orange" />
          <h2 className="text-base font-semibold text-fg">
            {t('disclaimerTitle')}
          </h2>
        </div>

        <p className="text-xs text-neutral leading-relaxed mb-6">
          {t('disclaimerBody')}
        </p>

        <a href={LEGAL_URL} target="_blank" rel="noopener noreferrer" className="block -mt-3 mb-6 text-xs text-accent-ink hover:underline">
          {t('termsOfService')} / {t('privacyPolicy')}
        </a>

        <button
          onClick={accept}
          className="w-full h-10 rounded-sm bg-accent text-on-accent text-sm font-semibold hover:bg-accent/90"
        >
          {t('disclaimerAccept')}
        </button>
      </div>
    </div>
  );
}
