import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, MessageSquare, Sparkles, UserRound } from 'lucide-react';
import { Wordmark } from '../shared/Logo';
import { DemoBanner } from '../shared/DemoBanner';
import { Drawer } from './Drawer';
import { PushBridge } from '../notifications/PushBridge';
import { BannerCtx, PageHeader } from './PageHeader';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import { useSubjects } from '../../contexts/SubjectsContext';
import { MAIN_TABS, tabIndexFor, useSwipeNav } from '../../hooks/useSwipeNav';

// Exactly four primary sections.
const NAV = [
  { to: MAIN_TABS[0], label: 'Home', icon: Home },
  { to: MAIN_TABS[1], label: 'Freedom Wall', icon: Sparkles },
  { to: MAIN_TABS[2], label: 'Messages', icon: MessageSquare },
  { to: MAIN_TABS[3], label: 'Profile', icon: UserRound },
] as const;

const ShellCtx = createContext<{ openMenu: () => void }>({ openMenu: () => undefined });
export const useShell = () => useContext(ShellCtx);

const DEFAULT_TITLE: Record<string, string> = { '': 'MASA', login: 'LOG IN', register: 'REGISTER', a: 'ANNOUNCEMENT', legal: 'LEGAL', settings: 'SETTINGS', publish: 'PUBLISH', admin: 'ADMIN', messages: 'MESSAGES', profile: 'PROFILE', wall: 'FREEDOM WALL' };

export function AppShell() {
  const [menu, setMenu] = useState(false);
  // Count of pages currently drawing their own banner; when none does (login screen, "waiting for approval", 404, legal…), a default banner is shown.
  const [own, setOwn] = useState(0);
  const claim = useCallback(() => { setOwn((n) => n + 1); return () => setOwn((n) => n - 1); }, []);
  const bannerCtx = useMemo(() => ({ claim }), [claim]);
  const { pathname } = useLocation();
  const { unreadCount, pendingCount } = useSubjects();
  const prevIdx = useRef(0);
  const dir = useRef(1);
  const idx = tabIndexFor(pathname);
  if (idx >= 0 && idx !== prevIdx.current) { dir.current = idx > prevIdx.current ? 1 : -1; prevIdx.current = idx; }

  useSwipeNav(true);
  const openMenu = useCallback(() => setMenu(true), []);
  const ctx = useMemo(() => ({ openMenu }), [openMenu]);
  const wide = pathname.startsWith('/admin');
  const badge = (to: string) => (to === '/messages' ? unreadCount + pendingCount : 0);
  const section = pathname === '/' ? 'home' : pathname.split('/')[1];

  return (
    <BannerCtx.Provider value={bannerCtx}>
    <ShellCtx.Provider value={ctx}>
      <div className="app-bg" aria-hidden="true" />
      <DemoBanner />
      <PushBridge />

      {/* Desktop / tablet-landscape: spacious sidebar with the same four sections */}
      <aside className="glass fixed inset-y-0 left-0 z-30 hidden w-64 flex-col gap-2 rounded-r-[2rem] border-l-0 p-5 lg:flex" style={{ top: 'var(--banner,0px)' }}>
        <div className="mb-6 mt-2 px-2"><Wordmark className="text-xl" /></div>
        <nav aria-label="Primary" className="flex flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `relative flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-colors ${isActive ? 'bg-primary text-white shadow-float' : 'text-ink hover:bg-primary/10'}`}>
              <Icon className="h-5 w-5" />{label}
              {badge(to) > 0 && <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-[#ff1f3d] px-1 text-[11px] font-bold text-white shadow-[0_0_0_2px_rgba(255,31,61,.25)]">{badge(to)}</span>}
            </NavLink>
          ))}
        </nav>
        <button className="btn btn-ghost mt-auto justify-start" onClick={openMenu}>Menu &amp; settings</button>
      </aside>

      <div className="lg:pl-64">
        <main id="main" className={`mx-auto w-full px-4 pb-28 pt-3 sm:px-6 lg:pb-10 ${wide ? 'max-w-6xl' : 'max-w-2xl'}`}>
          {own === 0 && <PageHeader isDefault title={DEFAULT_TITLE[pathname.split('/')[1] ?? ''] ?? 'MASA'} />}
          {/* Simple CSS enter animation (no exit animation, so a page can never get stuck invisible) */}
          <div key={section} className="page-enter" style={{ ['--dx' as string]: `${22 * dir.current}px` }}>
            <ErrorBoundary key={pathname}><Outlet /></ErrorBoundary>
          </div>
        </main>
      </div>

      {/* Mobile: fixed bottom navigation; main has bottom padding so nothing hides behind it */}
      <nav aria-label="Primary" className="glass fixed inset-x-3 bottom-3 z-40 rounded-[1.75rem] safe-bottom lg:hidden">
        <ul className="grid grid-cols-4">
          {NAV.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink to={to} end={to === '/'} className={({ isActive }) => `relative flex min-h-[3.5rem] flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] font-semibold transition-colors ${isActive ? 'text-link' : 'text-muted'}`}>
                {({ isActive }) => (
                  <>
                    {isActive && <motion.span layoutId="nav-pill" className="absolute inset-x-3 top-1 h-0.5 rounded-full bg-gradient-to-r from-primary to-gold" />}
                    <span className="relative"><Icon className="h-5 w-5" />{badge(to) > 0 && <span className="absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-[#ff1f3d] px-1 text-[10px] font-bold text-white">{badge(to)}</span>}</span>
                    {label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <Drawer open={menu} onClose={() => setMenu(false)} />
    </ShellCtx.Provider>
    </BannerCtx.Provider>
  );
}
