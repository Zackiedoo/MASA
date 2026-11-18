import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Bell, CalendarDays, GraduationCap, Flag, Megaphone, Send, Trash2, Users, Lock } from 'lucide-react';
import { AuthGate } from '../components/shared/AuthGate';
import { PageHeader } from '../components/navigation/PageHeader';
import { Modal } from '../components/shared/Modal';
import { Badge, Empty, ErrorBox, Spinner } from '../components/shared/States';
import { Field, Segmented } from '../components/shared/Field';
import { ScheduleModal } from '../components/schedule/ScheduleModal';
import { ProfessorSchedulePanel } from '../components/schedule/ProfessorSchedulePanel';
import { RequestsPanel } from '../components/messages/RequestsPanel';
import { RosterPanel } from '../components/messages/RosterPanel';
import { useAuth } from '../contexts/AuthContext';
import { useSubjects } from '../contexts/SubjectsContext';
import { useToast } from '../contexts/ToastContext';
import { useValue } from '../hooks/useValue';
import { useMute } from '../hooks/useMute';
import { MuteNotice } from '../components/shared/MuteNotice';
import { reportChatMessage } from '../lib/moderationApi';
import { deleteMessage, markRead, postClassUpdate, sendMessage } from '../services/messageService';
import { explainError } from '../lib/database';
import { cleanText, hasBlockedWord } from '../utils/validation';
import { formatDateTime, toList } from '../utils/format';
import type { ChatMessage, ClassUpdate, Subject } from '../types';
import NotFound from './NotFound';

type Tab = 'updates' | 'chat';

