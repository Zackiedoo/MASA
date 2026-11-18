import { useMemo, useState } from 'react';
import { Check, EyeOff, Flag, Gavel, Inbox, MessageSquareWarning, Trash2, X } from 'lucide-react';
import { useValue } from '../../hooks/useValue';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { approveQueued, flagPost, hidePost, rejectQueued, removePost, unhidePost } from '../../services/freedomWallService';
import { explainError } from '../../lib/database';
import { resolveMessageReport, resolvePostReports } from '../../lib/moderationApi';
import { PENALTY_LABEL } from '../../lib/penalty';
import { formatDateTime, toList } from '../../utils/format';
import { Segmented } from '../shared/Field';
import { Modal } from '../shared/Modal';
import { Badge, Empty, ErrorBox, Spinner } from '../shared/States';
import type { AuthorReveal, MessageReport, Report, WallPost } from '../../types';

type View = 'reports' | 'chats' | 'queue' | 'active' | 'hidden';

export function ModerationTab() {
  const { uid } = useAuth();
  const toast = useToast();
  const [view, setView] = useState<View>('reports');
  const queue = useValue<Record<string, Omit<WallPost, 'id'>>>('freedomWallQueue');
  const posts = useValue<Record<string, Omit<WallPost, 'id'>>>('freedomWall');
  const reports = useValue<Record<string, Omit<Report, 'id'>>>('reports');
  const msgReports = useValue<Record<string, Omit<MessageReport, 'id'>>>('messageReports');
  const [outcome, setOutcome] = useState<{ title: string; author: AuthorReveal | null | undefined } | null>(null);
  const openMsgReports = useMemo(() => toList<MessageReport>(msgReports.data).filter((r) => r.status === 'open').sort((a, b) => a.createdAt - b.createdAt), [msgReports.data]);

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
  const decide = async (title: string, fn: () => Promise<{ author?: AuthorReveal | null }>) => { try { const r = await fn(); setOutcome({ title, author: r.author }); } catch (e) { toast(explainError(e), 'error'); } };

  return (
    <div className="space-y-4">
      <Segmented label="Moderation views" value={view} onChange={setView} options={[{ value: 'reports', label: `Reported (${grouped.length})` }, { value: 'chats', label: `Chat reports (${openMsgReports.length})` }, { value: 'queue', label: `Pending approval (${queued.length})` }, { value: 'active', label: `Active posts (${postList.length})` }, { value: 'hidden', label: `Hidden (${hiddenList.length})` }]} />
      {(posts.error || reports.error || queue.error) && <ErrorBox message={(posts.error || reports.error || queue.error) as string} />}

      {view === 'reports' && (grouped.length === 0 ? <Empty icon={<Flag className="h-8 w-8" />} title="No open reports" /> : (
        <ul className="space-y-3">{grouped.map(({ postId, rs, post }) => (
          <li key={postId} className="glass card space-y-3 p-4">
            <div className="flex items-center justify-between gap-2"><Badge tone="bad"><Flag className="h-3 w-3" />{rs.length} report{rs.length > 1 ? 's' : ''}</Badge>{post && <span className="text-xs text-muted">{formatDateTime(post.createdAt)}</span>}</div>
            {post ? <p className="whitespace-pre-wrap break-words text-sm"><b>{post.authorLabel}:</b> {post.content}</p> : <p className="text-sm text-muted">This post has already been removed or has expired.</p>}
            <ul className="list-inside list-disc text-xs text-muted">{rs.map((r) => <li key={r.id}>{r.reason}</li>)}</ul>
            <p className="text-xs text-muted">The author is anonymous. Upholding a report confirms the post broke the rules: the post is removed, the author is revealed to you, and the offence ladder applies (warning → 24 h → 3 days → 7 days → permanent mute).</p>
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-danger btn-sm" onClick={() => { if (confirm('Uphold this report? The post is removed and its author receives a violation.')) void decide('Report upheld', () => resolvePostReports(uid, postId, 'upheld')); }}><Gavel className="h-3.5 w-3.5" />Uphold &amp; penalise</button>
              <button className="btn btn-ghost btn-sm" onClick={() => void decide('Report dismissed', () => resolvePostReports(uid, postId, 'dismissed'))}><Check className="h-3.5 w-3.5" />Dismiss</button>
              {post && <button className="btn btn-ghost btn-sm" onClick={() => run(() => hidePost(uid, post), 'Post hidden while you decide.')}><EyeOff className="h-3.5 w-3.5" />Hide meanwhile</button>}
            </div>
          </li>))}</ul>
      ))}

      {view === 'chats' && (openMsgReports.length === 0 ? <Empty icon={<MessageSquareWarning className="h-8 w-8" />} title="No reported chat messages" hint="Group chats are private. You only ever see a message that a member reports." /> : (
        <ul className="space-y-3">{openMsgReports.map((r) => (
          <li key={r.id} className="glass card space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><Badge tone="bad"><MessageSquareWarning className="h-3 w-3" />{r.subjectCode}</Badge><span className="text-xs text-muted">Reported {formatDateTime(r.createdAt)}</span></div>
            {r.context && r.context.length > 0 && <div className="space-y-1 rounded-2xl bg-primary/6 p-3 text-xs text-muted">{r.context.map((c, i) => <p key={i}><b>{c.senderName}:</b> {c.content}</p>)}</div>}
            <p className="whitespace-pre-wrap break-words rounded-2xl border-2 border-bad/40 p-3 text-sm"><b>{r.snapshot.senderName}:</b> {r.snapshot.content}</p>
            <p className="text-xs text-muted">Reason given: {r.reason}</p>
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-danger btn-sm" onClick={() => { if (confirm('Uphold? The message is deleted and its sender receives a violation.')) void decide('Report upheld', () => resolveMessageReport(uid, r.id, 'upheld')); }}><Gavel className="h-3.5 w-3.5" />Uphold &amp; penalise</button>
              <button className="btn btn-ghost btn-sm" onClick={() => void decide('Report dismissed', () => resolveMessageReport(uid, r.id, 'dismissed'))}><Check className="h-3.5 w-3.5" />Dismiss</button>
            </div>
          </li>))}</ul>
      ))}

      {view === 'queue' && (queue.loading ? <Spinner /> : queued.length === 0 ? <Empty icon={<Inbox className="h-8 w-8" />} title="Nothing waiting for approval" hint="Turn on “Require approval” in Settings to review posts before they appear." /> : (
        <ul className="space-y-3">{queued.map((p) => (
          <li key={p.id} className="glass card space-y-3 p-4">
            <p className="text-xs text-muted">{formatDateTime(p.createdAt)} · {p.authorLabel}</p>
            <p className="whitespace-pre-wrap break-words text-sm">{p.content}</p>
            <div className="flex flex-wrap gap-2">
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
            <button className="btn btn-ghost btn-sm" aria-label={p.flagged ? 'Unflag post' : 'Flag post'} onClick={() => run(() => flagPost(uid, p, !p.flagged), p.flagged ? 'Flag removed.' : 'Flagged.')}><Flag className={`h-3.5 w-3.5 ${p.flagged ? 'fill-current' : ''}`} /></button>
            <button className="btn btn-ghost btn-sm" aria-label="Hide post" onClick={() => run(() => hidePost(uid, p), 'Post hidden.')}><EyeOff className="h-3.5 w-3.5" /></button>
            <button className="btn btn-danger btn-sm" aria-label="Remove post" onClick={() => { if (confirm('Remove this post?')) void run(() => removePost(uid, p, []), 'Removed.'); }}><Trash2 className="h-3.5 w-3.5" /></button>
          </li>))}</ul>
      ))}

      {view === 'hidden' && (queue.loading ? <Spinner /> : hiddenList.length === 0 ? <Empty icon={<EyeOff className="h-8 w-8" />} title="No hidden posts" hint="Posts you hide stay here, out of sight, until you restore or remove them." /> : (
        <ul className="space-y-2">{hiddenList.map((p) => (
          <li key={p.id} className="glass card flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1"><p className="truncate text-sm"><b>{p.authorLabel}:</b> {p.content}</p><p className="text-xs text-muted">Would expire {formatDateTime(p.expiresAt)}</p></div>
            <button className="btn btn-ghost btn-sm" onClick={() => run(() => unhidePost(uid, p), 'Post restored to the wall.')}>Restore</button>
            <button className="btn btn-danger btn-sm" aria-label="Remove post" onClick={() => { if (confirm('Remove this post permanently?')) void run(() => removePost(uid, p, []), 'Removed.'); }}><Trash2 className="h-3.5 w-3.5" /></button>
          </li>))}</ul>
      ))}

      <Modal open={!!outcome} onClose={() => setOutcome(null)} title={outcome?.title ?? ''}>
        {outcome?.author ? (
          <div className="space-y-2 text-sm">
            <p>The author has been notified in their inbox.</p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-2xl bg-primary/6 p-3"><dt className="text-muted">Name</dt><dd className="font-semibold">{outcome.author.fullName}</dd><dt className="text-muted">User ID</dt><dd className="font-semibold">{outcome.author.studentId}</dd><dt className="text-muted">Offence</dt><dd className="font-semibold">#{outcome.author.offence}</dd><dt className="text-muted">Penalty</dt><dd className="font-semibold">{PENALTY_LABEL[outcome.author.penalty]}</dd></dl>
            <p className="text-xs text-muted">This is saved in the account's violation history (Users → Violations). The identity is only shown because the report was upheld.</p>
          </div>
        ) : <p className="text-sm">Done. People who reported have been told the outcome in their inbox.</p>}
      </Modal>
    </div>
  );
}
