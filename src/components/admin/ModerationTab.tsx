import { useMemo, useState } from 'react';
import { Check, Eye, EyeOff, Flag, Inbox, Trash2, X } from 'lucide-react';
import { useValue } from '../../hooks/useValue';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { approveQueued, dismissReport, flagPost, hidePost, rejectQueued, removePost, revealIdentity, unhidePost } from '../../services/freedomWallService';
import { explainError } from '../../lib/database';
import { formatDateTime, toList } from '../../utils/format';
import { Segmented } from '../shared/Field';
import { Modal } from '../shared/Modal';
import { Badge, Empty, ErrorBox, Spinner } from '../shared/States';
import type { Report, WallIdentity, WallPost } from '../../types';

type View = 'reports' | 'queue' | 'active' | 'hidden';

export function ModerationTab() {
  const { uid } = useAuth();
  const toast = useToast();
  const [view, setView] = useState<View>('reports');
  const queue = useValue<Record<string, Omit<WallPost, 'id'>>>('freedomWallQueue');
  const posts = useValue<Record<string, Omit<WallPost, 'id'>>>('freedomWall');
  const reports = useValue<Record<string, Omit<Report, 'id'>>>('reports');
  const [who, setWho] = useState<WallIdentity | null | undefined>(undefined);

  const postList = useMemo(() => toList<WallPost>(posts.data).sort((a, b) => b.createdAt - a.createdAt), [posts.data]);
  const queued = useMemo(() => toList<WallPost>(queue.data).filter((p) => p.status === 'pending').sort((a, b) => a.createdAt - b.createdAt), [queue.data]);
  const hiddenList = useMemo(() => toList<WallPost>(queue.data).filter((p) => p.status === 'hidden').sort((a, b) => b.createdAt - a.createdAt), [queue.data]);
  const openReports = useMemo(() => toList<Report>(reports.data).filter((r) => r.status === 'open'), [reports.data]);
  const grouped = useMemo(() => {
    const m = new Map<string, Report[]>();
    openReports.forEach((r) => m.set(r.postId, [...(m.get(r.postId) ?? []), r]));
    return [...m.entries()].map(([postId, rs]) => ({ postId, rs, post: postList.find((p) => p.id === postId) })).sort((a, b) => b.rs.length - a.rs.length);
  }, [openReports, postList]);

  if (!uid) return null;
  const run = async (fn: () => Promise<void>, ok: string) => { try { await fn(); toast(ok); } catch (e) { toast(explainError(e), 'error'); } };
  const reveal = async (id: string) => { try { setWho(await revealIdentity(uid, id)); } catch (e) { toast(explainError(e), 'error'); } };

  return (
    <div className="space-y-4">
      <Segmented label="Moderation views" value={view} onChange={setView} options={[{ value: 'reports', label: `Reported (${grouped.length})` }, { value: 'queue', label: `Pending approval (${queued.length})` }, { value: 'active', label: `Active posts (${postList.length})` }, { value: 'hidden', label: `Hidden (${hiddenList.length})` }]} />
      {(posts.error || reports.error || queue.error) && <ErrorBox message={(posts.error || reports.error || queue.error) as string} />}

      {view === 'reports' && (grouped.length === 0 ? <Empty icon={<Flag className="h-8 w-8" />} title="No open reports" /> : (
        <ul className="space-y-3">{grouped.map(({ postId, rs, post }) => (
          <li key={postId} className="glass card space-y-3 p-4">
            <div className="flex items-center justify-between gap-2"><Badge tone="bad"><Flag className="h-3 w-3" />{rs.length} report{rs.length > 1 ? 's' : ''}</Badge>{post && <span className="text-xs text-muted">{formatDateTime(post.createdAt)}</span>}</div>
            {post ? <p className="whitespace-pre-wrap break-words text-sm"><b>{post.authorLabel}:</b> {post.content}</p> : <p className="text-sm text-muted">This post has already been removed or has expired.</p>}
            <ul className="list-inside list-disc text-xs text-muted">{rs.map((r) => <li key={r.id}>{r.reason}</li>)}</ul>
            <div className="flex flex-wrap gap-2">
              {post && <button className="btn btn-ghost btn-sm" onClick={() => reveal(postId)}><Eye className="h-3.5 w-3.5" />View identity</button>}
              {post && <button className="btn btn-danger btn-sm" onClick={() => { if (confirm('Remove this post?')) void run(() => removePost(uid, post, rs), 'Post removed; reports closed.'); }}><Trash2 className="h-3.5 w-3.5" />Remove post</button>}
              <button className="btn btn-ghost btn-sm" onClick={() => run(async () => { for (const r of rs) await dismissReport(uid, r); }, 'Reports dismissed.')}><Check className="h-3.5 w-3.5" />Dismiss</button>
            </div>
          </li>))}</ul>
      ))}

      {view === 'queue' && (queue.loading ? <Spinner /> : queued.length === 0 ? <Empty icon={<Inbox className="h-8 w-8" />} title="Nothing waiting for approval" hint="Turn on “Require approval” in Settings to review posts before they appear." /> : (
        <ul className="space-y-3">{queued.map((p) => (
          <li key={p.id} className="glass card space-y-3 p-4">
            <p className="text-xs text-muted">{formatDateTime(p.createdAt)} · {p.authorLabel}</p>
            <p className="whitespace-pre-wrap break-words text-sm">{p.content}</p>
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-ghost btn-sm" onClick={() => reveal(p.id)}><Eye className="h-3.5 w-3.5" />Identity</button>
              <button className="btn btn-ghost btn-sm" onClick={() => run(() => rejectQueued(uid, p), 'Rejected.')}><X className="h-3.5 w-3.5" />Reject</button>
              <button className="btn btn-primary btn-sm" onClick={() => run(() => approveQueued(uid, p), 'Approved and published.')}><Check className="h-3.5 w-3.5" />Approve</button>
            </div>
          </li>))}</ul>
      ))}

      {view === 'active' && (posts.loading ? <Spinner /> : postList.length === 0 ? <Empty title="No active posts" /> : (
        <ul className="space-y-2">{postList.map((p) => (
          <li key={p.id} className="glass card flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1"><p className="truncate text-sm"><b>{p.authorLabel}:</b> {p.content}</p><p className="text-xs text-muted">Expires {formatDateTime(p.expiresAt)}</p></div>
            {p.flagged && <Badge tone="warn"><Flag className="h-3 w-3" />Flagged</Badge>}
            <button className="btn btn-ghost btn-sm" aria-label="View identity" onClick={() => reveal(p.id)}><Eye className="h-3.5 w-3.5" /></button>
            <button className="btn btn-ghost btn-sm" aria-label={p.flagged ? 'Unflag post' : 'Flag post'} onClick={() => run(() => flagPost(uid, p, !p.flagged), p.flagged ? 'Flag removed.' : 'Flagged.')}><Flag className={`h-3.5 w-3.5 ${p.flagged ? 'fill-current' : ''}`} /></button>
            <button className="btn btn-ghost btn-sm" aria-label="Hide post" onClick={() => run(() => hidePost(uid, p), 'Post hidden.')}><EyeOff className="h-3.5 w-3.5" /></button>
            <button className="btn btn-danger btn-sm" aria-label="Remove post" onClick={() => { if (confirm('Remove this post?')) void run(() => removePost(uid, p, []), 'Removed.'); }}><Trash2 className="h-3.5 w-3.5" /></button>
          </li>))}</ul>
      ))}

      {view === 'hidden' && (queue.loading ? <Spinner /> : hiddenList.length === 0 ? <Empty icon={<EyeOff className="h-8 w-8" />} title="No hidden posts" hint="Posts you hide stay here, out of sight, until you restore or remove them." /> : (
        <ul className="space-y-2">{hiddenList.map((p) => (
          <li key={p.id} className="glass card flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1"><p className="truncate text-sm"><b>{p.authorLabel}:</b> {p.content}</p><p className="text-xs text-muted">Would expire {formatDateTime(p.expiresAt)}</p></div>
            <button className="btn btn-ghost btn-sm" aria-label="View identity" onClick={() => reveal(p.id)}><Eye className="h-3.5 w-3.5" /></button>
            <button className="btn btn-ghost btn-sm" onClick={() => run(() => unhidePost(uid, p), 'Post restored to the wall.')}>Restore</button>
            <button className="btn btn-danger btn-sm" aria-label="Remove post" onClick={() => { if (confirm('Remove this post permanently?')) void run(() => removePost(uid, p, []), 'Removed.'); }}><Trash2 className="h-3.5 w-3.5" /></button>
          </li>))}</ul>
      ))}

      <Modal open={who !== undefined} onClose={() => setWho(undefined)} title="Post author">
        {who ? <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm"><dt className="text-muted">Name</dt><dd className="font-semibold">{who.fullName}</dd><dt className="text-muted">Student ID</dt><dd className="font-semibold">{who.studentId}</dd></dl> : <p className="text-sm text-muted">No identity record found (the post may have expired).</p>}
        <p className="mt-3 text-xs text-muted">This lookup was recorded in the activity log.</p>
      </Modal>
    </div>
  );
}
