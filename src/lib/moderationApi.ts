// Moderation calls that need the server (it alone can read a hidden Freedom Wall identity or write someone else's record).
// Demo mode simulates the same behaviour in the local demo store.
import { call } from './adminApi';
import { isDemoMode } from './firebase';
import { demoGet, demoKey, demoPatch } from './demoStore';
import { APPEAL_COOLDOWN_MS, PENALTY_LABEL, penaltyFor } from './penalty';
import { logActivity } from '../services/logService';
import type { AuthorReveal, InboxKind } from '../types';

const PENALTY_TEXT: Record<string, string> = {
  warning: 'This is a written warning. Your next upheld violation will mute your account for 24 hours.',
  '24h': 'Your account is muted for 24 hours: you cannot post on the Freedom Wall or send chat messages until then.',
  '3d': 'Your account is muted for 3 days: you cannot post on the Freedom Wall or send chat messages until then.',
  '7d': 'Your account is muted for 7 days. The next violation is a permanent mute.',
  permanent: 'Your account is permanently muted. You can send one appeal from Profile → Inbox.',
};

function demoDeliver(uids: string[], kind: InboxKind, title: string, body: string) {
  const ups: Record<string, unknown> = {};
  [...new Set(uids)].forEach((u) => { ups[`inbox/${u}/${demoKey()}`] = { kind, title, body, createdAt: Date.now(), read: false }; });
  demoPatch(ups);
}

function demoPunish(actor: string, uid: string, source: 'wall' | 'chat', ref: string, excerpt: string, reportCount: number): AuthorReveal | null {
  const user = (demoGet(`users/${uid}`) ?? null) as { studentId: string; fullName: string } | null;
  if (!user) return null;
  const level = (demoGet(`penaltyState/${uid}/level`) as number | null) ?? 0;
  const n = level + 1;
  const { penalty, until } = penaltyFor(n);
  const ups: Record<string, unknown> = { [`penaltyState/${uid}/level`]: n, [`violations/${uid}/${demoKey()}`]: { source, ref, excerpt, reportCount, decidedBy: actor, at: Date.now(), offence: n, penalty } };
  if (until) ups[`mutes/${uid}`] = { until, level: penalty, since: Date.now(), offence: n };
  demoPatch(ups);
  demoDeliver([uid], penalty === 'warning' ? 'violation' : 'mute', penalty === 'warning' ? 'Warning: a post of yours broke the rules' : 'Your account was muted',
    `A report about something you wrote was reviewed and upheld: “${excerpt.slice(0, 160)}”.\n\n${PENALTY_TEXT[penalty]}\n\nOffence ${n}.`);
  return { uid, studentId: user.studentId, fullName: user.fullName, offence: n, penalty, until };
}

export async function resolvePostReports(actor: string, postId: string, outcome: 'upheld' | 'dismissed'): Promise<{ author?: AuthorReveal | null }> {
  if (!isDemoMode) return call('/api/admin/moderate', { action: 'resolvePost', postId, outcome });
  const reports = Object.entries((demoGet('reports') ?? {}) as Record<string, { postId: string; reporterId: string; status: string }>).filter(([, r]) => r.postId === postId && r.status === 'open');
  const ups: Record<string, unknown> = {};
  reports.forEach(([id]) => { ups[`reports/${id}/status`] = outcome === 'upheld' ? 'actioned' : 'dismissed'; });
  let author: AuthorReveal | null = null;
  if (outcome === 'upheld') {
    const post = (demoGet(`freedomWall/${postId}`) ?? demoGet(`freedomWallQueue/${postId}`)) as { content?: string } | null;
    const authorUid = demoGet(`freedomWallPrivate/${postId}/uid`) as string | null;
    if (authorUid) { author = demoPunish(actor, authorUid, 'wall', postId, post?.content ?? '', reports.length); ups[`userPosts/${authorUid}/${postId}`] = null; }
    ups[`freedomWall/${postId}`] = null; ups[`freedomWallQueue/${postId}`] = null; ups[`freedomWallPrivate/${postId}`] = null;
  }
  demoPatch(ups);
  demoDeliver(reports.map(([, r]) => r.reporterId), 'report', outcome === 'upheld' ? 'Your report was upheld' : 'Your report was reviewed', outcome === 'upheld' ? 'Thank you. An administrator took action.' : 'An administrator found no violation. Thank you for looking out.');
  await logActivity(actor, outcome === 'upheld' ? 'moderation.uphold' : 'moderation.dismiss_report', `post ${postId}`);
  return { author };
}

