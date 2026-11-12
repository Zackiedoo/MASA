import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { firebaseStorage, isDemoMode } from './firebase';

export const MAX_UPLOAD = 10 * 1024 * 1024;
const ALLOWED = /^(image\/(png|jpeg|webp|gif)|application\/pdf|text\/plain|application\/(msword|vnd\.openxmlformats-officedocument\..+|vnd\.ms-.+))$/;

export function checkFile(file: File): string | null {
  if (file.size > MAX_UPLOAD) return `${file.name} is larger than 10 MB.`;
  if (!ALLOWED.test(file.type)) return `${file.name}: unsupported file type (use images, PDF, Word/Excel/PowerPoint or text).`;
  return null;
}

/**
 * Uploads a file and returns its public download URL.
 * Demo mode has no Storage: small files are embedded as data URLs (and therefore stay in this browser only).
 */
export async function uploadFile(path: string, file: File, onProgress?: (pct: number) => void): Promise<string> {
  const problem = checkFile(file);
  if (problem) throw new Error(problem);
  if (isDemoMode || !firebaseStorage) {
    if (file.size > 600 * 1024) throw new Error('Demo mode only supports files up to 600 KB (Firebase Storage is not configured).');
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(new Error('Could not read the file.'));
      fr.readAsDataURL(file);
    });
  }
  const task = uploadBytesResumable(ref(firebaseStorage, path), file, { contentType: file.type });
  await new Promise<void>((resolve, reject) => {
    task.on('state_changed', (s) => onProgress?.(Math.round((s.bytesTransferred / s.totalBytes) * 100)), reject, () => resolve());
  });
  return getDownloadURL(task.snapshot.ref);
}

export const safeFileName = (n: string) => n.replace(/[^A-Za-z0-9._-]+/g, '_').slice(-80);
