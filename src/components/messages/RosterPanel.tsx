import { useMemo, useState, type FormEvent } from 'react';
import { UserMinus, UserPlus } from 'lucide-react';
import { Modal } from '../shared/Modal';
import { Field } from '../shared/Field';
import { ErrorBox, Spinner } from '../shared/States';
import { useValue } from '../../hooks/useValue';
import { useToast } from '../../contexts/ToastContext';
import { enrollStudent, removeStudent } from '../../services/messageService';
import { explainError } from '../../lib/database';
import type { RosterEntry, Subject } from '../../types';

/**
 * Course roster. The course's professor (or an administrator) can enroll EXISTING student accounts by Student ID
 * and remove students. Students and other professors never see this list (the database rules enforce that).
 */
export function RosterPanel({ open, onClose, subject, actorUid }: { open: boolean; onClose: () => void; subject: Subject; actorUid: string }) {
  const toast = useToast();
  const raw = useValue<Record<string, Omit<RosterEntry, 'uid'> | true>>(open ? `subjectMembers/${subject.id}` : null);
  const [id, setId] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const roster = useMemo(() => {
    const rows = Object.entries(raw.data ?? {}).map(([uid, v]) => (v === true ? { uid, studentId: '', fullName: 'Student (older record)' } : { ...(v as object), uid }) as RosterEntry);
    return rows.sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [raw.data]);

  async function enroll(e: FormEvent) {
    e.preventDefault(); setErr(null); setBusy(true);
    try { const r = await enrollStudent(actorUid, subject, id); toast(`${r.fullName} enrolled in ${subject.subjectCode}.`); setId(''); }
    catch (x) { setErr(explainError(x)); } finally { setBusy(false); }
  }
  async function remove(m: RosterEntry) {
    if (!confirm(`Remove ${m.fullName} from ${subject.subjectCode}? They will lose access to this course.`)) return;
    try { await removeStudent(actorUid, subject, m); toast(`${m.fullName} removed.`); } catch (x) { toast(explainError(x), 'error'); }
  }

  return (
    <Modal open={open} onClose={onClose} title={`${subject.subjectCode} · students`} wide>
      <form onSubmit={enroll} className="mb-4 flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1"><Field label="Enroll a student" hint="Type the Student ID of an existing student account.">{(fid) => <input id={fid} className="field" value={id} onChange={(e) => setId(e.target.value)} placeholder="e.g. 2024-0001" autoCapitalize="none" spellCheck={false} required />}</Field></div>
        <button className="btn btn-primary mb-[1.35rem]" disabled={busy || !id.trim()}><UserPlus className="h-4 w-4" />{busy ? 'Enrolling…' : 'Enroll'}</button>
      </form>
      {err && <div className="mb-3"><ErrorBox message={err} /></div>}
      {raw.loading ? <Spinner /> : raw.error ? <ErrorBox message={raw.error} /> : roster.length === 0 ? <p className="py-6 text-center text-sm text-muted">No students enrolled yet.</p> : (
        <>
          <p className="mb-2 text-xs font-semibold text-muted">{roster.length} enrolled</p>
          <ul className="space-y-2">
            {roster.map((m) => (
              <li key={m.uid} className="flex items-center gap-3 rounded-2xl border border-[rgb(var(--line))] bg-bg/60 p-3">
                <div className="min-w-0 flex-1"><p className="truncate font-bold">{m.fullName}</p>{m.studentId && <p className="text-xs text-muted">ID {m.studentId}</p>}</div>
                <button className="btn btn-ghost btn-sm" onClick={() => void remove(m)} aria-label={`Remove ${m.fullName}`}><UserMinus className="h-4 w-4" />Remove</button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Modal>
  );
}
