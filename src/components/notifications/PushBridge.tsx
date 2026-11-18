import { useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { enablePush, isPushOn, onForegroundPush } from '../../lib/push';

/** Invisible. Shows notifications that arrive while MASA is open, and quietly refreshes this device's token after login (tokens rotate). */
export function PushBridge() {
  const { uid } = useAuth();
  const toast = useToast();
  useEffect(() => {
    if (!uid) return;
    if (isPushOn(uid)) void enablePush(uid, false).catch(() => undefined);
    return onForegroundPush((n) => { toast(`${n.title}${n.body ? ` — ${n.body}` : ''}`); });
  }, [uid, toast]);
  return null;
}
