import { Link } from 'react-router-dom';
import { VolumeX } from 'lucide-react';
import { useMute } from '../../hooks/useMute';
import { PENALTY_LABEL } from '../../lib/penalty';
import { formatDateTime } from '../../utils/format';

/** Shown to a muted account wherever posting / chatting is blocked. */
export function MuteNotice() {
  const { mute, permanent } = useMute();
  if (!mute) return null;
  return (
    <div role="status" className="mb-4 flex items-start gap-3 rounded-2xl border border-bad/40 bg-bad/10 p-4 text-sm">
      <VolumeX className="mt-0.5 h-5 w-5 shrink-0 text-bad" />
      <div>
        <p className="font-bold">Your account is muted ({PENALTY_LABEL[mute.level]})</p>
        <p className="text-muted">{permanent ? 'You cannot post on the Freedom Wall or send chat messages. You can send an appeal from Profile → Inbox.' : `You cannot post on the Freedom Wall or send chat messages until ${formatDateTime(mute.until)}.`} <Link to="/profile" className="font-semibold text-primary underline">Details</Link></p>
      </div>
    </div>
  );
}
