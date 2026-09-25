import { useState } from 'react';
import { useAuthStore } from '../../stores/use-auth-store';
import { useAuthActions } from '../../api/hooks/use-auth';
import { useT } from '../../i18n';
import { LEGAL_URL } from '../../lib/legal';
import { X } from 'lucide-react';
import logoSvg from '../../assets/logo.svg?raw';

export function LoginModal() {
  const t = useT();
  const open = useAuthStore((s) => s.loginModalOpen);
  const setOpen = useAuthStore((s) => s.setLoginModalOpen);
  const { login } = useAuthActions();

  const [mt5Login, setMt5Login] = useState('');
  const [password, setPassword] = useState('');
  const [investor, setInvestor] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const close = () => {
    setOpen(false);
    setPassword('');
    setError('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mt5Login || !password) {
      setError(t('enterMt5Login'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login(Number(mt5Login), password, investor);
      setPassword('');
    } catch (err: any) {
      setError(err.message || t('loginFailed'));
    } finally {
      setLoading(false);
    }
  };

  const inputClass = 'w-full h-9 bg-raised border border-border rounded-sm px-3 text-sm text-fg mb-4 focus:border-accent outline-none';
  const labelClass = 'block text-xs text-neutral mb-1.5';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-bg/80 backdrop-blur-sm" onClick={close}>
      <div
        className="corner-flag relative w-full max-w-sm bg-panel border border-border shadow-[0_24px_64px_rgb(0_0_0/0.35)] px-8 pt-8 pb-6 mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={close}
          aria-label="Close"
          className="absolute top-3 right-4 text-neutral hover:text-fg p-1"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="mb-7">
          <span aria-hidden className="block h-7 w-[108px] text-fg [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: logoSvg }} />
          <h2 className="mt-5 text-base font-semibold text-fg">{t('loginWithMt5')}</h2>
        </div>

        <form onSubmit={handleLogin}>
          <label htmlFor="mt5-login" className={labelClass}>{t('mt5Login')}</label>
          <input
            id="mt5-login"
            type="text"
            inputMode="numeric"
            autoComplete="username"
            value={mt5Login}
            onChange={(e) => setMt5Login(e.target.value.replace(/\D/g, '').slice(0, 15))}
            placeholder="12345678"
            autoFocus
            className={inputClass}
          />

          <label htmlFor="mt5-password" className={labelClass}>{t('mt5Password')}</label>
          <input
            id="mt5-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            maxLength={64}
            className={inputClass}
          />

          <label className="flex items-center gap-2 mb-5 text-xs text-neutral cursor-pointer select-none">
            <input
              type="checkbox"
              checked={investor}
              onChange={(e) => setInvestor(e.target.checked)}
              className="accent-accent w-3.5 h-3.5 p-0"
            />
            {t('investorReadOnly')}
          </label>

          {error && <p role="alert" className="-mt-2 mb-3 text-xs text-bearish">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 bg-accent text-on-accent text-sm font-semibold rounded-sm hover:bg-accent/90 disabled:opacity-50"
          >
            {loading ? t('loggingIn') : t('login')}
          </button>
        </form>

        {/* Terms consent note */}
        <p className="mt-5 text-mini text-neutral leading-relaxed">
          {t('cookieConsent')}{' '}
          <a href={LEGAL_URL} target="_blank" rel="noopener noreferrer" className="text-accent-ink hover:underline">{t('termsOfService')}</a>
          {' '}{t('and')}{' '}
          <a href={LEGAL_URL} target="_blank" rel="noopener noreferrer" className="text-accent-ink hover:underline">{t('privacyPolicy')}</a>.
        </p>
      </div>
    </div>
  );
}
