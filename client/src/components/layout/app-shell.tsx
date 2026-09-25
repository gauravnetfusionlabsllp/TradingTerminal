import { TopBar } from './top-bar';
import { StockTicker } from './stock-ticker';
import { StatusBar } from './status-bar';
import { DockLayout } from './dock-layout';
import { useAppStore } from '../../stores/use-app-store';

export function AppShell() {
  const showTicker = useAppStore((s) => s.settings.showTicker);
  return (
    <div className="h-screen flex flex-col bg-bg text-fg font-sans">
      <TopBar />
      {showTicker && <StockTicker />}
      <main className="flex-1 overflow-hidden min-h-0 relative">
        <DockLayout />
      </main>
      <StatusBar />
    </div>
  );
}
