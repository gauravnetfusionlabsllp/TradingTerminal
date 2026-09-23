import { Mt5Trading } from '../trading/mt5-trading';
import { useAuthStore } from '../../stores/use-auth-store';
import { useT } from '../../i18n';
import { BarChart3, FlaskConical } from 'lucide-react';

// Hyperliquid / Alpaca channels are hidden (MT5-only terminal); their components remain for a later cleanup pass.
export function TradingPanel() {
  const user = useAuthStore((s) => s.user);
  const t = useT();

  return (
    <div className="h-full flex flex-col bg-black overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#050505] border-b border-border/30 shrink-0">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-accent" />
          <span className="text-[9px] font-black font-mono uppercase tracking-tighter px-2 py-0.5 border bg-accent text-black border-accent">
            MT5
          </span>
        </div>
        {user && (
          <span className="text-[9px] font-mono text-bullish flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-bullish inline-block" />
            {t('connected')}
          </span>
        )}
      </div>

      {/* Early access banner */}
      <div className="px-3 py-1.5 bg-amber-500/[0.08] border-b border-amber-500/30 shrink-0 flex items-center gap-2">
        <FlaskConical className="w-3 h-3 text-amber-400 shrink-0" />
        <span className="text-[8px] font-mono font-bold text-amber-400/90 uppercase tracking-wider leading-tight">
          {t('earlyAccessTrading')}
        </span>
      </div>

      <div className="flex-1 overflow-hidden min-h-0">
        <Mt5Trading />
      </div>
    </div>
  );
}
