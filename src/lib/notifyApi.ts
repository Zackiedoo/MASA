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
