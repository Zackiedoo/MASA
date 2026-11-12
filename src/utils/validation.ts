// Input validation / sanitisation. React escapes text on render, so these helpers focus on
// (a) normalising what we store and (b) rejecting content the Security Rules would reject anyway,
// so people get a friendly message instead of "permission denied".

/** Removes control characters and trims. Newlines are kept for multi-line text. */
export function cleanText(s: string, opts: { multiline?: boolean } = {}) {
  const re = opts.multiline ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g : /[\u0000-\u001f\u007f]/g;
  return s.replace(re, '').replace(/[ \t]{2,}/g, ' ').trim();
}

// A deliberately small list — a real deployment should extend it (and add moderation) for its own language mix.
const BLOCKED = ['fuck', 'shit', 'bitch', 'asshole', 'puta', 'gago', 'tangina', 'bobo', 'nigger', 'faggot'];
export const hasBlockedWord = (s: string) => {
  const t = s.toLowerCase().replace(/[^a-z0-9]+/g, '');
  return BLOCKED.some((w) => t.includes(w));
};

export function validateNickname(v: string): string | null {
  const s = cleanText(v);
  if (s.length < 2) return 'Nickname must be at least 2 characters.';
  if (s.length > 30) return 'Nickname must be 30 characters or fewer.';
  if (!/^[\p{L}\p{N} ._'-]+$/u.test(s)) return 'Nickname may only contain letters, numbers, spaces and . _ \' -';
  if (hasBlockedWord(s)) return 'Please choose a respectful nickname.';
  return null;
}
export function validateBio(v: string): string | null {
  if (v.length > 500) return 'Bio must be 500 characters or fewer.';
  if (hasBlockedWord(v)) return 'Please keep your bio respectful.';
  if (/https?:\/\//i.test(v)) return 'Links are not allowed in the bio.';
  return null;
}
export const isHttpUrl = (s: string) => {
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};
export const isHexColor = (s: string) => /^#[0-9a-fA-F]{6}$/.test(s);
export const isLoginId = (s: string) => /^[A-Za-z0-9-]{3,20}$/.test(s);

export function validatePassword(p: string): string | null {
  if (p.length < 8) return 'Use at least 8 characters.';
  if (!/[A-Za-z]/.test(p) || !/[0-9]/.test(p)) return 'Use both letters and numbers.';
  return null;
}
