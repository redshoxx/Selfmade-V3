const CACHE='nest-v2.0.1-svg-navigation'
const SHELL=['/index.html','/styles.css?v=2.0.0','/nav.css?v=2.0.0','/settings-v1.3.css?v=2.0.0','/v2.css?v=2.0.0','/v2-nav-center.css?v=2.0.1-svg-nav','/v2-core.js?v=2.0.0','/import.js?v=2.0.0','/app.js?v=2.0.0','/settings-v1.3.js?v=2.0.0','/v2-ui.js?v=2.0.0','/v2-nav-center.js?v=2.0.1-svg-nav','/manifest.webmanifest','/icon.svg']
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())))
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE&&(k.startsWith('nest-')||k.startsWith('selfmade-'))).map(k=>caches.delete(k)))).then(()=>self.clients.claim())))
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return
  const url=new URL(event.request.url);if(url.origin!==self.location.origin)return
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request,{cache:'reload'}).then(r=>{if(r&&r.ok)caches.open(CACHE).then(c=>c.put('/index.html',r.clone()));return r}).catch(()=>caches.match('/index.html')))
    return
  }
  event.respondWith(fetch(event.request).then(r=>{if(r&&r.ok)caches.open(CACHE).then(c=>c.put(event.request,r.clone()));return r}).catch(()=>caches.match(event.request)))
})
