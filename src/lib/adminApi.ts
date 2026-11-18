// Calls to privileged server functions (/api/*). In real mode these use the Firebase Admin SDK on Vercel.
// In demo mode the same operations are simulated against the local demo store.
import { getIdToken } from './auth';
import { isDemoMode } from './firebase';
import { demoGet, demoKey, demoPatch } from './demoStore';
import type { Role } from '../types';

export async function call<T>(url: string, body: unknown): Promise<T> {
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
  | { action: 'update'; uid: string; fullName?: string; studentId?: string }
  | { action: 'delete'; uid: string }
  | { action: 'resetPassword'; uid: string; password?: string }
  | { action: 'setRole'; uid: string; role: Role; orgId?: string }
  | { action: 'setActive'; uid: string; active: boolean }
  | { action: 'approve'; uid: string; orgId?: string; orgName?: string; verified?: boolean }
  | { action: 'reject'; uid: string; reason?: string }
  | { action: 'reindex' };

const AVATARS = ['fox', 'panda', 'owl', 'cat', 'koala', 'frog'];
const demoTemp = () => Array.from({ length: 10 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 31)]).join('');
const nick = (n: string) => (n.trim().split(/\s+/).filter((w, i, a) => !(i < a.length - 1 && /^(mr|mrs|ms|mx|dr|prof|engr|atty|arch)\.?$/i.test(w)))[0] || 'User').padEnd(2, '_');

export interface RegisterInput { role: 'professor' | 'organization'; loginId: string; fullName: string; contactEmail: string; password: string; orgName?: string; orgDescription?: string; note?: string; website?: string }

