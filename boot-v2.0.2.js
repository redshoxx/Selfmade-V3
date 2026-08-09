(function(root){
'use strict'
var lastError=''
function clean(v){return String(v||'').slice(0,240)}
function showBootError(message){
  if(document.documentElement.hasAttribute('data-app-ready'))return
  var app=document.getElementById('app');if(!app)return
  var detail=clean(message||lastError||'Die App konnte nicht vollständig gestartet werden.')
  app.innerHTML='<main class="boot nest-boot-error"><div class="brand-mark">!</div><h1>Startfehler</h1><p>NEST konnte nicht vollständig geladen werden.</p><small>'+detail.replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]})+'</small><button type="button" id="nestBootReload">Neu laden</button></main>'
  var b=document.getElementById('nestBootReload');if(b)b.onclick=function(){location.reload()}
}
root.addEventListener('error',function(e){lastError=clean(e&&e.message||'JavaScript-Fehler');setTimeout(function(){showBootError(lastError)},50)})
root.addEventListener('unhandledrejection',function(e){var reason=e&&e.reason;lastError=clean(reason&&reason.message||reason||'Unbehandelter Startfehler');setTimeout(function(){showBootError(lastError)},50)})
setTimeout(function(){if(!document.documentElement.hasAttribute('data-app-ready'))showBootError(lastError||'Startzeit überschritten. Bitte neu laden.')},4500)
root.NestBootV202={showBootError:showBootError}
})(globalThis)
