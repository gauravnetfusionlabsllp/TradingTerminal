import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../stores/use-app-store';
import { X, Keyboard } from 'lucide-react';

const ALL_SHORTCUTS = [
  { keys: 'H', desc: 'Heatmap view' },
  { keys: 'C', desc: 'Compare view' },
  { keys: '?', desc: 'Keyboard shortcuts' },
  { keys: 'Esc', desc: 'Close dialog' },
  { keys: 'Alt+K', desc: 'Search' },
  { keys: 'Alt+1…9', desc: 'Switch workspace' },
];

const KBD = 'inline-flex items-center h-4 px-1 border border-border rounded-sm text-micro text-neutral';

/** Shortcut hints, shown in the status bar */
export function KeyboardHUD() {
  return (
    <div className="flex items-center gap-3">
      {[['?', 'Help'], ['Alt K', 'Search']].map(([k, label]) => (
        <span key={k} className="flex items-center gap-1.5">
          <kbd className={KBD}>{k}</kbd>
          {label}
        </span>
      ))}
    </div>
  );
}

export function ShortcutsModal() {
  const isOpen = useAppStore((s) => s.shortcutsModalOpen);
  const setOpen = useAppStore((s) => s.setShortcutsModalOpen);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-bg/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="w-full max-w-md bg-raised border border-border rounded-sm shadow-[0_24px_64px_rgb(0_0_0/0.35)] overflow-hidden z-10"
          >
            <div className="flex items-center justify-between h-11 px-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Keyboard className="w-4 h-4 text-neutral" />
                <span className="text-sm font-semibold text-fg">Keyboard shortcuts</span>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close" className="text-neutral hover:text-fg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-2">
              {ALL_SHORTCUTS.map((s) => (
                <div key={s.keys} className="flex items-center justify-between h-8 px-2 hover:bg-hover">
                  <span className="text-xs text-fg">{s.desc}</span>
                  <kbd className={KBD}>{s.keys}</kbd>
                </div>
              ))}
            </div>
            <p className="px-4 py-3 border-t border-border text-mini text-neutral">
              Drag tabs to rearrange panels. Drag the gaps between panels to resize them.
            </p>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
