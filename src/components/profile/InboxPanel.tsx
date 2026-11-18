import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Bell, CheckCheck, FileCheck2, Flag, Gavel, Megaphone, ShieldCheck, Trash2, UserCheck, Volume2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useValue } from '../../hooks/useValue';
import { useMute } from '../../hooks/useMute';
import { patch, explainError, stamp } from '../../lib/database';
import { PENALTY_LABEL } from '../../lib/penalty';
import { formatDateTime, timeAgo, toList } from '../../utils/format';
import { Empty, Spinner } from '../shared/States';
import type { Appeal, InboxItem, InboxKind } from '../../types';

const ICON: Record<InboxKind, typeof Bell> = { violation: AlertTriangle, mute: Gavel, appeal: FileCheck2, report: Flag, account: UserCheck, request: ShieldCheck, schedule: Bell, update: Megaphone };

/** Profile → Inbox: system messages (violations, mutes, appeals, reports, requests, password resets, updates). */
export function InboxPanel() {
  const { uid } = useAuth();
  const toast = useToast();
  const raw = useValue<Record<string, Omit<InboxItem, 'id'>>>(uid ? `inbox/${uid}` : null, { limitLast: 100, orderBy: 'createdAt' });
  const items = useMemo(() => toList<InboxItem>(raw.data).sort((a, b) => b.createdAt - a.createdAt), [raw.data]);
  const [open, setOpen] = useState<string | null>(null);
  if (!uid) return null;
  const mark = (id: string) => patch({ [`inbox/${uid}/${id}/read`]: true }).catch(() => undefined);
  const markAll = async () => { const ups: Record<string, unknown> = {}; items.filter((i) => i.read !== true).forEach((i) => { ups[`inbox/${uid}/${i.id}/read`] = true; }); if (Object.keys(ups).length) await patch(ups).catch((e) => toast(explainError(e), 'error')); };
  const remove = async (id: string) => { try { await patch({ [`inbox/${uid}/${id}`]: null }); } catch (e) { toast(explainError(e), 'error'); } };
  const unread = items.filter((i) => i.read !== true).length;

  return (
    <div className="space-y-4">
      <MuteAndAppeal uid={uid} />
      <div className="flex items-center justify-between gap-2 px-1"><p className="text-sm text-muted">{unread ? `${unread} unread` : 'All caught up'}</p>{unread > 0 && <button className="btn btn-ghost btn-sm" onClick={markAll}><CheckCheck className="h-4 w-4" />Mark all as read</button>}</div>
      {raw.loading ? <Spinner /> : items.length === 0 ? <Empty icon={<Bell className="h-8 w-8" />} title="Your inbox is empty" hint="Report results, request decisions, password resets, warnings and MASA updates arrive here." /> : (
        <ul className="space-y-2">
          {items.map((i) => {
            const Icon = ICON[i.kind] ?? Bell;
            const expanded = open === i.id;
            const bad = i.kind === 'violation' || i.kind === 'mute';
            return (
              <li key={i.id} className={`glass card p-4 ${i.read !== true ? 'ring-2 ring-[#ff1f3d]/40' : ''}`}>
                <button className="flex w-full items-start gap-3 text-left" aria-expanded={expanded} onClick={() => { setOpen(expanded ? null : i.id); if (i.read !== true) void mark(i.id); }}>
                  <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full ${bad ? 'bg-bad/15 text-bad' : 'bg-primary/10 text-primary'}`}><Icon className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2"><span className="truncate font-bold">{i.title}</span>{i.read !== true && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#ff1f3d]" aria-label="Unread" />}</span>
                    <span className={`block text-sm text-muted ${expanded ? 'whitespace-pre-wrap' : 'line-clamp-2'}`}>{i.body}</span>
                    <span className="mt-1 block text-xs text-muted" title={formatDateTime(i.createdAt)}>{timeAgo(i.createdAt)}</span>
                  </span>
                </button>
                {expanded && <div className="mt-3 flex flex-wrap justify-end gap-2">{i.link && <Link to={i.link} className="btn btn-ghost btn-sm">Open</Link>}<button className="btn btn-ghost btn-sm" onClick={() => remove(i.id)}><Trash2 className="h-3.5 w-3.5" />Delete</button></div>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Mute status plus the appeal form (appeals are for permanent mutes: one at a time, and a 30-day wait after a denial). */
function MuteAndAppeal({ uid }: { uid: string }) {
  const { mute, permanent } = useMute();
  const toast = useToast();
  const appeal = useValue<Appeal>(`appeals/${uid}`);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  if (!mute) return null;
  const a = appeal.data;
  const waitUntil = a?.status === 'denied' && a.nextAllowedAt && a.nextAllowedAt > Date.now() ? a.nextAllowedAt : null;
  const send = async () => {
    setBusy(true);
    try { await patch({ [`appeals/${uid}`]: { reason: text.trim(), createdAt: stamp(), status: 'pending' } }); setText(''); toast('Appeal sent. You will hear back in your inbox.'); }
    catch (e) { toast(/permission/i.test(String(e)) ? 'You cannot send an appeal right now.' : explainError(e), 'error'); }
    finally { setBusy(false); }
  };
  return (
    <section className="glass card space-y-3 border border-bad/40 p-5">
      <div className="flex items-center gap-2 font-bold"><Volume2 className="h-5 w-5 text-bad" />Your account is muted: {PENALTY_LABEL[mute.level]}</div>
      <p className="text-sm text-muted">{permanent ? 'You cannot post on the Freedom Wall or send chat messages.' : `You cannot post on the Freedom Wall or send chat messages until ${formatDateTime(mute.until)}. It lifts automatically.`}</p>
      {permanent && (a?.status === 'pending' ? <p className="rounded-2xl bg-primary/8 p-3 text-sm">Your appeal was sent {timeAgo(a.createdAt)} and is waiting for an administrator.</p>
        : waitUntil ? <p className="rounded-2xl bg-primary/8 p-3 text-sm">Your last appeal was denied{a?.response ? `: “${a.response}”` : ''}. You may appeal again after {formatDateTime(waitUntil)}.</p>
        : (
          <div className="space-y-2">
            <label htmlFor="appeal" className="text-sm font-semibold">Appeal this mute</label>
            <textarea id="appeal" className="field" rows={4} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Explain why your privileges should be restored (at least 10 characters)." />
            <p className="text-xs text-muted">One appeal at a time. If it is denied you can appeal again after 30 days.</p>
            <button className="btn btn-primary btn-sm" disabled={busy || text.trim().length < 10} onClick={send}>{busy ? 'Sending…' : 'Send appeal'}</button>
          </div>
        ))}
    </section>
  );
}
