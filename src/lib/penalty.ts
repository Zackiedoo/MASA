// Offence ladder (mirrors api/_lib/penalty.ts):
//   1st upheld violation → written warning · 2nd → 24-hour mute · 3rd → 3 days · 4th → 7 days · 5th+ → permanent (appeal required)
import type { PenaltyLevel } from '../types';
const DAY = 86400000;
export const PERMANENT_UNTIL = 9999999999999;
export const APPEAL_COOLDOWN_MS = 30 * DAY;

export function penaltyFor(n: number): { penalty: PenaltyLevel; until: number | null } {
  const now = Date.now();
  if (n <= 1) return { penalty: 'warning', until: null };
  if (n === 2) return { penalty: '24h', until: now + DAY };
  if (n === 3) return { penalty: '3d', until: now + 3 * DAY };
  if (n === 4) return { penalty: '7d', until: now + 7 * DAY };
  return { penalty: 'permanent', until: PERMANENT_UNTIL };
}
export const PENALTY_LABEL: Record<PenaltyLevel, string> = { warning: 'Warning', '24h': '24-hour mute', '3d': '3-day mute', '7d': '7-day mute', permanent: 'Permanent mute' };
export const isMuted = (m: { until: number } | null | undefined, now = Date.now()) => !!m && m.until > now;
