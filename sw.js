const CACHE='nest-v3.1.0-r9'
const SHELL=['/index.html','/v3.css?v=3.1.0-r7','/v3-shopping.css?v=3.1.0-r7','/v301-shopping.css?v=3.1.0-r7','/tasks-v3.1.css?v=3.1.0-r7','/v3-dialogs.css?v=3.1.0-r7','/boot-v2.0.2.js?v=3.1.0-r7','/v202-core-safe.js?v=3.1.0-r7','/shopping-core-v3.js?v=3.1.0-r7','/tasks-core-v3.1-fixed.js?v=3.1.0-r7','/tasks-v3.1.js?v=3.1.0-r7','/v202-wallet-guard.js?v=3.1.0-r7','/import-v2.0.2.js?v=3.1.0-r7','/app-v3.js?v=3.1.0-r7','/settings-v3.js?v=3.1.0-r7','/v301-shopping.js?v=3.1.0-r7','/manifest.webmanifest','/icon.svg','/icon-maskable.svg']
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL.map(url=>new Request(url,{cache:'reload'})))).then(()=>self.skipWaiting())))
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE&&(k.startsWith('nest-')||k.startsWith('selfmade-'))).map(k=>caches.delete(k)))).then(()=>self.clients.claim())))
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return
  const url=new URL(event.request.url)
  if(url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request,{cache:'no-cache'}).then(response=>{
      if(response&&response.ok){
        const copy=response.clone()
        event.waitUntil(caches.open(CACHE).then(cache=>cache.put('/index.html',copy)).catch(()=>{}))
      }
      return response
    }).catch(()=>caches.match('/index.html')))
    return
  }
  event.respondWith(caches.match(event.request).then(cached=>{
    if(cached)return cached
    return fetch(event.request).then(response=>{
      if(response&&response.ok){
        const copy=response.clone()
        event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)).catch(()=>{}))
      }
      return response
    })
  }))
})
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{for(const client of list){if('focus' in client)return client.focus()}return clients.openWindow?clients.openWindow('/'):null}))})
