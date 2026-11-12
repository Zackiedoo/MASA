import { useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { SourceAvatar } from '../shared/Avatar';
import { Field } from '../shared/Field';
import { ErrorBox } from '../shared/States';
import { uploadFile, safeFileName } from '../../lib/storage';
import { updateOrgProfile } from '../../services/adminService';
import { explainError } from '../../lib/database';
import { cleanText } from '../../utils/validation';
import { useToast } from '../../contexts/ToastContext';
import type { Organization } from '../../types';

/** Organization accounts manage their own public profile (description + logo). */
export function OrgProfileCard({ org }: { org: Organization }) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [desc, setDesc] = useState(org.description ?? '');
  const [logo, setLogo] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function save() {
    setBusy(true); setErr(null);
    try {
      const url = logo ? await uploadFile(`orgs/${org.id}/${Date.now()}_${safeFileName(logo.name)}`, logo) : undefined;
      await updateOrgProfile(org.id, { description: cleanText(desc, { multiline: true }).slice(0, 500), logo: url });
      toast('Organization profile saved.'); setLogo(null);
    } catch (e) { setErr(explainError(e)); } finally { setBusy(false); }
  }
  return (
    <section className="glass card space-y-3 p-5">
      <div className="flex items-center gap-3"><SourceAvatar name={org.name} logo={logo ? URL.createObjectURL(logo) : org.logo} size={56} /><div><h2 className="font-bold">{org.name}</h2><p className="text-xs text-muted">{org.verified ? 'Verified organization' : 'Awaiting verification by an administrator'}</p></div></div>
      {err && <ErrorBox message={err} />}
      <Field label="Description">{(id) => <textarea id={id} className="field min-h-20" maxLength={500} value={desc} onChange={(e) => setDesc(e.target.value)} />}</Field>
      <input ref={input} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setLogo(e.target.files?.[0] ?? null)} />
      <div className="flex flex-wrap gap-2"><button className="btn btn-ghost btn-sm" onClick={() => input.current?.click()}><ImagePlus className="h-4 w-4" />{logo ? logo.name : 'Change logo'}</button><button className="btn btn-primary btn-sm" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save profile'}</button></div>
    </section>
  );
}
