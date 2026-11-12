// POST /api/memos/ingest — memorandum ingestion endpoint (webhook + admin upload).
//
// Two ways to authenticate:
//   1. Header `x-masa-webhook-secret: <MEMO_WEBHOOK_SECRET>`  → for an external system (NOT connected yet; see README).
//   2. `Authorization: Bearer <Firebase ID token>` of an administrator → used by the dashboard's upload form.
//
// Body: { office: 'di' | 'president', referenceNumber?, title, content?, documentUrl?, publish?: boolean }
// Duplicate detection: a hash of (office + reference number) — or of (office + title + content) if no reference number —
// is claimed atomically in /memoHashes. A second submission gets HTTP 409.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash } from 'node:crypto';
import { adminDb, HttpError, logActivity, requireAdmin, route, safeEqual } from '../_lib/admin.js';

const OFFICES = {
  di: 'Director for Instruction',
  president: 'Office of the President',
} as const;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const clean = (v: unknown, max: number) => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max);

export default route(['POST'], async (req: VercelRequest, res: VercelResponse) => {
  // ── who is calling? ──
  const secret = process.env.MEMO_WEBHOOK_SECRET;
  const provided = String(req.headers['x-masa-webhook-secret'] || '');
  let uploader = 'webhook';
  let sourceType: 'webhook' | 'upload' = 'webhook';
  if (provided) {
    if (!secret || !safeEqual(provided, secret)) throw new HttpError(401, 'Invalid webhook secret.');
  } else {
    uploader = (await requireAdmin(req)).uid;
    sourceType = 'upload';
  }

  // ── validate ──
  const b = (req.body || {}) as Record<string, unknown>;
  const office = String(b.office) as keyof typeof OFFICES;
  if (!(office in OFFICES)) throw new HttpError(400, 'office must be "di" or "president".');
  const title = clean(b.title, 200);
  const content = clean(b.content, 5000);
  const referenceNumber = clean(b.referenceNumber, 60);
  const documentUrl = clean(b.documentUrl, 1000);
  if (title.length < 3) throw new HttpError(400, 'title is required.');
  if (!content && !documentUrl) throw new HttpError(400, 'Provide content text and/or a documentUrl.');
  if (documentUrl && !/^https?:\/\//.test(documentUrl)) throw new HttpError(400, 'documentUrl must be http(s).');
  const publish = b.publish !== false;

  // ── duplicate detection ──
  const key = referenceNumber ? `${office}|${norm(referenceNumber)}` : `${office}|${norm(title)}|${norm(content)}`;
  const hash = createHash('sha256').update(key).digest('hex').slice(0, 40);
  const db = adminDb();
  const memoRef = db.ref('memoranda').push();
  const claim = await db.ref(`memoHashes/${hash}`).transaction((cur) => (cur === null ? memoRef.key : undefined));
  if (!claim.committed) throw new HttpError(409, `Duplicate memorandum (already stored as ${claim.snapshot.val()}).`);

  // ── store ──
  const now = Date.now();
  const sourceName = OFFICES[office];
  await memoRef.set({
    office, referenceNumber, title, content, documentUrl, sourceType, contentHash: hash,
    status: publish ? 'published' : 'draft', publishedAt: now, uploadedBy: uploader,
  });
  if (publish) {
    // The announcement shares the memo's id so the feed entry and the memo stay linked without extra bookkeeping.
    const attachments = documentUrl ? [{ name: referenceNumber || 'Memorandum document', url: documentUrl, type: 'file' }] : undefined;
    await db.ref(`announcements/${memoRef.key}`).set({
      sourceType: office, sourceId: office, sourceName,
      title: referenceNumber ? `${referenceNumber}: ${title}` : title,
      content: content || 'See the attached memorandum.',
      createdAt: now, status: 'published', authorUid: uploader, memoId: memoRef.key,
      ...(attachments ? { attachments } : {}),
    });
  }
  await logActivity(uploader, publish ? 'memo.publish' : 'memo.save_draft', `${office}: ${referenceNumber || title}`);
  res.status(200).json({ id: memoRef.key, status: publish ? 'published' : 'draft' });
});
