import { useMemo, useState } from 'react';
import { History, Plus, Trash2 } from 'lucide-react';
import { useValue } from '../../hooks/useValue';
import { useToast } from '../../contexts/ToastContext';
import { addSlot, removeSlot, setStatus, STATUS_META } from '../../services/scheduleService';
import { explainError } from '../../lib/database';
import { DAYS, formatDateTime, formatTime12, toList } from '../../utils/format';
import { StatusLegend, StatusPill } from './ScheduleModal';
import type { Day, ScheduleHistoryEntry, ScheduleSlot, ScheduleStatus, Subject } from '../../types';
import { Spinner } from '../shared/States';

/** For the subject's professor: change each class's status (green / yellow / red) and see history. Admins and the subject's professor add or remove meeting times (`canEditSlots`). */
export function ProfessorSchedulePanel({ subject, actorUid, canEditSlots = false }: { subject: Subject; actorUid: string; canEditSlots?: boolean }) {
  const toast = useToast();
  const slotsRaw = useValue<Record<string, Omit<ScheduleSlot, 'id'>>>(`classSchedules/${subject.id}`);
  const histRaw = useValue<Record<string, Omit<ScheduleHistoryEntry, 'id'>>>(`scheduleHistory/${subject.id}`);
  const slots = useMemo(() => toList<ScheduleSlot>(slotsRaw.data).sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || a.startTime.localeCompare(b.startTime)), [slotsRaw.data]);
  const hist = useMemo(() => toList<ScheduleHistoryEntry>(histRaw.data).sort((a, b) => b.at - a.at).slice(0, 15), [histRaw.data]);
  const [day, setDay] = useState<Day>('Mon');
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('10:30');
  const [room, setRoom] = useState('');

  const run = async (fn: () => Promise<unknown>, ok?: string) => { try { await fn(); if (ok) toast(ok); } catch (e) { toast(explainError(e), 'error'); } };

  return (
    <div className="space-y-4">
      <StatusLegend />
      {slotsRaw.loading ? <Spinner /> : slots.length === 0 ? <p className="text-sm text-muted">No meeting times yet. Add the first one below.</p> : (
        <ul className="space-y-2">
          {slots.map((s) => (
            <li key={s.id} className="space-y-2 rounded-2xl border border-[rgb(var(--line))] bg-bg/60 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold">{s.day} · {formatTime12(s.startTime)} – {formatTime12(s.endTime)}{s.room ? <span className="font-normal text-muted"> · {s.room}</span> : null}</p>
                <StatusPill s={s.status} />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {(['green', 'yellow', 'red'] as ScheduleStatus[]).map((k) => (
                  <button key={k} className="btn btn-ghost btn-sm" aria-pressed={s.status === k} style={s.status === k ? { outline: '2px solid currentColor' } : undefined}
                    onClick={() => run(() => setStatus(actorUid, subject.id, subject.subjectCode, s, k), `${s.day} class marked: ${STATUS_META[k].label}`)}>
                    <span className={`h-2.5 w-2.5 rounded-full ${STATUS_META[k].dot}`} />{STATUS_META[k].label}
                  </button>
                ))}
                {canEditSlots && <button className="btn btn-ghost btn-sm ml-auto" aria-label="Remove meeting time" onClick={() => { if (confirm('Remove this meeting time?')) void run(() => removeSlot(subject.id, s.id)); }}><Trash2 className="h-3.5 w-3.5" /></button>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {canEditSlots ? <form className="grid grid-cols-2 gap-2 rounded-2xl bg-primary/6 p-3 sm:grid-cols-5" onSubmit={(e) => { e.preventDefault(); void run(async () => { await addSlot(subject.id, { day, startTime: start, endTime: end, room: room.trim().slice(0, 40) || undefined }); setRoom(''); }, 'Meeting time added (status: confirmed).'); }}>
        <select className="field" aria-label="Day" value={day} onChange={(e) => setDay(e.target.value as Day)}>{DAYS.map((d) => <option key={d}>{d}</option>)}</select>
        <input className="field" type="time" aria-label="Start time" value={start} onChange={(e) => setStart(e.target.value)} required />
        <input className="field" type="time" aria-label="End time" value={end} onChange={(e) => setEnd(e.target.value)} required />
        <input className="field" placeholder="Room" aria-label="Room" value={room} maxLength={40} onChange={(e) => setRoom(e.target.value)} />
        <button className="btn btn-primary btn-sm h-full" disabled={end <= start}><Plus className="h-4 w-4" />Add</button>
      </form> : <p className="rounded-2xl bg-primary/6 p-3 text-xs text-muted">Meeting times are set by an administrator.</p>}
      {hist.length > 0 && (
        <details className="rounded-2xl border border-[rgb(var(--line))] p-3 text-sm">
          <summary className="flex cursor-pointer items-center gap-2 font-semibold"><History className="h-4 w-4" />Status history</summary>
          <ul className="mt-2 space-y-1 text-xs text-muted">{hist.map((h) => <li key={h.id}>{formatDateTime(h.at)} — {STATUS_META[h.from].label} → {STATUS_META[h.to].label}</li>)}</ul>
        </details>
      )}
    </div>
  );
}
