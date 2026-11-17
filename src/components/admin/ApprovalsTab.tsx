import { useMemo, useState } from 'react';
import { Building2, Check, GraduationCap, Mail, UserCheck, X } from 'lucide-react';
import { useValue } from '../../hooks/useValue';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { manageUser } from '../../lib/adminApi';
import { explainError } from '../../lib/database';
import { timeAgo, toList } from '../../utils/format';
import { Modal } from '../shared/Modal';
import { Field, Segmented } from '../shared/Field';
import { Badge, Empty, ErrorBox, Spinner } from '../shared/States';
import type { Organization, UserProfile } from '../../types';

type View = 'pending' | 'rejected';

/** System Administrator: review sign-up requests from Professors/Instructors and Organization-affiliated accounts. */
export function ApprovalsTab() {
  const users = useValue<Record<string, Omit<UserProfile, 'uid'>>>('users');
  const orgs = useValue<Record<string, Omit<Organization, 'id'>>>('organizations');
  const [view, setView] = useState<View>('pending');
  const [deciding, setDeciding] = useState<{ user: UserProfile; approve: boolean } | null>(null);
  const orgList = useMemo(() => toList<Organization>(orgs.data), [orgs.data]);
  const all = useMemo(() => toList<UserProfile>(users.data).map((u) => ({ ...u, uid: u.id })), [users.data]);
  const pending = useMemo(() => all.filter((u) => u.approvalStatus === 'pending').sort((a, b) => a.createdAt - b.createdAt), [all]);
  const rejected = useMemo(() => all.filter((u) => u.approvalStatus === 'rejected').sort((a, b) => b.createdAt - a.createdAt), [all]);
  const shown = view === 'pending' ? pending : rejected;

  return (
    <div className="space-y-4">
      <p className="px-1 text-sm text-muted">Professors/Instructors and organization accounts register themselves, but cannot use MASA until you approve them here.</p>
      <Segmented label="Registration status" value={view} onChange={setView} options={[{ value: 'pending', label: `Awaiting review (${pending.length})` }, { value: 'rejected', label: `Rejected (${rejected.length})` }]} />
      {users.error ? <ErrorBox message={users.error} /> : users.loading ? <Spinner /> : shown.length === 0 ? (
        <Empty icon={<UserCheck className="h-8 w-8" />} title={view === 'pending' ? 'No registrations waiting' : 'No rejected registrations'} />
      ) : (
        <ul className="space-y-3">
          {shown.map((u) => (
            <li key={u.uid} className="glass card space-y-3 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">{u.role === 'organization' ? <Building2 className="h-5 w-5" /> : <GraduationCap className="h-5 w-5" />}</span>
                <div className="min-w-0 flex-1"><p className="truncate font-bold">{u.fullName}</p><p className="text-xs text-muted">Username {u.studentId} · requested {timeAgo(u.createdAt)}</p></div>
                <Badge tone="maroon">{u.role === 'organization' ? 'Organization' : 'Professor / Instructor'}</Badge>
              </div>
              <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
                {u.registration?.contactEmail && <><dt className="flex items-center gap-1 text-muted"><Mail className="h-3.5 w-3.5" />Contact</dt><dd className="break-all">{u.registration.contactEmail}</dd></>}
                {u.role === 'organization' && u.registration?.orgName && <><dt className="text-muted">Organization</dt><dd className="font-semibold">{u.registration.orgName}</dd></>}
                {u.role === 'organization' && u.registration?.orgDescription && <><dt className="text-muted">About</dt><dd className="whitespace-pre-wrap break-words">{u.registration.orgDescription}</dd></>}
                {u.registration?.note && <><dt className="text-muted">Note</dt><dd className="whitespace-pre-wrap break-words">{u.registration.note}</dd></>}
                {u.approvalStatus === 'rejected' && u.rejectionReason && <><dt className="text-muted">Reason given</dt><dd className="text-bad">{u.rejectionReason}</dd></>}
              </dl>
              <div className="flex flex-wrap justify-end gap-2">
                {view === 'pending' && <button className="btn btn-ghost btn-sm" onClick={() => setDeciding({ user: u, approve: false })}><X className="h-4 w-4" />Reject</button>}
                {view === 'pending' && <button className="btn btn-primary btn-sm" onClick={() => setDeciding({ user: u, approve: true })}><Check className="h-4 w-4" />Approve…</button>}
                {view === 'rejected' && <p className="text-xs text-muted">To reconsider, delete the account in Users and ask them to register again.</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {deciding && <DecideModal key={deciding.user.uid} {...deciding} orgs={orgList} onClose={() => setDeciding(null)} />}
    </div>
  );
}

function DecideModal({ user, approve, orgs, onClose }: { user: UserProfile; approve: boolean; orgs: Organization[]; onClose: () => void }) {
  const { uid } = useAuth();
  const toast = useToast();
  const isOrg = user.role === 'organization';
  const [orgChoice, setOrgChoice] = useState<string>('new'); // 'new' = create from the registration details
  const [orgName, setOrgName] = useState(user.registration?.orgName ?? '');
  const [verified, setVerified] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function go() {
    if (!uid) return; setBusy(true); setErr(null);
    try {
      if (approve) {
        await manageUser(isOrg ? (orgChoice === 'new' ? { action: 'approve', uid: user.uid, orgName: orgName.trim(), verified } : { action: 'approve', uid: user.uid, orgId: orgChoice }) : { action: 'approve', uid: user.uid }, uid);
        toast(`${user.fullName} approved.`);
      } else {
        await manageUser({ action: 'reject', uid: user.uid, reason: reason.trim() }, uid);
        toast('Registration rejected.');
      }
      onClose();
    } catch (e) { setErr(e instanceof Error ? e.message : explainError(e)); } finally { setBusy(false); }
  }

  return (
    <Modal open onClose={onClose} title={`${approve ? 'Approve' : 'Reject'} — ${user.fullName}`}>
      <div className="space-y-4">
        {err && <ErrorBox message={err} />}
        {approve ? (
          <>
            <p className="text-sm">{isOrg ? 'Choose which organization this account will publish for. It can then create announcements, but only edit or delete its own.' : 'This professor will be able to see courses assigned to them and manage their rosters. Assign courses in the Subjects tab.'}</p>
            {isOrg && (
              <>
                <Field label="Organization">{(f) => (
                  <select id={f} className="field" value={orgChoice} onChange={(e) => setOrgChoice(e.target.value)}>
                    <option value="new">Create a new organization from their request</option>
                    {orgs.map((o) => <option key={o.id} value={o.id}>Link to existing: {o.name}</option>)}
                  </select>)}</Field>
                {orgChoice === 'new' && (
                  <>
                    <Field label="New organization name">{(f) => <input id={f} className="field" value={orgName} onChange={(e) => setOrgName(e.target.value)} maxLength={120} />}</Field>
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} />Mark the organization as verified (shows the verified badge)</label>
                  </>
                )}
              </>
            )}
          </>
        ) : (
          <Field label="Reason (shown to the applicant, optional)">{(f) => <textarea id={f} className="field min-h-20" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />}</Field>
        )}
        <div className="flex justify-end gap-2">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className={approve ? 'btn btn-primary' : 'btn btn-danger'} disabled={busy || (approve && isOrg && orgChoice === 'new' && orgName.trim().length < 2)} onClick={go}>{busy ? 'Saving…' : approve ? 'Approve account' : 'Reject registration'}</button>
        </div>
      </div>
    </Modal>
  );
}
