import type { ReactNode } from 'react';
import type { IJsonModel } from 'flexlayout-react';
import { cn } from '../common/glass-card';
import { PANEL_IDS, getLocalizedPanelName } from './panels';

// Miniature of a real layout: rows split like the dock does (root horizontal, alternating with depth),
// weighted like its splitters. Tabsets that can trade (ticket / positions / orders) are outlined in amber.

const TRADES = new Set<string>([PANEL_IDS.TRADING, PANEL_IDS.POSITIONS, PANEL_IDS.ORDERS, PANEL_IDS.HISTORY]);

function node(n: any, horizontal: boolean, key: number): ReactNode {
  const flex = `${n.weight ?? 100} 1 0`;
  const kids: any[] = n.children ?? [];
  if (n.type === 'row') {
    return (
      <div key={key} style={{ flex }} className={cn('flex min-w-0 min-h-0 gap-px', horizontal ? 'flex-row' : 'flex-col')}>
        {kids.map((c, i) => node(c, !horizontal, i))}
      </div>
    );
  }
  const selected = kids[n.selected ?? 0]?.component;
  const trades = kids.some((t) => TRADES.has(t.component));
  return (
    <div
      key={key}
      style={{ flex }}
      className={cn(
        'min-w-0 min-h-0 overflow-hidden whitespace-nowrap border px-[2px] pt-px text-micro leading-[7px] font-mono uppercase',
        trades ? 'border-accent/70 text-accent-ink/80' : 'border-border text-neutral/45',
      )}
    >
      {selected ? getLocalizedPanelName(selected) : ''}
    </div>
  );
}

export function LayoutThumb({ layout, className }: { layout: IJsonModel; className?: string }) {
  return (
    <div aria-hidden className={cn('flex bg-black', className)}>
      {node(layout.layout, true, 0)}
    </div>
  );
}
