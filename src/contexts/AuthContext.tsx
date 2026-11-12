import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { onAuthChange, signIn as doSignIn, signOutUser } from '../lib/auth';
import { watch } from '../lib/database';
import type { Role, UserProfile } from '../types';

interface AuthState {
  uid: string | null;
  profile: UserProfile | null;
  role: Role | null;
  /** true until we know whether someone is signed in (avoids a login-screen flash on reload) */
  loading: boolean;
  notice: string | null;
  signIn: (id: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearNotice: () => void;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [uid, setUid] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => onAuthChange((u) => { setUid(u?.uid ?? null); setAuthReady(true); if (!u) { setProfile(null); setProfileReady(true); } else setProfileReady(false); }), []);

  // Live profile: a role change or account disable made by an admin takes effect immediately.
  useEffect(() => {
    if (!uid) return;
    return watch<Omit<UserProfile, 'uid'>>(`users/${uid}`, (p) => {
      if (!p) { setNotice('This account has not been set up yet. Please contact an administrator.'); void signOutUser(); return; }
      if (p.isActive === false) { setNotice('This account has been disabled. Please contact an administrator.'); void signOutUser(); return; }
      setProfile({ ...p, uid });
      setProfileReady(true);
    }, () => { setNotice('Could not load your profile.'); setProfileReady(true); });
  }, [uid]);

  const signIn = useCallback(async (id: string, pw: string) => { setNotice(null); await doSignIn(id, pw); }, []);
  const signOut = useCallback(async () => { await signOutUser(); }, []);
  const clearNotice = useCallback(() => setNotice(null), []);

  const value = useMemo<AuthState>(() => ({
    uid, profile, role: profile?.role ?? null, loading: !authReady || (!!uid && !profileReady), notice, signIn, signOut, clearNotice,
  }), [uid, profile, authReady, profileReady, notice, signIn, signOut, clearNotice]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth must be used inside <AuthProvider>');
  return c;
}
