import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, ExternalLink, FileText, Paperclip, Share2 } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Announcement, Organization } from '../../types';
import { SourceAvatar } from '../shared/Avatar';
import { Badge } from '../shared/States';
import { useToast } from '../../contexts/ToastContext';
import { formatDateTime, timeAgo } from '../../utils/format';
import { isHttpUrl } from '../../utils/validation';

const LONG = 320;

export function AnnouncementCard({ a, org, full }: { a: Announcement; org?: Organization; full?: boolean }) {
  const toast = useToast();
  const [open, setOpen] = useState(!!full);
  const isOffice = a.sourceType !== 'organization';
  const verified = isOffice || !!org?.verified;
  const long = a.content.length > LONG;
  const images = (a.attachments ?? []).filter((x) => x.type === 'image' && isHttpUrl(x.url) || x.type === 'image' && x.url.startsWith('data:image/'));
  const files = (a.attachments ?? []).filter((x) => x.type === 'file');

  async function share() {
    const url = `${location.origin}/a/${a.id}`;
    try {
      if (navigator.share) await navigator.share({ title: a.title, text: a.content.slice(0, 120), url });
      else { await navigator.clipboard.writeText(url); toast('Link copied to clipboard.'); }
    } catch (e) {
      if ((e as DOMException)?.name !== 'AbortError') toast('Could not share this announcement.', 'error');
    }
  }

  return (
    <motion.article layout="position" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass card p-5">
      <div className="flex items-start gap-3">
        <SourceAvatar name={a.sourceName} logo={org?.logo} office={isOffice} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1.5">
            <span className="truncate font-bold">{a.sourceName}</span>
            {verified && <BadgeCheck className="h-4 w-4 shrink-0 text-gold" aria-label="Verified" />}
          </div>
          <p className="text-xs text-muted"><time dateTime={new Date(a.createdAt).toISOString()} title={formatDateTime(a.createdAt)}>{formatDateTime(a.createdAt)}</time> · {timeAgo(a.createdAt)}</p>
        </div>
        {a.memoId && <Badge tone="maroon"><FileText className="h-3 w-3" />Memo</Badge>}
      </div>

      <h2 className="mt-4 text-lg font-bold leading-snug"><Link to={`/a/${a.id}`} className="hover:underline">{a.title}</Link></h2>
      <p className={`mt-2 whitespace-pre-wrap break-words text-[0.95rem] leading-relaxed ${!open && long ? 'line-clamp-5' : ''}`}>{a.content}</p>
      {long && !full && <button className="mt-1 text-sm font-semibold text-link" onClick={() => setOpen((o) => !o)}>{open ? 'Show less' : 'Read more'}</button>}

      {images.length > 0 && (
        <div className={`mt-4 grid gap-2 ${images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {images.map((im, i) => (
            <a key={i} href={im.url} target="_blank" rel="noopener noreferrer" className="overflow-hidden rounded-2xl">
              <img src={im.url} alt={im.name} loading="lazy" className="max-h-80 w-full object-cover transition-transform hover:scale-[1.02]" />
            </a>
          ))}
        </div>
      )}
      {files.length > 0 && (
        <ul className="mt-3 space-y-2">
          {files.filter((f) => isHttpUrl(f.url) || f.url.startsWith('data:')).map((f, i) => (
            <li key={i}><a href={f.url} target="_blank" rel="noopener noreferrer" download={f.url.startsWith('data:') ? f.name : undefined} className="flex items-center gap-2 rounded-2xl border border-[rgb(var(--line))] bg-bg/60 px-3 py-2 text-sm font-semibold hover:bg-primary/8"><Paperclip className="h-4 w-4 text-primary" /><span className="truncate">{f.name}</span></a></li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex items-center justify-between gap-2">
        {a.link && isHttpUrl(a.link) ? (
          <a href={a.link} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm"><ExternalLink className="h-3.5 w-3.5" />Open link</a>
        ) : <span />}
        <button className="btn btn-ghost btn-sm" onClick={share} aria-label={`Share “${a.title}”`}><Share2 className="h-3.5 w-3.5" />Share</button>
      </div>
    </motion.article>
  );
}
