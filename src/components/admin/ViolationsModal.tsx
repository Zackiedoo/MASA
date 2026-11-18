import { useMemo } from 'react';
import { Gavel, Volume2 } from 'lucide-react';
import { Modal } from '../shared/Modal';
import { Badge, Spinner } from '../shared/States';
import { useValue } from '../../hooks/useValue';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { explainError } from '../../lib/database';
import { liftMute } from '../../lib/moderationApi';
import { PENALTY_LABEL } from '../../lib/penalty';
import { formatDateTime, toList } from '../../utils/format';
import type { Appeal, MuteRecord, UserProfile, Violation } from '../../types';

/** Admin-only history of an account's upheld violations, current mute and appeal. Only upheld reports ever appear here. */
export function ViolationsModal({ user, onClose }: { user: UserProfile; onClose: () => void }) {
  const { uid: me } = useAuth();
  const toast = useToast();
  const v = useValue<Record<string, Omit<Violation, 'id'>>>(`violations/${user.uid}`);
  const mute = useValue<MuteRecord>(`mutes/${user.uid}`);
  const appeal = useValue<Appeal>(`appeals/${user.uid}`);
  const list = useMemo(() => toList<Violation>(v.data).sort((a, b) => b.at - a.at), [v.data]);
  const muted = !!mute.data && mute.data.until > Date.now();

  return (
    <Modal open onClose={onClose} title={`Violations · ${user.fullName}`} wide>
      {v.loading ? <Spinner /> : (
        <div className="space-y-4">
          {muted && mute.data && (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-bad/40 bg-bad/10 p-3 text-sm">
              <Volume2 className="h-4 w-4 text-bad" /><span className="flex-1"><b>{PENALTY_LABEL[mute.data.level]}</b>{mute.data.level === 'permanent' ? '' : ` until ${formatDateTime(mute.data.until)}`}</span>
              <button className="btn btn-ghost btn-sm" onClick={async () => { if (!me || !confirm('End this mute now?')) return; try { await liftMute(me, user.uid); toast('Mute lifted.'); } catch (e) { toast(explainError(e), 'error'); } }}>Lift mute</button>
            </div>
          )}
          {appeal.data && <p className="rounded-2xl bg-primary/6 p-3 text-sm"><b>Appeal ({appeal.data.status}):</b> {appeal.data.reason}</p>}
          {list.length === 0 ? <p className="py-6 text-center text-sm text-muted">No upheld violations. This account has a clean record.</p> : (
            <ol className="space-y-2">{list.map((x) => (
              <li key={x.id} className="rounded-2xl border border-[rgb(var(--line))] bg-bg/60 p-3 text-sm">
                <div className="mb-1 flex flex-wrap items-center gap-2"><Badge tone="bad"><Gavel className="h-3 w-3" />Offence {x.offence}</Badge><Badge tone="warn">{PENALTY_LABEL[x.penalty]}</Badge><Badge tone="muted">{x.source === 'wall' ? 'Freedom Wall' : 'Group chat'}</Badge><span className="text-xs text-muted">{formatDateTime(x.at)}</span></div>
                <p className="whitespace-pre-wrap break-words">“{x.excerpt}”</p>
              </li>))}</ol>
          )}
          <p className="text-xs text-muted">This history is hidden from the user's profile page, but they receive an inbox message for every violation.</p>
        </div>
      )}
    </Modal>
  );
}
