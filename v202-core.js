(function(root){
'use strict'
const RELEASE='2.0.2'
const CORE_KEY='selfmade-save-v1'
const BACKUP_KEY='selfmade-save-v1-backup-v202'
const AUDIT_KEY='nest-audit-v2'
const PREF_KEY='nest-settings-v1.3'
const PROBE_KEY='nest-storage-probe-v202'
const TRACKED_FIELDS=['type','amount','title','category','date','note']
const METHOD_LABELS={manual:'Manuell in NEST',wallet:'Apple Wallet / Kurzbefehle',legacy:'Aus älterer NEST-Version',system:'NEST System'}
const DEFAULT_PREFS={appearance:'system',density:'comfortable',textSize:'normal',privacy:false,reduceMotion:false,startRoute:'overview'}
const ROUTES=new Set(['overview','transactions','goals','challenges'])

function safeParse(value,fallback=null){try{return JSON.parse(value)}catch{return fallback}}
function clone(value){if(typeof structuredClone==='function')return structuredClone(value);return JSON.parse(JSON.stringify(value))}
function num(value,fallback=0){const n=Number(value);return Number.isFinite(n)?n:fallback}
function text(value='',max=180){return String(value??'').trim().replace(/\s+/g,' ').slice(0,max)}
function uid(prefix='id'){return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,10)}`}
function iso(value=Date.now()){const d=new Date(value);return Number.isFinite(d.getTime())?d.toISOString():new Date().toISOString()}
function hashString(input=''){let h=2166136261;for(let i=0;i<input.length;i++){h^=input.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(16).padStart(8,'0')}
function defaultChallenges(){const now=Date.now();return[
  {id:'builtin_52',name:'52-Wochen-Challenge',target:1378,steps:52,completed:0,deadline:'',custom:false,createdAt:now},
  {id:'builtin_30x5',name:'30 Tage × 5 €',target:150,steps:30,completed:0,deadline:'',custom:false,createdAt:now},
  {id:'builtin_1000',name:'1.000-€-Challenge',target:1000,steps:20,completed:0,deadline:'',custom:false,createdAt:now}
]}
function initialState(){return{version:RELEASE,openingBalance:0,transactions:[],goals:[],challenges:defaultChallenges(),settings:{onboarded:true,theme:'light'}}}
function normalizeTransaction(x={}){const created=num(x.createdAt,Date.now());return{
  id:text(x.id||uid('tx'),80),type:x.type==='income'?'income':'expense',amount:Math.max(0,Math.round(num(x.amount)*100)/100),
  title:text(x.title||x.description||x.name||'Buchung',80),category:text(x.category||'Sonstiges',50),
  date:String(x.date||new Date().toISOString().slice(0,10)).slice(0,10),note:text(x.note||'',180),
  createdAt:created,updatedAt:num(x.updatedAt,created),source:['wallet','manual','legacy','system'].includes(x.source)?x.source:undefined
}}
function normalizeGoal(x={}){return{id:text(x.id||uid('goal'),80),name:text(x.name||'Sparziel',60),target:Math.max(0,num(x.target??x.targetAmount)),saved:Math.max(0,num(x.saved??x.currentAmount)),deadline:x.deadline?String(x.deadline).slice(0,10):'',createdAt:num(x.createdAt,Date.now())}}
function normalizeChallenge(x={}){const steps=Math.max(1,Math.round(num(x.steps??x.totalSteps,20)));return{id:text(x.id||uid('challenge'),80),name:text(x.name||x.title||'Challenge',70),target:Math.max(0,num(x.target??x.targetAmount??x.total)),steps,completed:Math.max(0,Math.min(steps,Math.round(num(x.completed??x.completedSteps,0)))),deadline:x.deadline?String(x.deadline).slice(0,10):'',custom:Boolean(x.custom),createdAt:num(x.createdAt,Date.now())}}
function normalizeState(raw){const s=raw&&typeof raw==='object'?raw:{};return{
  version:RELEASE,openingBalance:num(s.openingBalance),transactions:Array.isArray(s.transactions)?s.transactions.map(normalizeTransaction):[],
  goals:Array.isArray(s.goals)?s.goals.map(normalizeGoal):[],challenges:Array.isArray(s.challenges)?s.challenges.map(normalizeChallenge):defaultChallenges(),
  settings:{onboarded:true,theme:s.settings?.theme==='dark'?'dark':'light'}
}}
function normalizePrefs(raw={}){return{
  appearance:['system','light','dark'].includes(raw.appearance)?raw.appearance:DEFAULT_PREFS.appearance,
  density:['comfortable','compact'].includes(raw.density)?raw.density:DEFAULT_PREFS.density,
  textSize:['normal','large'].includes(raw.textSize)?raw.textSize:DEFAULT_PREFS.textSize,
  privacy:Boolean(raw.privacy),reduceMotion:Boolean(raw.reduceMotion),startRoute:ROUTES.has(raw.startRoute)?raw.startRoute:DEFAULT_PREFS.startRoute
}}
function snapshot(tx={}){const t=normalizeTransaction(tx);return{id:t.id,type:t.type,amount:t.amount,title:t.title,category:t.category,date:t.date,note:t.note,createdAt:t.createdAt,updatedAt:t.updatedAt,source:t.source}}
function signature(tx={}){const t=snapshot(tx);return[t.type,t.title.toLocaleLowerCase('de-AT'),t.amount.toFixed(2),t.category.toLocaleLowerCase('de-AT')].join('|')}
function inferMethod(tx={},isNew=false){if(tx.source==='wallet')return'wallet';if(tx.source==='manual')return'manual';const id=String(tx.id||''),note=String(tx.note||'');if(id.startsWith('imp_')||/apple\s*wallet|wallet\s*import|kurzbefehl/i.test(note))return'wallet';return isNew?'manual':'legacy'}
function changedFields(before={},after={}){const a=snapshot(before),b=snapshot(after);return TRACKED_FIELDS.filter(key=>String(a[key])!==String(b[key]))}
function readAuditRaw(value){const parsed=safeParse(value,null);if(parsed&&Array.isArray(parsed.events))return{version:2,events:parsed.events};if(Array.isArray(parsed))return{version:2,events:parsed};return{version:2,events:[]}}
function pushEvent(audit,event){audit.events.push({eventId:event.eventId||uid('evt'),transactionId:String(event.transactionId||''),action:event.action||'updated',at:event.at||iso(),method:event.method||'system',changes:Array.isArray(event.changes)?event.changes:[],snapshot:event.snapshot||null,previous:event.previous||null,originalAt:event.originalAt||null});if(audit.events.length>4000)audit.events=audit.events.slice(-4000);return audit}
function hasAudit(audit,id){return audit.events.some(e=>String(e.transactionId)===String(id))}
function ensureExistingAudit(state,audit,now=Date.now()){for(const tx of state.transactions||[]){if(!tx.id||hasAudit(audit,tx.id))continue;pushEvent(audit,{transactionId:tx.id,action:'migrated',at:iso(now),originalAt:tx.createdAt?iso(tx.createdAt):null,method:inferMethod(tx,false),snapshot:snapshot(tx)})}return audit}
function applyTransition(previous,next,audit,method='manual',now=Date.now()){
  const prev=new Map((previous.transactions||[]).map(tx=>[String(tx.id),tx])),nxt=new Map((next.transactions||[]).map(tx=>[String(tx.id),tx]))
  for(const [id,tx] of nxt){const old=prev.get(id);if(!old){pushEvent(audit,{transactionId:id,action:'created',at:iso(now),originalAt:tx.createdAt?iso(tx.createdAt):null,method:inferMethod(tx,true)==='wallet'?'wallet':method,snapshot:snapshot(tx)});continue}const changes=changedFields(old,tx);if(changes.length)pushEvent(audit,{transactionId:id,action:'updated',at:iso(now),method,changes,snapshot:snapshot(tx),previous:snapshot(old)})}
  for(const [id,tx] of prev)if(!nxt.has(id))pushEvent(audit,{transactionId:id,action:'deleted',at:iso(now),method,snapshot:snapshot(tx)})
  return audit
}
function eventsFor(id,audit){return(audit?.events||[]).filter(e=>String(e.transactionId)===String(id)).sort((a,b)=>String(b.at).localeCompare(String(a.at)))}
function latestMethod(id,audit,tx){const event=eventsFor(id,audit).find(e=>e.action==='created'||e.action==='migrated');return event?.method||inferMethod(tx,false)}
function methodLabel(method){return METHOD_LABELS[method]||METHOD_LABELS.system}

function createRepository(storage){
  let lastError=''
  function get(key){try{return storage.getItem(key)}catch(error){lastError=String(error?.message||error);return null}}
  function setVerified(key,value){const serialized=String(value);try{storage.setItem(key,serialized);if(storage.getItem(key)!==serialized)throw new Error('Gespeicherter Wert konnte nicht verifiziert werden');lastError='';return true}catch(error){lastError=String(error?.message||error);throw error}}
  function remove(key){try{storage.removeItem(key);return storage.getItem(key)===null}catch(error){lastError=String(error?.message||error);return false}}
  function probe(){try{setVerified(PROBE_KEY,'ok');remove(PROBE_KEY);return true}catch{return false}}
  function backupEnvelope(state){const clean=normalizeState(state),payload=JSON.stringify(clean);return JSON.stringify({schema:1,release:RELEASE,savedAt:iso(),checksum:hashString(payload),state:clean})}
  function readBackup(){const envelope=safeParse(get(BACKUP_KEY),null);if(!envelope||envelope.schema!==1||!envelope.state)return null;const clean=normalizeState(envelope.state),payload=JSON.stringify(clean);return hashString(payload)===envelope.checksum?clean:null}
  function writeBackup(state){try{setVerified(BACKUP_KEY,backupEnvelope(state));return true}catch{return false}}
  function rawState(){const parsed=safeParse(get(CORE_KEY),null);return parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?normalizeState(parsed):null}
  function loadState(){let state=rawState();if(!state){const backup=readBackup();state=backup||initialState();try{setVerified(CORE_KEY,JSON.stringify(state))}catch{}if(backup)lastError='Hauptspeicher wurde aus lokaler Sicherung wiederhergestellt'}else if(state.version!==RELEASE){state.version=RELEASE;try{setVerified(CORE_KEY,JSON.stringify(state))}catch{}}writeBackup(state);return clone(state)}
  function readAudit(){return readAuditRaw(get(AUDIT_KEY))}
  function writeAudit(audit){try{setVerified(AUDIT_KEY,JSON.stringify(audit));return true}catch{return false}}
  function saveState(next,{method='manual'}={}){
    const previous=rawState()||initialState(),clean=normalizeState(next);clean.version=RELEASE
    setVerified(CORE_KEY,JSON.stringify(clean))
    const audit=applyTransition(previous,clean,ensureExistingAudit(previous,readAudit()),method)
    writeAudit(audit);writeBackup(clean)
    return clone(clean)
  }
  function loadPrefs(){return normalizePrefs(safeParse(get(PREF_KEY),{}))}
  function savePrefs(prefs){const clean=normalizePrefs(prefs);setVerified(PREF_KEY,JSON.stringify(clean));return clone(clean)}
  function replaceAll(payload={}){const state=normalizeState(payload.core||payload.state||payload);setVerified(CORE_KEY,JSON.stringify(state));if(payload.audit)writeAudit(readAuditRaw(JSON.stringify(payload.audit)));if(payload.preferences)savePrefs(payload.preferences);writeBackup(state);return clone(state)}
  function resetAll(){remove(CORE_KEY);remove(BACKUP_KEY);remove(AUDIT_KEY);remove(PREF_KEY)}
  function importTransaction(transaction){const tx=normalizeTransaction({...transaction,source:'wallet'});if(!tx.id||tx.amount<=0)throw new Error('Ungültige Wallet-Transaktion');const state=loadState();if(state.transactions.some(item=>String(item.id)===String(tx.id)))return{status:'duplicate',transaction:tx,state};state.transactions.push(tx);const saved=saveState(state,{method:'wallet'});return{status:'imported',transaction:tx,state:saved}}
  function status(){return{available:probe(),lastError,coreKey:CORE_KEY,backupKey:BACKUP_KEY,release:RELEASE}}
  probe()
  const current=loadState(),audit=ensureExistingAudit(current,readAudit());writeAudit(audit)
  return{RELEASE,CORE_KEY,BACKUP_KEY,AUDIT_KEY,PREF_KEY,initialState,normalizeState,normalizeTransaction,normalizeGoal,normalizeChallenge,normalizePrefs,loadState,saveState,loadPrefs,savePrefs,readAudit,replaceAll,resetAll,importTransaction,status,transactionSignature:signature,transactionSnapshot:snapshot,eventsFor,latestMethod,methodLabel,changedFields}
}

const pure={RELEASE,CORE_KEY,BACKUP_KEY,AUDIT_KEY,PREF_KEY,initialState,normalizeState,normalizeTransaction,normalizeGoal,normalizeChallenge,normalizePrefs,transactionSignature:signature,transactionSnapshot:snapshot,changedFields,readAuditRaw,ensureExistingAudit,applyTransition,eventsFor,latestMethod,methodLabel,hashString,createRepository}
if(typeof module!=='undefined'&&module.exports)module.exports=pure
if(typeof localStorage!=='undefined'){root.NestV202=createRepository(localStorage);root.NestV2Core=root.NestV202}
})(typeof globalThis!=='undefined'?globalThis:this)
