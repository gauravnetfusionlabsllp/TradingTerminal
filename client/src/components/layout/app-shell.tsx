import { TopBar } from './top-bar';
import { StockTicker } from './stock-ticker';
import { StatusBar } from './status-bar';
import { DockLayout } from './dock-layout';

export function AppShell() {
  return (
    <div className="h-screen flex flex-col bg-bg text-fg font-sans">
      <TopBar />
      <StockTicker />
      <main className="flex-1 overflow-hidden min-h-0 relative">
        <DockLayout />
      </main>
      <StatusBar />
    </div>
  );
}
