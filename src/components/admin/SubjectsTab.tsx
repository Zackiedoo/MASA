import { useEffect, useMemo, useState } from 'react';
import { BookOpen, CalendarClock, Check, ClipboardList, Pencil, Plus, Trash2, UserCheck, X } from 'lucide-react';
import { useValue } from '../../hooks/useValue';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { deleteSubject, saveClassList } from '../../services/adminService';
import { decideRequest } from '../../services/messageService';
import { explainError } from '../../lib/database';
import { isLoginId, cleanText } from '../../utils/validation';
import { timeAgo, toList } from '../../utils/format';
import { Modal } from '../shared/Modal';
import { Badge, Empty, ErrorBox, Spinner } from '../shared/States';
import { SubjectFormModal } from '../messages/SubjectFormModal';
import { ProfessorSchedulePanel } from '../schedule/ProfessorSchedulePanel';
import type { JoinRequest, Subject, UserProfile } from '../../types';

type Panel = { kind: 'edit' | 'list' | 'schedule' | 'requests'; subject: Subject } | { kind: 'new' } | null;

export function SubjectsTab() {
  const { uid } = useAuth();
  const toast = useToast();
  const subjects = useValue<Record<string, Omit<Subject, 'id'>>>('subjects');
  const users = useValue<Record<string, Omit<UserProfile, 'uid'>>>('users');
  const [panel, setPanel] = useState<Panel>(null);
  const list = useMemo(() => toList<Subject>(subjects.data).sort((a, b) => a.subjectCode.localeCompare(b.subjectCode)), [subjects.data]);
  const profs = useMemo(() => toList<UserProfile>(users.data).filter((u) => u.role === 'professor' && u.isActive).map((u) => ({ id: u.id, name: u.fullName })), [users.data]);
  if (!uid) return null;
  return (
    <div className="space-y-4">
      <button className="btn btn-primary" onClick={() => setPanel({ kind: 'new' })}><Plus className="h-4 w-4" />Register subject</button>
      {subjects.error ? <ErrorBox message={subjects.error} /> : subjects.loading ? <Spinner /> : list.length === 0 ? <Empty icon={<BookOpen className="h-8 w-8" />} title="No subjects registered" hint="Register a subject and assign a professor." /> : (
        <ul className="space-y-2">{list.map((s) => (
          <li key={s.id} className="glass card flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1"><p className="truncate font-bold">{s.subjectCode} · {s.subjectName}</p><p className="truncate text-xs text-muted">{s.professorName}</p></div>
            <div className="flex flex-wrap gap-1">
              <button className="btn btn-ghost btn-sm" onClick={() => setPanel({ kind: 'list', subject: s })}><ClipboardList className="h-3.5 w-3.5" />Class list</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setPanel({ kind: 'requests', subject: s })}><UserCheck className="h-3.5 w-3.5" />Requests</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setPanel({ kind: 'schedule', subject: s })}><CalendarClock className="h-3.5 w-3.5" />Schedule</button>
              <button className="btn btn-ghost btn-sm" aria-label="Edit subject" onClick={() => setPanel({ kind: 'edit', subject: s })}><Pencil className="h-3.5 w-3.5" /></button>
              <button className="btn btn-ghost btn-sm" aria-label="Delete subject" onClick={async () => { if (confirm(`Delete ${s.subjectCode} and all its chat, schedule and membership data?`)) { try { await deleteSubject(uid, s); toast('Subject deleted.'); } catch (e) { toast(explainError(e), 'error'); } } }}><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </li>))}</ul>
      )}
      {panel?.kind === 'new' && <SubjectFormModal open onClose={() => setPanel(null)} actorUid={uid} professors={profs} />}
      {panel?.kind === 'edit' && <SubjectFormModal key={panel.subject.id} open onClose={() => setPanel(null)} actorUid={uid} professors={profs} existing={panel.subject} />}
      {panel?.kind === 'schedule' && <Modal open onClose={() => setPanel(null)} title={`${panel.subject.subjectCode} schedule`} wide><ProfessorSchedulePanel subject={panel.subject} actorUid={uid} /></Modal>}
      {panel?.kind === 'list' && <ClassListModal subject={panel.subject} actor={uid} onClose={() => setPanel(null)} />}
      {panel?.kind === 'requests' && <AdminRequests subject={panel.subject} actor={uid} onClose={() => setPanel(null)} />}
    </div>
  );
}

