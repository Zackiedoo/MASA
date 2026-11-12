// Calls to privileged server functions (/api/*). In real mode these use the Firebase Admin SDK on Vercel.
// In demo mode the same operations are simulated against the local demo store.
import { getIdToken } from './auth';
import { isDemoMode } from './firebase';
import { demoGet, demoKey, demoPatch } from './demoStore';
import type { Role } from '../types';

async function call<T>(url: string, body: unknown): Promise<T> {
  const token = await getIdToken();
  if (!token) throw new Error('You are signed out.');
  let res: Response;
  try {
    res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  } catch {
    throw new Error('Could not reach the server. If you are running locally, use `vercel dev` so /api works (see README).');
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error || `Request failed (${res.status}).`);
  return json as T;
}

export type UserAction =
  | { action: 'create'; studentId: string; fullName: string; role: Role; orgId?: string; password?: string }
  | { action: 'resetPassword'; uid: string; password?: string }
  | { action: 'setRole'; uid: string; role: Role; orgId?: string }
  | { action: 'setActive'; uid: string; active: boolean };

const AVATARS = ['fox', 'panda', 'owl', 'cat', 'koala', 'frog'];
const demoTemp = () => Array.from({ length: 10 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 31)]).join('');

export async function manageUser(body: UserAction, actorUid: string): Promise<{ uid?: string; tempPassword?: string }> {
  if (!isDemoMode) return call('/api/admin/users', body);
  // ── demo simulation ──
  const users = (demoGet('users') || {}) as Record<string, any>;
  const log = (action: string, target: string) => demoPatch({ [`activityLogs/${demoKey()}`]: { actorId: actorUid, action, target, createdAt: Date.now() } });
  if (body.action === 'create') {
    if (Object.values(users).some((u) => u.studentId.toLowerCase() === body.studentId.toLowerCase())) throw new Error(`An account with ID "${body.studentId}" already exists.`);
    const uid = demoKey();
    demoPatch({ [`users/${uid}`]: { studentId: body.studentId, fullName: body.fullName, nickname: body.fullName.split(' ')[0].padEnd(2, '_'), bio: '', role: body.role, avatar: AVATARS[Math.floor(Math.random() * 6)], avatarColor: '#F2D98D', createdAt: Date.now(), isActive: true, mustChangePassword: false, ...(body.orgId ? { orgId: body.orgId } : {}) },
      ...(body.role === 'organization' && body.orgId ? { [`organizations/${body.orgId}/authorizedUsers/${uid}`]: true } : {}) });
    log('account.create', `${body.role}:${body.studentId}`);
    return { uid, tempPassword: 'demo1234' };
  }
  const u = users[body.uid];
  if (!u) throw new Error('User not found.');
  if (body.action === 'resetPassword') { demoPatch({ [`users/${body.uid}/mustChangePassword`]: true, [`resetRequests/${u.studentId}/status`]: 'resolved' }); log('account.reset_password', u.studentId); return { uid: body.uid, tempPassword: demoTemp() + ' (demo accounts keep the shared demo password)' }; }
  if (body.action === 'setRole') { if (body.uid === actorUid) throw new Error('You cannot change your own role.'); demoPatch({ [`users/${body.uid}/role`]: body.role, [`users/${body.uid}/orgId`]: body.orgId ?? null }); log('account.role_change', `${u.studentId}: ${u.role} → ${body.role}`); return { uid: body.uid }; }
  if (body.uid === actorUid) throw new Error('You cannot disable your own account.');
  demoPatch({ [`users/${body.uid}/isActive`]: body.active }); log(body.active ? 'account.reactivate' : 'account.disable', u.studentId);
  return { uid: body.uid };
}

export interface MemoInput { office: 'di' | 'president'; referenceNumber: string; title: string; content: string; documentUrl: string; publish: boolean }

export async function ingestMemo(input: MemoInput, actorUid: string): Promise<{ id: string; status: string }> {
  if (!isDemoMode) return call('/api/memos/ingest', input);
  // ── demo simulation (same duplicate rule as the server) ──
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const key = input.referenceNumber ? `${input.office}|${norm(input.referenceNumber)}` : `${input.office}|${norm(input.title)}|${norm(input.content)}`;
  const existing = demoGet(`memoHashes/${btoa(unescape(encodeURIComponent(key))).replace(/[^A-Za-z0-9]/g, '').slice(0, 60)}`);
  if (existing) throw new Error(`Duplicate memorandum (already stored as ${existing}).`);
  const id = demoKey();
  const hash = btoa(unescape(encodeURIComponent(key))).replace(/[^A-Za-z0-9]/g, '').slice(0, 60);
  const now = Date.now();
  const sourceName = input.office === 'di' ? 'Director for Instruction' : 'Office of the President';
  demoPatch({
    [`memoHashes/${hash}`]: id,
    [`memoranda/${id}`]: { ...input, status: input.publish ? 'published' : 'draft', sourceType: 'upload', publishedAt: now, uploadedBy: actorUid },
    ...(input.publish ? { [`announcements/${id}`]: { sourceType: input.office, sourceId: input.office, sourceName, title: input.referenceNumber ? `${input.referenceNumber}: ${input.title}` : input.title, content: input.content || 'See the attached memorandum.', createdAt: now, status: 'published', authorUid: actorUid, memoId: id, ...(input.documentUrl ? { attachments: [{ name: input.referenceNumber || 'Memorandum', url: input.documentUrl, type: 'file' }] } : {}) } } : {}),
    [`activityLogs/${demoKey()}`]: { actorId: actorUid, action: input.publish ? 'memo.publish' : 'memo.save_draft', target: input.referenceNumber || input.title, createdAt: now },
  });
  return { id, status: input.publish ? 'published' : 'draft' };
}
