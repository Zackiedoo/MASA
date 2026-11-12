import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export const MAIN_TABS = ['/', '/wall', '/messages', '/profile'] as const;
export const tabIndexFor = (pathname: string) => {
  if (pathname === '/') return 0;
  const i = MAIN_TABS.findIndex((t, idx) => idx > 0 && pathname.startsWith(t));
  return i;
};

/**
 * Swipe left/right between the four primary sections (touch devices).
 * Ignored when the gesture starts inside something that scrolls sideways, a text field, a dialog,
 * or an element marked data-no-swipe — so it never fights with typing or modals.
 */
export function useSwipeNav(enabled: boolean, onDirection?: (dir: 1 | -1) => void) {
  const nav = useNavigate();
  const { pathname } = useLocation();
  useEffect(() => {
    if (!enabled) return;
    const idx = tabIndexFor(pathname);
    if (idx < 0) return;
    let sx = 0, sy = 0, t0 = 0, ok = false;
    const blocked = (el: EventTarget | null) =>
      el instanceof Element && !!el.closest('input,textarea,select,[contenteditable],[role="dialog"],[data-no-swipe]');
    const start = (e: TouchEvent) => {
      ok = e.touches.length === 1 && !blocked(e.target);
      sx = e.touches[0].clientX; sy = e.touches[0].clientY; t0 = Date.now();
    };
    const end = (e: TouchEvent) => {
      if (!ok) return;
      const dx = e.changedTouches[0].clientX - sx;
      const dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.6 || Date.now() - t0 > 700) return;
      const dir = dx < 0 ? 1 : -1;
      const next = idx + dir;
      if (next < 0 || next >= MAIN_TABS.length) return;
      onDirection?.(dir);
      nav(MAIN_TABS[next]);
    };
    window.addEventListener('touchstart', start, { passive: true });
    window.addEventListener('touchend', end, { passive: true });
    return () => { window.removeEventListener('touchstart', start); window.removeEventListener('touchend', end); };
  }, [enabled, pathname, nav, onDirection]);
}
