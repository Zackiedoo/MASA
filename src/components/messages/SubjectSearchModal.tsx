import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Modal } from '../shared/Modal';
import { Badge } from '../shared/States';
import { useSubjects } from '../../contexts/SubjectsContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { requestJoin } from '../../services/messageService';
import { explainError } from '../../lib/database';

/** Student: find a subject and ask to join. Professor approval is required — there is no direct access. */
export function SubjectSearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { allSubjects, myStatus } = useSubjects();
  const { profile } = useAuth();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const results = useMemo(() => {
    const n = q.trim().toLowerCase();
    return allSubjects.filter((s) => !n || `${s.subjectCode} ${s.subjectName} ${s.professorName}`.toLowerCase().includes(n)).sort((a, b) => a.subjectCode.localeCompare(b.subjectCode));
  }, [allSubjects, q]);

  return (
    <Modal open={open} onClose={onClose} title="Add subject">
      <div className="space-y-3">
        <label className="relative block"><span className="sr-only">Search subjects</span><Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><input className="field pl-10" placeholder="Search by code, name or professor" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        {results.length === 0 ? <p className="py-6 text-center text-sm text-muted">No subjects found.</p> : (
          <ul className="space-y-2">
            {results.map((s) => {
              const st = myStatus[s.id];
              return (
                <li key={s.id} className="flex items-center gap-3 rounded-2xl border border-[rgb(var(--line))] bg-bg/60 p-3">
                  <div className="min-w-0 flex-1"><p className="truncate font-bold">{s.subjectCode} · {s.subjectName}</p><p className="truncate text-xs text-muted">{s.professorName}</p></div>
                  {st === 'approved' ? <Badge tone="ok">Joined</Badge> : st === 'pending' ? <Badge tone="warn">Request pending</Badge> : (
                    <button className="btn btn-primary btn-sm" disabled={busy === s.id || !profile} onClick={async () => {
                      if (!profile) return; setBusy(s.id);
                      try { await requestJoin(s, profile); toast(`Request sent to ${s.professorName}.`); } catch (e) { toast(explainError(e), 'error'); } finally { setBusy(null); }
                    }}>{st === 'rejected' ? 'Request again' : 'Request to join'}</button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-xs text-muted">Your professor checks your Student ID against the official class list before approving.</p>
      </div>
    </Modal>
  );
}
