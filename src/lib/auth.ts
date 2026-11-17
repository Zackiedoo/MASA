// Authentication. Students sign in with Student ID + password. Firebase Auth only supports e-mail/password,
// so the ID is mapped to a synthetic address (`<id>@<LOGIN_EMAIL_DOMAIN>`). Accounts are created by
// administrators through the server (/api/admin/users); passwords are handled by Firebase Auth only —
// they are never stored in the database.
import { EmailAuthProvider, onAuthStateChanged, reauthenticateWithCredential, signInWithEmailAndPassword, signOut, updatePassword } from 'firebase/auth';
import { firebaseAuth, isDemoMode, LOGIN_EMAIL_DOMAIN } from './firebase';
import { demoGet } from './demoStore';
import { DEMO_PASSWORD } from './demoSeed';
import type { Unsub } from './database';

export const loginIdToEmail = (id: string) => `${id.trim().toLowerCase()}@${LOGIN_EMAIL_DOMAIN}`;
const DEMO_SESSION = 'masa-demo-session';
const demoListeners = new Set<(u: { uid: string } | null) => void>();

export function onAuthChange(cb: (u: { uid: string } | null) => void): Unsub {
  if (isDemoMode || !firebaseAuth) {
    demoListeners.add(cb);
    queueMicrotask(() => cb(demoCurrent()));
    return () => { demoListeners.delete(cb); };
  }
  return onAuthStateChanged(firebaseAuth, (u) => cb(u ? { uid: u.uid } : null));
}

function demoCurrent() {
  const uid = localStorage.getItem(DEMO_SESSION);
  return uid ? { uid } : null;
}

export async function signIn(loginId: string, password: string): Promise<void> {
  const id = loginId.trim();
  if (!id || !password) throw new Error('Enter your ID and password.');
  if (isDemoMode || !firebaseAuth) {
    const users = (demoGet('users') || {}) as Record<string, { studentId: string; isActive: boolean; approvalStatus?: string }>;
    const hit = Object.entries(users).find(([, u]) => u.studentId.toLowerCase() === id.toLowerCase());
    if (!hit || password !== DEMO_PASSWORD) throw new Error('Incorrect ID or password.');
    if (!hit[1].isActive && (hit[1].approvalStatus ?? 'approved') === 'approved') throw new Error('This account has been disabled. Contact an administrator.');
    localStorage.setItem(DEMO_SESSION, hit[0]);
    demoListeners.forEach((l) => l({ uid: hit[0] }));
    return;
  }
  try {
    await signInWithEmailAndPassword(firebaseAuth, loginIdToEmail(id), password);
  } catch (e) {
    const code = (e as { code?: string }).code || '';
    if (code === 'auth/user-disabled') throw new Error('This account has been disabled. Contact an administrator.');
    if (code === 'auth/too-many-requests') throw new Error('Too many attempts. Please wait a few minutes and try again.');
    if (code === 'auth/network-request-failed') throw new Error('Network problem. Check your connection.');
    // Same message for wrong ID and wrong password: don't reveal which IDs exist.
    throw new Error('Incorrect ID or password.');
  }
}

export async function signOutUser(): Promise<void> {
  if (isDemoMode || !firebaseAuth) {
    localStorage.removeItem(DEMO_SESSION);
    demoListeners.forEach((l) => l(null));
    return;
  }
  await signOut(firebaseAuth);
}

/** Re-authenticates with the current password, then sets the new one. */
export async function changePassword(loginId: string, current: string, next: string): Promise<void> {
  if (isDemoMode || !firebaseAuth) {
    if (current !== DEMO_PASSWORD) throw new Error('Current password is incorrect.');
    return; // Demo accounts keep the shared demo password.
  }
  const user = firebaseAuth.currentUser;
  if (!user) throw new Error('You are signed out.');
  try {
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(loginIdToEmail(loginId), current));
  } catch {
    throw new Error('Current password is incorrect.');
  }
  await updatePassword(user, next);
}

/** ID token for calling our own /api functions. */
export async function getIdToken(): Promise<string | null> {
  if (!firebaseAuth?.currentUser) return null;
  return firebaseAuth.currentUser.getIdToken();
}
