import { useMemo, useRef, useState, type FormEvent } from 'react';
import { FileUp, Webhook, Wand2 } from 'lucide-react';
import { useValue } from '../../hooks/useValue';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { ingestMemo } from '../../lib/adminApi';
import { publishMemoDraft } from '../../services/adminService';
import { uploadFile, checkFile, safeFileName } from '../../lib/storage';
import { extractMemoDetails } from '../../utils/memo';
import { cleanText } from '../../utils/validation';
import { explainError } from '../../lib/database';
import { formatDateTime, toList } from '../../utils/format';
import { Field, Segmented } from '../shared/Field';
import { Badge, Empty, ErrorBox, Spinner } from '../shared/States';
import type { Memorandum } from '../../types';

const OFFICE = { di: 'Director for Instruction', president: 'Office of the President' } as const;

/**
 * Memorandum integration module.
 *  - Upload: administrators add a memo (text and/or document). Details can be auto-extracted from pasted text.
 *  - Ingestion endpoint: POST /api/memos/ingest (webhook) is READY but NOT CONNECTED to any source system yet.
 *  - Duplicate detection and publication status are enforced by the server (see api/memos/ingest.ts).
 */
export function MemoModule() {
  const { uid } = useAuth();
  const toast = useToast();
  const { data, loading, error } = useValue<Record<string, Omit<Memorandum, 'id'>>>('memoranda');
  const list = useMemo(() => toList<Memorandum>(data).sort((a, b) => b.publishedAt - a.publishedAt), [data]);
  const [office, setOffice] = useState<'di' | 'president'>('di');
  const [ref, setRef] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [publish, setPublish] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState<'all' | 'di' | 'president'>('all');

  function autofill() {
    const x = extractMemoDetails(content);
    if (x.referenceNumber) setRef(x.referenceNumber);
    if (x.title) setTitle(x.title);
    if (x.office) setOffice(x.office);
    toast(x.referenceNumber || x.title ? 'Details extracted — please review them.' : 'Nothing could be extracted. Fill the fields manually.', x.referenceNumber || x.title ? 'ok' : 'error');
  }
  async function loadText(f: File | null) {
    if (!f) return;
    if (f.type.startsWith('text/')) { setContent((await f.text()).slice(0, 5000)); return; }
    const problem = checkFile(f); if (problem) return setErr(problem);
    setFile(f);
  }

  async function submit(e: FormEvent) {
    e.preventDefault(); setErr(null); if (!uid) return;
    const t = cleanText(title); const c = cleanText(content, { multiline: true });
    if (t.length < 3) return setErr('Title is required.');
    if (!c && !file) return setErr('Add the memo text and/or upload the document.');
    setBusy(true);
    try {
      const documentUrl = file ? await uploadFile(`memoranda/${Date.now()}_${safeFileName(file.name)}`, file) : '';
      const r = await ingestMemo({ office, referenceNumber: cleanText(ref).slice(0, 60), title: t, content: c, documentUrl, publish }, uid);
      toast(r.status === 'published' ? 'Memorandum published to the homepage.' : 'Saved as draft.');
      setRef(''); setTitle(''); setContent(''); setFile(null);
    } catch (x) { setErr(x instanceof Error ? x.message : explainError(x)); } finally { setBusy(false); }
  }

  const shown = list.filter((m) => filter === 'all' || m.office === filter);
  return (
    <div className="space-y-5">
      <section className="glass card space-y-3 p-5">
        <h3 className="flex items-center gap-2 font-bold"><Webhook className="h-4 w-4" />Automatic distribution — status</h3>
        <p className="text-sm text-muted">The ingestion endpoint <code className="rounded bg-ink/8 px-1">POST /api/memos/ingest</code> (header <code className="rounded bg-ink/8 px-1">x-masa-webhook-secret</code>) is implemented with duplicate detection, source-office identification and publication status. <b>No source system is connected yet</b>: until one is configured (see README), memoranda are added with the form below.</p>
      </section>

      <form onSubmit={submit} className="glass card space-y-4 p-5">
        <h3 className="flex items-center gap-2 font-bold"><FileUp className="h-4 w-4" />Upload a memorandum</h3>
        {err && <ErrorBox message={err} />}
        <Field label="Source office">{(id) => <select id={id} className="field" value={office} onChange={(e) => setOffice(e.target.value as 'di' | 'president')}><option value="di">{OFFICE.di}</option><option value="president">{OFFICE.president}</option></select>}</Field>
        <Field label="Memo text (paste or load a .txt file)" hint="Paste the memo, then press “Auto-extract” to pre-fill the reference number and subject.">{(id) => <textarea id={id} className="field min-h-32" maxLength={5000} value={content} onChange={(e) => setContent(e.target.value)} />}</Field>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-ghost btn-sm" onClick={autofill} disabled={!content.trim()}><Wand2 className="h-4 w-4" />Auto-extract</button>
          <input ref={fileInput} hidden type="file" accept=".txt,.pdf,.doc,.docx,image/png,image/jpeg" onChange={(e) => { void loadText(e.target.files?.[0] ?? null); e.target.value = ''; }} />
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileInput.current?.click()}>{file ? file.name : 'Attach document / load .txt'}</button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Reference number">{(id) => <input id={id} className="field" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="DI Memo No. 12, s. 2026" />}</Field>
          <Field label="Title / subject">{(id) => <input id={id} className="field" value={title} onChange={(e) => setTitle(e.target.value)} required />}</Field>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--c-primary))]" checked={publish} onChange={(e) => setPublish(e.target.checked)} />Publish to the homepage immediately (otherwise save as draft)</label>
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : publish ? 'Publish memorandum' : 'Save draft'}</button>
      </form>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2"><h3 className="font-bold">Memoranda</h3><Segmented label="Office" value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All' }, { value: 'di', label: 'DI' }, { value: 'president', label: 'President' }]} /></div>
        {error ? <ErrorBox message={error} /> : loading ? <Spinner /> : shown.length === 0 ? <Empty title="No memoranda" /> : (
          <ul className="space-y-2">{shown.map((m) => (
            <li key={m.id} className="glass card flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1"><p className="truncate font-bold">{m.referenceNumber || m.title}</p><p className="truncate text-xs text-muted">{OFFICE[m.office]} · {formatDateTime(m.publishedAt)} · via {m.sourceType}</p></div>
              <Badge tone={m.status === 'published' ? 'ok' : 'warn'}>{m.status === 'published' ? 'Published' : 'Draft'}</Badge>
              {m.status === 'draft' && uid && <button className="btn btn-primary btn-sm" onClick={async () => { try { await publishMemoDraft(uid, m); toast('Published.'); } catch (e) { toast(explainError(e), 'error'); } }}>Publish</button>}
            </li>))}</ul>
        )}
      </section>
    </div>
  );
}