function ClassListModal({ subject, actor, onClose }: { subject: Subject; actor: string; onClose: () => void }) {
  const toast = useToast();
  const cur = useValue<Record<string, { fullName: string }>>(`classLists/${subject.id}`);
  const [text, setText] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (!cur.loading && !loaded) { setText(Object.entries(cur.data ?? {}).map(([id, v]) => `${id}, ${v.fullName}`).join('\n')); setLoaded(true); } }, [cur.loading, cur.data, loaded]);
  async function save() {
    setErr(null);
    const rows: Array<{ studentId: string; fullName: string }> = [];
    for (const [i, line] of text.split('\n').map((l) => l.trim()).entries()) {
      if (!line) continue;
      const k = line.search(/[,\t]/);
      const studentId = (k < 0 ? line : line.slice(0, k)).trim();
      const fullName = k < 0 ? studentId : cleanText(line.slice(k + 1)) || studentId;
      if (!isLoginId(studentId)) return setErr(`Line ${i + 1}: “${studentId}” is not a valid Student ID.`);
      rows.push({ studentId, fullName });
    }
    try { await saveClassList(actor, subject, rows); toast(`Class list saved (${rows.length} students).`); onClose(); } catch (e) { setErr(explainError(e)); }
  }
  return (
    <Modal open onClose={onClose} title={`${subject.subjectCode} — official class list`} footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={save}>Save list</button></>}>
      {err && <ErrorBox message={err} />}
      <p className="mb-2 text-sm text-muted">One student per line: <code>Student ID, Full Name</code>. Professors compare join requests against this list.</p>
      {cur.loading ? <Spinner /> : <textarea className="field min-h-64 font-mono text-sm" value={text} onChange={(e) => setText(e.target.value)} placeholder={'2024-0001, Ana Dela Cruz'} />}
    </Modal>
  );
}

function AdminRequests({ subject, actor, onClose }: { subject: Subject; actor: string; onClose: () => void }) {
  const toast = useToast();
  const reqs = useValue<Record<string, Omit<JoinRequest, 'uid' | 'subjectId'>>>(`joinRequests/${subject.id}`);
  const lists = useValue<Record<string, { fullName: string }>>(`classLists/${subject.id}`);
  const pending = toList<JoinRequest>(reqs.data).map((r) => ({ ...r, uid: r.id })).filter((r) => r.status === 'pending');
  return (
    <Modal open onClose={onClose} title={`${subject.subjectCode} — access requests`}>
      {reqs.loading ? <Spinner /> : pending.length === 0 ? <p className="py-6 text-center text-sm text-muted">No pending requests.</p> : (
        <ul className="space-y-2">{pending.map((r) => (
          <li key={r.uid} className="flex flex-wrap items-center gap-2 rounded-2xl border border-[rgb(var(--line))] p-3">
            <div className="min-w-0 flex-1"><p className="truncate font-bold">{r.studentName}</p><p className="text-xs text-muted">ID {r.studentId} · {timeAgo(r.requestedAt)}</p></div>
            {lists.data?.[r.studentId] ? <Badge tone="ok">On list</Badge> : <Badge tone="bad">Not on list</Badge>}
            <button className="btn btn-ghost btn-sm" onClick={async () => { try { await decideRequest(actor, subject, r, false); toast('Rejected.'); } catch (e) { toast(explainError(e), 'error'); } }}><X className="h-4 w-4" /></button>
            <button className="btn btn-primary btn-sm" onClick={async () => { try { await decideRequest(actor, subject, r, true); toast('Approved.'); } catch (e) { toast(explainError(e), 'error'); } }}><Check className="h-4 w-4" /></button>
          </li>))}</ul>
      )}
    </Modal>
  );
}
