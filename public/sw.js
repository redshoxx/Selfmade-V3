const CACHE = 'haushaltklar-v21-1-interaction-fix';
const STATIC = ['/', '/index.html', '/styles.css?v=21.1.0', '/app.js?v=21.1.0', '/manifest.webmanifest?v=21.1.0', '/icon.svg?v=21.1.0', '/icon-192.png?v=21.1.0', '/icon-512.png?v=21.1.0', '/apple-touch-icon.png?v=21.1.0'];
self.addEventListener('install', (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(STATIC)).then(() => self.skipWaiting())));
self.addEventListener('activate', (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then((response) => { caches.open(CACHE).then((cache) => cache.put('/index.html', response.clone())); return response; }).catch(() => caches.match('/index.html')));
    return;
  }
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => { if (response.ok) caches.open(CACHE).then((cache) => cache.put(request, response.clone())); return response; })));
});
