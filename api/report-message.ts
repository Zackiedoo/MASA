// POST /api/report-message { subjectId, messageId, reason } — a group member reports a chat message.
// Administrators cannot read group chats, so the SERVER copies the reported message (plus a little context) at report time.
// That snapshot is the only part of a chat an administrator ever sees.
import { adminUids, pushToUsers } from './_lib/push.js';
import { adminDb, getCaller, HttpError, route } from './_lib/admin.js';

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export default route(['POST'], async (req, res) => {
  const caller = await getCaller(req);
  const db = adminDb();
  const b = (req.body ?? {}) as Record<string, unknown>;
  const subjectId = clean(b.subjectId, 80); const messageId = clean(b.messageId, 80); const reason = clean(b.reason, 300);
  if (!subjectId || !messageId) throw new HttpError(400, 'Missing message.');
  if (reason.length < 3) throw new HttpError(400, 'Please say briefly what is wrong with this message.');
  const subject = (await db.ref(`subjects/${subjectId}`).get()).val();
  if (!subject) throw new HttpError(404, 'Course not found.');
  const isMember = subject.professorId === caller.uid || (await db.ref(`subjectMembers/${subjectId}/${caller.uid}`).get()).exists();
  if (!isMember) throw new HttpError(403, 'You are not in this group.');
  const msg = (await db.ref(`messages/${subjectId}/${messageId}`).get()).val();
  if (!msg) throw new HttpError(404, 'That message no longer exists.');
  if (msg.senderId === caller.uid) throw new HttpError(400, 'You cannot report your own message.');
  const key = `${messageId}_${caller.uid}`;
  if ((await db.ref(`messageReports/${key}`).get()).exists()) throw new HttpError(409, 'You already reported this message.');
  const before = (await db.ref(`messages/${subjectId}`).orderByChild('createdAt').endAt(msg.createdAt).limitToLast(5).get()).val() as Record<string, { senderName: string; content: string; createdAt: number }> | null;
  const context = Object.entries(before ?? {}).filter(([id]) => id !== messageId).sort((a, b2) => a[1].createdAt - b2[1].createdAt).slice(-4).map(([, m]) => ({ senderName: m.senderName, content: String(m.content).slice(0, 300), createdAt: m.createdAt }));
  await db.ref(`messageReports/${key}`).set({
    subjectId, subjectCode: subject.subjectCode, messageId, reporterId: caller.uid, reason, createdAt: Date.now(), status: 'open',
    snapshot: { senderId: msg.senderId, senderName: msg.senderName, content: String(msg.content).slice(0, 1000), createdAt: msg.createdAt }, context,
  });
  await pushToUsers(await adminUids(), 'admin', { title: 'Chat message reported', body: `A message in ${subject.subjectCode} was reported.`, link: '/admin' }).catch(() => 0);
  res.status(200).json({ ok: true });
});
