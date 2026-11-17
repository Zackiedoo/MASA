import { createContext, useContext, useLayoutEffect, type ReactNode } from 'react';

/** Lets AppShell know whether the current page draws its own banner, so it can supply a default one when it doesn't. */
export const BannerCtx = createContext<{ claim: () => () => void }>({ claim: () => () => undefined });

/** Sticky glass banner: left slot · centred title · right slot. AppShell shows a default one on any page that has none, so it is always there. */
export function PageHeader({ left, title, right, isDefault }: { left?: ReactNode; title: ReactNode; right?: ReactNode; isDefault?: boolean }) {
  const { claim } = useContext(BannerCtx);
  useLayoutEffect(() => (isDefault ? undefined : claim()), [claim, isDefault]); // the shell's own default banner must not count as a page banner
  return (
    <header className="glass sticky top-2 z-20 mb-4 grid min-h-14 grid-cols-[3rem_1fr_3rem] items-center gap-2 rounded-full px-2 py-1.5">
      <div className="flex justify-start">{left}</div>
      <div className="min-w-0 truncate text-center text-sm font-extrabold tracking-[0.2em]">{title}</div>
      <div className="flex justify-end">{right}</div>
    </header>
  );
}
