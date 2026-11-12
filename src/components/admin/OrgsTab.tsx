import { useMemo, useState, type FormEvent } from 'react';
import { BadgeCheck, Building2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useValue } from '../../hooks/useValue';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { deleteOrganization, saveOrganization } from '../../services/adminService';
import { explainError } from '../../lib/database';
import { toList } from '../../utils/format';
import { cleanText } from '../../utils/validation';
import { Modal } from '../shared/Modal';
import { Field, Toggle } from '../shared/Field';
import { SourceAvatar } from '../shared/Avatar';
import { Empty, ErrorBox, Spinner } from '../shared/States';
import type { Organization } from '../../types';

export function OrgsTab() {
  const { uid } = useAuth();
  const toast = useToast();
  const { data, loading, error } = useValue<Record<string, Omit<Organization, 'id'>>>('organizations');
  const list = useMemo(() => toList<Organization>(data).sort((a, b) => a.name.localeCompare(b.name)), [data]);
  const [editing, setEditing] = useState<Organization | 'new' | null>(null);
  return (
    <div className="space-y-4">
      <button className="btn btn-primary" onClick={() => setEditing('new')}><Plus className="h-4 w-4" />New organization</button>
      <p className="text-xs text-muted">After creating an organization, create an <b>Organization</b> account for it in the Users tab to let its officers publish.</p>
      {error ? <ErrorBox message={error} /> : loading ? <Spinner /> : list.length === 0 ? <Empty icon={<Building2 className="h-8 w-8" />} title="No organizations yet" /> : (
        <ul className="space-y-2">{list.map((o) => (
          <li key={o.id} className="glass card flex items-center gap-3 p-4">
            <SourceAvatar name={o.name} logo={o.logo} />
            <div className="min-w-0 flex-1"><p className="flex items-center gap-1 truncate font-bold">{o.name}{o.verified && <BadgeCheck className="h-4 w-4 text-gold" />}</p><p className="truncate text-xs text-muted">{Object.keys(o.authorizedUsers ?? {}).length} authorized account(s)</p></div>
            <button className="btn btn-ghost btn-sm" aria-label="Edit" onClick={() => setEditing(o)}><Pencil className="h-3.5 w-3.5" /></button>
            <button className="btn btn-ghost btn-sm" aria-label="Delete" onClick={async () => { if (uid && confirm(`Delete ${o.name}? Its announcements stay, but its accounts lose publishing access.`)) { try { await deleteOrganization(uid, o); toast('Organization deleted.'); } catch (e) { toast(explainError(e), 'error'); } } }}><Trash2 className="h-3.5 w-3.5" /></button>
          </li>))}</ul>
      )}
      {editing && <OrgForm key={editing === 'new' ? 'new' : editing.id} org={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function OrgForm({ org, onClose }: { org?: Organization; onClose: () => void }) {
  const { uid } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(org?.name ?? '');
  const [desc, setDesc] = useState(org?.description ?? '');
  const [verified, setVerified] = useState(org?.verified ?? false);
  const [err, setErr] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault(); if (!uid) return;
    if (cleanText(name).length < 2) return setErr('Enter the organization name.');
    try { await saveOrganization(uid, { id: org?.id, name: cleanText(name).slice(0, 120), description: cleanText(desc, { multiline: true }).slice(0, 500), verified }); toast('Saved.'); onClose(); } catch (x) { setErr(explainError(x)); }
  }
  return (
    <Modal open onClose={onClose} title={org ? 'Edit organization' : 'New organization'}>
      <form onSubmit={submit} className="space-y-4">
        {err && <ErrorBox message={err} />}
        <Field label="Name">{(f) => <input id={f} className="field" value={name} onChange={(e) => setName(e.target.value)} required />}</Field>
        <Field label="Description">{(f) => <textarea id={f} className="field min-h-20" maxLength={500} value={desc} onChange={(e) => setDesc(e.target.value)} />}</Field>
        <div className="flex items-center justify-between"><div><p className="text-sm font-semibold">Verified</p><p className="text-xs text-muted">Shows the gold check on its announcements.</p></div><Toggle checked={verified} onChange={setVerified} label="Verified" /></div>
        <div className="flex justify-end gap-2"><button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary">Save</button></div>
      </form>
    </Modal>
  );
}
