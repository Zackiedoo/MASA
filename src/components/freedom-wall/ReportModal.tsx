import { useState, type FormEvent } from 'react';
import { Modal } from '../shared/Modal';
import { ErrorBox } from '../shared/States';
import { reportPost } from '../../services/freedomWallService';
import { explainError } from '../../lib/database';
import { useToast } from '../../contexts/ToastContext';
import { cleanText } from '../../utils/validation';

const REASONS = ['Harassment or bullying', 'Hate speech', 'Sexual content', 'Threats or violence', 'Personal information', 'Spam', 'False information', 'Other'];

export function ReportModal({ postId, uid, onClose }: { postId: string | null; uid: string; onClose: () => void }) {
  const toast = useToast();
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!postId) return;
    setBusy(true); setErr(null);
    try {
      await reportPost(uid, postId, `${reason}${details.trim() ? ` — ${cleanText(details).slice(0, 200)}` : ''}`);
      toast('Thanks — an administrator will review this post.'); setDetails(''); onClose();
    } catch (x) { setErr(x instanceof Error && x.message.startsWith('You already') ? x.message : explainError(x)); } finally { setBusy(false); }
  }
  return (
    <Modal open={!!postId} onClose={onClose} title="Report post">
      <form onSubmit={submit} className="space-y-4">
        {err && <ErrorBox message={err} />}
        <div><label htmlFor="rep-reason" className="mb-1.5 block text-sm font-semibold">Reason</label><select id="rep-reason" className="field" value={reason} onChange={(e) => setReason(e.target.value)}>{REASONS.map((r) => <option key={r}>{r}</option>)}</select></div>
        <div><label htmlFor="rep-details" className="mb-1.5 block text-sm font-semibold">Details (optional)</label><textarea id="rep-details" className="field min-h-20" maxLength={200} value={details} onChange={(e) => setDetails(e.target.value)} /></div>
        <div className="flex justify-end gap-2"><button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy}>{busy ? 'Sending…' : 'Submit report'}</button></div>
      </form>
    </Modal>
  );
}
