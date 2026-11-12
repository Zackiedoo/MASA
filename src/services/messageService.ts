import { newKey, patch, stamp } from '../lib/database';
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
    [`subjectMembers/${subject.id}/${req.uid}`]: approve ? true : null,
  });
  await logActivity(prof, approve ? 'subject.approve_member' : 'subject.reject_member', `${subject.subjectCode}: ${req.studentId}`);
}

export async function sendMessage(subjectId: string, p: UserProfile, content: string) {
  const id = newKey(`messages/${subjectId}`);
  await patch({
    [`messages/${subjectId}/${id}`]: { senderId: p.uid, senderName: p.nickname, content, createdAt: stamp(), messageType: 'text' },
    [`subjectMeta/${subjectId}`]: { text: `${p.nickname}: ${content}`.slice(0, 140), at: stamp(), by: p.uid, kind: 'message' },
  });
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
}

export async function markRead(uid: string, subjectId: string) {
  await patch({ [`userReads/${uid}/${subjectId}`]: stamp() });
}
