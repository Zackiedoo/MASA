import { useEffect, useState, type FormEvent } from 'react';
import { EyeOff } from 'lucide-react';
import { Modal } from '../shared/Modal';
import { ProfileAvatar } from '../shared/Avatar';
import { Toggle } from '../shared/Field';
import { ErrorBox } from '../shared/States';
import { createPost, DURATIONS, MAX_POSTS_PER_DAY, postsLeftToday } from '../../services/freedomWallService';
import { explainError } from '../../lib/database';
import { cleanText, hasBlockedWord } from '../../utils/validation';
import { useToast } from '../../contexts/ToastContext';
import type { UserProfile } from '../../types';

export function PostComposer({ open, onClose, profile, requireApproval }: { open: boolean; onClose: () => void; profile: UserProfile; requireApproval: boolean }) {
  const toast = useToast();
  const [text, setText] = useState('');
  const [anon, setAnon] = useState(false);
  const [hours, setHours] = useState<number>(24);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => { if (open) void postsLeftToday(profile.uid).then(setLeft); }, [open, profile.uid]);

  async function submit(e: FormEvent) {
    e.preventDefault(); setErr(null);
    const content = cleanText(text, { multiline: true });
    if (!content) return setErr('Write something first.');
    if (content.length > 500) return setErr('Posts are limited to 500 characters.');
    if (hasBlockedWord(content)) return setErr('Your post contains language that is not allowed on the Freedom Wall.');
    if (left === 0) return setErr(`You have used all ${MAX_POSTS_PER_DAY} posts for today. Your allowance resets at 12:00 am.`);
    setBusy(true);
    try {
      const { pending } = await createPost(profile, content, anon, hours, requireApproval);
      toast(pending ? 'Submitted! Your post will appear once an administrator approves it.' : 'Posted to the Freedom Wall.');
      setText(''); setLeft((n) => (n === null ? n : Math.max(0, n - 1))); onClose();
    } catch (x) { console.error('Freedom Wall post failed', x); setErr(/permission/i.test(String((x as Error)?.message) + String((x as { code?: string })?.code)) ? 'The database refused this post. Possible reasons: you posted again within 30 seconds, you have reached the daily limit of 3 posts, you have not accepted the Freedom Wall terms, or the latest security rules have not been deployed yet (administrator: run firebase deploy --only database).' : explainError(x)); } finally { setBusy(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="New Freedom Wall post">
      <form onSubmit={submit} className="space-y-4">
        {err && <ErrorBox message={err} />}
        <div className="flex items-center gap-3">
          <ProfileAvatar avatar={profile.avatar} color={profile.avatarColor} size={48} />
          <div className="min-w-0"><p className="truncate font-bold">{profile.fullName}</p><p className="text-sm text-muted">Nickname: {profile.nickname}</p></div>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-primary/8 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold"><EyeOff className="h-4 w-4" />Post anonymously</div>
          <Toggle checked={anon} onChange={setAnon} label="Post anonymously" />
        </div>
        {anon && <p className="-mt-2 text-xs text-muted">Other students will see “Anonymous”. Nobody, including administrators, can see who wrote it. Your identity is revealed to administrators only if someone reports the post and a reviewer confirms it broke the rules.</p>}
        <div>
          <label htmlFor="wall-text" className="sr-only">Post text</label>
          <textarea id="wall-text" className="field" rows={5} maxLength={500} value={text} onChange={(e) => setText(e.target.value)} placeholder="What's on your mind?" />
          <p className={`mt-1 text-right text-xs ${text.length > 450 ? 'text-bad' : 'text-muted'}`}>{text.length}/500</p>
        </div>
        <div>
          <label htmlFor="wall-dur" className="mb-1.5 block text-sm font-semibold">Disappears after</label>
          <select id="wall-dur" className="field" value={hours} onChange={(e) => setHours(Number(e.target.value))}>{DURATIONS.map((h) => <option key={h} value={h}>{h} hours</option>)}</select>
        </div>
        {left !== null && <p className={`text-xs ${left === 0 ? 'font-semibold text-bad' : 'text-muted'}`}>{left === 0 ? `Daily limit reached (${MAX_POSTS_PER_DAY} posts). It resets at 12:00 am.` : `${left} of ${MAX_POSTS_PER_DAY} posts left today (resets at 12:00 am).`}</p>}
        {requireApproval && <p className="text-xs text-muted">Posts are reviewed by an administrator before they appear.</p>}
        <div className="flex justify-end gap-2"><button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy || !text.trim() || left === 0}>{busy ? 'Posting…' : 'Post'}</button></div>
      </form>
    </Modal>
  );
}
