import { notifyServer } from '../lib/notifyApi';
import { newKey, patch, read, stamp } from '../lib/database';
import type { JoinRequest, Subject, UserProfile } from '../types';
import { logActivity } from './logService';

export async function requestJoin(subject: Subject, p: UserProfile) {
  await patch({
    [`joinRequests/${subject.id}/${p.uid}`]: { studentId: p.studentId, studentName: p.fullName, status: 'pending', requestedAt: stamp() },
    [`userSubjects/${p.uid}/${subject.id}`]: 'pending',
  });
}

export async function decideRequest(prof: string, subject: Subject, req: JoinRequest & { uid: string }, approve: boolean) {
  const status = approve ? 'approved' : 'rejected';
  await patch({
    [`joinRequests/${subject.id}/${req.uid}`]: { studentId: req.studentId, studentName: req.studentName, status, requestedAt: req.requestedAt, decidedAt: stamp(), decidedBy: prof },
    [`userSubjects/${req.uid}/${subject.id}`]: status,
    [`subjectMembers/${subject.id}/${req.uid}`]: approve ? { studentId: req.studentId, fullName: req.studentName, enrolledAt: stamp(), by: prof } : null,
  });
  await logActivity(prof, approve ? 'subject.approve_member' : 'subject.reject_member', `${subject.subjectCode}: ${req.studentId}`);
  notifyServer({ type: 'membership', subjectId: subject.id, studentUid: req.uid });
}

export async function sendMessage(subjectId: string, p: UserProfile, content: string) {
  const id = newKey(`messages/${subjectId}`);
  await patch({
    [`messages/${subjectId}/${id}`]: { senderId: p.uid, senderName: p.nickname, content, createdAt: stamp(), messageType: 'text' },
    [`subjectMeta/${subjectId}`]: { text: `${p.nickname}: ${content}`.slice(0, 140), at: stamp(), by: p.uid, kind: 'message' },
  });
  notifyServer({ type: 'subject', subjectId });
}

export async function deleteMessage(subjectId: string, id: string) {
  await patch({ [`messages/${subjectId}/${id}`]: null });
}

export async function postClassUpdate(subjectId: string, prof: UserProfile, title: string, content: string, kind: 'announcement' | 'update') {
  const id = newKey(`classUpdates/${subjectId}`);
  await patch({
    [`classUpdates/${subjectId}/${id}`]: { professorId: prof.uid, title, content, createdAt: stamp(), kind },
    [`subjectMeta/${subjectId}`]: { text: `${kind === 'announcement' ? 'Announcement' : 'Update'}: ${title}`.slice(0, 140), at: stamp(), by: prof.uid, kind },
  });
  await logActivity(prof.uid, 'classupdate.post', title);
  notifyServer({ type: 'subject', subjectId });
}

export async function markRead(uid: string, subjectId: string) {
  await patch({ [`userReads/${uid}/${subjectId}`]: stamp() });
}

// ───── roster (the subject's professor, or an administrator) ─────
/** Enrolls an EXISTING student account (found by Student ID) in a course. Professors cannot create accounts. */
export async function enrollStudent(actor: string, subject: Subject, studentId: string): Promise<{ fullName: string }> {
  const id = studentId.trim();
  if (!/^[A-Za-z0-9-]{3,20}$/.test(id)) throw new Error('Enter a valid Student ID.');
  const hit = await read<{ uid: string; fullName: string }>(`studentIndex/${id}`).catch(() => null)
    ?? await read<{ uid: string; fullName: string }>(`studentIndex/${id.toLowerCase()}`).catch(() => null);
  if (!hit) throw new Error(`No student account was found with ID "${id}". Students must already have an account created by an administrator.`);
  if (await read(`subjectMembers/${subject.id}/${hit.uid}`).catch(() => null)) throw new Error(`${hit.fullName} is already enrolled in ${subject.subjectCode}.`);
  await patch({
    [`subjectMembers/${subject.id}/${hit.uid}`]: { studentId: id, fullName: hit.fullName, enrolledAt: stamp(), by: actor },
    [`userSubjects/${hit.uid}/${subject.id}`]: 'approved',
    [`joinRequests/${subject.id}/${hit.uid}`]: null, // a pending request, if any, is now moot
  });
  await logActivity(actor, 'subject.enroll_student', `${subject.subjectCode}: ${id}`);
  notifyServer({ type: 'membership', subjectId: subject.id, studentUid: hit.uid });
  return { fullName: hit.fullName };
}

export async function removeStudent(actor: string, subject: Subject, m: { uid: string; studentId: string }) {
  await patch({
    [`subjectMembers/${subject.id}/${m.uid}`]: null,
    [`userSubjects/${m.uid}/${subject.id}`]: null,
    [`joinRequests/${subject.id}/${m.uid}`]: null,
  });
  await logActivity(actor, 'subject.remove_student', `${subject.subjectCode}: ${m.studentId}`);
}
