import { useMemo, useState, type FormEvent } from 'react';
import { Send } from 'lucide-react';
import { useValue } from '../../hooks/useValue';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { explainError } from '../../lib/database';
import { sendBroadcast, type Audience } from '../../lib/moderationApi';
import { cleanText } from '../../utils/validation';
import { formatDateTime, toList } from '../../utils/format';
import { Field } from '../shared/Field';
import { Badge } from '../shared/States';

const AUDIENCES: Array<{ value: Audience; label: string }> = [
  { value: 'all', label: 'Everyone' }, { value: 'students', label: 'Students' }, { value: 'professors', label: 'Professors' }, { value: 'organizations', label: 'Organizations' }, { value: 'staff', label: 'Professors + organizations' },
];

/** Mail dashboard: a message that lands in each recipient's Profile → Inbox (and on their phone if notifications are on). */
export function BroadcastTab() {
  const { uid } = useAuth();
  const toast = useToast();
  const sent = useValue<Record<string, { title: string; body: string; audience: string; createdAt: number; recipients: number }>>('broadcasts', { limitLast: 20, orderBy: 'createdAt' });
  const history = useMemo(() => toList<{ id: string; title: string; body: string; audience: string; createdAt: number; recipients: number }>(sent.data).sort((a, b) => b.createdAt - a.createdAt), [sent.data]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<Audience>('all');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!uid) return;
    const t = cleanText(title); const b = cleanText(body, { multiline: true });
    if (t.length < 3 || b.length < 3) return toast('Enter a title and a message.', 'error');
    if (!confirm(`Send this to ${AUDIENCES.find((a) => a.value === audience)?.label.toLowerCase()}?`)) return;
    setBusy(true);
    try { const n = await sendBroadcast(uid, t, b, audience); toast(`Sent to ${n} inbox${n === 1 ? '' : 'es'}.`); setTitle(''); setBody(''); } catch (x) { toast(explainError(x), 'error'); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={submit} className="glass card space-y-3 p-5">
        <h3 className="font-bold">New message to inboxes</h3>
        <p className="text-sm text-muted">Use this for web-app updates, maintenance notices and policy changes. For school announcements use Publish instead.</p>
        <Field label="To">{(id) => <select id={id} className="field" value={audience} onChange={(e) => setAudience(e.target.value as Audience)}>{AUDIENCES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}</select>}</Field>
        <Field label="Title">{(id) => <input id={id} className="field" maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} required />}</Field>
        <Field label="Message">{(id) => <textarea id={id} className="field" rows={5} maxLength={1000} value={body} onChange={(e) => setBody(e.target.value)} required />}</Field>
        <div className="flex justify-end"><button className="btn btn-primary" disabled={busy}><Send className="h-4 w-4" />{busy ? 'Sending…' : 'Send'}</button></div>
      </form>
      <section><h3 className="mb-2 font-bold">Sent</h3>
        {history.length === 0 ? <p className="text-sm text-muted">Nothing sent yet.</p> : <ul className="space-y-2">{history.map((h) => (
          <li key={h.id} className="glass card p-4 text-sm"><div className="flex flex-wrap items-center gap-2"><b>{h.title}</b><Badge tone="muted">{h.audience}</Badge><span className="text-xs text-muted">{h.recipients} recipients · {formatDateTime(h.createdAt)}</span></div><p className="mt-1 whitespace-pre-wrap text-muted">{h.body}</p></li>))}</ul>}
      </section>
    </div>
  );
}