/** PUBLIC sign-up request for a Professor/Instructor or Organization account. Creates a PENDING account (no token needed). */
export async function registerAccount(input: RegisterInput): Promise<void> {
  if (!isDemoMode) {
    let res: Response;
    try { res = await fetch('/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }); }
    catch { throw new Error('Could not reach the server. Please try again in a moment.'); }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((json as { error?: string }).error || `Request failed (${res.status}).`);
    return;
  }
  // ── demo simulation ──
  const users = (demoGet('users') || {}) as Record<string, any>;
  if (Object.values(users).some((u) => u.studentId.toLowerCase() === input.loginId.toLowerCase())) throw new Error(`The username "${input.loginId}" is already taken.`);
  const uid = demoKey();
  demoPatch({ [`users/${uid}`]: { studentId: input.loginId, fullName: input.fullName, nickname: nick(input.fullName), bio: '', role: input.role, avatar: AVATARS[Math.floor(Math.random() * 6)], avatarColor: '#F2D98D', createdAt: Date.now(), isActive: false, approvalStatus: 'pending', mustChangePassword: false,
    registration: { contactEmail: input.contactEmail, note: input.note || '', ...(input.role === 'organization' ? { orgName: input.orgName || '', orgDescription: input.orgDescription || '' } : {}) } } });
}

export async function manageUser(body: UserAction, actorUid: string): Promise<{ uid?: string; tempPassword?: string; indexed?: number; upgraded?: number }> {
  if (!isDemoMode) return call('/api/admin/users', body);
  // ── demo simulation (mirrors api/admin/users.ts) ──
  const users = (demoGet('users') || {}) as Record<string, any>;
  const log = (action: string, target: string) => demoPatch({ [`activityLogs/${demoKey()}`]: { actorId: actorUid, action, target, createdAt: Date.now() } });
  const actor = users[actorUid];
  if (!actor || actor.role !== 'admin') throw new Error('Only a System Administrator can do this.');
  if (body.action === 'create') {
    if (Object.values(users).some((u) => u.studentId.toLowerCase() === body.studentId.toLowerCase())) throw new Error(`An account with ID "${body.studentId}" already exists.`);
    const uid = demoKey();
    demoPatch({ [`users/${uid}`]: { studentId: body.studentId, fullName: body.fullName, nickname: nick(body.fullName), bio: '', role: body.role, avatar: AVATARS[Math.floor(Math.random() * 6)], avatarColor: '#F2D98D', createdAt: Date.now(), isActive: true, approvalStatus: 'approved', mustChangePassword: false, ...(body.orgId ? { orgId: body.orgId } : {}) },
      ...(body.role === 'organization' && body.orgId ? { [`organizations/${body.orgId}/authorizedUsers/${uid}`]: true } : {}),
      ...(body.role === 'student' ? { [`studentIndex/${body.studentId}`]: { uid, fullName: body.fullName } } : {}) });
    log('account.create', `${body.role}:${body.studentId}`);
    return { uid, tempPassword: 'demo1234' };
  }
  if (body.action === 'reindex') {
    const ups: Record<string, unknown> = {}; let n = 0;
    Object.entries(users).forEach(([uid, u]) => { if (u.role === 'student' && u.isActive !== false) { ups[`studentIndex/${u.studentId}`] = { uid, fullName: u.fullName }; n++; } });
    if (n) demoPatch(ups);
    log('maintenance.reindex_students', `${n} students`);
    return { indexed: n };
  }
  const u = users[body.uid];
  if (!u) throw new Error('User not found.');
  if (body.action === 'update') {
    const ups: Record<string, unknown> = {};
    const fullName = body.fullName?.trim() || u.fullName;
    const loginId = body.studentId?.trim() || u.studentId;
    if (loginId.toLowerCase() !== u.studentId.toLowerCase() && Object.values(users).some((x) => x.studentId.toLowerCase() === loginId.toLowerCase())) throw new Error(`An account with ID "${loginId}" already exists.`);
    ups[`users/${body.uid}/fullName`] = fullName; ups[`users/${body.uid}/studentId`] = loginId;
    if (u.role === 'student') { ups[`studentIndex/${u.studentId}`] = null; ups[`studentIndex/${loginId}`] = { uid: body.uid, fullName }; }
    if (u.role === 'professor') Object.entries((demoGet('subjects') || {}) as Record<string, any>).forEach(([sid, s]) => { if (s.professorId === body.uid) ups[`subjects/${sid}/professorName`] = fullName; });
    demoPatch(ups); log('account.update', `${u.role}:${loginId}`);
    return { uid: body.uid };
  }
  if (body.action === 'approve' || body.action === 'reject') {
    if (u.approvalStatus !== 'pending') throw new Error('This account is not awaiting approval.');
    if (body.action === 'reject') { demoPatch({ [`users/${body.uid}/isActive`]: false, [`users/${body.uid}/approvalStatus`]: 'rejected', [`users/${body.uid}/rejectionReason`]: body.reason || null }); log('account.reject', `${u.role}:${u.studentId}`); return { uid: body.uid }; }
    let orgId: string | undefined;
    const ups: Record<string, unknown> = {};
    if (u.role === 'organization') {
      if (body.orgId) { orgId = body.orgId; ups[`organizations/${orgId}/authorizedUsers/${body.uid}`] = true; }
      else {
        orgId = demoKey();
        ups[`organizations/${orgId}`] = { name: body.orgName || u.registration?.orgName || 'Organization', description: u.registration?.orgDescription || '', verified: body.verified === true, authorizedUsers: { [body.uid]: true } };
      }
      ups[`users/${body.uid}/orgId`] = orgId;
    }
    ups[`users/${body.uid}/isActive`] = true; ups[`users/${body.uid}/approvalStatus`] = 'approved'; ups[`users/${body.uid}/rejectionReason`] = null;
    demoPatch(ups); log('account.approve', `${u.role}:${u.studentId}`);
    return { uid: body.uid };
  }
  if (body.action === 'delete') {
    if (body.uid === actorUid) throw new Error('You cannot delete your own account.');
    const subjects = (demoGet('subjects') || {}) as Record<string, any>;
    if (u.role === 'professor' && Object.values(subjects).some((s) => s.professorId === body.uid)) throw new Error('This professor still has courses. Reassign or delete those courses first.');
    const ups: Record<string, unknown> = { [`users/${body.uid}`]: null, [`userSettings/${body.uid}`]: null, [`userSubjects/${body.uid}`]: null, [`userPosts/${body.uid}`]: null };
    if (u.role === 'student') ups[`studentIndex/${u.studentId}`] = null;
    if (u.orgId) ups[`organizations/${u.orgId}/authorizedUsers/${body.uid}`] = null;
    Object.keys(subjects).forEach((sid) => { ups[`subjectMembers/${sid}/${body.uid}`] = null; ups[`joinRequests/${sid}/${body.uid}`] = null; });
    demoPatch(ups); log('account.delete', `${u.role}:${u.studentId}`);
    return { uid: body.uid };
  }
  if (body.action === 'resetPassword') { demoPatch({ [`users/${body.uid}/mustChangePassword`]: true, [`resetRequests/${u.studentId}/status`]: 'resolved' }); log('account.reset_password', u.studentId); return { uid: body.uid, tempPassword: demoTemp() + ' (demo accounts keep the shared demo password)' }; }
  if (u.approvalStatus === 'pending' || u.approvalStatus === 'rejected') throw new Error('Approve or reject this registration first.');
  if (body.action === 'setRole') {
    if (body.uid === actorUid) throw new Error('You cannot change your own role.');
    const subjects = (demoGet('subjects') || {}) as Record<string, any>;
    if (u.role === 'professor' && body.role !== 'professor' && Object.values(subjects).some((s) => s.professorId === body.uid)) throw new Error('This professor still has courses. Reassign them first.');
    const ups: Record<string, unknown> = { [`users/${body.uid}/role`]: body.role, [`users/${body.uid}/orgId`]: body.orgId ?? null };
    if (u.role === 'student' && body.role !== 'student') ups[`studentIndex/${u.studentId}`] = null;
    if (u.role !== 'student' && body.role === 'student') ups[`studentIndex/${u.studentId}`] = { uid: body.uid, fullName: u.fullName };
    demoPatch(ups); log('account.role_change', `${u.studentId}: ${u.role} → ${body.role}`); return { uid: body.uid };
  }
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
