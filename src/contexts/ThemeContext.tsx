import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { MotionConfig } from 'framer-motion';
import { watch, patch } from '../lib/database';
import { useAuth } from './AuthContext';
import type { FontSize, ThemeName, UserSettings } from '../types';

const LS = 'masa-settings';
const DEFAULTS: UserSettings = { theme: 'maroon-gold', fontSize: 'md', reduceMotion: false };
export const FONT_PX: Record<FontSize, number> = { sm: 14, md: 16, lg: 18, xl: 20 };

interface ThemeState { settings: UserSettings; update: (p: Partial<UserSettings>) => void }
const Ctx = createContext<ThemeState | null>(null);

function loadLocal(): UserSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(LS) || '{}');
    return {
      theme: ['maroon-gold', 'light', 'dark'].includes(raw.theme) ? (raw.theme as ThemeName) : DEFAULTS.theme,
      fontSize: ['sm', 'md', 'lg', 'xl'].includes(raw.fontSize) ? raw.fontSize : DEFAULTS.fontSize,
      reduceMotion: typeof raw.reduceMotion === 'boolean' ? raw.reduceMotion : window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    };
  } catch {
    return DEFAULTS;
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { uid } = useAuth();
  const [settings, setSettings] = useState<UserSettings>(loadLocal);

  // Signed-in users get their saved preferences from the database (works across devices).
  useEffect(() => {
    if (!uid) return;
    return watch<Partial<UserSettings>>(`userSettings/${uid}`, (remote) => {
      if (remote) setSettings((s) => ({ ...s, ...remote }));
    });
  }, [uid]);

  // Apply to the page.
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = settings.theme;
    root.dataset.reduceMotion = String(settings.reduceMotion);
    root.style.fontSize = `${FONT_PX[settings.fontSize]}px`;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', settings.theme === 'dark' ? '#120E16' : '#800020');
    try { localStorage.setItem(LS, JSON.stringify(settings)); } catch { /* private mode */ }
  }, [settings]);

  const update = useCallback((p: Partial<UserSettings>) => {
    setSettings((s) => {
      const next = { ...s, ...p };
      if (uid) void patch(Object.fromEntries(Object.entries(next).map(([k, v]) => [`userSettings/${uid}/${k}`, v]))).catch(() => undefined);
      return next;
    });
  }, [uid]);

  const value = useMemo(() => ({ settings, update }), [settings, update]);
  return (
    <Ctx.Provider value={value}>
      <MotionConfig reducedMotion={settings.reduceMotion ? 'always' : 'user'}>{children}</MotionConfig>
    </Ctx.Provider>
  );
}

export function useTheme() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useTheme must be used inside <ThemeProvider>');
  return c;
}
