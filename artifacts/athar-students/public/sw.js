// Cache only this public offline notice, never student data or authenticated pages.
const CACHE = 'athar-offline-v1';
const offlineUrl = new URL('offline.html', self.registration.scope).href;
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(offlineUrl)));
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key.startsWith('athar-offline-') && key !== CACHE)
        .map((key) => caches.delete(key)),
    )).then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.mode !== 'navigate' || event.request.method !== 'GET' ||
      !url.href.startsWith(self.registration.scope) ||
      /\/(api|__clerk|clerk)(\/|$)/.test(url.pathname)) return;
  event.respondWith(fetch(event.request).catch(async () =>
    (await caches.match(offlineUrl)) || Response.error(),
  ));
});

// Offline installation and consented reminders share ONE registration/scope.
// Never register a second worker at this scope: it would replace these handlers.
self.addEventListener('push', (event) => {
  const data = event.data?.json();
  if (!data) return;
  event.waitUntil(self.registration.showNotification(data.title, {
    body: data.body, tag: data.tag, dir: 'rtl', lang: 'ar',
    data: { url: data.url },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data.url, self.registration.scope);
  if (url.origin !== self.location.origin ||
      !url.pathname.startsWith(new URL(self.registration.scope).pathname) ||
      !url.pathname.endsWith('/roadmap')) return;
  event.waitUntil(self.clients.openWindow(url.href));
});
