const CACHE = 'haushaltklar-v19-3-protection';
const CORE_ASSETS = [
  '/',
  '/index.html?v=19.3',
  '/styles.css?v=19.3',
  '/app.js?v=19.3',
  '/manifest.webmanifest?v=19.3',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => key === CACHE ? Promise.resolve() : caches.delete(key)));
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    clients.forEach((client) => client.postMessage({ type: 'SELFMADE_UPDATED', version: 19.3 }));
  })());
});

async function cacheFirstWithRefresh(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const refresh = fetch(request).then((response) => {
    if (response.ok && new URL(request.url).origin === self.location.origin) cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  if (cached) {
    refresh.catch(() => {});
    return cached;
  }
  return (await refresh) || Response.error();
}

async function navigationNetworkFirst(request) {
  const cache = await caches.open(CACHE);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);
  try {
    const response = await fetch(request, { signal: controller.signal, cache: 'no-cache' });
    if (response.ok) await cache.put('/index.html?v=19.3', response.clone());
    return response;
  } catch {
    return (await cache.match(request)) || (await cache.match('/index.html?v=19.3')) || Response.error();
  } finally {
    clearTimeout(timeout);
  }
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/') || url.origin !== self.location.origin || url.pathname === '/sw.js') return;

  if (event.request.mode === 'navigate') {
    event.respondWith(navigationNetworkFirst(event.request));
    return;
  }

  const versionedCore = ['/app.js', '/styles.css', '/manifest.webmanifest'].includes(url.pathname)
    || url.pathname.startsWith('/icon-')
    || url.pathname === '/icon.svg'
    || url.pathname === '/apple-touch-icon.png';

  if (versionedCore) {
    event.respondWith(cacheFirstWithRefresh(event.request));
    return;
  }

  event.respondWith(cacheFirstWithRefresh(event.request));
});
