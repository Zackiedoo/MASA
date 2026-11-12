export const cx = (...a: Array<string | false | null | undefined>) => a.filter(Boolean).join(' ');

/** Turns a Firebase object map into an array, copying the key into `id`. */
export function toList<T>(obj: Record<string, unknown> | null | undefined): Array<T & { id: string }> {
  if (!obj) return [];
  return Object.entries(obj).map(([id, v]) => ({ ...(v as object), id }) as T & { id: string });
}

export const formatDateTime = (ts: number) =>
  new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

export function timeAgo(ts: number, now = Date.now()) {
  const s = Math.max(0, Math.floor((now - ts) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function remaining(expiresAt: number, now = Date.now()) {
  const ms = expiresAt - now;
  if (ms <= 0) return 'expired';
  const m = Math.ceil(ms / 60000);
  if (m < 60) return `${m}m left`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m left`;
}

export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?';

export function formatTime12(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${ap}`;
}
export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export const DAY_NAMES: Record<string, string> = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };
