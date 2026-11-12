/** Best-effort extraction of memorandum details from pasted/plain text. Used to pre-fill the admin form — admins always review it. */
export interface ExtractedMemo { referenceNumber: string; title: string; office?: 'di' | 'president' }

export function extractMemoDetails(text: string): ExtractedMemo {
  const t = text.replace(/\r/g, '');
  const ref =
    t.match(/(?:memorandum|memo)\s*(?:order\s*)?(?:no\.?|number|#)\s*[:.]?\s*([A-Za-z0-9\-\/ ,.]+?(?:s\.?\s*(?:of\s*)?\d{4}|\d{4}))/i)?.[0] ||
    t.match(/\b(?:DI|OP|OOP)[\s-]*(?:MEMO|MEMORANDUM)?[\s-]*(?:NO\.?\s*)?\d{1,4}[\s,-]*(?:s\.?\s*)?\d{4}\b/i)?.[0] ||
    '';
  const subject = t.match(/^\s*(?:subject|re)\s*[:\-]\s*(.+)$/im)?.[1] || t.split('\n').map((l) => l.trim()).find((l) => l.length > 8) || '';
  const lower = t.toLowerCase();
  const office = /director\s+for\s+instruction/.test(lower) ? 'di' : /office\s+of\s+the\s+president/.test(lower) ? 'president' : undefined;
  return { referenceNumber: ref.replace(/\s+/g, ' ').trim().slice(0, 60), title: subject.replace(/\s+/g, ' ').trim().slice(0, 200), office };
}
