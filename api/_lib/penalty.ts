// Offence ladder (also mirrored in src/lib/penalty.ts for the demo mode):
//   1st upheld violation → written warning only
//   2nd → 24-hour mute · 3rd → 3-day mute · 4th → 7-day mute · 5th and beyond → permanent mute (appeal required)
export type Penalty = 'warning' | '24h' | '3d' | '7d' | 'permanent';
const DAY = 86400000;
export const PERMANENT_UNTIL = 9999999999999;
export const APPEAL_COOLDOWN_MS = 30 * DAY;

export function penaltyFor(offenceNumber: number): { penalty: Penalty; until: number | null } {
  const now = Date.now();
  if (offenceNumber <= 1) return { penalty: 'warning', until: null };
  if (offenceNumber === 2) return { penalty: '24h', until: now + DAY };
  if (offenceNumber === 3) return { penalty: '3d', until: now + 3 * DAY };
  if (offenceNumber === 4) return { penalty: '7d', until: now + 7 * DAY };
  return { penalty: 'permanent', until: PERMANENT_UNTIL };
}
export const PENALTY_TEXT: Record<Penalty, string> = {
  warning: 'This is a written warning. Your next upheld violation will mute your account for 24 hours.',
  '24h': 'Your account is muted for 24 hours: you cannot post on the Freedom Wall or send chat messages until then.',
  '3d': 'Your account is muted for 3 days: you cannot post on the Freedom Wall or send chat messages until then.',
  '7d': 'Your account is muted for 7 days: you cannot post on the Freedom Wall or send chat messages until then. The next violation is a permanent mute.',
  permanent: 'Your account is permanently muted. You can send one appeal from Profile → Inbox.',
};
