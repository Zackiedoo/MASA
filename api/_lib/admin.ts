// Shared server-side helpers for Vercel functions. Uses the Firebase Admin SDK,
// whose credentials live ONLY in server environment variables (never VITE_*).
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { timingSafeEqual } from 'node:crypto';

function init() {
  if (getApps().length) return getApps()[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new HttpError(503, 'Server is not configured: FIREBASE_SERVICE_ACCOUNT_JSON is missing.');
  const databaseURL = process.env.FIREBASE_DATABASE_URL || process.env.VITE_FIREBASE_DATABASE_URL;
  if (!databaseURL) throw new HttpError(503, 'Server is not configured: FIREBASE_DATABASE_URL is missing.');
  let account: Record<string, unknown>;
  try {
    account = JSON.parse(raw);
  } catch {
    throw new HttpError(503, 'Server misconfigured: FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON. Re-paste the whole key file (from { to }).');
  }
  try {
    return initializeApp({ credential: cert(account as never), databaseURL });
  } catch (e) {
    console.error('Firebase Admin init failed', e);
    throw new HttpError(503, 'Server misconfigured: the service-account key was rejected (check FIREBASE_SERVICE_ACCOUNT_JSON).');
  }
}

export const adminAuth = () => getAuth(init());
export const adminDb = () => getDatabase(init());

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const LOGIN_EMAIL_DOMAIN = process.env.LOGIN_EMAIL_DOMAIN || 'masa-login.example.com';
export const loginIdToEmail = (id: string) => `${id.trim().toLowerCase()}@${LOGIN_EMAIL_DOMAIN}`;
export const LOGIN_ID_PATTERN = /^[A-Za-z0-9-]{3,20}$/;

/** Wraps a handler: method check, JSON errors, no stack traces leaked to clients. */
export function route(methods: string[], fn: (req: VercelRequest, res: VercelResponse) => Promise<void>) {
  return async (req: VercelRequest, res: VercelResponse) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!methods.includes(req.method || '')) {
      res.setHeader('Allow', methods.join(', '));
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    try {
      await fn(req, res);
    } catch (e) {
      if (e instanceof HttpError) res.status(e.status).json({ error: e.message });
      else {
        console.error(e);
        res.status(500).json({ error: 'Unexpected server error.' });
      }
    }
  };
}

export interface Caller { uid: string; role: string }

/** Verifies the Firebase ID token in `Authorization: Bearer …` and loads the caller's role from the database. */
export async function getCaller(req: VercelRequest): Promise<Caller> {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) throw new HttpError(401, 'Sign in required.');
  const auth = adminAuth(); // configuration problems surface here with a clear message (not as "expired session")
  let uid: string;
  try {
    uid = (await auth.verifyIdToken(token, true)).uid; // `true` also rejects revoked tokens
  } catch (e) {
    console.error('verifyIdToken failed', e);
    throw new HttpError(401, 'Invalid or expired session. Log out, log in again, and retry.');
  }
  const snap = await adminDb().ref(`users/${uid}`).get();
  const u = snap.val();
  if (!u || u.isActive !== true) throw new HttpError(403, 'Account is disabled.');
  return { uid, role: u.role };
}

export async function requireAdmin(req: VercelRequest): Promise<Caller> {
  const c = await getCaller(req);
  if (c.role !== 'admin') throw new HttpError(403, 'Administrator access required.');
  return c;
}

export function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export async function logActivity(actorId: string, action: string, target: string) {
  await adminDb().ref('activityLogs').push({ actorId, action, target, createdAt: { '.sv': 'timestamp' } });
}
