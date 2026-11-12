// POST /api/admin/users — account provisioning. Administrators only.
// Body: { action: 'create' | 'resetPassword' | 'setRole' | 'setActive', ... }
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomInt } from 'node:crypto';
import { adminAuth, adminDb, HttpError, loginIdToEmail, LOGIN_ID_PATTERN, logActivity, requireAdmin, route } from '../_lib/admin.js';

const ROLES = ['student', 'organization', 'professor', 'admin'];
const AVATARS = ['fox', 'panda', 'owl', 'cat', 'koala', 'frog'];

/** Readable temporary password (no look-alike characters). The admin hands it over; the user must change it at first login. */
function tempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  return Array.from({ length: 12 }, () => chars[randomInt(chars.length)]).join('');
}

const clean = (v: unknown, max: number) => String(v ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max);

export default route(['POST'], async (req: VercelRequest, res: VercelResponse) => {
  const caller = await requireAdmin(req);
  const auth = adminAuth();
  const db = adminDb();
  const b = (req.body || {}) as Record<string, unknown>;

  switch (b.action) {
    case 'create': {
      const loginId = clean(b.studentId, 20);
      const fullName = clean(b.fullName, 120);
      const role = String(b.role);
      const orgId = b.orgId ? clean(b.orgId, 80) : undefined;
      if (!LOGIN_ID_PATTERN.test(loginId)) throw new HttpError(400, 'ID must be 3–20 letters, digits or dashes.');
      if (fullName.length < 2) throw new HttpError(400, 'Full name is required.');
      if (!ROLES.includes(role)) throw new HttpError(400, 'Invalid role.');
      if (role === 'organization') {
        if (!orgId || !(await db.ref(`organizations/${orgId}`).get()).exists()) throw new HttpError(400, 'Pick an existing organization.');
      }
      const password = b.password ? String(b.password) : tempPassword();
      if (password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters.');
      let user;
      try {
        user = await auth.createUser({ email: loginIdToEmail(loginId), password, displayName: fullName });
      } catch (e: any) {
        if (e?.code === 'auth/email-already-exists') throw new HttpError(409, `An account with ID "${loginId}" already exists.`);
        throw e;
      }
      await auth.setCustomUserClaims(user.uid, { role, ...(orgId ? { orgId } : {}) });
      const nickname = fullName.split(' ')[0].slice(0, 30).padEnd(2, '_');
      await db.ref(`users/${user.uid}`).set({
        studentId: loginId, fullName, nickname, bio: '', role,
        avatar: AVATARS[randomInt(AVATARS.length)], avatarColor: '#F2D98D',
        createdAt: Date.now(), isActive: true, mustChangePassword: true,
        ...(orgId ? { orgId } : {}),
      });
      if (role === 'organization' && orgId) await db.ref(`organizations/${orgId}/authorizedUsers/${user.uid}`).set(true);
      await logActivity(caller.uid, 'account.create', `${role}:${loginId}`);
      res.status(200).json({ uid: user.uid, tempPassword: b.password ? undefined : password });
      return;
    }

    case 'resetPassword': {
      const uid = clean(b.uid, 128);
      const u = (await db.ref(`users/${uid}`).get()).val();
      if (!u) throw new HttpError(404, 'User not found.');
      const password = b.password ? String(b.password) : tempPassword();
      if (password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters.');
      await auth.updateUser(uid, { password });
      await auth.revokeRefreshTokens(uid); // sign out everywhere
      await db.ref(`users/${uid}/mustChangePassword`).set(true);
      await db.ref(`resetRequests/${u.studentId}`).update({ status: 'resolved' }).catch(() => undefined);
      await logActivity(caller.uid, 'account.reset_password', `${u.role}:${u.studentId}`);
      res.status(200).json({ uid, tempPassword: b.password ? undefined : password });
      return;
    }

    case 'setRole': {
      const uid = clean(b.uid, 128);
      const role = String(b.role);
      const orgId = b.orgId ? clean(b.orgId, 80) : undefined;
      if (!ROLES.includes(role)) throw new HttpError(400, 'Invalid role.');
      if (uid === caller.uid) throw new HttpError(400, 'You cannot change your own role.');
      const u = (await db.ref(`users/${uid}`).get()).val();
      if (!u) throw new HttpError(404, 'User not found.');
      if (role === 'organization' && (!orgId || !(await db.ref(`organizations/${orgId}`).get()).exists())) throw new HttpError(400, 'Pick an existing organization.');
      await auth.setCustomUserClaims(uid, { role, ...(role === 'organization' && orgId ? { orgId } : {}) });
      await db.ref(`users/${uid}`).update({ role, orgId: role === 'organization' ? orgId ?? null : null });
      if (u.orgId && u.orgId !== orgId) await db.ref(`organizations/${u.orgId}/authorizedUsers/${uid}`).remove();
      if (role === 'organization' && orgId) await db.ref(`organizations/${orgId}/authorizedUsers/${uid}`).set(true);
      await auth.revokeRefreshTokens(uid); // force a fresh token carrying the new claims
      await logActivity(caller.uid, 'account.role_change', `${u.studentId}: ${u.role} → ${role}`);
      res.status(200).json({ uid });
      return;
    }

    case 'setActive': {
      const uid = clean(b.uid, 128);
      const active = b.active === true;
      if (uid === caller.uid) throw new HttpError(400, 'You cannot disable your own account.');
      const u = (await db.ref(`users/${uid}`).get()).val();
      if (!u) throw new HttpError(404, 'User not found.');
      await auth.updateUser(uid, { disabled: !active });
      if (!active) await auth.revokeRefreshTokens(uid);
      await db.ref(`users/${uid}/isActive`).set(active);
      await logActivity(caller.uid, active ? 'account.reactivate' : 'account.disable', `${u.role}:${u.studentId}`);
      res.status(200).json({ uid });
      return;
    }

    default:
      throw new HttpError(400, 'Unknown action.');
  }
});
