import type { ReactNode } from 'react';

/** Sticky glass header: left slot · centred title · right slot. */
export function PageHeader({ left, title, right }: { left?: ReactNode; title: ReactNode; right?: ReactNode }) {
  return (
    <header className="glass sticky top-2 z-20 mb-4 grid min-h-14 grid-cols-[3rem_1fr_3rem] items-center gap-2 rounded-full px-2 py-1.5">
      <div className="flex justify-start">{left}</div>
      <div className="min-w-0 truncate text-center text-sm font-extrabold tracking-[0.2em]">{title}</div>
      <div className="flex justify-end">{right}</div>
    </header>
  );
}
