// POST /api/admin/users — account management. ADMINISTRATORS ONLY (checked server-side on every call).
// Body: { action: 'create' | 'update' | 'delete' | 'resetPassword' | 'setRole' | 'setActive' | 'approve' | 'reject' | 'reindex', ... }
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { pushToUsers } from '../_lib/push.js';
import { adminAuth, adminDb, HttpError, loginIdToEmail, LOGIN_ID_PATTERN, logActivity, requireAdmin, route } from '../_lib/admin.js';
import { AVATARS, ROLES, checkPassword, clean, indexStudent, nicknameFrom, tempPassword, unindexStudent } from '../_lib/accounts.js';
import { randomInt } from 'node:crypto';

export default route(['POST'], async (req: VercelRequest, res: VercelResponse) => {
  const caller = await requireAdmin(req);
  const auth = adminAuth();
  const db = adminDb();
  const b = (req.body || {}) as Record<string, unknown>;
  const loadUser = async (uid: string) => {
    const u = (await db.ref(`users/${uid}`).get()).val();
    if (!u) throw new HttpError(404, 'User not found.');
    return u;
  };
  const requireOrg = async (orgId?: string) => {
    if (!orgId || !(await db.ref(`organizations/${orgId}`).get()).exists()) throw new HttpError(400, 'Pick an existing organization.');
  };

  switch (b.action) {
    // ───────── CREATE ─────────
    case 'create': {
      const loginId = clean(b.studentId, 20);
      const fullName = clean(b.fullName, 120);
      const role = String(b.role);
      const orgId = b.orgId ? clean(b.orgId, 80) : undefined;
      if (!LOGIN_ID_PATTERN.test(loginId)) throw new HttpError(400, 'ID must be 3–20 letters, digits or dashes.');
      if (fullName.length < 2) throw new HttpError(400, 'Full name is required.');
      if (!(ROLES as readonly string[]).includes(role)) throw new HttpError(400, 'Invalid role.');
      if (role === 'organization') await requireOrg(orgId);
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
      await db.ref(`users/${user.uid}`).set({
        studentId: loginId, fullName, nickname: nicknameFrom(fullName), bio: '', role,
        avatar: AVATARS[randomInt(AVATARS.length)], avatarColor: '#F2D98D',
        createdAt: Date.now(), isActive: true, approvalStatus: 'approved', mustChangePassword: true,
        ...(orgId ? { orgId } : {}),
      });
      if (role === 'organization' && orgId) await db.ref(`organizations/${orgId}/authorizedUsers/${user.uid}`).set(true);
      if (role === 'student') await indexStudent(loginId, user.uid, fullName);
      await logActivity(caller.uid, 'account.create', `${role}:${loginId}`);
      res.status(200).json({ uid: user.uid, tempPassword: b.password ? undefined : password });
      return;
    }

    // ───────── UPDATE (name / login ID) ─────────
    case 'update': {
      const uid = clean(b.uid, 128);
      const u = await loadUser(uid);
      const fullName = b.fullName !== undefined ? clean(b.fullName, 120) : u.fullName;
      const loginId = b.studentId !== undefined ? clean(b.studentId, 20) : u.studentId;
      if (fullName.length < 2) throw new HttpError(400, 'Full name is required.');
      if (!LOGIN_ID_PATTERN.test(loginId)) throw new HttpError(400, 'ID must be 3–20 letters, digits or dashes.');
      const idChanged = loginId.toLowerCase() !== String(u.studentId).toLowerCase();
      try {
        await auth.updateUser(uid, { displayName: fullName, ...(idChanged ? { email: loginIdToEmail(loginId) } : {}) });
      } catch (e: any) {
        if (e?.code === 'auth/email-already-exists') throw new HttpError(409, `ID "${loginId}" is already taken.`);
        throw e;
      }
      await db.ref(`users/${uid}`).update({ fullName, studentId: loginId });
      if (u.role === 'student') {
        if (idChanged) await unindexStudent(u.studentId);
        await indexStudent(loginId, uid, fullName);
      }
      if (u.role === 'professor' && fullName !== u.fullName) {
        // keep the denormalised professor name on their courses in sync
        const subs = await db.ref('subjects').orderByChild('professorId').equalTo(uid).get();
        const ups: Record<string, string> = {};
        subs.forEach((s) => { ups[`subjects/${s.key}/professorName`] = fullName; });
        if (Object.keys(ups).length) await db.ref().update(ups);
      }
      await logActivity(caller.uid, 'account.update', `${u.role}:${u.studentId}${idChanged ? ` → ${loginId}` : ''}`);
      res.status(200).json({ uid });
      return;
    }

    // ───────── DELETE ─────────
    case 'delete': {
      const uid = clean(b.uid, 128);
      if (uid === caller.uid) throw new HttpError(400, 'You cannot delete your own account.');
      const u = await loadUser(uid);
      if (u.role === 'professor') {
        const subs = await db.ref('subjects').orderByChild('professorId').equalTo(uid).get();
        if (subs.exists()) throw new HttpError(409, 'This professor is still assigned to courses. Reassign or delete those courses first.');
      }
      const ups: Record<string, null> = {};
      const subjects = (await db.ref(`userSubjects/${uid}`).get()).val() || {};
      for (const sid of Object.keys(subjects)) { ups[`subjectMembers/${sid}/${uid}`] = null; ups[`joinRequests/${sid}/${uid}`] = null; }
      for (const root of ['userSubjects', 'userReads', 'userSettings', 'freedomWallTerms', 'userPosts', 'rateLimits']) ups[`${root}/${uid}`] = null;
      if (u.orgId) ups[`organizations/${u.orgId}/authorizedUsers/${uid}`] = null;
      if (u.role === 'student') ups[`studentIndex/${u.studentId}`] = null;
      ups[`users/${uid}`] = null;
      await db.ref().update(ups);
      await auth.deleteUser(uid).catch((e: any) => { if (e?.code !== 'auth/user-not-found') throw e; });
      await logActivity(caller.uid, 'account.delete', `${u.role}:${u.studentId}`);
      res.status(200).json({ uid });
      return;
    }

    // ───────── RESET PASSWORD ─────────
    case 'resetPassword': {
      const uid = clean(b.uid, 128);
      const u = await loadUser(uid);
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

    // ───────── CHANGE ROLE ─────────
    case 'setRole': {
      const uid = clean(b.uid, 128);
      const role = String(b.role);
      const orgId = b.orgId ? clean(b.orgId, 80) : undefined;
      if (!(ROLES as readonly string[]).includes(role)) throw new HttpError(400, 'Invalid role.');
      if (uid === caller.uid) throw new HttpError(400, 'You cannot change your own role.');
      const u = await loadUser(uid);
      if (u.approvalStatus === 'pending') throw new HttpError(409, 'Approve or reject this registration first.');
      if (role === 'organization') await requireOrg(orgId);
      if (u.role === 'professor' && role !== 'professor') {
        const subs = await db.ref('subjects').orderByChild('professorId').equalTo(uid).get();
        if (subs.exists()) throw new HttpError(409, 'This professor is still assigned to courses. Reassign them first.');
      }
      await auth.setCustomUserClaims(uid, { role, ...(role === 'organization' && orgId ? { orgId } : {}) });
      await db.ref(`users/${uid}`).update({ role, orgId: role === 'organization' ? orgId ?? null : null });
      if (u.orgId && u.orgId !== orgId) await db.ref(`organizations/${u.orgId}/authorizedUsers/${uid}`).remove();
      if (role === 'organization' && orgId) await db.ref(`organizations/${orgId}/authorizedUsers/${uid}`).set(true);
      if (u.role === 'student' && role !== 'student') await unindexStudent(u.studentId);
      if (role === 'student' && u.role !== 'student') await indexStudent(u.studentId, uid, u.fullName);
      await auth.revokeRefreshTokens(uid); // force a fresh token carrying the new claims
      await logActivity(caller.uid, 'account.role_change', `${u.studentId}: ${u.role} → ${role}`);
      res.status(200).json({ uid });
      return;
    }

    // ───────── DISABLE / REACTIVATE ─────────
    case 'setActive': {
      const uid = clean(b.uid, 128);
      const active = b.active === true;
      if (uid === caller.uid) throw new HttpError(400, 'You cannot disable your own account.');
      const u = await loadUser(uid);
      if (u.approvalStatus && u.approvalStatus !== 'approved') throw new HttpError(409, 'Use approve / reject for registration requests.');
      await auth.updateUser(uid, { disabled: !active });
      if (!active) await auth.revokeRefreshTokens(uid);
      await db.ref(`users/${uid}/isActive`).set(active);
      await logActivity(caller.uid, active ? 'account.reactivate' : 'account.disable', `${u.role}:${u.studentId}`);
      res.status(200).json({ uid });
      return;
    }

    // ───────── APPROVE a professor / organization registration ─────────
    case 'approve': {
      const uid = clean(b.uid, 128);
      const u = await loadUser(uid);
      if (u.approvalStatus !== 'pending') throw new HttpError(409, 'This account is not awaiting approval.');
      let orgId: string | undefined;
      if (u.role === 'organization') {
        // Either link to an existing organization, or create one from the details given at registration.
        if (b.orgId) { orgId = clean(b.orgId, 80); await requireOrg(orgId); }
        else {
          const name = clean(b.orgName || u.registration?.orgName, 120);
          if (name.length < 2) throw new HttpError(400, 'Organization name is required.');
          const ref = db.ref('organizations').push();
          orgId = ref.key as string;
          await ref.set({ name, description: clean(u.registration?.orgDescription, 500), verified: b.verified === true });
        }
        await db.ref(`organizations/${orgId}/authorizedUsers/${uid}`).set(true);
      }
      await auth.setCustomUserClaims(uid, { role: u.role, ...(orgId ? { orgId } : {}) });
      await db.ref(`users/${uid}`).update({ isActive: true, approvalStatus: 'approved', rejectionReason: null, ...(orgId ? { orgId } : {}) });
      await auth.revokeRefreshTokens(uid); // so their next login carries the new role claims
      await logActivity(caller.uid, 'account.approve', `${u.role}:${u.studentId}`);
      await pushToUsers([uid], 'account', { title: 'Your MASA account is approved', body: 'You can now log in and use MASA.', link: '/login' }, { allowInactive: true }).catch(() => undefined);
      res.status(200).json({ uid });
      return;
    }

    // ───────── REJECT ─────────
    case 'reject': {
      const uid = clean(b.uid, 128);
      const u = await loadUser(uid);
      if (u.approvalStatus !== 'pending') throw new HttpError(409, 'This account is not awaiting approval.');
      await db.ref(`users/${uid}`).update({ isActive: false, approvalStatus: 'rejected', rejectionReason: clean(b.reason, 300) || null });
      await logActivity(caller.uid, 'account.reject', `${u.role}:${u.studentId}`);
      await pushToUsers([uid], 'account', { title: 'MASA registration update', body: 'Your registration was not approved. Open MASA for details.', link: '/login' }, { allowInactive: true }).catch(() => undefined);
      res.status(200).json({ uid });
      return;
    }

    // ───────── REBUILD the Student-ID lookup (maintenance / after importing old accounts) ─────────
    case 'reindex': {
      const students = await db.ref('users').orderByChild('role').equalTo('student').get();
      const ups: Record<string, unknown> = {};
      let n = 0;
      students.forEach((s) => { const v = s.val(); if (v.isActive !== false) { ups[`studentIndex/${v.studentId}`] = { uid: s.key, fullName: v.fullName }; n++; } });
      // Roster entries written by older versions are plain `true`; upgrade them to {studentId, fullName} so professors can see names.
      const byUid = new Map<string, { studentId: string; fullName: string }>();
      students.forEach((s) => { const v = s.val(); byUid.set(String(s.key), { studentId: v.studentId, fullName: v.fullName }); });
      const members = (await db.ref('subjectMembers').get()).val() as Record<string, Record<string, unknown>> | null;
      let upgraded = 0;
      for (const [sid, m] of Object.entries(members ?? {})) {
        for (const [uid, val] of Object.entries(m ?? {})) {
          const info = byUid.get(uid);
          if (val === true && info) { ups[`subjectMembers/${sid}/${uid}`] = { studentId: info.studentId, fullName: info.fullName, enrolledAt: Date.now(), by: caller.uid }; upgraded++; }
        }
      }
      if (n || upgraded) await db.ref().update(ups);
      await logActivity(caller.uid, 'maintenance.reindex_students', `${n} students, ${upgraded} roster entries upgraded`);
      res.status(200).json({ indexed: n, upgraded });
      return;
    }

    default:
      throw new HttpError(400, 'Unknown action.');
  }
});
