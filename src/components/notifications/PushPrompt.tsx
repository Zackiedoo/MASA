import { useState } from 'react';
import { BellRing, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { enablePush, permissionState, pushSupport } from '../../lib/push';
import { isApproved } from '../../lib/permissions';

const KEY = 'masa-push-prompt-dismissed';

/** One-time, dismissible invitation on Home for signed-in users whose device can receive notifications. */
export function PushPrompt() {
  const { uid, profile } = useAuth();
  const toast = useToast();
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } });
  const [busy, setBusy] = useState(false);
  if (hidden || !uid || !isApproved(profile) || pushSupport() !== 'ok' || permissionState() !== 'default') return null;
  const dismiss = () => { try { localStorage.setItem(KEY, '1'); } catch { /* ignore */ } setHidden(true); };
  return (
    <section className="glass card mb-4 flex items-center gap-3 p-4" aria-label="Turn on notifications">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><BellRing className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1"><p className="text-sm font-bold">Don't miss class changes</p><p className="text-xs text-muted">Get a notification for announcements, messages and class updates.</p></div>
      <button className="btn btn-primary btn-sm" disabled={busy} onClick={async () => { setBusy(true); try { await enablePush(uid); toast('Notifications are on.'); dismiss(); } catch (e) { toast(e instanceof Error ? e.message : 'Could not turn on notifications.', 'error'); } finally { setBusy(false); } }}>Turn on</button>
      <button className="btn btn-ghost btn-icon btn-sm" aria-label="Not now" onClick={dismiss}><X className="h-4 w-4" /></button>
    </section>
  );
}
