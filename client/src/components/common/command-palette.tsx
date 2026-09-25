import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../stores/use-app-store';
import { Terminal, TrendingUp, Command, LayoutDashboard } from 'lucide-react';
import { useT } from '../../i18n';
import { useWorkspaceStore, wsLabel } from '../../stores/use-workspace-store';

export function CommandPalette() {
  const isOpen = useAppStore((s) => s.commandPaletteOpen);
  const setOpen = useAppStore((s) => s.setCommandPaletteOpen);
  const setSelectedSymbol = useAppStore((s) => s.setSelectedSymbol);
  
  const t = useT();
  const [input, setInput] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Command handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key === 'k') {
        e.preventDefault();
        setOpen(!isOpen);
      }
      if (e.key === 'Escape' && isOpen) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, setOpen]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 10);
      setInput('');
      setActiveIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!input) {
      setResults([]);
      return;
    }

    const searchResults: any[] = [];
    
    // Ticker detection (starts with dot or uppercase)
    if (input.startsWith('.') || (input.length <= 5 && /^[A-Z]+$/.test(input))) {
      const symbol = input.startsWith('.') ? input.slice(1).toUpperCase() : input.toUpperCase();
      searchResults.push({
        type: 'ticker',
        id: `ticker-${symbol}`,
        label: `GO ${symbol} - View Market Data`,
        icon: <TrendingUp className="w-4 h-4 text-bullish" />,
        action: () => setSelectedSymbol(symbol)
      });
    }

    // Workspaces by name
    const q = input.toLowerCase();
    const ws = useWorkspaceStore.getState();
    for (const w of ws.byOwner[ws.owner]?.list ?? []) {
      const label = wsLabel(w, t);
      if (!label.toLowerCase().includes(q)) continue;
      searchResults.push({
        type: 'workspace',
        id: `ws-${w.key}`,
        label: `${t('wsSwitch')}: ${label}`,
        icon: <LayoutDashboard className="w-4 h-4 text-accent-ink" />,
        action: () => ws.switchTo(w.key),
      });
    }

    setResults(searchResults);
    setActiveIndex(0);
  }, [input, setSelectedSymbol]);

  const handleExecute = (item: any) => {
    if (!item) return;
    item.action();
    setOpen(false);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-bg/70 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          className="w-full max-w-xl bg-raised border border-border rounded-sm shadow-[0_24px_64px_rgb(0_0_0/0.35)] overflow-hidden z-10"
        >
          <div className="flex items-center gap-3 px-4 h-12 border-b border-border">
            <Command className="w-4 h-4 text-neutral" />
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('cmdPlaceholder')}
              className="flex-1 bg-transparent border-none outline-none text-fg text-sm placeholder:text-neutral"
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setActiveIndex(prev => (prev + 1) % results.length);
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setActiveIndex(prev => (prev - 1 + results.length) % results.length);
                } else if (e.key === 'Enter') {
                  handleExecute(results[activeIndex]);
                }
              }}
            />
            <div className="flex items-center gap-1.5 px-1.5 h-5 rounded-sm border border-border text-micro text-neutral">
              ESC
            </div>
          </div>

          <div className="max-h-[350px] overflow-y-auto p-2 no-scrollbar">
            {results.length > 0 ? (
              results.map((item, index) => (
                <button
                  key={item.id}
                  onClick={() => handleExecute(item)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`w-full flex items-center gap-3 px-3 h-9 rounded-sm text-sm ${
                    index === activeIndex ? 'bg-accent/15 text-fg' : 'text-neutral'
                  }`}
                >
                  <span className={index === activeIndex ? 'text-accent-ink' : ''}>{item.icon}</span>
                  <span className="flex-1 text-left">{item.label}</span>
                  {index === activeIndex && (
                    <span className="text-micro text-accent-ink flex items-center gap-1">
                      {t('execute')} <Terminal className="w-3 h-3" />
                    </span>
                  )}
                </button>
              ))
            ) : (
              <div className="py-8 text-center text-neutral text-xs italic">
                {t('cmdNoResults')}
              </div>
            )}
          </div>
          
          <div className="px-4 h-9 border-t border-border flex justify-between items-center">
            <div className="flex gap-4">
              <span className="text-mini text-neutral flex items-center gap-1">
                <kbd className="px-1 h-4 inline-flex items-center rounded-sm border border-border">↑↓</kbd> {t('navigate')}
              </span>
              <span className="text-mini text-neutral flex items-center gap-1">
                <kbd className="px-1 h-4 inline-flex items-center rounded-sm border border-border">Enter</kbd> {t('execute')}
              </span>
            </div>
            <span className="text-micro text-neutral">SGFX Terminal</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
