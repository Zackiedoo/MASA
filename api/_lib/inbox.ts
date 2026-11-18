// In-app inbox + (optional) phone push, in one call. Inbox items live at /inbox/{uid}/{id}; users can read their own and
// mark them read, but only the server writes them.
import { adminDb } from './admin.js';
import { pushToUsers, type Topic } from './push.js';

export type InboxKind = 'violation' | 'mute' | 'appeal' | 'report' | 'account' | 'request' | 'schedule' | 'update';
export interface InboxItem { kind: InboxKind; title: string; body: string; link?: string }

/** Writes the message into each user's inbox and sends a push. Never throws (a failed notice must not undo the action that caused it). */
export async function deliver(uids: string[], item: InboxItem, topic: Topic = 'account', opts: { allowInactive?: boolean } = {}): Promise<void> {
  const unique = [...new Set(uids)].filter(Boolean);
  if (!unique.length) return;
  try {
    const ups: Record<string, unknown> = {};
    const now = Date.now();
    for (const uid of unique) {
      const id = adminDb().ref(`inbox/${uid}`).push().key as string;
      ups[`inbox/${uid}/${id}`] = { kind: item.kind, title: item.title.slice(0, 120), body: item.body.slice(0, 1500), createdAt: now, read: false, ...(item.link ? { link: item.link } : {}) };
    }
    await adminDb().ref().update(ups);
  } catch (e) { console.error('inbox write failed', e); }
  try { await pushToUsers(unique, topic, { title: item.title, body: item.body, link: item.link || '/profile' }, opts); } catch (e) { console.error('push failed', e); }
}
