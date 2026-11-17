import { useMemo, useState } from 'react';
import { Archive, ArchiveRestore, EyeOff, Eye, Flag, Pencil, Plus, Trash2 } from 'lucide-react';
import { useValue } from '../../hooks/useValue';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { can } from '../../lib/permissions';
import { AnnouncementComposer } from './AnnouncementComposer';
import { Badge, Empty, ErrorBox, Spinner } from '../shared/States';
import { deleteAnnouncement, flagAnnouncement, hideAnnouncement, setAnnouncementStatus } from '../../services/announcementService';
import { explainError } from '../../lib/database';
import { formatDateTime, toList } from '../../utils/format';
import type { Announcement } from '../../types';

/**
 * List + create/edit/archive/delete. An organization account sees its organization's posts but can change only the ones it wrote;
 * a System Administrator can edit/delete anything and additionally flag or hide any announcement.
 */
export function AnnouncementManager({ actorUid, org }: { actorUid: string; org?: { id: string; name: string } }) {
  const toast = useToast();
  const { profile } = useAuth();
  const isAdmin = can(profile, 'announcement.moderate');
  const { data, loading, error } = useValue<Record<string, Omit<Announcement, 'id'>>>('announcements', { limitLast: 200, orderBy: 'createdAt' });
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [creating, setCreating] = useState(false);
  const list = useMemo(() => toList<Announcement>(data).filter((a) => (org ? a.sourceId === org.id : true)).sort((a, b) => b.createdAt - a.createdAt), [data, org]);
  const run = async (fn: () => Promise<void>, ok: string) => { try { await fn(); toast(ok); } catch (e) { toast(explainError(e), 'error'); } };

  return (
    <div className="space-y-3">
      <button className="btn btn-primary" onClick={() => setCreating(true)}><Plus className="h-4 w-4" />New announcement</button>
      {error ? <ErrorBox message={error} /> : loading ? <Spinner /> : list.length === 0 ? <Empty title="Nothing published yet" /> : (
        <ul className="space-y-2">
          {list.map((a) => (
            <li key={a.id} className="glass card flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{a.title}</p>
                <p className="truncate text-xs text-muted">{a.sourceName} · {formatDateTime(a.createdAt)}</p>
              </div>
              {a.memoId && <Badge tone="maroon">Memo</Badge>}
              {a.flagged && <Badge tone="warn"><Flag className="h-3 w-3" />Flagged</Badge>}
              <Badge tone={a.status === 'published' ? 'ok' : a.status === 'hidden' ? 'bad' : 'muted'}>{a.status === 'published' ? 'Visible' : a.status === 'hidden' ? 'Hidden by admin' : 'Archived'}</Badge>
              {isAdmin ? <ModerationButtons a={a} actorUid={actorUid} run={run} /> : null}
              {(isAdmin || a.authorUid === actorUid) ? (
              <div className="flex gap-1">
                <button className="btn btn-ghost btn-sm" aria-label="Edit" onClick={() => setEditing(a)}><Pencil className="h-3.5 w-3.5" /></button>
                {a.status !== 'hidden' && <button className="btn btn-ghost btn-sm" aria-label={a.status === 'published' ? 'Archive' : 'Restore'} onClick={() => run(() => setAnnouncementStatus(actorUid, a, a.status === 'published' ? 'archived' : 'published'), a.status === 'published' ? 'Archived — hidden from the homepage.' : 'Restored to the homepage.')}>{a.status === 'published' ? <Archive className="h-3.5 w-3.5" /> : <ArchiveRestore className="h-3.5 w-3.5" />}</button>}
                <button className="btn btn-ghost btn-sm" aria-label="Delete" onClick={() => { if (confirm(`Delete “${a.title}” permanently?`)) void run(() => deleteAnnouncement(actorUid, a), 'Deleted.'); }}><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
              ) : <span className="text-xs text-muted" title="You can only edit or delete announcements you wrote.">View only</span>}
            </li>
          ))}
        </ul>
      )}
      {creating && <AnnouncementComposer open onClose={() => setCreating(false)} actorUid={actorUid} org={org} />}
      {editing && <AnnouncementComposer key={editing.id} open onClose={() => setEditing(null)} actorUid={actorUid} org={org} editing={editing} />}
    </div>
  );
}

function ModerationButtons({ a, actorUid, run }: { a: Announcement; actorUid: string; run: (fn: () => Promise<void>, ok: string) => Promise<void> }) {
  return (
    <div className="flex gap-1">
      <button className="btn btn-ghost btn-sm" aria-label={a.flagged ? 'Remove flag' : 'Flag for review'} title={a.flagged ? 'Remove flag' : 'Flag for review'}
        onClick={() => { if (a.flagged) void run(() => flagAnnouncement(actorUid, a, false), 'Flag removed.'); else { const r = prompt('Why is this being flagged? (optional)') ; if (r !== null) void run(() => flagAnnouncement(actorUid, a, true, r), 'Flagged.'); } }}>
        <Flag className={`h-3.5 w-3.5 ${a.flagged ? 'fill-current' : ''}`} />
      </button>
      <button className="btn btn-ghost btn-sm" aria-label={a.status === 'hidden' ? 'Unhide' : 'Hide from everyone'} title={a.status === 'hidden' ? 'Show again' : 'Hide from everyone'}
        onClick={() => run(() => hideAnnouncement(actorUid, a, a.status !== 'hidden'), a.status === 'hidden' ? 'Visible again.' : 'Hidden from all feeds.')}>
        {a.status === 'hidden' ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}
