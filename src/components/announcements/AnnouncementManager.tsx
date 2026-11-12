import { useMemo, useState } from 'react';
import { Archive, ArchiveRestore, Pencil, Plus, Trash2 } from 'lucide-react';
import { useValue } from '../../hooks/useValue';
import { useToast } from '../../contexts/ToastContext';
import { AnnouncementComposer } from './AnnouncementComposer';
import { Badge, Empty, ErrorBox, Spinner } from '../shared/States';
import { deleteAnnouncement, setAnnouncementStatus } from '../../services/announcementService';
import { explainError } from '../../lib/database';
import { formatDateTime, toList } from '../../utils/format';
import type { Announcement } from '../../types';

/** List + create/edit/archive/delete. `orgId` limits an organization account to its own posts. */
export function AnnouncementManager({ actorUid, org }: { actorUid: string; org?: { id: string; name: string } }) {
  const toast = useToast();
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
              <Badge tone={a.status === 'published' ? 'ok' : 'muted'}>{a.status === 'published' ? 'Visible' : 'Archived'}</Badge>
              <div className="flex gap-1">
                <button className="btn btn-ghost btn-sm" aria-label="Edit" onClick={() => setEditing(a)}><Pencil className="h-3.5 w-3.5" /></button>
                <button className="btn btn-ghost btn-sm" aria-label={a.status === 'published' ? 'Archive' : 'Restore'} onClick={() => run(() => setAnnouncementStatus(actorUid, a, a.status === 'published' ? 'archived' : 'published'), a.status === 'published' ? 'Archived — hidden from the homepage.' : 'Restored to the homepage.')}>{a.status === 'published' ? <Archive className="h-3.5 w-3.5" /> : <ArchiveRestore className="h-3.5 w-3.5" />}</button>
                <button className="btn btn-ghost btn-sm" aria-label="Delete" onClick={() => { if (confirm(`Delete “${a.title}” permanently?`)) void run(() => deleteAnnouncement(actorUid, a), 'Deleted.'); }}><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {creating && <AnnouncementComposer open onClose={() => setCreating(false)} actorUid={actorUid} org={org} />}
      {editing && <AnnouncementComposer key={editing.id} open onClose={() => setEditing(null)} actorUid={actorUid} org={org} editing={editing} />}
    </div>
  );
}
