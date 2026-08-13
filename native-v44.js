(function(root){
'use strict'
const API_ORIGIN='https://selfmade-v3.vercel.app'
const protocol=String(root.location?.protocol||'')
const native=protocol==='capacitor:'||protocol==='ionic:'
function apiUrl(path){const value=String(path||'');if(!native||!value.startsWith('/api/'))return value;return API_ORIGIN+value}
if(native){
  document.documentElement.dataset.nestNative='ios'
  const originalFetch=root.fetch?.bind(root)
  if(originalFetch){
    root.fetch=function(input,init){
      if(typeof input==='string')return originalFetch(apiUrl(input),init)
      if(input instanceof Request){
        const url=new URL(input.url)
        if(url.origin===root.location.origin&&url.pathname.startsWith('/api/')){
          const target=API_ORIGIN+url.pathname+url.search
          return originalFetch(new Request(target,input),init)
        }
      }
      return originalFetch(input,init)
    }
  }
  try{
    if(navigator.serviceWorker&&typeof navigator.serviceWorker.register==='function'){
      navigator.serviceWorker.register=function(){return Promise.resolve(null)}
    }
  }catch(_){}
}
root.NestNativeV44={isNative:native,platform:native?'ios':'web',apiOrigin:API_ORIGIN,apiUrl}
})(globalThis)
