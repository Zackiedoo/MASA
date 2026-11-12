// GET /api/cron/cleanup — deletes expired Freedom Wall posts, their private identity records and their reports.
// Triggered daily by vercel.json and (recommended) hourly by .github/workflows/cleanup.yml.
// Auth: `Authorization: Bearer <CRON_SECRET>` (Vercel adds this automatically when CRON_SECRET is set).
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { adminDb, HttpError, route, safeEqual } from '../_lib/admin.js';

export default route(['GET', 'POST'], async (req: VercelRequest, res: VercelResponse) => {
  const secret = process.env.CRON_SECRET;
  const header = String(req.headers.authorization || '');
  if (!secret || !safeEqual(header, `Bearer ${secret}`)) throw new HttpError(401, 'Unauthorized.');

  const db = adminDb();
  const now = Date.now();
  const expired = await db.ref('freedomWall').orderByChild('expiresAt').endAt(now).get();
  const updates: Record<string, null> = {};
  const ids: string[] = [];
  expired.forEach((child) => {
    ids.push(child.key as string);
    updates[`freedomWall/${child.key}`] = null;
    updates[`freedomWallPrivate/${child.key}`] = null;
  });
  // Reports are keyed `${postId}_${uid}` and indexed by postId.
  for (const id of ids) {
    const reps = await db.ref('reports').orderByChild('postId').equalTo(id).get();
    reps.forEach((r) => { updates[`reports/${r.key}`] = null; });
  }
  // Rejected queue items older than 7 days.
  const old = await db.ref('freedomWallQueue').orderByChild('createdAt').endAt(now - 7 * 86400000).get();
  old.forEach((q) => {
    if (q.val()?.status === 'rejected') {
      updates[`freedomWallQueue/${q.key}`] = null;
      updates[`freedomWallPrivate/${q.key}`] = null;
    }
  });
  if (Object.keys(updates).length) await db.ref().update(updates);
  res.status(200).json({ removedPosts: ids.length, removedPaths: Object.keys(updates).length });
});
