const CACHE = 'selfmade-v13-zoom-lock';
const VERSIONED_ASSETS = [
  '/index.html?v=13',
  '/styles.css?v=13',
  '/app.js?v=13',
  '/manifest.webmanifest?v=13',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(VERSIONED_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => key === CACHE ? Promise.resolve() : caches.delete(key)));
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    clients.forEach((client) => client.postMessage({ type: 'SELFMADE_UPDATED', version: 13 }));
  })());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/')) return;

  // Navigation and core code are network-first so an old Homescreen cache
  // can never keep obsolete app behavior alive after a deployment.
  const networkFirst = event.request.mode === 'navigate'
    || ['/index.html', '/app.js', '/styles.css', '/manifest.webmanifest', '/sw.js'].includes(url.pathname);

  if (networkFirst) {
    event.respondWith((async () => {
      try {
        const response = await fetch(event.request, { cache: 'no-store' });
        if (response.ok && url.origin === self.location.origin && url.pathname !== '/sw.js') {
          const cache = await caches.open(CACHE);
          await cache.put(event.request, response.clone());
        }
        return response;
      } catch {
        return (await caches.match(event.request)) || (await caches.match('/')) || (await caches.match('/index.html?v=13')) || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;
    const response = await fetch(event.request);
    if (response.ok && url.origin === self.location.origin) {
      const cache = await caches.open(CACHE);
      await cache.put(event.request, response.clone());
    }
    return response;
  })());
});
