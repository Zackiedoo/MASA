import type { ReactNode } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

export const Spinner = ({ label = 'Loading…' }: { label?: string }) => (
  <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted" role="status"><Loader2 className="h-4 w-4 animate-spin" />{label}</div>
);

export const CardSkeleton = ({ n = 3 }: { n?: number }) => (
  <div className="space-y-4" aria-hidden="true">{Array.from({ length: n }, (_, i) => <div key={i} className="skeleton h-40" />)}</div>
);

export function Empty({ icon, title, hint, action }: { icon?: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="glass card flex flex-col items-center gap-2 px-6 py-10 text-center">
      {icon && <div className="text-primary/70">{icon}</div>}
      <p className="font-semibold">{title}</p>
      {hint && <p className="max-w-sm text-sm text-muted">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export const ErrorBox = ({ message }: { message: string }) => (
  <div role="alert" className="flex items-start gap-2 rounded-2xl border border-bad/30 bg-bad/10 px-4 py-3 text-sm text-bad">
    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{message}</span>
  </div>
);

export const Badge = ({ children, tone = 'gold' }: { children: ReactNode; tone?: 'gold' | 'maroon' | 'muted' | 'ok' | 'warn' | 'bad' }) => {
  const t = { gold: 'bg-gold/20 text-deep', maroon: 'bg-primary/12 text-link', muted: 'bg-ink/8 text-muted', ok: 'bg-ok/15 text-ok', warn: 'bg-warn/20 text-warn', bad: 'bg-bad/15 text-bad' }[tone];
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${t}`}>{children}</span>;
};
