import { useState, useMemo, useRef, useEffect, useId } from 'react';
import type { Mt5Symbol } from '../../api/hooks/use-mt5';
import { SymbolLogo } from '../common/symbol-logo';

export const tradeModeLabel = (mode: string) =>
  ({ TRADE_FULL: 'Full', TRADE_LONGONLY: 'Long only', TRADE_SHORTONLY: 'Short only', TRADE_CLOSEONLY: 'Close only' } as Record<string, string>)[mode] ?? mode;

// Fixed-height windowing: the allowed-symbols list can run to thousands, only ~16 rows are ever in the DOM
const ROW_H = 30;
const VISIBLE_ROWS = 8;
const OVERSCAN = 4;

interface Props {
  symbols: Mt5Symbol[];
  value?: string;
  onSelect: (symbol: string) => void;
  placeholder?: string;
  clearOnSelect?: boolean;
  className?: string;
}

/** Searchable, virtualized picker over the account's allowed MT5 symbols. */
export function SymbolPicker({ symbols, value = '', onSelect, placeholder, clearOnSelect, className = '' }: Props) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  // Reflect outside changes (position click, news selection) while not typing
  useEffect(() => {
    if (!open) setQuery(clearOnSelect ? '' : value);
  }, [value, open, clearOnSelect]);

  const q = query.trim().toUpperCase();
  const matches = useMemo(
    () => (q ? symbols.filter((s) => s.symbol.toUpperCase().includes(q)) : symbols),
    [symbols, q],
  );

  const start = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
  const end = Math.min(matches.length, Math.ceil(scrollTop / ROW_H) + VISIBLE_ROWS + OVERSCAN);

  const scrollTo = (i: number) => {
    const el = listRef.current;
    if (!el) return;
    if (i * ROW_H < el.scrollTop) el.scrollTop = i * ROW_H;
    else if ((i + 1) * ROW_H > el.scrollTop + el.clientHeight) el.scrollTop = (i + 1) * ROW_H - el.clientHeight;
  };

  const pick = (symbol: string) => {
    onSelect(symbol);
    setOpen(false);
    setQuery(clearOnSelect ? '' : symbol);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      const next = Math.min(Math.max(highlight + (e.key === 'ArrowDown' ? 1 : -1), 0), matches.length - 1);
      setHighlight(next);
      scrollTo(next);
    } else if (e.key === 'Enter' && open && matches[highlight]) {
      e.preventDefault();
      pick(matches[highlight].symbol);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* The selected symbol's logo; blank while typing. Search-only pickers (clearOnSelect) have none */}
      {!clearOnSelect && (
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 flex pointer-events-none">
          <SymbolLogo symbol={query === value ? value : ''} />
        </span>
      )}
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && matches[highlight] ? `${listId}-${highlight}` : undefined}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setHighlight(0);
          setScrollTop(0);
          if (listRef.current) listRef.current.scrollTop = 0;
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        maxLength={32}
        className={`w-full bg-black/60 border border-border/40 px-3 ${clearOnSelect ? '' : 'pl-7!'} py-2 text-[12px] font-mono text-white placeholder:text-neutral/30 outline-none focus:border-accent/50`}
      />

      {open && matches.length > 0 && (
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
          style={{ maxHeight: VISIBLE_ROWS * ROW_H }}
          className="absolute left-0 right-0 top-full mt-1 z-50 overflow-y-auto bg-zinc-900 border border-border/80 shadow-2xl"
        >
          <div style={{ height: matches.length * ROW_H, position: 'relative' }}>
            {matches.slice(start, end).map((s, i) => {
              const idx = start + i;
              return (
                <div
                  key={s.symbol}
                  id={`${listId}-${idx}`}
                  role="option"
                  aria-selected={idx === highlight}
                  // mousedown + preventDefault so the input's blur doesn't close the list before the pick lands
                  onMouseDown={(e) => { e.preventDefault(); pick(s.symbol); }}
                  onMouseEnter={() => setHighlight(idx)}
                  style={{ position: 'absolute', top: idx * ROW_H, height: ROW_H, left: 0, right: 0 }}
                  className={`px-3 flex items-center gap-2 cursor-pointer border-b border-border/10 ${idx === highlight ? 'bg-white/10' : ''}`}
                >
                  <SymbolLogo symbol={s.symbol} />
                  <span className="font-mono font-black text-xs text-accent-ink flex-1 truncate">{s.symbol}</span>
                  <span className="text-mini text-neutral font-mono shrink-0">{tradeModeLabel(s.tradeMode)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
