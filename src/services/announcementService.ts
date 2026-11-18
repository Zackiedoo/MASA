import { notifyServer } from '../lib/notifyApi';
import { newKey, patch, stamp } from '../lib/database';
import { safeFileName, uploadFile } from '../lib/storage';
import type { Announcement, Attachment, SourceType } from '../types';
import { logActivity } from './logService';

export interface AnnouncementInput {
  sourceType: SourceType;
  sourceId: string;
  sourceName: string;
  title: string;
  content: string;
  link?: string;
  attachments: Attachment[];
}

/** Uploads picked files to Storage (announcements/<uid>/…) and returns attachment records. */
export async function uploadAttachments(uid: string, files: File[], onProgress?: (pct: number) => void): Promise<Attachment[]> {
  const out: Attachment[] = [];
  for (const f of files) {
    const url = await uploadFile(`announcements/${uid}/${Date.now()}_${safeFileName(f.name)}`, f, onProgress);
    out.push({ name: f.name.slice(0, 200), url, type: f.type.startsWith('image/') ? 'image' : 'file' });
  }
  return out;
}

export async function createAnnouncement(uid: string, input: AnnouncementInput) {
  const id = newKey('announcements');
  await patch({
    [`announcements/${id}`]: {
      sourceType: input.sourceType, sourceId: input.sourceId, sourceName: input.sourceName,
      title: input.title, content: input.content, createdAt: stamp(), status: 'published', authorUid: uid,
      ...(input.link ? { link: input.link } : {}),
      ...(input.attachments.length ? { attachments: input.attachments } : {}),
    },
  });
  await logActivity(uid, 'announcement.publish', input.title);
  notifyServer({ type: 'announcement', id });
  return id;
}

export async function updateAnnouncement(uid: string, a: Announcement, input: Pick<AnnouncementInput, 'title' | 'content' | 'link' | 'attachments'>) {
  await patch({
    [`announcements/${a.id}/title`]: input.title,
    [`announcements/${a.id}/content`]: input.content,
    [`announcements/${a.id}/link`]: input.link || null,
    [`announcements/${a.id}/attachments`]: input.attachments.length ? input.attachments : null,
    [`announcements/${a.id}/updatedAt`]: stamp(),
  });
  await logActivity(uid, 'announcement.edit', input.title);
}

export async function setAnnouncementStatus(uid: string, a: Announcement, status: 'published' | 'archived') {
  await patch({ [`announcements/${a.id}/status`]: status, [`announcements/${a.id}/updatedAt`]: stamp() });
  await logActivity(uid, status === 'archived' ? 'announcement.archive' : 'announcement.restore', a.title);
}

export async function deleteAnnouncement(uid: string, a: Announcement) {
  await patch({ [`announcements/${a.id}`]: null });
  await logActivity(uid, 'announcement.delete', a.title);
}

// ───── administrator moderation ─────
/** Flags an announcement for follow-up (stays visible). Admin only; the database rules reject anyone else. */
export async function flagAnnouncement(admin: string, a: Announcement, flagged: boolean, reason = '') {
  await patch({ [`announcements/${a.id}/flagged`]: flagged ? true : null, [`announcements/${a.id}/flagReason`]: flagged && reason ? reason.slice(0, 200) : null });
  await logActivity(admin, flagged ? 'announcement.flag' : 'announcement.unflag', a.title);
}
/** Hides an announcement from every feed without deleting it. Only an administrator can hide or un-hide. */
export async function hideAnnouncement(admin: string, a: Announcement, hide: boolean) {
  await patch({ [`announcements/${a.id}/status`]: hide ? 'hidden' : 'published', [`announcements/${a.id}/updatedAt`]: stamp() });
  await logActivity(admin, hide ? 'announcement.hide' : 'announcement.unhide', a.title);
}
