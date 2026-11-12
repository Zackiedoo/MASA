import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useValue } from '../../hooks/useValue';
import { setRequireApproval } from '../../services/adminService';
import { TERMS_VERSION } from '../../services/freedomWallService';
import { explainError } from '../../lib/database';
import { isDemoMode } from '../../lib/firebase';
import { Toggle } from '../shared/Field';

export function SettingsTab() {
  const { uid } = useAuth();
  const toast = useToast();
  const on = useValue<boolean>('settings/freedomWall/requireApproval');
  return (
    <div className="space-y-4">
      <section className="glass card flex items-center justify-between gap-4 p-5">
        <div><h3 className="font-bold">Require approval for Freedom Wall posts</h3><p className="text-sm text-muted">When on, new posts wait in the moderation queue until an administrator approves them. When off, posts appear immediately and are moderated through reports.</p></div>
        <Toggle checked={on.data === true} label="Require approval" onChange={async (v) => { if (!uid) return; try { await setRequireApproval(uid, v); toast(v ? 'Posts now need approval.' : 'Posts now publish immediately.'); } catch (e) { toast(explainError(e), 'error'); } }} />
      </section>
      <section className="glass card space-y-1 p-5 text-sm">
        <h3 className="font-bold">System information</h3>
        <p className="text-muted">Freedom Wall terms version: <b className="text-ink">{TERMS_VERSION}</b></p>
        <p className="text-muted">Data backend: <b className="text-ink">{isDemoMode ? 'Demo (local browser storage)' : 'Firebase Realtime Database'}</b></p>
        <p className="text-muted">Expired Freedom Wall posts are deleted by the scheduled job <code>/api/cron/cleanup</code>.</p>
      </section>
    </div>
  );
}
