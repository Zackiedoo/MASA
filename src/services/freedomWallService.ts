import { notifyServer } from '../lib/notifyApi';
import { inc, manilaDay, newKey, patch, read, serverNow, stamp } from '../lib/database';
import type { Report, UserProfile, WallPost } from '../types';
import { logActivity } from './logService';

export const TERMS_VERSION = '1.0';
export const DURATIONS = [3, 6, 12, 24] as const;
const HOUR = 3600000;
export const MAX_POSTS_PER_DAY = 3;

/** How many posts the student may still make today (resets 12:00 am Philippine time). */
export async function postsLeftToday(uid: string): Promise<number> {
  const q = await read<{ day: number; count: number }>(`postQuota/${uid}`).catch(() => null);
  return q && q.day === manilaDay() ? Math.max(0, MAX_POSTS_PER_DAY - q.count) : MAX_POSTS_PER_DAY;
}

export async function acceptTerms(uid: string) {
  await patch({ [`freedomWallTerms/${uid}`]: { accepted: true, version: TERMS_VERSION, acceptedAt: stamp() } });
}

/**
 * Creates a post. The PUBLIC record never contains who wrote it; the real identity is stored separately in
 * /freedomWallPrivate (admins only). If moderation-first mode is on, the post waits in /freedomWallQueue.
 * One atomic update also stamps the rate-limit marker the Security Rules check.
 */
export async function createPost(p: UserProfile, content: string, anonymous: boolean, hours: number, requireApproval: boolean) {
  const q = await read<{ day: number; count: number }>(`postQuota/${p.uid}`).catch(() => null);
  const day = manilaDay();
  const used = q && q.day === day ? q.count : 0;
  if (used >= MAX_POSTS_PER_DAY) throw new Error(`You have used all ${MAX_POSTS_PER_DAY} posts for today. The allowance resets at 12:00 am.`);
  const id = newKey('freedomWall');
  const post = {
    authorLabel: anonymous ? 'Anonymous' : p.nickname,
    anonymous,
    content,
    createdAt: stamp(),
    expiresAt: serverNow() + hours * HOUR, // server clock: the rules accept only the 3/6/12/24 h options ±2 min
    status: requireApproval ? 'pending' : 'approved',
  };
  await patch({
    [`${requireApproval ? 'freedomWallQueue' : 'freedomWall'}/${id}`]: post,
    [`freedomWallPrivate/${id}`]: { uid: p.uid, studentId: p.studentId, fullName: p.fullName },
    [`rateLimits/${p.uid}/post`]: stamp(),
    [`postQuota/${p.uid}`]: { day, count: used + 1 },
  });
  // Lets the author's own posts be recognised (to edit/delete them) without exposing identities. Kept separate so a problem here can never block the post itself.
  await patch({ [`userPosts/${p.uid}/${id}`]: true }).catch(() => undefined);
  return { id, pending: requireApproval };
}

export async function deleteOwnPost(uid: string, id: string) {
  await patch({ [`freedomWall/${id}`]: null, [`freedomWallPrivate/${id}`]: null, [`userPosts/${uid}/${id}`]: null });
}

/** Author edits their own post's text (only while moderation-first mode is off; the rules enforce this). */
export async function editOwnPost(id: string, content: string) {
  await patch({ [`freedomWall/${id}/content`]: content, [`freedomWall/${id}/editedAt`]: stamp() });
}

export async function reportPost(uid: string, postId: string, reason: string) {
  const rid = `${postId}_${uid}`;
  // Students cannot READ /reports (only admins can), so we don't pre-check for a duplicate; the rules refuse a second report from the same person.
  try {
    await patch({
      [`reports/${rid}`]: { postId, reporterId: uid, reason: reason.slice(0, 300), createdAt: stamp(), status: 'open' },
      [`rateLimits/${uid}/report`]: stamp(),
    });
  } catch (e) {
    if (/permission[_-]denied/i.test(String((e as { code?: string })?.code) + String((e as Error)?.message))) throw new Error('This report could not be sent. You may have already reported this post, or you reported another one a few seconds ago. Please wait a moment and try again.');
    throw e;
  }
  notifyServer({ type: 'report' });
}

// ───── moderation (administrators) ─────
export async function approveQueued(admin: string, post: WallPost) {
  const dur = Math.max(post.expiresAt - post.createdAt, HOUR); // keep the chosen lifetime, counted from approval
  await patch({
    [`freedomWallQueue/${post.id}`]: null,
    [`freedomWall/${post.id}`]: { authorLabel: post.authorLabel, anonymous: post.anonymous, content: post.content, createdAt: Date.now(), expiresAt: Date.now() + dur, status: 'approved' },
  });
  await logActivity(admin, 'moderation.approve', `post ${post.id}`);
}

export async function rejectQueued(admin: string, post: WallPost) {
  await patch({ [`freedomWallQueue/${post.id}/status`]: 'rejected', [`freedomWallQueue/${post.id}/decidedBy`]: admin, [`freedomWallQueue/${post.id}/decidedAt`]: stamp() });
  await logActivity(admin, 'moderation.reject', `post ${post.id}`);
}

/** Admin removes a post (no identity is looked up; use "Uphold report" to penalise the author). */
export async function removePost(admin: string, post: WallPost, reports: Report[]) {
  const updates: Record<string, unknown> = { [`freedomWall/${post.id}`]: null, [`freedomWallQueue/${post.id}`]: null };
  for (const r of reports) updates[`reports/${r.id}/status`] = 'actioned';
  await patch(updates);
  await logActivity(admin, 'moderation.remove', `post ${post.id}`);
}

/** Temporarily hides a post from the wall (reversible), keeping its identity record. Admin only. */
export async function hidePost(admin: string, post: WallPost) {
  await patch({
    [`freedomWall/${post.id}`]: null,
    [`freedomWallQueue/${post.id}`]: { authorLabel: post.authorLabel, anonymous: post.anonymous, content: post.content, createdAt: post.createdAt, expiresAt: post.expiresAt, status: 'hidden', decidedBy: admin, decidedAt: stamp() },
  });
  await logActivity(admin, 'moderation.hide', `post ${post.id}`);
}
export async function unhidePost(admin: string, post: WallPost) {
  await patch({
    [`freedomWallQueue/${post.id}`]: null,
    [`freedomWall/${post.id}`]: { authorLabel: post.authorLabel, anonymous: post.anonymous, content: post.content, createdAt: post.createdAt, expiresAt: post.expiresAt, status: 'approved' },
  });
  await logActivity(admin, 'moderation.unhide', `post ${post.id}`);
}
export async function flagPost(admin: string, post: WallPost, flagged: boolean) {
  await patch({ [`freedomWall/${post.id}/flagged`]: flagged ? true : null });
  await logActivity(admin, flagged ? 'moderation.flag' : 'moderation.unflag', `post ${post.id}`);
}

/** Like (1) or dislike (-1); choosing the same again removes it. Counters move atomically together with my private vote record. */
export async function vote(uid: string, post: WallPost, mine: 1 | -1 | 0, choice: 1 | -1) {
  const next = mine === choice ? 0 : choice;
  const up: Record<string, unknown> = { [`userVotes/${uid}/${post.id}`]: next === 0 ? null : next };
  if (mine === 1 && next !== 1) up[`freedomWall/${post.id}/likes`] = inc(-1);
  if (mine === -1 && next !== -1) up[`freedomWall/${post.id}/dislikes`] = inc(-1);
  if (next === 1) up[`freedomWall/${post.id}/likes`] = inc(1);
  if (next === -1) up[`freedomWall/${post.id}/dislikes`] = inc(1);
  await patch(up);
}