function Group() {
  const { subjectId = '' } = useParams();
  const { profile, role } = useAuth();
  const { allSubjects, myStatus, requests, loading } = useSubjects();
  const toast = useToast();
  const subject: Subject | undefined = allSubjects.find((s) => s.id === subjectId);
  const isProf = role === 'professor' && subject?.professorId === profile?.uid;
  const allowed = !!subject && (role === 'admin' || isProf || (role === 'student' && myStatus[subjectId] === 'approved'));

  const [tab, setTab] = useState<Tab>('updates');
  const [sched, setSched] = useState(false);
  const [reqOpen, setReqOpen] = useState(false);
  const [rosterOpen, setRosterOpen] = useState(false);
  const [composeUpdate, setComposeUpdate] = useState(false);

  const msgsRaw = useValue<Record<string, Omit<ChatMessage, 'id'>>>(allowed && role !== 'admin' ? `messages/${subjectId}` : null, { limitLast: 150, orderBy: 'createdAt' });
  const updRaw = useValue<Record<string, Omit<ClassUpdate, 'id'>>>(allowed ? `classUpdates/${subjectId}` : null, { limitLast: 100, orderBy: 'createdAt' });
  const msgs = useMemo(() => toList<ChatMessage>(msgsRaw.data).sort((a, b) => a.createdAt - b.createdAt), [msgsRaw.data]);
  const upds = useMemo(() => toList<ClassUpdate>(updRaw.data).sort((a, b) => b.createdAt - a.createdAt), [updRaw.data]);

  // Mark as read when opened and whenever something new arrives while the group is on screen.
  const lastSeen = Math.max((msgs[msgs.length - 1]?.createdAt ?? 0), upds[0]?.createdAt ?? 0);
  useEffect(() => { if (allowed && profile) void markRead(profile.uid, subjectId).catch(() => undefined); }, [allowed, profile, subjectId, lastSeen]);

  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => { if (tab === 'chat') bottom.current?.scrollIntoView({ block: 'end' }); }, [msgs.length, tab]);

  if (loading) return <Spinner />;
  if (!subject) return <NotFound />;
  if (!allowed || !profile) return <Empty title="You don't have permission to open this course" hint={role === 'student' ? 'You can see a course once your professor enrolls you or approves your join request (Messages → Add subject).' : 'This course is not assigned to you.'} action={<Link to="/messages" className="btn btn-primary">Back to Messages</Link>} />;
  const pending = requests[subjectId]?.length ?? 0;

  return (
    <>
      <PageHeader
        left={<Link to="/messages" className="btn btn-ghost btn-icon btn-sm" aria-label="Back to messages"><ArrowLeft className="h-5 w-5" /></Link>}
        title={subject.subjectCode}
        right={<button className="btn btn-ghost btn-icon btn-sm" onClick={() => setSched(true)} aria-label="Class schedule"><CalendarDays className="h-5 w-5" /></button>}
      />
      <section className="glass card mb-4 flex flex-wrap items-center gap-3 p-4">
        <div className="min-w-0 flex-1"><h1 className="truncate text-lg font-extrabold">{subject.subjectName}</h1><p className="flex items-center gap-1.5 text-sm text-muted"><Users className="h-3.5 w-3.5" />{subject.professorName}</p>{subject.description && <p className="mt-1 text-xs text-muted">{subject.description}</p>}</div>
        {(isProf || role === 'admin') && <button className="btn btn-ghost btn-sm" onClick={() => setRosterOpen(true)}><GraduationCap className="h-4 w-4" />Students</button>}
        {isProf && <button className="btn btn-ghost btn-sm" onClick={() => setReqOpen(true)}><Bell className="h-4 w-4" />Requests{pending > 0 && <Badge tone="gold">{pending}</Badge>}</button>}
      </section>

      <div className="mb-4"><Segmented label="Group sections" value={tab} onChange={setTab} options={[{ value: 'updates', label: `Announcements & updates${upds.length ? ` (${upds.length})` : ''}` }, { value: 'chat', label: 'Group chat' }]} /></div>

      {tab === 'updates' ? (
        <div className="space-y-3">
          {isProf && <button className="btn btn-primary w-full" onClick={() => setComposeUpdate(true)}><Megaphone className="h-4 w-4" />Post announcement / update</button>}
          {updRaw.error ? <ErrorBox message={updRaw.error} /> : upds.length === 0 ? <Empty title="No updates yet" hint={isProf ? 'Post your first class update above.' : 'Your professor\'s announcements will show up here.'} /> : upds.map((u) => (
            <article key={u.id} className="glass card p-5">
              <div className="mb-1 flex items-center justify-between gap-2"><Badge tone={u.kind === 'announcement' ? 'maroon' : 'gold'}>{u.kind === 'announcement' ? 'Announcement' : 'Class update'}</Badge><time className="text-xs text-muted">{formatDateTime(u.createdAt)}</time></div>
              <h2 className="font-bold">{u.title}</h2><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">{u.content}</p>
            </article>
          ))}
        </div>
      ) : (
        role === 'admin' ? (
          <Empty icon={<Lock className="h-8 w-8" />} title="Group chats are private" hint="Administrators cannot read group conversations. If a member reports a message, you will see only that message (with a little context) in Admin → Freedom Wall → Chat reports." />
        ) : (
          <ChatPane msgs={msgs} meId={profile.uid} canDelete={isProf} loading={msgsRaw.loading} error={msgsRaw.error} bottom={bottom}
            onDelete={async (id) => { try { await deleteMessage(subjectId, id); } catch (e) { toast(explainError(e), 'error'); } }}
            onReport={async (id, reason) => { await reportChatMessage(profile.uid, subjectId, id, reason); toast('Reported. Only that message goes to the administrators.'); }}
            onSend={async (t) => { await sendMessage(subjectId, profile, t); }} />
        )
      )}

      {isProf || role === 'admin' ? (
        <Modal open={sched} onClose={() => setSched(false)} title={`${subject.subjectCode} schedule`} wide><ProfessorSchedulePanel subject={subject} actorUid={profile.uid} canEditSlots /></Modal>
      ) : <ScheduleModal open={sched} onClose={() => setSched(false)} subjects={[subject]} />}
      {(isProf || role === 'admin') && <RosterPanel open={rosterOpen} onClose={() => setRosterOpen(false)} subject={subject} actorUid={profile.uid} />}
      {isProf && <RequestsPanel open={reqOpen} onClose={() => setReqOpen(false)} subjects={[subject]} profUid={profile.uid} />}
      {isProf && <UpdateComposer open={composeUpdate} onClose={() => setComposeUpdate(false)} onSubmit={async (t, c, k) => { await postClassUpdate(subjectId, profile, t, c, k); toast('Posted to the group.'); }} />}
    </>
  );
}

