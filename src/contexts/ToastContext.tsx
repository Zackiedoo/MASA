import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';

interface Toast { id: number; text: string; kind: 'ok' | 'error' }
const Ctx = createContext<{ toast: (text: string, kind?: 'ok' | 'error') => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const toast = useCallback((text: string, kind: 'ok' | 'error' = 'ok') => {
    const id = Date.now() + Math.random();
    setItems((l) => [...l, { id, text, kind }]);
    window.setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), 4200);
  }, []);
  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[80] flex flex-col items-center gap-2 px-4 lg:bottom-6" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className="glass pointer-events-auto flex max-w-md items-start gap-2 rounded-2xl px-4 py-3 text-sm shadow-glass">
            {t.kind === 'ok' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ok" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-bad" />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
export const useToast = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useToast must be used inside <ToastProvider>');
  return c.toast;
};
