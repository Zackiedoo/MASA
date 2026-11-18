// POST /api/register — PUBLIC sign-up request for Professors/Instructors and Organization-affiliated accounts.
// The account is created in a PENDING state: it can sign in, but has no access to anything until an administrator
// approves it. Students are NOT self-registered; their accounts are provisioned by an administrator.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash } from 'node:crypto';
import { adminAuth, adminDb, HttpError, loginIdToEmail, LOGIN_ID_PATTERN, logActivity, route } from './_lib/admin.js';
import { adminUids, pushToUsers } from './_lib/push.js';
import { AVATARS, checkPassword, clean, nicknameFrom } from './_lib/accounts.js';

const MAX_PENDING = 200; // stops a flood of fake sign-ups from filling the approval queue
const PER_IP_PER_HOUR = 3;

export default route(['POST'], async (req: VercelRequest, res: VercelResponse) => {
  const b = (req.body || {}) as Record<string, unknown>;
  if (b.website) { res.status(200).json({ ok: true }); return; } // honeypot field: real people never fill it in

  const role = String(b.role);
  if (role !== 'professor' && role !== 'organization') throw new HttpError(400, 'Only Professor/Instructor and Organization accounts can register here. Student accounts are created by your school administrator.');
  const loginId = clean(b.loginId, 20);
  const fullName = clean(b.fullName, 120);
  const contactEmail = clean(b.contactEmail, 120);
  const note = clean(b.note, 300);
  const orgName = clean(b.orgName, 120);
  const orgDescription = clean(b.orgDescription, 500);
  const password = String(b.password || '');
  if (!LOGIN_ID_PATTERN.test(loginId)) throw new HttpError(400, 'Username must be 3–20 letters, numbers or dashes.');
  if (fullName.length < 2) throw new HttpError(400, 'Full name is required.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) throw new HttpError(400, 'Enter a valid contact e-mail (the administrator uses it to verify you).');
  if (role === 'organization' && orgName.length < 2) throw new HttpError(400, 'Organization name is required.');
  checkPassword(password);

  const db = adminDb();
  // ── abuse limits ──
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const key = createHash('sha256').update(ip).digest('hex').slice(0, 32);
  const hour = Math.floor(Date.now() / 3600000);
  const gate = await db.ref(`registrationLimits/${key}`).transaction((cur) => {
    if (cur && cur.hour === hour && cur.count >= PER_IP_PER_HOUR) return undefined; // abort
    return { hour, count: cur && cur.hour === hour ? cur.count + 1 : 1 };
  });
  if (!gate.committed) throw new HttpError(429, 'Too many sign-up attempts from this network. Please try again later.');
  const pending = await db.ref('users').orderByChild('approvalStatus').equalTo('pending').limitToFirst(MAX_PENDING + 1).get();
  if (pending.numChildren() > MAX_PENDING) throw new HttpError(503, 'Registrations are temporarily closed. Please contact your administrator.');

  // ── create the PENDING account ──
  let user;
  try {
    user = await adminAuth().createUser({ email: loginIdToEmail(loginId), password, displayName: fullName });
  } catch (e: any) {
    if (e?.code === 'auth/email-already-exists') throw new HttpError(409, `The username "${loginId}" is already taken.`);
    throw e;
  }
  await db.ref(`users/${user.uid}`).set({
    studentId: loginId, fullName, nickname: nicknameFrom(fullName), bio: '', role,
    avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)], avatarColor: '#F2D98D',
    createdAt: Date.now(), isActive: false, approvalStatus: 'pending', mustChangePassword: false,
    registration: { contactEmail, note, ...(role === 'organization' ? { orgName, orgDescription } : {}) },
  });
  await logActivity(`registration:${user.uid}`, 'account.register', `${role}:${loginId}`);
  await pushToUsers(await adminUids(), 'admin', { title: 'New registration to review', body: `${fullName} (${role}) is waiting for approval.`, link: '/admin' }).catch(() => undefined);
  res.status(200).json({ ok: true });
});
