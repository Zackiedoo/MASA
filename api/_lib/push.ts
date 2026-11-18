// Sends web-push notifications through Firebase Cloud Messaging. Device tokens live in /pushTokens/{uid}/{key}
// (written by each user's own browser); only this server reads them.
import { getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { adminDb } from './admin.js';

/** 'account' and 'admin' notices always go out; the other topics can be muted per user in Settings. */
export type Topic = 'announcements' | 'messages' | 'classes' | 'account' | 'admin';
export interface Payload { title: string; body: string; link: string }

const MUTABLE: Topic[] = ['announcements', 'messages', 'classes'];

/** Notifies specific users. Skips anyone who muted this topic or whose account is not active (unless `allowInactive`). */
export async function pushToUsers(uids: string[], topic: Topic, p: Payload, opts: { allowInactive?: boolean } = {}): Promise<number> {
  const db = adminDb();
  const unique = [...new Set(uids)].filter(Boolean);
  const targets: { token: string; uid: string; key: string }[] = [];
  await Promise.all(unique.map(async (uid) => {
    const [tokens, prefs, active] = await Promise.all([
      db.ref(`pushTokens/${uid}`).get(),
      MUTABLE.includes(topic) ? db.ref(`pushPrefs/${uid}/${topic}`).get() : Promise.resolve(null),
      opts.allowInactive ? Promise.resolve(null) : db.ref(`users/${uid}/isActive`).get(),
    ]);
    if (!tokens.exists()) return;
    if (prefs && prefs.val() === false) return;
    if (!opts.allowInactive && active?.val() !== true) return;
    tokens.forEach((t) => { const v = t.val(); if (v?.token) targets.push({ token: v.token, uid, key: String(t.key) }); });
  }));
  return send(targets, p);
}

/** Notifies every signed-up device (e.g. a new announcement), except `exclude`. */
export async function pushToAll(topic: Topic, p: Payload, exclude: string[] = []): Promise<number> {
  const snap = await adminDb().ref('pushTokens').get();
  const uids = Object.keys((snap.val() as Record<string, unknown>) ?? {}).filter((u) => !exclude.includes(u));
  return pushToUsers(uids, topic, p);
}

export async function adminUids(): Promise<string[]> {
  const snap = await adminDb().ref('users').orderByChild('role').equalTo('admin').get();
  return Object.keys((snap.val() as Record<string, unknown>) ?? {});
}

export interface SendReport { tokens: number; sent: number; errors: string[] }

/** Sends to the caller's own devices and reports exactly what happened (used by the Settings "Send test" button). */
export async function pushTest(uid: string, p: Payload): Promise<SendReport> {
  const snap = await adminDb().ref(`pushTokens/${uid}`).get();
  const targets: { token: string; uid: string; key: string }[] = [];
  snap.forEach((t) => { const v = t.val(); if (v?.token) targets.push({ token: v.token, uid, key: String(t.key) }); });
  return sendDetailed(targets, p);
}

async function send(targets: { token: string; uid: string; key: string }[], p: Payload): Promise<number> {
  return (await sendDetailed(targets, p)).sent;
}

async function sendDetailed(targets: { token: string; uid: string; key: string }[], p: Payload): Promise<SendReport> {
  const errors: string[] = [];
  if (!targets.length) return { tokens: 0, sent: 0, errors };
  const messaging = getMessaging(getApps()[0]);
  const dead: string[] = [];
  let ok = 0;
  for (let i = 0; i < targets.length; i += 500) {
    const batch = targets.slice(i, i + 500);
    const r = await messaging.sendEachForMulticast({
      tokens: batch.map((t) => t.token),
      data: { title: p.title.slice(0, 120), body: p.body.slice(0, 180), link: p.link },
      webpush: { headers: { Urgency: 'high', TTL: '86400' } },
    });
    ok += r.successCount;
    r.responses.forEach((x, j) => {
      const code = x.error?.code || '';
      if (!x.success) { errors.push(`${code}: ${x.error?.message ?? ''}`.slice(0, 300)); console.error('push failed', code, x.error?.message); }
      if (!x.success && /registration-token-not-registered|invalid-registration-token|invalid-argument/.test(code)) dead.push(`pushTokens/${batch[j].uid}/${batch[j].key}`);
    });
  }
  if (dead.length) await adminDb().ref().update(Object.fromEntries(dead.map((d) => [d, null]))); // forget uninstalled / expired devices
  return { tokens: targets.length, sent: ok, errors: [...new Set(errors)] };
}
