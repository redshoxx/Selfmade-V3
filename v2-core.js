(function(root){
'use strict'
const RELEASE='2.0.0'
const CORE_KEY='selfmade-save-v1'
const AUDIT_KEY='nest-audit-v2'
const TRACKED_FIELDS=['type','amount','title','category','date','note']
const METHOD_LABELS={manual:'Manuell in NEST',wallet:'Apple Wallet / Kurzbefehle',legacy:'Aus älterer NEST-Version',system:'NEST System'}

function safeParse(value,fallback){try{return JSON.parse(value)}catch{return fallback}}
function nowIso(now=Date.now()){const d=new Date(now);return Number.isFinite(d.getTime())?d.toISOString():new Date().toISOString()}
function eventId(){return `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,9)}`}
function normalizeText(value){return String(value??'').trim().replace(/\s+/g,' ')}
function transactionSnapshot(tx={}){return{
  id:String(tx.id||''),
  type:tx.type==='income'?'income':'expense',
  amount:Number.isFinite(Number(tx.amount))?Math.round(Number(tx.amount)*100)/100:0,
  title:normalizeText(tx.title||tx.description||tx.name||'Buchung').slice(0,80),
  category:normalizeText(tx.category||'Sonstiges').slice(0,50),
  date:String(tx.date||'').slice(0,10),
  note:normalizeText(tx.note||'').slice(0,180),
  createdAt:Number.isFinite(Number(tx.createdAt))?Number(tx.createdAt):0
}}
function transactionSignature(tx={}){const s=transactionSnapshot(tx);return [s.type,s.title.toLocaleLowerCase('de-AT'),s.amount.toFixed(2),s.category.toLocaleLowerCase('de-AT')].join('|')}
function inferredWallet(tx={}){const id=String(tx.id||''),note=String(tx.note||'');return id.startsWith('imp_')||/apple\s*wallet|wallet\s*import|kurzbefehl/i.test(note)}
function classifySource(tx={},isNew=false){if(inferredWallet(tx))return 'wallet';return isNew?'manual':'legacy'}
function methodLabel(method){return METHOD_LABELS[method]||METHOD_LABELS.system}
function changedFields(before={},after={}){const a=transactionSnapshot(before),b=transactionSnapshot(after);return TRACKED_FIELDS.filter(key=>String(a[key])!==String(b[key]))}
function readAuditValue(value){const parsed=safeParse(value,null);if(parsed&&typeof parsed==='object'&&Array.isArray(parsed.events))return{version:2,events:parsed.events};if(Array.isArray(parsed))return{version:2,events:parsed};return{version:2,events:[]}}
function hasAuditFor(audit,transactionId){return audit.events.some(event=>String(event.transactionId)===String(transactionId))}
function pushEvent(audit,event){audit.events.push({eventId:event.eventId||eventId(),transactionId:String(event.transactionId||''),action:String(event.action||'updated'),at:event.at||nowIso(),method:event.method||'system',changes:Array.isArray(event.changes)?event.changes:[],snapshot:event.snapshot||null,previous:event.previous||null,originalAt:event.originalAt||null});if(audit.events.length>3000)audit.events=audit.events.slice(-3000);return audit}
function ensureAuditForExisting(core,audit={version:2,events:[]},now=Date.now()){
  const txs=Array.isArray(core?.transactions)?core.transactions:[]
  for(const tx of txs){if(!tx?.id||hasAuditFor(audit,tx.id))continue;const snap=transactionSnapshot(tx);pushEvent(audit,{transactionId:snap.id,action:'migrated',at:nowIso(now),originalAt:snap.createdAt?nowIso(snap.createdAt):null,method:classifySource(tx,false),snapshot:snap})}
  return audit
}
function applyTransition(previous,next,audit={version:2,events:[]},now=Date.now()){
  const prevMap=new Map((Array.isArray(previous?.transactions)?previous.transactions:[]).map(tx=>[String(tx.id),tx]))
  const nextMap=new Map((Array.isArray(next?.transactions)?next.transactions:[]).map(tx=>[String(tx.id),tx]))
  for(const [id,tx] of nextMap){const before=prevMap.get(id);if(!before){const snap=transactionSnapshot(tx);pushEvent(audit,{transactionId:id,action:'created',at:nowIso(now),originalAt:snap.createdAt?nowIso(snap.createdAt):null,method:classifySource(tx,true),snapshot:snap});continue}const changes=changedFields(before,tx);if(changes.length)pushEvent(audit,{transactionId:id,action:'updated',at:nowIso(now),method:'manual',changes,snapshot:transactionSnapshot(tx),previous:transactionSnapshot(before)})}
  for(const [id,tx] of prevMap){if(!nextMap.has(id))pushEvent(audit,{transactionId:id,action:'deleted',at:nowIso(now),method:'manual',snapshot:transactionSnapshot(tx)})}
  return audit
}
function eventsFor(transactionId,audit){return (audit?.events||[]).filter(event=>String(event.transactionId)===String(transactionId)).sort((a,b)=>String(b.at).localeCompare(String(a.at)))}
function latestMethod(transactionId,audit,tx){const events=eventsFor(transactionId,audit);const exact=events.find(event=>['created','migrated'].includes(event.action));return exact?.method||classifySource(tx,false)}

const API={RELEASE,CORE_KEY,AUDIT_KEY,transactionSnapshot,transactionSignature,classifySource,methodLabel,changedFields,readAuditValue,ensureAuditForExisting,applyTransition,eventsFor,latestMethod}
root.NestV2Core=API
if(typeof module!=='undefined'&&module.exports)module.exports=API
if(typeof localStorage==='undefined'||typeof Storage==='undefined')return

const nativeSetItem=Storage.prototype.setItem
const nativeGetItem=Storage.prototype.getItem
const nativeRemoveItem=Storage.prototype.removeItem
function currentCore(){const parsed=safeParse(nativeGetItem.call(localStorage,CORE_KEY),null);return parsed&&typeof parsed==='object'?parsed:null}
function currentAudit(){return readAuditValue(nativeGetItem.call(localStorage,AUDIT_KEY))}
function persistAudit(audit){nativeSetItem.call(localStorage,AUDIT_KEY,JSON.stringify(audit))}
function migrate(){const core=currentCore();if(!core)return;const audit=ensureAuditForExisting(core,currentAudit());persistAudit(audit);if(core.version!==RELEASE){core.version=RELEASE;nativeSetItem.call(localStorage,CORE_KEY,JSON.stringify(core))}}

Storage.prototype.setItem=function(key,value){
  if(this===localStorage&&key===CORE_KEY){const previous=currentCore()||{transactions:[]};const next=safeParse(String(value),null);if(next&&typeof next==='object'){next.version=RELEASE;const audit=applyTransition(previous,next,currentAudit());persistAudit(audit);return nativeSetItem.call(this,key,JSON.stringify(next))}}
  return nativeSetItem.call(this,key,value)
}
Storage.prototype.removeItem=function(key){if(this===localStorage&&key===CORE_KEY)nativeRemoveItem.call(this,AUDIT_KEY);return nativeRemoveItem.call(this,key)}

migrate()
})(globalThis)
