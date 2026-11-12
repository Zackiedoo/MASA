import { useRef, useState, type FormEvent } from 'react';
import { Paperclip, X } from 'lucide-react';
import { Modal } from '../shared/Modal';
import { Field } from '../shared/Field';
import { ErrorBox } from '../shared/States';
import { checkFile } from '../../lib/storage';
import { createAnnouncement, updateAnnouncement, uploadAttachments } from '../../services/announcementService';
import { explainError } from '../../lib/database';
import { cleanText, isHttpUrl } from '../../utils/validation';
import { useToast } from '../../contexts/ToastContext';
import type { Announcement, Attachment, SourceType } from '../../types';

const ADMIN_SOURCES: Array<{ type: SourceType; id: string; name: string }> = [
  { type: 'admin', id: 'admin', name: 'School Administration' },
  { type: 'di', id: 'di', name: 'Director for Instruction' },
  { type: 'president', id: 'president', name: 'Office of the President' },
];

interface Props {
  open: boolean; onClose: () => void; actorUid: string;
  /** organization accounts publish as their own organization; admins choose an office */
  org?: { id: string; name: string };
  editing?: Announcement;
}

export function AnnouncementComposer({ open, onClose, actorUid, org, editing }: Props) {
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(editing?.title ?? '');
  const [content, setContent] = useState(editing?.content ?? '');
  const [link, setLink] = useState(editing?.link ?? '');
  const [source, setSource] = useState(0);
  const [kept, setKept] = useState<Attachment[]>(editing?.attachments ?? []);
  const [files, setFiles] = useState<File[]>([]);
  const [pct, setPct] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function pick(list: FileList | null) {
    if (!list) return;
    const next = [...files];
    for (const f of Array.from(list)) {
      const problem = checkFile(f);
      if (problem) { setErr(problem); continue; }
      next.push(f);
    }
    if (kept.length + next.length > 10) return setErr('You can attach up to 10 files.');
    setFiles(next);
  }

  async function submit(e: FormEvent) {
    e.preventDefault(); setErr(null);
    const t = cleanText(title); const c = cleanText(content, { multiline: true }); const l = link.trim();
    if (t.length < 3) return setErr('Add a title (at least 3 characters).');
    if (!c) return setErr('Write the announcement content.');
    if (l && !isHttpUrl(l)) return setErr('The link must start with http:// or https://');
    setBusy(true);
    try {
      const uploaded = await uploadAttachments(actorUid, files, setPct);
      const attachments = [...kept, ...uploaded];
      if (editing) await updateAnnouncement(actorUid, editing, { title: t, content: c, link: l || undefined, attachments });
      else {
        const src = org ? { type: 'organization' as const, id: org.id, name: org.name } : ADMIN_SOURCES[source];
        await createAnnouncement(actorUid, { sourceType: src.type, sourceId: src.id, sourceName: src.name, title: t, content: c, link: l || undefined, attachments });
      }
      toast(editing ? 'Announcement updated.' : 'Announcement published.');
      onClose();
    } catch (x) { setErr(explainError(x)); } finally { setBusy(false); setPct(0); }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit announcement' : 'New announcement'} wide>
      <form onSubmit={submit} className="space-y-4">
        {err && <ErrorBox message={err} />}
        {!editing && (org ? <p className="text-sm text-muted">Publishing as <b>{org.name}</b></p> : (
          <Field label="Publish as">{(id) => <select id={id} className="field" value={source} onChange={(e) => setSource(Number(e.target.value))}>{ADMIN_SOURCES.map((s, i) => <option key={s.id} value={i}>{s.name}</option>)}</select>}</Field>
        ))}
        <Field label="Title">{(id) => <input id={id} className="field" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} required />}</Field>
        <Field label={`Content (${content.length}/5000)`}>{(id) => <textarea id={id} className="field min-h-36" maxLength={5000} value={content} onChange={(e) => setContent(e.target.value)} required />}</Field>
        <Field label="External link (optional)">{(id) => <input id={id} className="field" type="url" placeholder="https://…" value={link} onChange={(e) => setLink(e.target.value)} />}</Field>
        <div className="space-y-2">
          <p className="text-sm font-semibold">Images &amp; attachments</p>
          <ul className="flex flex-wrap gap-2">
            {kept.map((a, i) => <li key={`k${i}`} className="chip">{a.name}<button type="button" aria-label={`Remove ${a.name}`} onClick={() => setKept(kept.filter((_, j) => j !== i))}><X className="h-3 w-3" /></button></li>)}
            {files.map((f, i) => <li key={`n${i}`} className="chip">{f.name}<button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles(files.filter((_, j) => j !== i))}><X className="h-3 w-3" /></button></li>)}
          </ul>
          <input ref={fileInput} type="file" multiple hidden accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt" onChange={(e) => { pick(e.target.files); e.target.value = ''; }} />
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileInput.current?.click()}><Paperclip className="h-4 w-4" />Add files</button>
        </div>
        {busy && files.length > 0 && <div className="h-2 overflow-hidden rounded-full bg-ink/10" role="progressbar" aria-valuenow={pct}><div className="h-full bg-gradient-to-r from-primary to-gold transition-all" style={{ width: `${pct}%` }} /></div>}
        <div className="flex justify-end gap-2"><button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy}>{busy ? 'Publishing…' : editing ? 'Save changes' : 'Publish'}</button></div>
      </form>
    </Modal>
  );
}
