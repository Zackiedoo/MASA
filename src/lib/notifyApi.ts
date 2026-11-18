// Tells the server "I just did X" so it can push a notification to the right people. Fire-and-forget: a failure here must never
// break the action the user actually performed. The server re-checks everything itself (see api/notify.ts).
import { getIdToken } from './auth';
import { isDemoMode } from './firebase';

export type NotifyBody =
  | { type: 'announcement'; id: string }
  | { type: 'subject'; subjectId: string }
  | { type: 'schedule'; subjectId: string }
  | { type: 'membership'; subjectId: string; studentUid: string }
  | { type: 'report' };

export function notifyServer(body: NotifyBody): void {
  if (isDemoMode) return;
  void (async () => {
    try {
      const token = await getIdToken();
      if (!token) return;
      await fetch('/api/notify', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body), keepalive: true });
    } catch { /* notifications are best-effort */ }
  })();
}

/** Settings "Send test": waits for the server and reports how many of this user's devices it reached, with any error. */
export async function sendTestNotification(): Promise<{ tokens: number; sent: number; errors: string[] }> {
  const token = await getIdToken();
  if (!token) throw new Error('You are signed out.');
  const res = await fetch('/api/notify', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ type: 'test' }) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error || `Server error (${res.status}).`);
  return json as { tokens: number; sent: number; errors: string[] };
}
