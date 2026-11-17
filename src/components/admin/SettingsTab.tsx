import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useValue } from '../../hooks/useValue';
import { setRequireApproval } from '../../services/adminService';
import { TERMS_VERSION } from '../../services/freedomWallService';
import { explainError } from '../../lib/database';
import { isDemoMode } from '../../lib/firebase';
import { Toggle } from '../shared/Field';
import { manageUser } from '../../lib/adminApi';
import { useState } from 'react';

export function SettingsTab() {
  const { uid } = useAuth();
  const toast = useToast();
  const on = useValue<boolean>('settings/freedomWall/requireApproval');
  const [busy, setBusy] = useState(false);
  async function reindex() {
    if (!uid) return; setBusy(true);
    try { const r = await manageUser({ action: 'reindex' }, uid); toast(`Student lookup rebuilt: ${r.indexed ?? 0} students${r.upgraded ? `, ${r.upgraded} roster entries upgraded` : ''}.`); }
    catch (e) { toast(explainError(e), 'error'); } finally { setBusy(false); }
  }
  return (
    <div className="space-y-4">
      <section className="glass card flex items-center justify-between gap-4 p-5">
        <div><h3 className="font-bold">Require approval for Freedom Wall posts</h3><p className="text-sm text-muted">When on, new posts wait in the moderation queue until an administrator approves them. When off, posts appear immediately and are moderated through reports.</p></div>
        <Toggle checked={on.data === true} label="Require approval" onChange={async (v) => { if (!uid) return; try { await setRequireApproval(uid, v); toast(v ? 'Posts now need approval.' : 'Posts now publish immediately.'); } catch (e) { toast(explainError(e), 'error'); } }} />
      </section>
      <section className="glass card flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="min-w-0 flex-1"><h3 className="font-bold">Rebuild the student lookup</h3><p className="text-sm text-muted">Lets professors enroll existing students by Student ID. Run it once after updating MASA, and after importing accounts from elsewhere. It also upgrades older course rosters so names appear.</p></div>
        <button className="btn btn-ghost" disabled={busy} onClick={reindex}>{busy ? 'Rebuilding…' : 'Rebuild now'}</button>
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
