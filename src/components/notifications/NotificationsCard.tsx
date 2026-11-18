import { useState } from 'react';
import { BellRing, Share, SquarePlus } from 'lucide-react';
import { Toggle } from '../shared/Field';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useValue } from '../../hooks/useValue';
import { patch, explainError } from '../../lib/database';
import { disablePush, enablePush, isPushOn, permissionState, pushSupport } from '../../lib/push';

const TOPICS = [
  { k: 'announcements', label: 'New announcements', hint: 'Memoranda and organization posts.' },
  { k: 'messages', label: 'Group messages', hint: 'Chat in your subject groups.' },
  { k: 'classes', label: 'Class updates', hint: 'Class status changes and professor posts.' },
] as const;

/** Settings card: turn phone/browser notifications on or off for this device and choose what to be told about. */
export function NotificationsCard() {
  const { uid } = useAuth();
  const toast = useToast();
  const support = pushSupport();
  const prefs = useValue<Record<string, boolean>>(uid ? `pushPrefs/${uid}` : null);
  const [on, setOn] = useState(() => (uid ? isPushOn(uid) : false));
  const [busy, setBusy] = useState(false);
  if (!uid) return <p className="text-sm text-muted">Log in to manage notifications.</p>;

  async function toggle(next: boolean) {
    if (!uid) return;
    setBusy(true);
    try {
      if (next) { await enablePush(uid); setOn(true); toast('Notifications are on for this device.'); }
      else { await disablePush(uid); setOn(false); toast('Notifications are off for this device.'); }
    } catch (e) { toast(e instanceof Error ? e.message : explainError(e), 'error'); } finally { setBusy(false); }
  }

  if (support === 'demo') return <p className="text-sm text-muted">Notifications need the real Firebase connection; they are not available in demo mode.</p>;
  if (support === 'unsupported') return <p className="text-sm text-muted">This browser can't show notifications. Try Chrome on Android, or Safari on iPhone after adding MASA to your Home Screen.</p>;
  if (support === 'ios-install') {
    return (
      <div className="space-y-2 text-sm">
        <p className="flex items-center gap-2 font-semibold"><BellRing className="h-4 w-4" />Add MASA to your Home Screen first</p>
        <p className="text-muted">iPhones only allow notifications for apps on the Home Screen (iOS 16.4 or newer):</p>
        <ol className="list-decimal space-y-1 pl-5 text-muted">
          <li>Open MASA in <b>Safari</b>.</li>
          <li>Tap the <Share className="inline h-4 w-4" /> <b>Share</b> button.</li>
          <li>Choose <SquarePlus className="inline h-4 w-4" /> <b>Add to Home Screen</b>.</li>
          <li>Open MASA from the new icon, then come back to Settings and turn notifications on.</li>
        </ol>
      </div>
    );
  }
  const blocked = permissionState() === 'denied';
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div><p className="text-sm font-semibold">Notifications on this device</p><p className="text-xs text-muted">{blocked ? 'Blocked in your browser/phone settings. Allow notifications for MASA there, then try again.' : on ? 'You will be notified even when MASA is closed.' : 'Get alerts for announcements, messages and class changes.'}</p></div>
        <Toggle checked={on} onChange={(v) => void toggle(v)} label="Notifications on this device" disabled={busy || blocked} />
      </div>
      {on && (
        <div className="space-y-2 border-t divider pt-3">
          <p className="text-xs font-semibold text-muted">Tell me about…</p>
          {TOPICS.map((t) => (
            <div key={t.k} className="flex items-center justify-between gap-4">
              <div><p className="text-sm font-semibold">{t.label}</p><p className="text-xs text-muted">{t.hint}</p></div>
              <Toggle checked={prefs.data?.[t.k] !== false} onChange={(v) => void patch({ [`pushPrefs/${uid}/${t.k}`]: v })} label={t.label} />
            </div>
          ))}
          <p className="text-xs text-muted">Account decisions (approvals, enrolment) and admin alerts always come through.</p>
        </div>
      )}
    </div>
  );
}
