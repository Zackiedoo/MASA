// Helpers shared by the account endpoints (/api/admin/users and /api/register).
import { randomInt } from 'node:crypto';
import { adminDb, HttpError } from './admin.js';

export const ROLES = ['student', 'organization', 'professor', 'admin'] as const;
export const AVATARS = ['fox', 'panda', 'owl', 'cat', 'koala', 'frog'];

/** Readable temporary password (no look-alike characters). */
export function tempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  return Array.from({ length: 12 }, () => chars[randomInt(chars.length)]).join('');
}

export const clean = (v: unknown, max: number) => String(v ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max);

export function checkPassword(p: string) {
  if (p.length < 8 || !/[A-Za-z]/.test(p) || !/[0-9]/.test(p)) throw new HttpError(400, 'Password must be at least 8 characters with letters and numbers.');
}

export const nicknameFrom = (fullName: string) => fullName.split(' ')[0].slice(0, 30).padEnd(2, '_');

/** Student ID → uid lookup that lets a professor enroll an existing student (see /studentIndex rules). */
export async function indexStudent(loginId: string, uid: string, fullName: string) {
  await adminDb().ref(`studentIndex/${loginId}`).set({ uid, fullName });
}
export async function unindexStudent(loginId: string) {
  await adminDb().ref(`studentIndex/${loginId}`).remove();
}
