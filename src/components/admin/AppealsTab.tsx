import { useMemo, useState } from 'react';
import { Check, FileCheck2, X } from 'lucide-react';
import { useValue } from '../../hooks/useValue';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { explainError } from '../../lib/database';
import { decideAppeal } from '../../lib/moderationApi';
import { formatDateTime, timeAgo } from '../../utils/format';
import { Badge, Empty, ErrorBox, Spinner } from '../shared/States';
import { ViolationsModal } from './ViolationsModal';
import type { Appeal, UserProfile } from '../../types';

/** Appeals against permanent mutes. One appeal per user at a time; a denial blocks a new one for 30 days. */
export function AppealsTab() {
  const { uid } = useAuth();
  const toast = useToast();
  const appeals = useValue<Record<string, Appeal>>('appeals');
  const users = useValue<Record<string, Omit<UserProfile, 'uid'>>>('users');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [look, setLook] = useState<UserProfile | null>(null);
  const pending = useMemo(() => Object.entries(appeals.data ?? {}).filter(([, a]) => a.status === 'pending').sort((a, b) => a[1].createdAt - b[1].createdAt), [appeals.data]);
  const decided = useMemo(() => Object.entries(appeals.data ?? {}).filter(([, a]) => a.status !== 'pending').sort((a, b) => (b[1].decidedAt ?? 0) - (a[1].decidedAt ?? 0)).slice(0, 10), [appeals.data]);
  if (!uid) return null;
  const decide = async (target: string, approve: boolean) => { try { await decideAppeal(uid, target, approve, (notes[target] ?? '').trim()); toast(approve ? 'Appeal approved. Privileges restored.' : 'Appeal denied.'); } catch (e) { toast(explainError(e), 'error'); } };
  const who = (id: string) => users.data?.[id];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">Appeals come from permanently muted accounts. Approving restores posting and chat (their next upheld violation becomes a 7-day mute). Denying blocks a new appeal for 30 days.</p>
      {appeals.error ? <ErrorBox message={appeals.error} /> : appeals.loading ? <Spinner /> : pending.length === 0 ? <Empty icon={<FileCheck2 className="h-8 w-8" />} title="No pending appeals" /> : (
        <ul className="space-y-3">{pending.map(([id, a]) => (
          <li key={id} className="glass card space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-bold">{who(id)?.fullName ?? id} <span className="font-normal text-muted">· ID {who(id)?.studentId}</span></p><span className="text-xs text-muted">{timeAgo(a.createdAt)}</span></div>
            <p className="whitespace-pre-wrap break-words rounded-2xl bg-primary/6 p-3 text-sm">{a.reason}</p>
            <input className="field" placeholder="Note to the user (optional)" maxLength={500} value={notes[id] ?? ''} onChange={(e) => setNotes((n) => ({ ...n, [id]: e.target.value }))} />
            <div className="flex flex-wrap gap-2">
              {who(id) && <button className="btn btn-ghost btn-sm" onClick={() => setLook({ ...(who(id) as Omit<UserProfile, 'uid'>), uid: id })}>See violations</button>}
              <span className="flex-1" />
              <button className="btn btn-ghost btn-sm" onClick={() => decide(id, false)}><X className="h-4 w-4" />Deny</button>
              <button className="btn btn-primary btn-sm" onClick={() => decide(id, true)}><Check className="h-4 w-4" />Approve</button>
            </div>
          </li>))}</ul>
      )}
      {decided.length > 0 && (
        <section><h3 className="mb-2 font-bold">Recently decided</h3>
          <ul className="space-y-1 text-sm">{decided.map(([id, a]) => <li key={id} className="flex flex-wrap items-center gap-2"><Badge tone={a.status === 'approved' ? 'ok' : 'bad'}>{a.status}</Badge><span>{who(id)?.fullName ?? id}</span><span className="text-xs text-muted">{a.decidedAt ? formatDateTime(a.decidedAt) : ''}</span></li>)}</ul>
        </section>
      )}
      {look && <ViolationsModal user={look} onClose={() => setLook(null)} />}
    </div>
  );
}
