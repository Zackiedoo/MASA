import { motion } from 'framer-motion';
import { Clock, Flag, Trash2, UserSearch, VenetianMask } from 'lucide-react';
import type { WallPost } from '../../types';
import { formatDateTime, initials, remaining, timeAgo } from '../../utils/format';
import { Badge } from '../shared/States';

interface Props {
  post: WallPost; now: number; reports: number; isAdmin: boolean; isMine: boolean;
  onReport: () => void; onRemove: () => void; onReveal: () => void; onDeleteOwn: () => void;
}

export function PostCard({ post, now, reports, isAdmin, isMine, onReport, onRemove, onReveal, onDeleteOwn }: Props) {
  return (
    <motion.article layout="position" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass card p-5">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-deep text-sm font-bold text-white" aria-hidden="true">
          {post.anonymous ? <VenetianMask className="h-5 w-5" /> : initials(post.authorLabel)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{post.authorLabel}</p>
          <p className="text-xs text-muted" title={formatDateTime(post.createdAt)}>{timeAgo(post.createdAt, now)}</p>
        </div>
        <Badge tone="muted"><Clock className="h-3 w-3" />{remaining(post.expiresAt, now)}</Badge>
      </div>
      <p className="mt-3 whitespace-pre-wrap break-words leading-relaxed">{post.content}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {!isAdmin && !isMine && <button className="btn btn-ghost btn-sm" onClick={onReport}><Flag className="h-3.5 w-3.5" />Report</button>}
        {isMine && <button className="btn btn-ghost btn-sm" onClick={onDeleteOwn}><Trash2 className="h-3.5 w-3.5" />Delete mine</button>}
        {isAdmin && (
          <>
            {reports > 0 && <Badge tone="bad"><Flag className="h-3 w-3" />{reports} report{reports > 1 ? 's' : ''}</Badge>}
            <button className="btn btn-ghost btn-sm" onClick={onReveal}><UserSearch className="h-3.5 w-3.5" />Identity</button>
            <button className="btn btn-danger btn-sm" onClick={onRemove}><Trash2 className="h-3.5 w-3.5" />Remove</button>
          </>
        )}
      </div>
    </motion.article>
  );
}
