import { useAuth } from '../contexts/AuthContext';
import { useValue } from './useValue';
import { useNow } from './useNow';
import type { MuteRecord } from '../types';

/** The signed-in user's current mute (from an upheld violation), if any. Expired mutes count as none. */
export function useMute() {
  const { uid } = useAuth();
  const m = useValue<MuteRecord>(uid ? `mutes/${uid}` : null);
  const now = useNow(30000);
  const active = !!m.data && m.data.until > now ? m.data : null;
  return { mute: active, permanent: active?.level === 'permanent' };
}
