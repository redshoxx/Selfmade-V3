(function(root){
'use strict'
var RELEASE='2.2.0',scheduled=false,app=document.getElementById('app')
function apply(){scheduled=false;document.documentElement.dataset.nestRelease=RELEASE;document.title='NEST 2.2';var eyebrow=document.querySelector('#app header.top .eyebrow');if(eyebrow){var text=String(eyebrow.textContent||''),next=text.replace(/NEST\s+[0-9.]+/i,'NEST '+RELEASE);if(next!==text)eyebrow.textContent=next}}
function schedule(){if(scheduled)return;scheduled=true;if(typeof requestAnimationFrame==='function')requestAnimationFrame(apply);else setTimeout(apply,0)}
if(app)new MutationObserver(schedule).observe(app,{childList:true,subtree:true});schedule();root.NestReleaseV22=RELEASE
})(typeof globalThis!=='undefined'?globalThis:this)