export async function resolveMessageReport(actor: string, reportId: string, outcome: 'upheld' | 'dismissed'): Promise<{ author?: AuthorReveal | null }> {
  if (!isDemoMode) return call('/api/admin/moderate', { action: 'resolveMessage', reportId, outcome });
  const r = demoGet(`messageReports/${reportId}`) as { subjectId: string; messageId: string; reporterId: string; snapshot: { senderId: string; content: string } } | null;
  if (!r) throw new Error('This report is no longer open.');
  let author: AuthorReveal | null = null;
  if (outcome === 'upheld') { author = demoPunish(actor, r.snapshot.senderId, 'chat', `${r.subjectId}/${r.messageId}`, r.snapshot.content, 1); demoPatch({ [`messages/${r.subjectId}/${r.messageId}`]: null }); }
  demoPatch({ [`messageReports/${reportId}/status`]: outcome === 'upheld' ? 'actioned' : 'dismissed' });
  demoDeliver([r.reporterId], 'report', outcome === 'upheld' ? 'Your report was upheld' : 'Your report was reviewed', outcome === 'upheld' ? 'Thank you. An administrator took action.' : 'An administrator found no violation.');
  return { author };
}

export async function reportChatMessage(uid: string, subjectId: string, messageId: string, reason: string): Promise<void> {
  if (!isDemoMode) { await call('/api/report-message', { subjectId, messageId, reason }); return; }
  const m = demoGet(`messages/${subjectId}/${messageId}`) as { senderId: string; senderName: string; content: string; createdAt: number } | null;
  if (!m) throw new Error('That message no longer exists.');
  const subject = demoGet(`subjects/${subjectId}`) as { subjectCode: string } | null;
  demoPatch({ [`messageReports/${messageId}_${uid}`]: { subjectId, subjectCode: subject?.subjectCode ?? '', messageId, reporterId: uid, reason, createdAt: Date.now(), status: 'open', snapshot: { senderId: m.senderId, senderName: m.senderName, content: m.content, createdAt: m.createdAt }, context: [] } });
}

export async function decideAppeal(actor: string, uid: string, approve: boolean, response: string): Promise<void> {
  if (!isDemoMode) { await call('/api/admin/moderate', { action: 'decideAppeal', uid, approve, response }); return; }
  const a = demoGet(`appeals/${uid}`) as Record<string, unknown> | null;
  if (!a) throw new Error('There is no pending appeal for this user.');
  if (approve) { demoPatch({ [`mutes/${uid}`]: null, [`penaltyState/${uid}/level`]: 3, [`appeals/${uid}`]: { ...a, status: 'approved', decidedAt: Date.now(), response } }); demoDeliver([uid], 'appeal', 'Your appeal was approved', 'Your privileges are restored. Your next upheld violation means a 7-day mute.'); }
  else { const next = Date.now() + APPEAL_COOLDOWN_MS; demoPatch({ [`appeals/${uid}`]: { ...a, status: 'denied', decidedAt: Date.now(), response, nextAllowedAt: next } }); demoDeliver([uid], 'appeal', 'Your appeal was denied', `Your account stays muted. You may appeal again after ${new Date(next).toLocaleDateString()}.`); }
  await logActivity(actor, approve ? 'moderation.appeal_approved' : 'moderation.appeal_denied', `user ${uid}`);
}

export async function liftMute(actor: string, uid: string): Promise<void> {
  if (!isDemoMode) { await call('/api/admin/moderate', { action: 'liftMute', uid }); return; }
  demoPatch({ [`mutes/${uid}`]: null });
  demoDeliver([uid], 'mute', 'Your mute was lifted', 'You can post and chat again.');
  await logActivity(actor, 'moderation.lift_mute', `user ${uid}`);
}

export type Audience = 'all' | 'students' | 'professors' | 'organizations' | 'staff';
export async function sendBroadcast(actor: string, title: string, body: string, audience: Audience): Promise<number> {
  if (!isDemoMode) return (await call<{ recipients: number }>('/api/admin/moderate', { action: 'broadcast', title, body, audience })).recipients;
  const users = Object.entries((demoGet('users') ?? {}) as Record<string, { role: string; isActive?: boolean }>);
  const roles = { all: null, students: ['student'], professors: ['professor'], organizations: ['organization'], staff: ['professor', 'organization'] }[audience];
  const uids = users.filter(([, u]) => u.isActive !== false && (!roles || roles.includes(u.role))).map(([id]) => id);
  demoPatch({ [`broadcasts/${demoKey()}`]: { title, body, audience, by: actor, createdAt: Date.now(), recipients: uids.length } });
  demoDeliver(uids, 'update', title, body);
  await logActivity(actor, 'broadcast.send', `${audience}: ${title}`);
  return uids.length;
}

export { PENALTY_LABEL };
