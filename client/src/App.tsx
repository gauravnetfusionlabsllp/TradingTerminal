import { useEffect } from 'react';
import { AppShell } from './components/layout/app-shell';
import { CommandPalette } from './components/common/command-palette';
import { KeyboardHUD, ShortcutsModal } from './components/common/keyboard-hud';
import { LoginModal } from './components/auth/login-modal';
import { CookieConsent } from './components/common/cookie-consent';
import { DisclaimerModal } from './components/common/disclaimer-modal';
import { useWebSocket } from './realtime/use-ws';
import { useKeyboard } from './hooks/use-keyboard';
import { useAuth } from './api/hooks/use-auth';
import { useAppStore } from './stores/use-app-store';

export default function App() {
  useWebSocket();
  useKeyboard();
  useAuth();
  const theme = useAppStore((s) => s.settings.theme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <>
      <AppShell />
      <LoginModal />
      <CommandPalette />
      <KeyboardHUD />
      <ShortcutsModal />
      <CookieConsent />
      <DisclaimerModal />
    </>
  );
}
