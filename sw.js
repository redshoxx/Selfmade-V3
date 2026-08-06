const CACHE = 'selfmade-v1-20260806'
const CORE = [
  '/', '/index.html', '/loader.js', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png',
  '/app.bundle-0.bin', '/app.bundle-1.bin', '/app.bundle-2.bin', '/app.bundle-3.bin', '/app.bundle-4.bin',
  '/styles-0.bin', '/styles-1.bin'
]
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting()))
})
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()))
})
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
    const copy = response.clone()
    caches.open(CACHE).then((cache) => cache.put(event.request, copy))
    return response
  }).catch(() => event.request.mode === 'navigate' ? caches.match('/index.html') : cached)))
})
