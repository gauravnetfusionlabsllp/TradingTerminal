import { useState } from 'react';
import { useAuthStore } from '../../stores/use-auth-store';
import { useAuthActions } from '../../api/hooks/use-auth';
import { useT } from '../../i18n';
import { X, Shield } from 'lucide-react';

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

  const inputClass = 'w-full bg-black border border-border px-3 py-2.5 text-sm font-mono text-white placeholder:text-neutral/30 mb-3 focus:border-accent outline-none';
  const labelClass = 'block text-[9px] font-bold uppercase tracking-widest text-neutral mb-1.5';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={close}>
      <div
        className="relative w-full max-w-sm bg-black border border-border p-6 mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={close}
          className="absolute top-3 right-3 text-neutral hover:text-white p-1"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-2 mb-6">
          <Shield className="w-5 h-5 text-accent" />
          <h2 className="text-sm font-black uppercase tracking-widest text-accent">
            {t('login')}
          </h2>
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

          <label className="flex items-center gap-2 mb-4 text-[10px] font-mono text-neutral cursor-pointer select-none">
            <input
              type="checkbox"
              checked={investor}
              onChange={(e) => setInvestor(e.target.checked)}
            />
            {t('investorReadOnly')}
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-accent text-black text-[11px] font-black uppercase tracking-widest hover:bg-accent/90 disabled:opacity-50"
          >
            {loading ? t('loggingIn') : t('login')}
          </button>
        </form>

        {/* Terms consent note */}
        <p className="mt-4 text-[9px] font-mono text-neutral/50 text-center leading-relaxed">
          {t('cookieConsent')}{' '}
          <a href="https://github.com/KoNananachan/Neuberg/blob/main/TERMS_OF_SERVICE.md" target="_blank" rel="noopener noreferrer" className="text-accent/60 hover:text-accent">{t('termsOfService')}</a>
          {' '}{t('and')}{' '}
          <a href="https://github.com/KoNananachan/Neuberg/blob/main/PRIVACY_POLICY.md" target="_blank" rel="noopener noreferrer" className="text-accent/60 hover:text-accent">{t('privacyPolicy')}</a>.
        </p>

        {/* Error */}
        {error && (
          <p role="alert" className="mt-3 text-[10px] font-mono text-bearish text-center">{error}</p>
        )}
      </div>
    </div>
  );
}
