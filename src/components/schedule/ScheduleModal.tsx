import { useMemo } from 'react';
import { CalendarDays } from 'lucide-react';
import { Modal } from '../shared/Modal';
import { Spinner } from '../shared/States';
import { useMultiValue } from '../../hooks/useValue';
import { useAuth } from '../../contexts/AuthContext';
import { DAYS, DAY_NAMES, formatTime12 } from '../../utils/format';
import { STATUS_META } from '../../services/scheduleService';
import type { ScheduleSlot, ScheduleStatus, Subject } from '../../types';

export function StatusLegend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Status legend">
      {(Object.keys(STATUS_META) as ScheduleStatus[]).map((k) => (
        <li key={k} className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${STATUS_META[k].dot}`} />{STATUS_META[k].hint}</li>
      ))}
    </ul>
  );
}

export const StatusPill = ({ s }: { s: ScheduleStatus }) => (
  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_META[s].chip}`}><span className={`h-2 w-2 rounded-full ${STATUS_META[s].dot}`} />{STATUS_META[s].label}</span>
);

/** The student's full weekly timetable. Colours update live when a professor changes a status. */
export function ScheduleModal({ open, onClose, subjects }: { open: boolean; onClose: () => void; subjects: Subject[] }) {
  const paths = useMemo(() => (open ? subjects.map((s) => `classSchedules/${s.id}`) : []), [open, subjects]);
  const { data, loading } = useMultiValue<Record<string, Omit<ScheduleSlot, 'id'>>>(paths);
  const { role } = useAuth();

  const byDay = useMemo(() => {
    const all: Array<ScheduleSlot & { subject: Subject }> = [];
    for (const s of subjects) {
      const slots = data[`classSchedules/${s.id}`];
      Object.entries(slots ?? {}).forEach(([id, v]) => all.push({ ...(v as Omit<ScheduleSlot, 'id'>), id, subjectId: s.id, subject: s }));
    }
    return DAYS.map((d) => ({ day: d, items: all.filter((x) => x.day === d).sort((a, b) => a.startTime.localeCompare(b.startTime)) })).filter((g) => g.items.length);
  }, [data, subjects]);

  return (
    <Modal open={open} onClose={onClose} title={role === 'professor' ? 'My teaching schedule' : 'Weekly schedule'} wide>
      <div className="space-y-4">
        <StatusLegend />
        {loading && paths.length ? <Spinner /> : byDay.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">No schedule yet. Class times appear here once they are set for your subjects.</p>
        ) : byDay.map((g) => (
          <section key={g.day} aria-label={DAY_NAMES[g.day]}>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">{DAY_NAMES[g.day]}</h3>
            <ul className="space-y-2">
              {g.items.map((x) => (
                <li key={`${x.subjectId}-${x.id}`} className="flex flex-wrap items-center gap-3 rounded-2xl border border-[rgb(var(--line))] bg-bg/60 p-3">
                  <span className={`h-10 w-1.5 rounded-full ${STATUS_META[x.status].dot}`} aria-hidden="true" />
                  <div className="min-w-0 flex-1"><p className="truncate font-bold">{x.subject.subjectCode} · {x.subject.subjectName}</p><p className="truncate text-xs text-muted">{x.subject.professorName}{x.room ? ` · ${x.room}` : ''}</p></div>
                  <div className="text-right text-sm font-semibold">{formatTime12(x.startTime)} – {formatTime12(x.endTime)}</div>
                  <StatusPill s={x.status} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Modal>
  );
}

export const ScheduleFab = ({ onClick }: { onClick: () => void }) => (
  <button onClick={onClick} className="btn btn-primary fixed bottom-24 right-4 z-30 h-14 rounded-full px-5 shadow-float lg:bottom-8 lg:right-8" aria-label="Open weekly schedule"><CalendarDays className="h-5 w-5" /><span className="hidden sm:inline">Schedule</span></button>
);
