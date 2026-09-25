import { AppShell } from './components/layout/app-shell';
import { CommandPalette } from './components/common/command-palette';
import { ShortcutsModal } from './components/common/keyboard-hud';
import { LoginModal } from './components/auth/login-modal';
import { CookieConsent } from './components/common/cookie-consent';
import { DisclaimerModal } from './components/common/disclaimer-modal';
import { useWebSocket } from './realtime/use-ws';
import { useKeyboard } from './hooks/use-keyboard';
import { useAuth } from './api/hooks/use-auth';
import './lib/theme'; // applies data-theme and keeps it in step with the settings and the OS

export default function App() {
  useWebSocket();
  useKeyboard();
  useAuth();

  return (
    <>
      <AppShell />
      <LoginModal />
      <CommandPalette />
      <ShortcutsModal />
      <CookieConsent />
      <DisclaimerModal />
    </>
  );
}
