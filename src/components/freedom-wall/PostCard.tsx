import { motion } from 'framer-motion';
import { Clock, EyeOff, Flag, Pencil, ThumbsDown, ThumbsUp, Trash2, UserSearch, VenetianMask } from 'lucide-react';
import type { WallPost } from '../../types';
import { formatDateTime, initials, remaining, timeAgo } from '../../utils/format';
import { Badge } from '../shared/States';

interface Props {
  post: WallPost; now: number; reports: number;
  /** administrator tools (identity lookup, flag, hide, remove) */
  isAdmin: boolean;
  /** this post belongs to the signed-in student */
  isMine: boolean;
  /** signed-in account may report other people's posts (students only) */
  canReport: boolean;
  /** the author may edit in place (students, and only while moderation-first mode is off) */
  canEdit: boolean;
  /** my vote on this post: 1 like, -1 dislike, 0 none; omit onVote for view-only accounts */
  myVote?: 1 | -1 | 0; onVote?: (choice: 1 | -1) => void;
  onReport: () => void; onRemove: () => void; onReveal: () => void; onDeleteOwn: () => void; onEdit: () => void; onHide: () => void; onFlag: () => void;
}

export function PostCard({ post, now, reports, isAdmin, isMine, canReport, canEdit, myVote = 0, onVote, onReport, onRemove, onReveal, onDeleteOwn, onEdit, onHide, onFlag }: Props) {
  return (
    <motion.article layout="position" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass card p-5">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-deep text-sm font-bold text-white" aria-hidden="true">
          {post.anonymous ? <VenetianMask className="h-5 w-5" /> : initials(post.authorLabel)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{post.authorLabel}</p>
          <p className="text-xs text-muted" title={formatDateTime(post.createdAt)}>{timeAgo(post.createdAt, now)}{post.editedAt ? ' · edited' : ''}</p>
        </div>
        {isAdmin && post.flagged && <Badge tone="warn"><Flag className="h-3 w-3" />Flagged</Badge>}
        <Badge tone="muted"><Clock className="h-3 w-3" />{remaining(post.expiresAt, now)}</Badge>
      </div>
      <p className="mt-3 whitespace-pre-wrap break-words leading-relaxed">{post.content}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button className="btn btn-ghost btn-sm" disabled={!onVote} aria-pressed={myVote === 1} aria-label={`Like (${post.likes ?? 0})`} onClick={() => onVote?.(1)}><ThumbsUp className={`h-3.5 w-3.5 ${myVote === 1 ? 'fill-current text-primary' : ''}`} />{post.likes ?? 0}</button>
        <button className="btn btn-ghost btn-sm" disabled={!onVote} aria-pressed={myVote === -1} aria-label={`Dislike (${post.dislikes ?? 0})`} onClick={() => onVote?.(-1)}><ThumbsDown className={`h-3.5 w-3.5 ${myVote === -1 ? 'fill-current text-primary' : ''}`} />{post.dislikes ?? 0}</button>
        {canReport && !isMine && <button className="btn btn-ghost btn-sm" onClick={onReport}><Flag className="h-3.5 w-3.5" />Report</button>}
        {isMine && canEdit && <button className="btn btn-ghost btn-sm" onClick={onEdit}><Pencil className="h-3.5 w-3.5" />Edit</button>}
        {isMine && <button className="btn btn-ghost btn-sm" onClick={onDeleteOwn}><Trash2 className="h-3.5 w-3.5" />Delete mine</button>}
        {isAdmin && (
          <>
            {reports > 0 && <Badge tone="bad"><Flag className="h-3 w-3" />{reports} report{reports > 1 ? 's' : ''}</Badge>}
            <button className="btn btn-ghost btn-sm" onClick={onReveal}><UserSearch className="h-3.5 w-3.5" />Identity</button>
            <button className="btn btn-ghost btn-sm" onClick={onFlag}><Flag className={`h-3.5 w-3.5 ${post.flagged ? 'fill-current' : ''}`} />{post.flagged ? 'Unflag' : 'Flag'}</button>
            <button className="btn btn-ghost btn-sm" onClick={onHide}><EyeOff className="h-3.5 w-3.5" />Hide</button>
            <button className="btn btn-danger btn-sm" onClick={onRemove}><Trash2 className="h-3.5 w-3.5" />Remove</button>
          </>
        )}
      </div>
    </motion.article>
  );
}
