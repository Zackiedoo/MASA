// MASA service worker — receives push notifications (sent by the server through Firebase Cloud Messaging) and opens the right page when tapped.
// It does not cache anything, so it can never serve stale pages.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let raw = {};
  try { raw = event.data ? event.data.json() : {}; } catch (_) { raw = { data: { body: event.data && event.data.text() } }; }
  const d = raw.data || raw.notification || raw;
  const title = d.title || 'MASA';
  event.waitUntil(self.registration.showNotification(title, {
    body: d.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { link: d.link || '/' },
    tag: d.link || undefined,   // a newer notice for the same page replaces the older one instead of piling up
    renotify: !!d.link,
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.link) || '/', self.location.origin).href;
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if (new URL(c.url).origin === self.location.origin) { await c.focus(); if ('navigate' in c) await c.navigate(url); return; }
    }
    await self.clients.openWindow(url);
  })());
});
