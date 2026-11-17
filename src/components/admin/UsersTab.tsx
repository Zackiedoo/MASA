import { useMemo, useState, type FormEvent } from 'react';
import { KeyRound, Pencil, Plus, Search, ShieldOff, ShieldCheck, Trash2, UserCog, Users } from 'lucide-react';
import { useValue } from '../../hooks/useValue';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { manageUser } from '../../lib/adminApi';
import { resolveResetRequest } from '../../services/adminService';
import { explainError } from '../../lib/database';
import { toList, timeAgo } from '../../utils/format';
import { cleanText, isLoginId } from '../../utils/validation';
import { Modal } from '../shared/Modal';
import { Field, Segmented } from '../shared/Field';
import { Badge, Empty, ErrorBox, Spinner } from '../shared/States';
import { CredentialsModal, type Credential } from './CredentialsModal';
import type { Organization, ResetRequest, Role, UserProfile } from '../../types';

const ROLES: Array<{ value: Role | 'all'; label: string }> = [
  { value: 'all', label: 'All' }, { value: 'student', label: 'Students' }, { value: 'professor', label: 'Professors' }, { value: 'organization', label: 'Organizations' }, { value: 'admin', label: 'Admins' },
];

export function UsersTab() {
  const { uid } = useAuth();
  const toast = useToast();
  const users = useValue<Record<string, Omit<UserProfile, 'uid'>>>('users');
  const orgs = useValue<Record<string, Omit<Organization, 'id'>>>('organizations');
  const resets = useValue<Record<string, Omit<ResetRequest, 'id'>>>('resetRequests');
  const [role, setRole] = useState<Role | 'all'>('all');
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const [roleFor, setRoleFor] = useState<UserProfile | null>(null);
  const [editFor, setEditFor] = useState<UserProfile | null>(null);
  const [creds, setCreds] = useState<Credential[] | null>(null);
  const orgList = useMemo(() => toList<Organization>(orgs.data), [orgs.data]);

  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    return toList<UserProfile>(users.data).map((u) => ({ ...u, uid: u.id })).filter((u) => role === 'all' || u.role === role)
      .filter((u) => !n || `${u.fullName} ${u.studentId}`.toLowerCase().includes(n)).sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [users.data, role, q]);
  const openResets = toList<ResetRequest & { id: string }>(resets.data).filter((r) => r.status === 'open');
  const byLoginId = useMemo(() => new Map(toList<UserProfile>(users.data).map((u) => [u.studentId.toLowerCase(), u])), [users.data]);

  async function reset(u: UserProfile) {
    if (!uid || !confirm(`Reset the password for ${u.fullName}? They will be signed out everywhere.`)) return;
    try { const r = await manageUser({ action: 'resetPassword', uid: u.uid }, uid); setCreds([{ id: u.studentId, name: u.fullName, password: r.tempPassword ?? '' }]); } catch (e) { toast(explainError(e), 'error'); }
  }
  async function remove(u: UserProfile) {
    if (!uid) return;
    if (!confirm(`Permanently delete ${u.fullName} (${u.studentId})? Their login, profile and course memberships are removed. This cannot be undone.`)) return;
    try { await manageUser({ action: 'delete', uid: u.uid }, uid); toast('Account deleted.'); } catch (e) { toast(explainError(e), 'error'); }
  }
  async function toggle(u: UserProfile) {
    if (!uid) return;
    if (u.isActive && !confirm(`Disable ${u.fullName}? They will be signed out and unable to log in.`)) return;
    try { await manageUser({ action: 'setActive', uid: u.uid, active: !u.isActive }, uid); toast(u.isActive ? 'Account disabled.' : 'Account reactivated.'); } catch (e) { toast(explainError(e), 'error'); }
  }

  return (
    <div className="space-y-4">
      {openResets.length > 0 && (
        <section className="glass card space-y-2 border-gold/50 p-4">
          <h3 className="flex items-center gap-2 font-bold"><KeyRound className="h-4 w-4" />Password reset requests <Badge tone="gold">{openResets.length}</Badge></h3>
          <ul className="space-y-2">{openResets.map((r) => {
            const u = byLoginId.get(r.id.toLowerCase());
            return (
              <li key={r.id} className="flex flex-wrap items-center gap-2 text-sm"><span className="font-semibold">{r.id}</span><span className="text-muted">{u ? u.fullName : 'No matching account'} · {timeAgo(r.requestedAt)}</span>
                <span className="ml-auto flex gap-2">{u && <button className="btn btn-primary btn-sm" onClick={() => reset({ ...u, uid: u.id })}>Reset password</button>}<button className="btn btn-ghost btn-sm" onClick={() => void resolveResetRequest(r.id)}>Dismiss</button></span></li>
            );
          })}</ul>
        </section>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-48 flex-1"><span className="sr-only">Search users</span><Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><input className="field pl-10" placeholder="Search name or ID" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <button className="btn btn-primary" onClick={() => setCreating(true)}><Plus className="h-4 w-4" />Create accounts</button>
      </div>
      <Segmented label="Role filter" value={role} onChange={setRole} options={ROLES} />
      {users.error ? <ErrorBox message={users.error} /> : users.loading ? <Spinner /> : list.length === 0 ? <Empty icon={<Users className="h-8 w-8" />} title="No accounts match" /> : (
        <ul className="space-y-2">
          {list.map((u) => (
            <li key={u.uid} className="glass card flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1"><p className="truncate font-bold">{u.fullName}</p><p className="truncate text-xs text-muted">ID {u.studentId}{u.orgId ? ` · ${orgs.data?.[u.orgId]?.name ?? 'org'}` : ''}</p></div>
              <Badge tone="maroon"><span className="capitalize">{u.role}</span></Badge>
              {u.approvalStatus === 'pending' ? <Badge tone="warn">Awaiting approval</Badge> : u.approvalStatus === 'rejected' ? <Badge tone="bad">Rejected</Badge> : <Badge tone={u.isActive ? 'ok' : 'bad'}>{u.isActive ? 'Active' : 'Disabled'}</Badge>}
              <div className="flex gap-1">
                <button className="btn btn-ghost btn-sm" title="Edit name / ID" aria-label="Edit user" onClick={() => setEditFor(u)}><Pencil className="h-3.5 w-3.5" /></button>
                <button className="btn btn-ghost btn-sm" title="Reset password" aria-label="Reset password" onClick={() => reset(u)}><KeyRound className="h-3.5 w-3.5" /></button>
                <button className="btn btn-ghost btn-sm" title="Change role" aria-label="Change role" disabled={u.uid === uid || !!u.approvalStatus && u.approvalStatus !== 'approved'} onClick={() => setRoleFor(u)}><UserCog className="h-3.5 w-3.5" /></button>
                <button className="btn btn-ghost btn-sm" title={u.isActive ? 'Disable' : 'Reactivate'} aria-label={u.isActive ? 'Disable account' : 'Reactivate account'} disabled={u.uid === uid || !!u.approvalStatus && u.approvalStatus !== 'approved'} onClick={() => toggle(u)}>{u.isActive ? <ShieldOff className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}</button>
                <button className="btn btn-ghost btn-sm text-bad" title="Delete account" aria-label="Delete account" disabled={u.uid === uid} onClick={() => remove(u)}><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {creating && <CreateModal orgs={orgList} existing={byLoginId} onClose={() => setCreating(false)} onCreds={setCreds} />}
      {editFor && <EditModal key={editFor.uid} user={editFor} onClose={() => setEditFor(null)} />}
      {roleFor && <RoleModal user={roleFor} orgs={orgList} onClose={() => setRoleFor(null)} />}
      <CredentialsModal items={creds} onClose={() => setCreds(null)} />
    </div>
  );
}

function CreateModal({ orgs, existing, onClose, onCreds }: { orgs: Organization[]; existing: Map<string, UserProfile>; onClose: () => void; onCreds: (c: Credential[]) => void }) {
  const { uid } = useAuth();
  const [mode, setMode] = useState<'one' | 'bulk'>('one');
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('student');
  const [orgId, setOrgId] = useState(orgs[0]?.id ?? '');
  const [bulk, setBulk] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault(); setErr(null);
    if (!uid) return;
    setBusy(true);
    try {
      if (mode === 'one') {
        if (!isLoginId(id.trim())) throw new Error('ID must be 3–20 letters, numbers or dashes.');
        if (role === 'organization' && !orgId) throw new Error('Create an organization first (Organizations tab), then link the account.');
        const r = await manageUser({ action: 'create', studentId: id.trim(), fullName: cleanText(name), role, orgId: role === 'organization' ? orgId : undefined }, uid);
        onCreds([{ id: id.trim(), name: cleanText(name), password: r.tempPassword ?? '(you set it)' }]);
      } else {
        // One student per line:  2024-0001, Juan Dela Cruz
        const rows = bulk.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => { const i = l.search(/[,\t]/); return { id: l.slice(0, i).trim(), name: cleanText(l.slice(i + 1)) }; });
        if (!rows.length) throw new Error('Paste at least one line: ID, Full Name');
        const out: Credential[] = [];
        for (const r of rows) {
          if (!isLoginId(r.id) || r.name.length < 2) { out.push({ id: r.id || '?', name: r.name, password: '', error: 'Invalid line' }); continue; }
          if (existing.has(r.id.toLowerCase())) { out.push({ id: r.id, name: r.name, password: '', error: 'Already exists' }); continue; }
          try { const res = await manageUser({ action: 'create', studentId: r.id, fullName: r.name, role: 'student' }, uid); out.push({ id: r.id, name: r.name, password: res.tempPassword ?? '' }); }
          catch (x) { out.push({ id: r.id, name: r.name, password: '', error: x instanceof Error ? x.message : 'Failed' }); }
        }
        onCreds(out);
      }
      onClose();
    } catch (x) { setErr(x instanceof Error ? x.message : explainError(x)); } finally { setBusy(false); }
  }

  return (
    <Modal open onClose={onClose} title="Create accounts">
      <form onSubmit={submit} className="space-y-4">
        <Segmented label="Mode" value={mode} onChange={setMode} options={[{ value: 'one', label: 'One account' }, { value: 'bulk', label: 'Many students' }]} />
        {err && <ErrorBox message={err} />}
        {mode === 'one' ? (
          <>
            <Field label="Login ID" hint="Student number or staff username.">{(f) => <input id={f} className="field" value={id} onChange={(e) => setId(e.target.value)} required autoCapitalize="none" />}</Field>
            <Field label="Full name">{(f) => <input id={f} className="field" value={name} onChange={(e) => setName(e.target.value)} required />}</Field>
            <Field label="Role">{(f) => <select id={f} className="field" value={role} onChange={(e) => setRole(e.target.value as Role)}><option value="student">Student</option><option value="professor">Professor</option><option value="organization">Organization</option><option value="admin">Administrator</option></select>}</Field>
            {role === 'organization' && <Field label="Organization">{(f) => <select id={f} className="field" value={orgId} onChange={(e) => setOrgId(e.target.value)}>{orgs.length === 0 && <option value="">No organizations yet</option>}{orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>}</Field>}
          </>
        ) : (
          <Field label="One student per line: ID, Full Name" hint="Example: 2024-0003, Maria Clara">{(f) => <textarea id={f} className="field min-h-40 font-mono text-sm" value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder={'2024-0003, Maria Clara\n2024-0004, Jose Rizal'} />}</Field>
        )}
        <p className="text-xs text-muted">A temporary password is generated for each account and shown once. Users must change it at first login.</p>
        <div className="flex justify-end gap-2"><button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create'}</button></div>
      </form>
    </Modal>
  );
}

function RoleModal({ user, orgs, onClose }: { user: UserProfile; orgs: Organization[]; onClose: () => void }) {
  const { uid } = useAuth();
  const toast = useToast();
  const [role, setRole] = useState<Role>(user.role);
  const [orgId, setOrgId] = useState(user.orgId ?? orgs[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function save() {
    if (!uid) return; setBusy(true); setErr(null);
    try { await manageUser({ action: 'setRole', uid: user.uid, role, orgId: role === 'organization' ? orgId : undefined }, uid); toast('Role updated. The user must sign in again.'); onClose(); }
    catch (e) { setErr(e instanceof Error ? e.message : explainError(e)); } finally { setBusy(false); }
  }
  return (
    <Modal open onClose={onClose} title={`Role — ${user.fullName}`}>
      <div className="space-y-4">
        {err && <ErrorBox message={err} />}
        <Field label="Role">{(f) => <select id={f} className="field" value={role} onChange={(e) => setRole(e.target.value as Role)}><option value="student">Student</option><option value="professor">Professor</option><option value="organization">Organization</option><option value="admin">Administrator</option></select>}</Field>
        {role === 'organization' && <Field label="Organization">{(f) => <select id={f} className="field" value={orgId} onChange={(e) => setOrgId(e.target.value)}>{orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>}</Field>}
        <div className="flex justify-end gap-2"><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy || role === user.role && role !== 'organization'} onClick={save}>{busy ? 'Saving…' : 'Save role'}</button></div>
      </div>
    </Modal>
  );
}

function EditModal({ user, onClose }: { user: UserProfile; onClose: () => void }) {
  const { uid } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(user.fullName);
  const [loginId, setLoginId] = useState(user.studentId);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function save(e: FormEvent) {
    e.preventDefault(); if (!uid) return; setErr(null);
    if (!isLoginId(loginId.trim())) return setErr('ID must be 3–20 letters, numbers or dashes.');
    if (cleanText(name).length < 2) return setErr('Full name is required.');
    setBusy(true);
    try { await manageUser({ action: 'update', uid: user.uid, fullName: cleanText(name), studentId: loginId.trim() }, uid); toast('Account updated.'); onClose(); }
    catch (x) { setErr(x instanceof Error ? x.message : explainError(x)); } finally { setBusy(false); }
  }
  return (
    <Modal open onClose={onClose} title={`Edit — ${user.fullName}`}>
      <form onSubmit={save} className="space-y-4">
        {err && <ErrorBox message={err} />}
        <Field label="Full name">{(f) => <input id={f} className="field" value={name} onChange={(e) => setName(e.target.value)} required />}</Field>
        <Field label="Login ID" hint="Changing the ID changes what this person types to log in.">{(f) => <input id={f} className="field" value={loginId} onChange={(e) => setLoginId(e.target.value)} autoCapitalize="none" required />}</Field>
        <div className="flex justify-end gap-2"><button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button></div>
      </form>
    </Modal>
  );
}
