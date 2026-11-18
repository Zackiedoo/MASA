// POST /api/notify — called by the app right after a user does something others should hear about.
// The server NEVER trusts the client's wording: it re-reads what was just written, checks the caller is allowed to have done it,
// and builds the notification text itself. Body: { type, ... } (see each case).
import { adminDb, getCaller, HttpError, route } from './_lib/admin.js';
import { adminUids, pushTest, pushToAll, pushToUsers } from './_lib/push.js';

const RECENT = 5 * 60 * 1000;
const clean = (v: unknown, max = 128) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const snip = (s: unknown, n = 110) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const STATUS_WORDS: Record<string, string> = { green: 'Class is on', yellow: 'Class may change', red: 'No class' };

export default route(['POST'], async (req, res) => {
  const caller = await getCaller(req);
  const db = adminDb();
  const b = (req.body ?? {}) as Record<string, unknown>;
  const type = clean(b.type, 30);

  /** The caller must be an admin or the professor of this subject. */
  async function subjectAsStaff(subjectId: string) {
    const s = (await db.ref(`subjects/${subjectId}`).get()).val();
    if (!s) throw new HttpError(404, 'Course not found.');
    if (caller.role !== 'admin' && s.professorId !== caller.uid) throw new HttpError(403, 'Only this course\'s professor can do that.');
    return s as { subjectCode: string; subjectName: string; professorId: string };
  }
  async function once(key: string, minGapMs: number) {
    const ref = db.ref(`notifyLog/${key}`);
    const last = (await ref.get()).val() as number | null;
    if (last && Date.now() - last < minGapMs) return false;
    await ref.set(Date.now());
    return true;
  }

  switch (type) {
    // { type:'announcement', id } — author (or admin) just published it → everyone with notifications on
    case 'announcement': {
      const id = clean(b.id);
      const a = (await db.ref(`announcements/${id}`).get()).val();
      if (!a || a.status !== 'published') throw new HttpError(404, 'Announcement not found.');
      if (a.authorUid !== caller.uid && caller.role !== 'admin') throw new HttpError(403, 'You can only notify about your own announcements.');
      if (typeof a.createdAt !== 'number' || Date.now() - a.createdAt > RECENT) throw new HttpError(409, 'This announcement is too old to send notifications for.');
      if (!(await once(`announcement_${id}`, Number.MAX_SAFE_INTEGER))) { res.status(200).json({ sent: 0 }); return; }
      const sent = await pushToAll('announcements', { title: `${snip(a.sourceName, 40)}: ${snip(a.title, 70)}`, body: snip(a.content), link: `/a/${id}` }, [caller.uid]);
      res.status(200).json({ sent }); return;
    }
    // { type:'subject', subjectId } — a chat message or class update was just posted in a group → its members
    case 'subject': {
      const sid = clean(b.subjectId);
      const s = (await db.ref(`subjects/${sid}`).get()).val();
      if (!s) throw new HttpError(404, 'Course not found.');
      const isMember = s.professorId === caller.uid || (await db.ref(`subjectMembers/${sid}/${caller.uid}`).get()).exists();
      if (!isMember && caller.role !== 'admin') throw new HttpError(403, 'You are not in this group.');
      const meta = (await db.ref(`subjectMeta/${sid}`).get()).val();
      if (!meta || meta.by !== caller.uid || typeof meta.at !== 'number' || Date.now() - meta.at > 2 * 60 * 1000) { res.status(200).json({ sent: 0 }); return; }
      const isChat = meta.kind === 'message';
      if (isChat && !(await once(`msg_${sid}`, 4000))) { res.status(200).json({ sent: 0 }); return; } // don't buzz phones for every line of a fast chat
      const members = Object.keys(((await db.ref(`subjectMembers/${sid}`).get()).val() as Record<string, unknown>) ?? {});
      const to = [...members, s.professorId].filter((u) => u !== caller.uid);
      const sent = await pushToUsers(to, isChat ? 'messages' : 'classes', { title: isChat ? `${s.subjectCode} · new message` : `${s.subjectCode} · ${meta.kind === 'announcement' ? 'announcement' : 'class update'}`, body: snip(meta.text), link: `/messages/${sid}` });
      res.status(200).json({ sent }); return;
    }
    // { type:'schedule', subjectId } — the professor just changed a class's status → enrolled students
    case 'schedule': {
      const sid = clean(b.subjectId);
      const s = await subjectAsStaff(sid);
      const hist = (await db.ref(`scheduleHistory/${sid}`).orderByChild('at').limitToLast(1).get()).val() as Record<string, { to: string; by: string; at: number; slotId: string }> | null;
      const h = hist ? Object.values(hist)[0] : null;
      if (!h || h.by !== caller.uid || Date.now() - h.at > 2 * 60 * 1000) { res.status(200).json({ sent: 0 }); return; }
      const slot = (await db.ref(`classSchedules/${sid}/${h.slotId}`).get()).val() as { day?: string; startTime?: string } | null;
      const members = Object.keys(((await db.ref(`subjectMembers/${sid}`).get()).val() as Record<string, unknown>) ?? {});
      const sent = await pushToUsers(members, 'classes', { title: `${s.subjectCode}: ${STATUS_WORDS[h.to] ?? 'Class update'}`, body: slot ? `${slot.day ?? ''} ${slot.startTime ?? ''}`.trim() : 'Check the schedule for details.', link: `/messages/${sid}` });
      res.status(200).json({ sent }); return;
    }
    // { type:'membership', subjectId, studentUid } — a join request was decided, or a professor enrolled someone
    case 'membership': {
      const sid = clean(b.subjectId); const studentUid = clean(b.studentUid);
      const s = await subjectAsStaff(sid);
      const status = (await db.ref(`userSubjects/${studentUid}/${sid}`).get()).val();
      if (status === 'approved') await pushToUsers([studentUid], 'account', { title: `You're enrolled in ${s.subjectCode}`, body: s.subjectName, link: `/messages/${sid}` });
      else if (status === 'rejected') await pushToUsers([studentUid], 'account', { title: `Join request declined`, body: `Your request to join ${s.subjectCode} was not approved.`, link: '/messages' });
      res.status(200).json({ ok: true }); return;
    }
    // { type:'report' } — a student reported a Freedom Wall post → administrators
    case 'report': {
      if (caller.role !== 'student') throw new HttpError(403, 'Only students report posts.');
      if (!(await once(`report_${caller.uid}`, 30000))) { res.status(200).json({ sent: 0 }); return; }
      const sent = await pushToUsers(await adminUids(), 'admin', { title: 'Freedom Wall report', body: 'A post was reported and needs review.', link: '/admin' });
      res.status(200).json({ sent }); return;
    }
    // { type:'test' } — sends a notification to the caller's own devices and says exactly what happened
    case 'test': {
      const r = await pushTest(caller.uid, { title: 'MASA test notification', body: 'If you can read this, notifications work on this device.', link: '/settings' });
      res.status(200).json(r); return;
    }
    default:
      throw new HttpError(400, 'Unknown notification type.');
  }
});
