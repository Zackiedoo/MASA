// POST /api/admin/moderate — ADMINISTRATORS ONLY. Everything that needs to see a hidden identity or write someone else's record.
// Actions:
//   resolvePost    { postId, outcome: 'upheld' | 'dismissed', note? }  — decide the reports on a Freedom Wall post
//   resolveMessage { reportId, outcome: 'upheld' | 'dismissed' }       — decide a reported chat message
//   decideAppeal   { uid, approve, response? }                         — appeal against a permanent mute
//   liftMute       { uid }                                             — end a mute early
//   broadcast      { title, body, audience }                           — message to many inboxes
// A Freedom Wall author's identity is read here ONLY when a report is upheld, and the result is stored as a violation record.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { adminDb, HttpError, logActivity, requireAdmin, route } from '../_lib/admin.js';
import { deliver } from '../_lib/inbox.js';
import { APPEAL_COOLDOWN_MS, PENALTY_TEXT, penaltyFor, type Penalty } from '../_lib/penalty.js';

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const fmt = (ms: number) => new Date(ms).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' });
const AUDIENCES: Record<string, string[] | null> = { all: null, students: ['student'], professors: ['professor'], organizations: ['organization'], staff: ['professor', 'organization'] };

export default route(['POST'], async (req: VercelRequest, res: VercelResponse) => {
  const caller = await requireAdmin(req);
  const db = adminDb();
  const b = (req.body ?? {}) as Record<string, unknown>;
  const outcome = b.outcome === 'upheld' ? 'upheld' : 'dismissed';

  /** Records an upheld violation, applies the penalty ladder, tells the user. Returns what happened (and who) for the admin. */
  async function punish(uid: string, source: 'wall' | 'chat', ref: string, excerpt: string, reportCount: number) {
    const user = (await db.ref(`users/${uid}`).get()).val();
    if (!user) return null;
    const level = ((await db.ref(`penaltyState/${uid}/level`).get()).val() as number | null) ?? 0;
    const n = level + 1;
    const { penalty, until } = penaltyFor(n);
    const vid = db.ref(`violations/${uid}`).push().key as string;
    const ups: Record<string, unknown> = {
      [`penaltyState/${uid}/level`]: n,
      [`violations/${uid}/${vid}`]: { source, ref, excerpt: excerpt.slice(0, 500), reportCount, decidedBy: caller.uid, at: Date.now(), offence: n, penalty },
    };
    if (until) ups[`mutes/${uid}`] = { until, level: penalty, since: Date.now(), reason: 'Upheld violation', offence: n };
    await db.ref().update(ups);
    const where = source === 'wall' ? 'on the Freedom Wall' : 'in a group chat';
    await deliver([uid], {
      kind: penalty === 'warning' ? 'violation' : 'mute',
      title: penalty === 'warning' ? 'Warning: a post of yours broke the rules' : penalty === 'permanent' ? 'Your account was permanently muted' : 'Your account was muted',
      body: `A report about something you wrote ${where} was reviewed and upheld by an administrator: “${excerpt.slice(0, 160)}”.\n\n${PENALTY_TEXT[penalty]}${until && penalty !== 'permanent' ? ` Muted until ${fmt(until)}.` : ''}\n\nOffence ${n}. Please read the Freedom Wall terms.`,
      link: '/profile',
    });
    await logActivity(caller.uid, 'moderation.uphold', `${source} ${ref} → ${user.studentId} (offence ${n}, ${penalty})`);
    return { uid, studentId: user.studentId as string, fullName: user.fullName as string, offence: n, penalty: penalty as Penalty, until };
  }

  async function tellReporters(reporters: string[], upheld: boolean) {
    await deliver(reporters, { kind: 'report', title: upheld ? 'Your report was upheld' : 'Your report was reviewed', body: upheld ? 'Thank you. An administrator reviewed what you reported and took action.' : 'An administrator reviewed what you reported and found no violation of the rules. Thank you for looking out.' }, 'account');
  }

  switch (b.action) {
    case 'resolvePost': {
      const postId = clean(b.postId, 80);
      const reportsSnap = await db.ref('reports').orderByChild('postId').equalTo(postId).get();
      const reports: Array<{ id: string; reporterId: string; status: string }> = [];
      reportsSnap.forEach((r) => { reports.push({ id: String(r.key), ...(r.val() as { reporterId: string; status: string }) }); });
      const open = reports.filter((r) => r.status === 'open');
      if (!open.length) throw new HttpError(409, 'There is no open report on this post.');
      const reporters = open.map((r) => r.reporterId);
      if (outcome === 'dismissed') {
        const ups: Record<string, unknown> = {};
        open.forEach((r) => { ups[`reports/${r.id}/status`] = 'dismissed'; });
        await db.ref().update(ups);
        await logActivity(caller.uid, 'moderation.dismiss_report', `post ${postId}`);
        await tellReporters(reporters, false);
        res.status(200).json({ ok: true }); return;
      }
      const post = ((await db.ref(`freedomWall/${postId}`).get()).val() ?? (await db.ref(`freedomWallQueue/${postId}`).get()).val()) as { content?: string } | null;
      const authorUid = (await db.ref(`freedomWallPrivate/${postId}/uid`).get()).val() as string | null;
      const result = authorUid ? await punish(authorUid, 'wall', postId, post?.content ?? '(post already removed)', open.length) : null;
      const ups: Record<string, unknown> = { [`freedomWall/${postId}`]: null, [`freedomWallQueue/${postId}`]: null, [`freedomWallPrivate/${postId}`]: null };
      if (authorUid) ups[`userPosts/${authorUid}/${postId}`] = null;
      open.forEach((r) => { ups[`reports/${r.id}/status`] = 'actioned'; });
      await db.ref().update(ups);
      await tellReporters(reporters, true);
      res.status(200).json({ ok: true, author: result }); return;
    }

    case 'resolveMessage': {
      const id = clean(b.reportId, 200);
      const r = (await db.ref(`messageReports/${id}`).get()).val();
      if (!r || r.status !== 'open') throw new HttpError(409, 'This report is no longer open.');
      if (outcome === 'dismissed') {
        await db.ref(`messageReports/${id}/status`).set('dismissed');
        await logActivity(caller.uid, 'moderation.dismiss_message_report', `${r.subjectCode} ${r.messageId}`);
        await tellReporters([r.reporterId], false);
        res.status(200).json({ ok: true }); return;
      }
      const result = await punish(r.snapshot.senderId, 'chat', `${r.subjectId}/${r.messageId}`, r.snapshot.content, 1);
      await db.ref().update({ [`messages/${r.subjectId}/${r.messageId}`]: null, [`messageReports/${id}/status`]: 'actioned' });
      await tellReporters([r.reporterId], true);
      res.status(200).json({ ok: true, author: result }); return;
    }

    case 'decideAppeal': {
      const uid = clean(b.uid, 128);
      const a = (await db.ref(`appeals/${uid}`).get()).val();
      if (!a || a.status !== 'pending') throw new HttpError(409, 'There is no pending appeal for this user.');
      const response = clean(b.response, 500);
      if (b.approve === true) {
        // privileges return; the next violation is a 7-day mute (not a restart from zero)
        await db.ref().update({ [`mutes/${uid}`]: null, [`penaltyState/${uid}/level`]: 3, [`appeals/${uid}`]: { ...a, status: 'approved', decidedAt: Date.now(), decidedBy: caller.uid, response: response || null } });
        await deliver([uid], { kind: 'appeal', title: 'Your appeal was approved', body: `Your posting and chat privileges are restored.${response ? `\n\nAdministrator's note: ${response}` : ''}\n\nPlease follow the rules: your next upheld violation means a 7-day mute.`, link: '/profile' });
      } else {
        const nextAllowedAt = Date.now() + APPEAL_COOLDOWN_MS;
        await db.ref(`appeals/${uid}`).set({ ...a, status: 'denied', decidedAt: Date.now(), decidedBy: caller.uid, response: response || null, nextAllowedAt });
        await deliver([uid], { kind: 'appeal', title: 'Your appeal was denied', body: `Your account stays muted.${response ? `\n\nAdministrator's note: ${response}` : ''}\n\nYou may send another appeal after ${fmt(nextAllowedAt)}.`, link: '/profile' });
      }
      await logActivity(caller.uid, b.approve === true ? 'moderation.appeal_approved' : 'moderation.appeal_denied', `user ${uid}`);
      res.status(200).json({ ok: true }); return;
    }

    case 'liftMute': {
      const uid = clean(b.uid, 128);
      if (!(await db.ref(`mutes/${uid}`).get()).exists()) throw new HttpError(409, 'This account is not muted.');
      await db.ref(`mutes/${uid}`).set(null);
      await logActivity(caller.uid, 'moderation.lift_mute', `user ${uid}`);
      await deliver([uid], { kind: 'mute', title: 'Your mute was lifted', body: 'An administrator ended your mute. You can post and chat again.', link: '/profile' });
      res.status(200).json({ ok: true }); return;
    }

    case 'broadcast': {
      const title = clean(b.title, 100); const body = clean(b.body, 1000); const audience = clean(b.audience, 20);
      if (title.length < 3 || body.length < 3) throw new HttpError(400, 'Enter a title and a message.');
      if (!(audience in AUDIENCES)) throw new HttpError(400, 'Pick who should receive this.');
      const roles = AUDIENCES[audience];
      const users = ((await db.ref('users').get()).val() ?? {}) as Record<string, { role: string; isActive?: boolean }>;
      const uids = Object.entries(users).filter(([, u]) => u.isActive === true && (!roles || roles.includes(u.role))).map(([id]) => id);
      await db.ref('broadcasts').push({ title, body, audience, by: caller.uid, createdAt: Date.now(), recipients: uids.length });
      await deliver(uids, { kind: 'update', title, body, link: '/profile' }, 'announcements');
      await logActivity(caller.uid, 'broadcast.send', `${audience}: ${title}`);
      res.status(200).json({ ok: true, recipients: uids.length }); return;
    }

    default:
      throw new HttpError(400, 'Unknown action.');
  }
});
