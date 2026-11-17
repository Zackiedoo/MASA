import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from '../shared/Modal';
import { ErrorBox } from '../shared/States';
import { editOwnPost } from '../../services/freedomWallService';
import { explainError } from '../../lib/database';
import { cleanText, hasBlockedWord } from '../../utils/validation';
import { useToast } from '../../contexts/ToastContext';
import type { WallPost } from '../../types';

/** A student edits the text of their own Freedom Wall post. The post keeps its original expiry time. */
export function EditPostModal({ post, onClose }: { post: WallPost | null; onClose: () => void }) {
  const toast = useToast();
  const [text, setText] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setText(post?.content ?? ''); setErr(null); }, [post]);

  async function submit(e: FormEvent) {
    e.preventDefault(); if (!post) return; setErr(null);
    const content = cleanText(text, { multiline: true });
    if (!content) return setErr('A post cannot be empty.');
    if (content.length > 500) return setErr('Posts are limited to 500 characters.');
    if (hasBlockedWord(content)) return setErr('Your post contains language that is not allowed on the Freedom Wall.');
    if (content === post.content) return onClose();
    setBusy(true);
    try { await editOwnPost(post.id, content); toast('Post updated.'); onClose(); } catch (x) { setErr(explainError(x)); } finally { setBusy(false); }
  }

  return (
    <Modal open={!!post} onClose={onClose} title="Edit your post">
      <form onSubmit={submit} className="space-y-4">
        {err && <ErrorBox message={err} />}
        <div>
          <label htmlFor="wall-edit" className="sr-only">Post text</label>
          <textarea id="wall-edit" className="field" rows={5} maxLength={500} value={text} onChange={(e) => setText(e.target.value)} />
          <p className={`mt-1 text-right text-xs ${text.length > 450 ? 'text-bad' : 'text-muted'}`}>{text.length}/500</p>
        </div>
        <div className="flex justify-end gap-2"><button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy || !text.trim()}>{busy ? 'Saving…' : 'Save'}</button></div>
      </form>
    </Modal>
  );
}
