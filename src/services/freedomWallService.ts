import { newKey, patch, read, serverNow, stamp } from '../lib/database';
import type { Report, UserProfile, WallIdentity, WallPost } from '../types';
import { logActivity } from './logService';

export const TERMS_VERSION = '1.0';
export const DURATIONS = [3, 6, 12, 24] as const;
const HOUR = 3600000;

export async function acceptTerms(uid: string) {
  await patch({ [`freedomWallTerms/${uid}`]: { accepted: true, version: TERMS_VERSION, acceptedAt: stamp() } });
}

/**
 * Creates a post. The PUBLIC record never contains who wrote it; the real identity is stored separately in
 * /freedomWallPrivate (admins only). If moderation-first mode is on, the post waits in /freedomWallQueue.
 * One atomic update also stamps the rate-limit marker the Security Rules check.
 */
export async function createPost(p: UserProfile, content: string, anonymous: boolean, hours: number, requireApproval: boolean) {
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
  if (await read(`reports/${rid}`)) throw new Error('You already reported this post.');
  await patch({
    [`reports/${rid}`]: { postId, reporterId: uid, reason, createdAt: stamp(), status: 'open' },
    [`rateLimits/${uid}/report`]: stamp(),
  });
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

export async function removePost(admin: string, post: WallPost, reports: Report[]) {
  const ident = await read<WallIdentity>(`freedomWallPrivate/${post.id}`);
  const updates: Record<string, unknown> = { [`freedomWall/${post.id}`]: null, [`freedomWallQueue/${post.id}`]: null };
  if (ident?.uid) updates[`userPosts/${ident.uid}/${post.id}`] = null;
  for (const r of reports) updates[`reports/${r.id}/status`] = 'actioned';
  await patch(updates);
  await logActivity(admin, 'moderation.remove', `post ${post.id} (author ${ident?.studentId ?? 'unknown'})`);
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

export async function dismissReport(admin: string, r: Report) {
  await patch({ [`reports/${r.id}/status`]: 'dismissed' });
  await logActivity(admin, 'moderation.dismiss_report', `post ${r.postId}`);
}

/** Reveals who wrote a post. Every reveal is written to the audit log. */
export async function revealIdentity(admin: string, postId: string): Promise<WallIdentity | null> {
  const ident = await read<WallIdentity>(`freedomWallPrivate/${postId}`);
  await logActivity(admin, 'moderation.reveal_identity', `post ${postId}`);
  return ident;
}
