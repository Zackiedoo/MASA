import { useState, type FormEvent } from 'react';
import { EyeOff } from 'lucide-react';
import { Modal } from '../shared/Modal';
import { ProfileAvatar } from '../shared/Avatar';
import { Toggle } from '../shared/Field';
import { ErrorBox } from '../shared/States';
import { createPost, DURATIONS } from '../../services/freedomWallService';
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

  async function submit(e: FormEvent) {
    e.preventDefault(); setErr(null);
    const content = cleanText(text, { multiline: true });
    if (!content) return setErr('Write something first.');
    if (content.length > 500) return setErr('Posts are limited to 500 characters.');
    if (hasBlockedWord(content)) return setErr('Your post contains language that is not allowed on the Freedom Wall.');
    setBusy(true);
    try {
      const { pending } = await createPost(profile, content, anon, hours, requireApproval);
      toast(pending ? 'Submitted! Your post will appear once an administrator approves it.' : 'Posted to the Freedom Wall.');
      setText(''); onClose();
    } catch (x) { setErr(explainError(x)); } finally { setBusy(false); }
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
        {anon && <p className="-mt-2 text-xs text-muted">Other students will see “Anonymous”. School administrators can still identify the author for moderation and safety.</p>}
        <div>
          <label htmlFor="wall-text" className="sr-only">Post text</label>
          <textarea id="wall-text" className="field" rows={5} maxLength={500} value={text} onChange={(e) => setText(e.target.value)} placeholder="What's on your mind?" />
          <p className={`mt-1 text-right text-xs ${text.length > 450 ? 'text-bad' : 'text-muted'}`}>{text.length}/500</p>
        </div>
        <div>
          <label htmlFor="wall-dur" className="mb-1.5 block text-sm font-semibold">Disappears after</label>
          <select id="wall-dur" className="field" value={hours} onChange={(e) => setHours(Number(e.target.value))}>{DURATIONS.map((h) => <option key={h} value={h}>{h} hours</option>)}</select>
        </div>
        {requireApproval && <p className="text-xs text-muted">Posts are reviewed by an administrator before they appear.</p>}
        <div className="flex justify-end gap-2"><button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy || !text.trim()}>{busy ? 'Posting…' : 'Post'}</button></div>
      </form>
    </Modal>
  );
}
