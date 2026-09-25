import { type ReactNode } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// Our type-scale tokens are font sizes; without this twMerge reads text-micro as a colour and drops text-neutral
const twMerge = extendTailwindMerge({ extend: { classGroups: { 'font-size': [{ text: ['micro', 'mini'] }] } } });

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface GlassCardProps {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  headerRight?: ReactNode;
}

export function GlassCard({ children, className = '', title, headerRight }: GlassCardProps) {
  const showHeader = title || headerRight;

  return (
    <div className={cn('bg-panel flex flex-col overflow-hidden relative', className)}>
      {showHeader && (
        <div className="h-8 px-3 border-b border-border bg-raised flex items-center justify-between gap-2 z-10 shrink-0">
          {title ? <span className="text-xs font-semibold text-fg truncate">{title}</span> : <span />}
          {headerRight && <div className="flex items-center">{headerRight}</div>}
        </div>
      )}
      <div className="flex-1 flex flex-col overflow-auto z-10">{children}</div>
    </div>
  );
}
