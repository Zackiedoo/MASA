import { Link } from 'react-router-dom';
import type { SubjectRow } from '../../contexts/SubjectsContext';
import { timeAgo } from '../../utils/format';

export function ConversationCard({ row }: { row: SubjectRow }) {
  const { subject: s, meta, unread } = row;
  return (
    <Link to={`/messages/${s.id}`} className="glass card flex items-center gap-4 p-4 transition-transform active:scale-[0.99]">
      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary to-deep text-xs font-extrabold tracking-wide text-white" aria-hidden="true">{s.subjectCode.slice(0, 6)}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate font-bold">{s.subjectName}</p>
          {meta && <time className="shrink-0 text-[11px] text-muted">{timeAgo(meta.at)}</time>}
        </div>
        <p className="truncate text-xs text-muted">{s.professorName}</p>
        <p className={`mt-0.5 truncate text-sm ${unread ? 'font-semibold' : 'text-muted'}`}>{meta?.text ?? 'No messages yet'}</p>
      </div>
      {unread && <span className="h-3 w-3 shrink-0 rounded-full bg-[#ff1f3d] ring-4 ring-[#ff1f3d]/25" aria-label="Unread updates" />}
    </Link>
  );
}
