import { useMemo, useState } from 'react';
import { Bell, MessageSquareText, Plus, Search } from 'lucide-react';
import { AuthGate } from '../components/shared/AuthGate';
import { PageHeader } from '../components/navigation/PageHeader';
import { ConversationCard } from '../components/messages/ConversationCard';
import { SubjectSearchModal } from '../components/messages/SubjectSearchModal';
import { RequestsPanel } from '../components/messages/RequestsPanel';
import { SubjectFormModal } from '../components/messages/SubjectFormModal';
import { ScheduleFab, ScheduleModal } from '../components/schedule/ScheduleModal';
import { Badge, CardSkeleton, Empty } from '../components/shared/States';
import { useAuth } from '../contexts/AuthContext';
import { useSubjects } from '../contexts/SubjectsContext';

function MessagesHome() {
  const { profile, role } = useAuth();
  const { rows, myStatus, allSubjects, pendingCount, loading } = useSubjects();
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [creating, setCreating] = useState(false);
  const [reqOpen, setReqOpen] = useState(false);
  const [schedule, setSchedule] = useState(false);

  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return rows.filter((r) => !n || `${r.subject.subjectCode} ${r.subject.subjectName} ${r.subject.professorName}`.toLowerCase().includes(n));
  }, [rows, q]);
  const pendingSubjects = useMemo(() => allSubjects.filter((s) => myStatus[s.id] === 'pending'), [allSubjects, myStatus]);
  const subjects = useMemo(() => rows.map((r) => r.subject), [rows]);
  if (!profile) return null;

  return (
    <>
      <PageHeader title="MESSAGES" />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="relative min-w-0 flex-1"><span className="sr-only">Search your subjects</span><Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><input className="field pl-10" placeholder="Search your subjects" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        {role === 'student' && <button className="btn btn-primary" onClick={() => setAdding(true)}><Plus className="h-4 w-4" />Add subject</button>}
        {role === 'professor' && (
          <>
            <button className="btn btn-ghost" onClick={() => setReqOpen(true)}><Bell className="h-4 w-4" />Requests{pendingCount > 0 && <Badge tone="gold">{pendingCount}</Badge>}</button>
            <button className="btn btn-primary" onClick={() => setCreating(true)}><Plus className="h-4 w-4" />New subject</button>
          </>
        )}
      </div>

      {pendingSubjects.length > 0 && (
        <div className="mb-4 rounded-2xl border border-gold/40 bg-softgold/30 p-3 text-sm"><b>Awaiting professor approval:</b> {pendingSubjects.map((s) => s.subjectCode).join(', ')}</div>
      )}

      {loading ? <CardSkeleton n={3} /> : shown.length === 0 ? (
        <Empty icon={<MessageSquareText className="h-8 w-8" />}
          title={q ? 'No subjects match your search' : role === 'student' ? 'No subjects yet' : role === 'professor' ? 'You have no subject groups yet' : 'No subjects registered'}
          hint={q ? undefined : role === 'student' ? 'Tap “Add subject”, find your class and send a join request. Your professor will approve it.' : role === 'professor' ? 'Create a subject group or ask an administrator to assign one to you.' : 'Register subjects in the administrator dashboard.'} />
      ) : <div className="space-y-3">{shown.map((r) => <ConversationCard key={r.subject.id} row={r} />)}</div>}

      {(role === 'student' || role === 'professor') && <ScheduleFab onClick={() => setSchedule(true)} />}
      <ScheduleModal open={schedule} onClose={() => setSchedule(false)} subjects={subjects} />
      {role === 'student' && <SubjectSearchModal open={adding} onClose={() => setAdding(false)} />}
      {role === 'professor' && (
        <>
          <RequestsPanel open={reqOpen} onClose={() => setReqOpen(false)} subjects={subjects} profUid={profile.uid} />
          {creating && <SubjectFormModal open onClose={() => setCreating(false)} actorUid={profile.uid} professor={{ id: profile.uid, name: profile.fullName }} />}
        </>
      )}
    </>
  );
}

export default function Messages() {
  return <AuthGate roles={['student', 'professor', 'admin']} reason="Log in with your Student ID to see your subject groups and class updates."><MessagesHome /></AuthGate>;
}
