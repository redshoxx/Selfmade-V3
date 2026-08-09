const CACHE='nest-v3.1.0-r6'
const SHELL=['/index.html','/v3.css?v=3.1.0-r6','/v3-shopping.css?v=3.1.0-r6','/v301-shopping.css?v=3.1.0-r6','/tasks-v3.1.css?v=3.1.0-r6','/v3-dialogs.css?v=3.1.0-r6','/boot-v2.0.2.js?v=3.1.0-r6','/v202-core-safe.js?v=3.1.0-r6','/shopping-core-v3.js?v=3.1.0-r6','/tasks-core-v3.1-fixed.js?v=3.1.0-r6','/tasks-v3.1.js?v=3.1.0-r6','/v202-wallet-guard.js?v=3.1.0-r6','/import-v2.0.2.js?v=3.1.0-r6','/app-v3.js?v=3.1.0-r6','/settings-v3.js?v=3.1.0-r6','/v301-shopping.js?v=3.1.0-r6','/manifest.webmanifest','/icon.svg']
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())))
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE&&(k.startsWith('nest-')||k.startsWith('selfmade-'))).map(k=>caches.delete(k)))).then(()=>self.clients.claim())))
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return
  const url=new URL(event.request.url)
  if(url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request,{cache:'reload'}).then(r=>{if(r&&r.ok)caches.open(CACHE).then(c=>c.put('/index.html',r.clone()));return r}).catch(()=>caches.match('/index.html')))
    return
  }
  event.respondWith(fetch(event.request,{cache:'reload'}).then(r=>{if(r&&r.ok)caches.open(CACHE).then(c=>c.put(event.request,r.clone()));return r}).catch(()=>caches.match(event.request)))
})
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{for(const client of list){if('focus' in client)return client.focus()}return clients.openWindow?clients.openWindow('/'):null}))})
