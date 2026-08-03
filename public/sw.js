const CACHE='selfmade-v15-stability-smart-receipt';
const CORE=[
  '/','/index.html','/manifest.webmanifest?v=15','/src/app.js?v=15','/src/styles/app.css?v=15',
  '/icon.svg','/icon-192.png','/icon-512.png','/apple-touch-icon.png','/vendor/zxing-browser.min.js?v=15'
];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)));});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{for(const key of await caches.keys())if(key!==CACHE)await caches.delete(key);await self.clients.claim();const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});clients.forEach(client=>client.postMessage({type:'SELFMADE_UPDATE_READY',version:15}));})());});
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==location.origin)return;
  if(url.pathname.startsWith('/api/'))return;
  event.respondWith((async()=>{
    try{const response=await fetch(request);if(response.ok){const cache=await caches.open(CACHE);cache.put(request,response.clone());}return response;}
    catch{const cached=await caches.match(request,{ignoreSearch:true});return cached||caches.match('/index.html');}
  })());
});
self.addEventListener('push',event=>{
  let data={};try{data=event.data?.json()||{};}catch{data={body:event.data?.text()||''};}
  event.waitUntil(self.registration.showNotification(data.title||'Selfmade',{body:data.body||'Es gibt eine neue Erinnerung.',icon:'/icon-192.png',badge:'/icon-192.png',tag:data.tag||`selfmade-${Date.now()}`,data:{url:data.url||'/#start'}}));
});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil((async()=>{const url=event.notification.data?.url||'/#start';const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});const client=clients[0];if(client){await client.focus();client.postMessage({type:'NAVIGATE',url});}else await self.clients.openWindow(url);})());});