function ChatPane({ msgs, meId, canDelete, onDelete, onReport, onSend, loading, error, bottom }: { msgs: ChatMessage[]; meId: string; canDelete: boolean; onDelete: (id: string) => void; onReport: (id: string, reason: string) => Promise<void>; onSend: (t: string) => Promise<void>; loading: boolean; error: string | null; bottom: React.RefObject<HTMLDivElement> }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const { mute } = useMute();
  const toast = useToast();
  const [reporting, setReporting] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  async function submitReport(e: FormEvent) {
    e.preventDefault();
    if (!reporting) return;
    try { await onReport(reporting, reason); setReporting(null); setReason(''); } catch (x) { toast(explainError(x), 'error'); }
  }
  async function send(e: FormEvent) {
    e.preventDefault();
    const t = cleanText(text, { multiline: true });
    if (!t) return;
    if (hasBlockedWord(t)) return setErr('Please keep the chat respectful.');
    setBusy(true); setErr(null);
    try { await onSend(t); setText(''); } catch (x) { setErr(explainError(x)); } finally { setBusy(false); }
  }
  return (
    <div className="flex flex-col gap-3">
      {error ? <ErrorBox message={error} /> : loading ? <Spinner /> : msgs.length === 0 ? <Empty title="No messages yet" hint="Say hello to your classmates." /> : (
        <ul className="flex flex-col gap-2" aria-live="polite">
          {msgs.map((m) => {
            const mine = m.senderId === meId;
            return (
              <li key={m.id} className={`group flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                {!mine && <span className="mb-0.5 px-2 text-[11px] font-semibold text-muted">{m.senderName}</span>}
                <div className="flex items-center gap-1">
                  {mine && canDelete && <button className="opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100" aria-label="Delete message" onClick={() => onDelete(m.id)}><Trash2 className="h-3.5 w-3.5 text-muted" /></button>}
                  <p className={`max-w-[80vw] whitespace-pre-wrap break-words rounded-3xl px-4 py-2 text-sm sm:max-w-md ${mine ? 'rounded-br-lg bg-gradient-to-br from-primary to-deep text-white' : 'glass rounded-bl-lg'}`}>{m.content}</p>
                  {!mine && <button className="opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100" aria-label="Report message" onClick={() => setReporting(m.id)}><Flag className="h-3.5 w-3.5 text-muted" /></button>}
                  {!mine && canDelete && <button className="opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100" aria-label="Delete message" onClick={() => onDelete(m.id)}><Trash2 className="h-3.5 w-3.5 text-muted" /></button>}
                </div>
                <time className="px-2 text-[10px] text-muted">{new Date(m.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time>
              </li>
            );
          })}
        </ul>
      )}
      <div ref={bottom} />
      <MuteNotice />
      <Modal open={!!reporting} onClose={() => setReporting(null)} title="Report this message">
        <form onSubmit={submitReport} className="space-y-3">
          <p className="text-sm text-muted">Group chats are private. Only this message (and a few lines before it) will be sent to the administrators.</p>
          <textarea className="field" rows={3} maxLength={300} required minLength={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What is wrong with it?" />
          <div className="flex justify-end gap-2"><button type="button" className="btn btn-ghost" onClick={() => setReporting(null)}>Cancel</button><button className="btn btn-danger">Report</button></div>
        </form>
      </Modal>
      <form onSubmit={send} className="glass sticky bottom-24 z-20 flex items-end gap-2 rounded-3xl p-2 lg:bottom-4" data-no-swipe>
        <label className="sr-only" htmlFor="chat-input">Message</label>
        <textarea id="chat-input" rows={1} maxLength={1000} className="field max-h-32 min-h-11 flex-1 resize-none rounded-2xl" placeholder={mute ? 'Your account is muted' : 'Write a message…'} disabled={!!mute} value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && window.matchMedia('(min-width:1024px)').matches) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} />
        <button className="btn btn-primary btn-icon" disabled={busy || !text.trim() || !!mute} aria-label="Send message"><Send className="h-4 w-4" /></button>
      </form>
      {err && <ErrorBox message={err} />}
    </div>
  );
}

function UpdateComposer({ open, onClose, onSubmit }: { open: boolean; onClose: () => void; onSubmit: (t: string, c: string, k: 'announcement' | 'update') => Promise<void> }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [kind, setKind] = useState<'announcement' | 'update'>('update');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault(); setErr(null);
    const t = cleanText(title); const c = cleanText(content, { multiline: true });
    if (!t || !c) return setErr('Add a title and a message.');
    setBusy(true);
    try { await onSubmit(t, c, kind); setTitle(''); setContent(''); onClose(); } catch (x) { setErr(explainError(x)); } finally { setBusy(false); }
  }
  return (
    <Modal open={open} onClose={onClose} title="Post to the group">
      <form onSubmit={submit} className="space-y-4">
        {err && <ErrorBox message={err} />}
        <Segmented label="Type" value={kind} onChange={setKind} options={[{ value: 'update', label: 'Class update' }, { value: 'announcement', label: 'Announcement' }]} />
        <Field label="Title">{(id) => <input id={id} className="field" maxLength={150} value={title} onChange={(e) => setTitle(e.target.value)} required />}</Field>
        <Field label="Message">{(id) => <textarea id={id} className="field" maxLength={3000} value={content} onChange={(e) => setContent(e.target.value)} required />}</Field>
        <div className="flex justify-end gap-2"><button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy}>{busy ? 'Posting…' : 'Post'}</button></div>
      </form>
    </Modal>
  );
}

export default function SubjectGroup() {
  return <AuthGate roles={['student', 'professor', 'admin']}><Group /></AuthGate>;
}
