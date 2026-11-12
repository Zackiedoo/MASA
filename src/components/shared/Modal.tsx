import { useEffect, useRef, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

interface Props { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean; footer?: ReactNode }

/** Glass dialog: bottom sheet on phones, centred card on larger screens. Esc / backdrop click closes. */
export function Modal({ open, onClose, title, children, wide, footer }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', key);
    const prevFocus = document.activeElement as HTMLElement | null;
    window.setTimeout(() => panel.current?.querySelector<HTMLElement>('input,textarea,select,button.btn-primary')?.focus(), 60);
    return () => { document.body.style.overflow = prevOverflow; window.removeEventListener('keydown', key); prevFocus?.focus?.(); };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6" data-no-swipe>
          <motion.div className="absolute inset-0 bg-black/40 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            ref={panel} role="dialog" aria-modal="true" aria-label={title}
            className={`glass relative flex max-h-[92dvh] w-full flex-col rounded-t-[2rem] bg-bg/90 sm:rounded-[2rem] ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`}
            initial={{ y: 40, opacity: 0, scale: 0.98 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 30, opacity: 0 }} transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          >
            <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-5">
              <h2 className="text-lg font-bold">{title}</h2>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Close"><X className="h-4 w-4" /></button>
            </div>
            <div className="overflow-y-auto px-5 pb-5">{children}</div>
            {footer && <div className="border-t divider flex flex-wrap justify-end gap-2 px-5 py-3 safe-bottom">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
