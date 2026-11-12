import { useEffect, useState } from 'react';
import { Check, ShieldCheck, ShieldX, X } from 'lucide-react';
import { Modal } from '../shared/Modal';
import { Badge } from '../shared/States';
import { useSubjects } from '../../contexts/SubjectsContext';
import { useToast } from '../../contexts/ToastContext';
import { decideRequest } from '../../services/messageService';
import { read, explainError } from '../../lib/database';
import { timeAgo } from '../../utils/format';
import type { Subject } from '../../types';

/** Professor: review membership requests, comparing each Student ID against the subject's official class list. */
export function RequestsPanel({ open, onClose, subjects, profUid }: { open: boolean; onClose: () => void; subjects: Subject[]; profUid: string }) {
  const { requests } = useSubjects();
  const toast = useToast();
  const [lists, setLists] = useState<Record<string, Record<string, { fullName: string }> | null>>({});
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    subjects.forEach(async (s) => { const l = await read<Record<string, { fullName: string }>>(`classLists/${s.id}`).catch(() => null); setLists((p) => ({ ...p, [s.id]: l })); });
  }, [open, subjects]);

  const total = subjects.reduce((n, s) => n + (requests[s.id]?.length ?? 0), 0);
  return (
    <Modal open={open} onClose={onClose} title="Membership requests" wide>
      {total === 0 ? <p className="py-8 text-center text-sm text-muted">No pending requests.</p> : (
        <div className="space-y-5">
          {subjects.filter((s) => (requests[s.id]?.length ?? 0) > 0).map((s) => (
            <section key={s.id}>
              <h3 className="mb-2 font-bold">{s.subjectCode} · {s.subjectName}</h3>
              {lists[s.id] === null && <p className="mb-2 text-xs text-warn">No official class list has been uploaded for this subject yet — ask an administrator.</p>}
              <ul className="space-y-2">
                {requests[s.id].map((r) => {
                  const onList = !!lists[s.id]?.[r.studentId];
                  const key = `${s.id}${r.uid}`;
                  const act = async (ok: boolean) => { setBusy(key); try { await decideRequest(profUid, s, r, ok); toast(ok ? `${r.studentName} approved.` : 'Request rejected.'); } catch (e) { toast(explainError(e), 'error'); } finally { setBusy(null); } };
                  return (
                    <li key={r.uid} className="flex flex-wrap items-center gap-3 rounded-2xl border border-[rgb(var(--line))] bg-bg/60 p-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold">{r.studentName}</p>
                        <p className="text-xs text-muted">ID {r.studentId} · {timeAgo(r.requestedAt)}</p>
                        <div className="mt-1">{onList ? <Badge tone="ok"><ShieldCheck className="h-3 w-3" />On class list</Badge> : <Badge tone="bad"><ShieldX className="h-3 w-3" />Not on class list</Badge>}</div>
                      </div>
                      <button className="btn btn-ghost btn-sm" disabled={busy === key} onClick={() => act(false)}><X className="h-4 w-4" />Reject</button>
                      <button className="btn btn-primary btn-sm" disabled={busy === key} onClick={() => act(true)}><Check className="h-4 w-4" />Approve</button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Modal>
  );
}
