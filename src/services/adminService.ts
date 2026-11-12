import { newKey, patch, read, stamp, write } from '../lib/database';
import type { Organization, ScheduleSlot, Subject } from '../types';
import { logActivity } from './logService';

// ───── organizations ─────
export async function saveOrganization(actor: string, org: { id?: string; name: string; description: string; verified: boolean; logo?: string }) {
  const id = org.id ?? newKey('organizations');
  await patch({
    [`organizations/${id}/name`]: org.name,
    [`organizations/${id}/description`]: org.description,
    [`organizations/${id}/verified`]: org.verified,
    ...(org.logo !== undefined ? { [`organizations/${id}/logo`]: org.logo || null } : {}),
  });
  await logActivity(actor, org.id ? 'organization.edit' : 'organization.create', org.name);
  return id;
}
export async function updateOrgProfile(orgId: string, v: { description: string; logo?: string }) {
  await patch({ [`organizations/${orgId}/description`]: v.description, ...(v.logo ? { [`organizations/${orgId}/logo`]: v.logo } : {}) });
}
export async function deleteOrganization(actor: string, org: Organization) {
  await patch({ [`organizations/${org.id}`]: null });
  await logActivity(actor, 'organization.delete', org.name);
}

// ───── subjects ─────
export async function saveSubject(actor: string, s: { id?: string; subjectCode: string; subjectName: string; professorId: string; professorName: string; description: string }) {
  const id = s.id ?? newKey('subjects');
  const existing = s.id ? await read<Subject>(`subjects/${id}`) : null;
  await write(`subjects/${id}`, {
    subjectCode: s.subjectCode, subjectName: s.subjectName, professorId: s.professorId, professorName: s.professorName,
    ...(s.description ? { description: s.description } : {}), createdAt: existing?.createdAt ?? stamp(),
  });
  await logActivity(actor, s.id ? 'subject.edit' : 'subject.create', `${s.subjectCode} ${s.subjectName}`);
  return id;
}

/** Removes a subject and everything that hangs off it (membership, chat, schedule…). */
export async function deleteSubject(actor: string, s: Subject) {
  const members = (await read<Record<string, unknown>>(`subjectMembers/${s.id}`)) ?? {};
  const requests = (await read<Record<string, unknown>>(`joinRequests/${s.id}`)) ?? {};
  const updates: Record<string, null> = {};
  for (const root of ['subjects', 'classSchedules', 'classLists', 'subjectMembers', 'joinRequests', 'messages', 'classUpdates', 'subjectMeta', 'scheduleHistory']) updates[`${root}/${s.id}`] = null;
  for (const uid of new Set([...Object.keys(members), ...Object.keys(requests)])) updates[`userSubjects/${uid}/${s.id}`] = null;
  await patch(updates);
  await logActivity(actor, 'subject.delete', s.subjectCode);
}

export async function saveClassList(actor: string, s: Subject, rows: Array<{ studentId: string; fullName: string }>) {
  const obj: Record<string, { fullName: string }> = {};
  rows.forEach((r) => { obj[r.studentId] = { fullName: r.fullName }; });
  await write(`classLists/${s.id}`, rows.length ? obj : null);
  await logActivity(actor, 'subject.classlist', `${s.subjectCode}: ${rows.length} students`);
}

export async function removeSlotsAndAdd(subjectId: string, slots: Array<Pick<ScheduleSlot, 'day' | 'startTime' | 'endTime' | 'room'>>) {
  const obj: Record<string, unknown> = {};
  slots.forEach((s) => { obj[newKey(`classSchedules/${subjectId}`)] = { day: s.day, startTime: s.startTime, endTime: s.endTime, ...(s.room ? { room: s.room } : {}), status: 'green' }; });
  await write(`classSchedules/${subjectId}`, slots.length ? obj : null);
}

// ───── settings / requests ─────
export async function setRequireApproval(actor: string, on: boolean) {
  await patch({ 'settings/freedomWall/requireApproval': on });
  await logActivity(actor, 'settings.freedomwall_approval', on ? 'on' : 'off');
}
export async function resolveResetRequest(studentId: string) {
  await patch({ [`resetRequests/${studentId}/status`]: 'resolved' });
}
export async function submitResetRequest(studentId: string) {
  await write(`resetRequests/${studentId}`, { studentId, requestedAt: stamp(), status: 'open' });
}
export async function setMemoStatus(actor: string, memoId: string, status: 'draft' | 'published') {
  await patch({ [`memoranda/${memoId}/status`]: status });
  await logActivity(actor, 'memo.status', `${memoId}: ${status}`);
}

/** Publishes a draft memorandum: flips its status and creates the matching feed announcement (same id). */
export async function publishMemoDraft(actor: string, m: { id: string; office: 'di' | 'president'; referenceNumber: string; title: string; content: string; documentUrl: string }) {
  await patch({
    [`memoranda/${m.id}/status`]: 'published',
    [`announcements/${m.id}`]: {
      sourceType: m.office, sourceId: m.office, sourceName: m.office === 'di' ? 'Director for Instruction' : 'Office of the President',
      title: m.referenceNumber ? `${m.referenceNumber}: ${m.title}` : m.title,
      content: m.content || 'See the attached memorandum.', createdAt: stamp(), status: 'published', authorUid: actor, memoId: m.id,
      ...(m.documentUrl ? { attachments: [{ name: m.referenceNumber || 'Memorandum', url: m.documentUrl, type: 'file' }] } : {}),
    },
  });
  await logActivity(actor, 'memo.publish', m.referenceNumber || m.title);
}
