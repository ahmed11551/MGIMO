import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Подтвердить',
  cancelLabel = 'Отмена',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onCancel}
            aria-hidden="true"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative bg-white dark:!bg-slate-800 rounded-2xl p-6 shadow-xl max-w-sm w-full border border-slate-200 dark:!border-slate-600"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby="confirm-desc"
          >
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                danger ? 'bg-rose-100 dark:!bg-rose-900/30 text-rose-600' : 'bg-amber-100 dark:!bg-amber-900/30 text-amber-600'
              }`}>
                <AlertTriangle size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <h2 id="confirm-title" className="font-bold text-lg text-slate-900 dark:!text-slate-100">
                  {title}
                </h2>
                <p id="confirm-desc" className="mt-1 text-sm text-slate-500 dark:!text-slate-400">
                  {message}
                </p>
              </div>
            </div>
            <div className="mt-6 flex gap-3 justify-end">
              <button
                onClick={onCancel}
                className="px-4 py-2 rounded-xl font-medium text-slate-600 dark:!text-slate-400 hover:bg-slate-100 dark:hover:!bg-slate-700 transition-colors"
              >
                {cancelLabel}
              </button>
              <button
                onClick={onConfirm}
                className={`px-4 py-2 rounded-xl font-medium text-white transition-colors ${
                  danger
                    ? 'bg-rose-500 hover:bg-rose-600'
                    : 'bg-brand-primary hover:bg-brand-secondary'
                }`}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
