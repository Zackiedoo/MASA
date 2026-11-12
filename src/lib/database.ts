// One tiny data-access layer used by every service. In normal mode it talks to Firebase Realtime
// Database; in DEMO MODE it talks to the local demo store. Services never import Firebase directly.
import { get, onValue, orderByChild, limitToLast, push, query, ref, serverTimestamp, set, update } from 'firebase/database';
import { firebaseDb, isDemoMode } from './firebase';
import { buildSeed } from './demoSeed';
import { demoGet, demoInit, demoKey, demoPatch, demoSet, demoWatch } from './demoStore';

export type Unsub = () => void;
export interface WatchOptions { orderBy?: string; limitLast?: number }

if (isDemoMode) demoInit(buildSeed);

/** Server-side timestamp (Firebase) or client time (demo). Security rules require `createdAt === now`. */
export const stamp = (): number => (isDemoMode ? Date.now() : (serverTimestamp() as unknown as number));

/** Subscribe to a path. Returns an unsubscribe function. `null` means "no data". */
export function watch<T>(path: string, cb: (v: T | null) => void, onError?: (e: Error) => void, opts?: WatchOptions): Unsub {
  if (isDemoMode || !firebaseDb) return demoWatch(path, cb, opts);
  const r = ref(firebaseDb, path);
  const q = opts?.limitLast ? query(r, orderByChild(opts.orderBy ?? 'createdAt'), limitToLast(opts.limitLast)) : r;
  return onValue(q, (s) => cb(s.val() as T | null), (e) => onError?.(e));
}

export async function read<T>(path: string): Promise<T | null> {
  if (isDemoMode || !firebaseDb) return demoGet(path) as T | null;
  return (await get(ref(firebaseDb, path))).val() as T | null;
}

export async function write(path: string, value: unknown): Promise<void> {
  if (isDemoMode || !firebaseDb) return demoSet(path, value);
  await set(ref(firebaseDb, path), value);
}

/** Atomic multi-path update from the database root. `null` deletes a path. */
export async function patch(updates: Record<string, unknown>): Promise<void> {
  if (isDemoMode || !firebaseDb) return demoPatch(updates);
  await update(ref(firebaseDb), updates);
}

export function newKey(path: string): string {
  if (isDemoMode || !firebaseDb) return demoKey();
  return push(ref(firebaseDb, path)).key as string;
}

/** Human-friendly message for Firebase errors. */
export function explainError(e: unknown): string {
  const code = (e as { code?: string })?.code || '';
  const msg = (e as { message?: string })?.message || 'Something went wrong.';
  if (/permission[_-]denied/i.test(code + msg)) return 'You do not have permission to do that (or the action was rate-limited). Please wait a moment and try again.';
  if (/network/i.test(code + msg)) return 'Network problem. Check your connection and try again.';
  return msg;
}
