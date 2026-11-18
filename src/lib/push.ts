// Web-push on the phone/desktop: registers the service worker, asks permission, and stores this device's Firebase Cloud Messaging
// token under the signed-in user. The server (api/notify.ts) later sends to those tokens. Nothing here works in demo mode.
import { deleteToken, getMessaging, getToken, onMessage, type Messaging } from 'firebase/messaging';
import { firebaseApp, isDemoMode } from './firebase';
import { patch } from './database';

const VAPID = (import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined)?.trim() || undefined; // optional: Firebase falls back to a default key
const keyStore = (uid: string) => `masa-push-key:${uid}`;

export type PushSupport = 'ok' | 'ios-install' | 'unsupported' | 'demo';

/** iPhones only allow notifications for apps added to the Home Screen. */
export function pushSupport(): PushSupport {
  if (isDemoMode || !firebaseApp) return 'demo';
  const hasApis = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'Notification' in window && 'PushManager' in window;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
  if (ios && !standalone) return 'ios-install';
  return hasApis ? 'ok' : 'unsupported';
}

export const permissionState = (): NotificationPermission | 'unsupported' => ('Notification' in window ? Notification.permission : 'unsupported');
export const isPushOn = (uid: string) => permissionState() === 'granted' && !!localStorage.getItem(keyStore(uid));

let messaging: Messaging | null = null;
const getMsg = () => (messaging ??= getMessaging(firebaseApp!));

function hash(s: string): string { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return `${h.toString(36)}${s.length.toString(36)}`; }

/** Asks permission (must be called from a tap), then registers this device. Throws a readable Error on failure. */
export async function enablePush(uid: string, askPermission = true): Promise<void> {
  if (pushSupport() !== 'ok') throw new Error('This browser cannot receive notifications.');
  if (Notification.permission === 'denied') throw new Error('Notifications are blocked for MASA. Allow them in your browser or phone settings, then try again.');
  if (Notification.permission !== 'granted') {
    if (!askPermission) return;
    const r = await Notification.requestPermission();
    if (r !== 'granted') throw new Error('Permission was not given, so notifications stay off.');
  }
  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const token = await getToken(getMsg(), { serviceWorkerRegistration: reg, ...(VAPID ? { vapidKey: VAPID } : {}) });
  if (!token) throw new Error('Could not get a notification address for this device. Try again.');
  const key = hash(token);
  await patch({ [`pushTokens/${uid}/${key}`]: { token, createdAt: Date.now(), ua: navigator.userAgent.slice(0, 190) } });
  localStorage.setItem(keyStore(uid), key);
}

export async function disablePush(uid: string): Promise<void> {
  const key = localStorage.getItem(keyStore(uid));
  localStorage.removeItem(keyStore(uid));
  if (key) await patch({ [`pushTokens/${uid}/${key}`]: null }).catch(() => undefined);
  try { await deleteToken(getMsg()); } catch { /* already gone */ }
}

/** Notifications that arrive while MASA is open are shown in the app (the browser does not show them itself). */
export function onForegroundPush(cb: (n: { title: string; body: string; link: string }) => void): () => void {
  if (pushSupport() !== 'ok') return () => undefined;
  return onMessage(getMsg(), (p) => cb({ title: p.data?.title ?? 'MASA', body: p.data?.body ?? '', link: p.data?.link ?? '/' }));
}
