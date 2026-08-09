(function(root){
'use strict'
const RELEASE='4.1.0',SYNC_KEY='nest-lidl-auto-v4.1',SYNC_MS=6*60*60*1000
let syncing=false,lastMessage='',observer=null
function nowInfo(){try{return JSON.parse(localStorage.getItem(SYNC_KEY)||'null')||{}}catch{return{}}}
function saveInfo(patch){const next={...nowInfo(),...patch};try{localStorage.setItem(SYNC_KEY,JSON.stringify(next))}catch{}return next}
function due(){const info=nowInfo();return !Number(info.lastSuccess)||Date.now()-Number(info.lastSuccess)>=SYNC_MS}
function fmtTime(ts){if(!ts)return'';try{return new Intl.DateTimeFormat('de-AT',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(ts))}catch{return''}}
function setRelease(){document.documentElement.dataset.nestRelease=RELEASE;const meta=document.querySelector('meta[name="nest-version"]');if(meta)meta.content=RELEASE;const top=document.querySelector('.v3-top>div>span');if(top)top.textContent='NEST · V'+RELEASE;document.title='NEST 4'}
function statusLabel(){const info=nowInfo();if(syncing)return'Aktualisiere Angebote …';if(lastMessage)return lastMessage;if(info.lastSuccess)return`Auto · ${fmtTime(info.lastSuccess)}`;return'Auto-Sync bereit'}
function enhanceStatus(){
  setRelease()
  const entry=document.querySelector('.v4-lidl-entry .v4-entry-copy')
  if(entry){let badge=entry.querySelector('.v41-auto-status');if(!badge){badge=document.createElement('span');badge.className='v41-auto-status';entry.appendChild(badge)}badge.textContent=statusLabel()}
  const toolbar=document.querySelector('.v4-lidl-dialog .v4-toolbar')
  if(toolbar&&!toolbar.querySelector('[data-v41-sync]')){const b=document.createElement('button');b.type='button';b.className='v4-secondary v41-sync-btn';b.dataset.v41Sync='1';b.textContent='↻ Jetzt aktualisieren';toolbar.prepend(b)}
  const head=document.querySelector('.v4-lidl-dialog .v4-hub-head>div')
  if(head){let s=head.querySelector('.v41-hub-status');if(!s){s=document.createElement('small');s.className='v41-hub-status';head.appendChild(s)}s.textContent=statusLabel()}
}
function schedule(){requestAnimationFrame(enhanceStatus)}
async function sync(force=false){
  const Lidl=root.NestLidlV4
  if(syncing||!Lidl)return{ok:false,error:'not_ready'}
  if(!force&&!due())return{ok:true,skipped:true}
  syncing=true;lastMessage='';schedule()
  try{
    const response=await fetch('/api/lidl-offers'+(force?'?force=1':''),{headers:{Accept:'application/json'},cache:'no-store'})
    const type=response.headers.get('content-type')||''
    if(!type.includes('application/json'))throw new Error('NEST Auto-Sync braucht den NEST Server')
    const data=await response.json()
    if(!response.ok||!data.ok)throw new Error(data.message||data.error||'Lidl-Angebote nicht erreichbar')
    if(!Array.isArray(data.offers)||!data.offers.length)throw new Error('Lidl hat derzeit keine automatisch lesbaren Angebote geliefert')
    const current=Lidl.load?.()||{},storeLabel=current.profile?.storeLabel||'Lidl Österreich'
    Lidl.mergeOffers(data.offers,{storeLabel})
    const at=Date.now();saveInfo({lastSuccess:at,lastCount:data.offers.length,lastError:'',sourceFetchedAt:data.fetchedAt||''})
    lastMessage=`${data.offers.length} Angebote aktualisiert`
    Lidl.schedule?.();Lidl.enhance?.()
    if(document.querySelector('.v3-main[data-page="shopping"]'))root.NestAppV3?.render?.(false)
    setTimeout(()=>{lastMessage='';schedule()},2600)
    return{ok:true,count:data.offers.length}
  }catch(error){
    console.error('NEST Lidl Auto-Sync',error)
    const message=String(error&&error.message||'Auto-Sync fehlgeschlagen').slice(0,120)
    saveInfo({lastError:message,lastAttempt:Date.now()});lastMessage=message;schedule();setTimeout(()=>{lastMessage='';schedule()},5000)
    return{ok:false,error:message}
  }finally{syncing=false;schedule()}
}
document.addEventListener('click',e=>{const b=e.target.closest?.('[data-v41-sync]');if(!b)return;e.preventDefault();e.stopPropagation();sync(true)},true)
const app=document.getElementById('app');if(app){observer=new MutationObserver(schedule);observer.observe(app,{childList:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{schedule();setTimeout(()=>sync(false),900)},{once:true});else{schedule();setTimeout(()=>sync(false),900)}
root.addEventListener('pageshow',()=>{schedule();if(due())sync(false)})
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&due())sync(false)})
setInterval(()=>{if(due())sync(false)},30*60*1000)
root.NestLidlAutoV41={RELEASE,SYNC_MS,sync,due,status:()=>({...nowInfo(),syncing})}
})(globalThis)
