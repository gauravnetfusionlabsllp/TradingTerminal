import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { useT } from '../../i18n';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const t = useT();

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-bg/70 backdrop-blur-sm"
            onClick={onCancel}
          />
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.15 }}
            className="relative w-full max-w-sm bg-raised border border-border rounded-sm p-5 mx-4 shadow-[0_24px_64px_rgb(0_0_0/0.35)]"
          >
            <div className="flex items-start gap-3 mb-4">
              <div className={`p-1.5 ${variant === 'danger' ? 'text-bearish bg-bearish/10' : 'text-accent-ink bg-accent/10'}`}>
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-fg">{title}</h3>
                {description && (
                  <p className="text-xs text-neutral mt-1 leading-relaxed">{description}</p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={onCancel}
                className="flex-1 h-8 rounded-sm text-xs font-medium text-fg border border-border hover:bg-hover transition-colors"
              >
                {cancelLabel || t('cancel')}
              </button>
              <button
                onClick={onConfirm}
                className={`flex-1 h-8 rounded-sm text-xs font-semibold transition-colors ${
                  variant === 'danger'
                    ? 'bg-sell text-on-accent hover:bg-sell/90'
                    : 'bg-accent text-on-accent hover:bg-accent/90'
                }`}
              >
                {confirmLabel || t('confirm')}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
