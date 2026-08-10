(function(root){
'use strict'
var RELEASE='2.0.2'
var CORE_KEY='selfmade-save-v1'
var BACKUP_KEY='selfmade-save-v1-backup-v202'
var AUDIT_KEY='nest-audit-v2'
var PREF_KEY='nest-settings-v1.3'
var PROBE_KEY='nest-storage-probe-v202-safe'
var memoryData={}
var storageError=''
var persistent=true
var stateCacheRaw=null,stateCache=null,auditCacheRaw=null,auditCache=null,prefCacheRaw=null,prefCache=null
var perf={stateParses:0,stateWrites:0,backupWrites:0,auditParses:0,auditWrites:0,prefParses:0,prefWrites:0,recoveries:0}
function memoryStorage(){return{getItem:function(k){return Object.prototype.hasOwnProperty.call(memoryData,k)?memoryData[k]:null},setItem:function(k,v){memoryData[k]=String(v)},removeItem:function(k){delete memoryData[k]}}}
function resolveStorage(){try{var s=root.localStorage;s.setItem(PROBE_KEY,'1');if(s.getItem(PROBE_KEY)!=='1')throw new Error('Speicherprüfung fehlgeschlagen');s.removeItem(PROBE_KEY);return s}catch(e){persistent=false;storageError=String(e&&e.message||e||'Lokaler Speicher nicht verfügbar');return memoryStorage()}}
var storage=resolveStorage()
function parse(v,f){try{return JSON.parse(v)}catch(e){return f}}
function clone(v){if(typeof structuredClone==='function')try{return structuredClone(v)}catch(e){}return JSON.parse(JSON.stringify(v))}
function num(v,d){var n=Number(v);return Number.isFinite(n)?n:(d||0)}
function text(v,max){return String(v==null?'':v).trim().replace(/\s+/g,' ').slice(0,max||180)}
function uid(p){return (p||'id')+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,10)}
function iso(v){var d=new Date(v==null?Date.now():v);return Number.isFinite(d.getTime())?d.toISOString():new Date().toISOString()}
function hashString(s){var h=2166136261,i;for(i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(16).padStart(8,'0')}
function defaultChallenges(){var now=Date.now();return[{id:'builtin_52',name:'52-Wochen-Challenge',target:1378,steps:52,completed:0,deadline:'',custom:false,createdAt:now},{id:'builtin_30x5',name:'30 Tage × 5 €',target:150,steps:30,completed:0,deadline:'',custom:false,createdAt:now},{id:'builtin_1000',name:'1.000-€-Challenge',target:1000,steps:20,completed:0,deadline:'',custom:false,createdAt:now}]}
function initialState(){return{version:RELEASE,openingBalance:0,transactions:[],goals:[],challenges:defaultChallenges(),settings:{onboarded:true,theme:'light'}}}
function normalizeTransaction(x){x=x||{};var created=num(x.createdAt,Date.now());return{id:text(x.id||uid('tx'),80),type:x.type==='income'?'income':'expense',amount:Math.max(0,Math.round(num(x.amount,0)*100)/100),title:text(x.title||x.description||x.name||'Buchung',80),category:text(x.category||'Sonstiges',50),date:String(x.date||new Date().toISOString().slice(0,10)).slice(0,10),note:text(x.note||'',180),createdAt:created,updatedAt:num(x.updatedAt,created),source:['wallet','manual','legacy','system'].indexOf(x.source)>=0?x.source:undefined}}
function normalizeGoal(x){x=x||{};return{id:text(x.id||uid('goal'),80),name:text(x.name||'Sparziel',60),target:Math.max(0,num(x.target!=null?x.target:x.targetAmount,0)),saved:Math.max(0,num(x.saved!=null?x.saved:x.currentAmount,0)),deadline:x.deadline?String(x.deadline).slice(0,10):'',createdAt:num(x.createdAt,Date.now())}}
function normalizeChallenge(x){x=x||{};var steps=Math.max(1,Math.round(num(x.steps!=null?x.steps:x.totalSteps,20))),legacy=Array.isArray(x.doneSteps)?x.doneSteps.length:0,completed=x.completed!=null?x.completed:(x.completedSteps!=null?x.completedSteps:legacy);return{id:text(x.id||uid('challenge'),80),name:text(x.name||x.title||'Challenge',70),target:Math.max(0,num(x.target!=null?x.target:(x.targetAmount!=null?x.targetAmount:x.total),0)),steps:steps,completed:Math.max(0,Math.min(steps,Math.round(num(completed,0)))),deadline:x.deadline?String(x.deadline).slice(0,10):'',custom:Boolean(x.custom),createdAt:num(x.createdAt,Date.now())}}
function validState(v){return !!(v&&typeof v==='object'&&!Array.isArray(v)&&Array.isArray(v.transactions)&&Array.isArray(v.goals)&&Array.isArray(v.challenges))}
function normalizeState(raw){var s=raw&&typeof raw==='object'?raw:{};return{version:RELEASE,openingBalance:num(s.openingBalance,0),transactions:Array.isArray(s.transactions)?s.transactions.map(normalizeTransaction):[],goals:Array.isArray(s.goals)?s.goals.map(normalizeGoal):[],challenges:Array.isArray(s.challenges)?s.challenges.map(normalizeChallenge):defaultChallenges(),settings:{onboarded:true,theme:s.settings&&s.settings.theme==='dark'?'dark':'light'}}}
function normalizePrefs(p){p=p||{};return{appearance:['system','light','dark'].indexOf(p.appearance)>=0?p.appearance:'system',density:['comfortable','compact'].indexOf(p.density)>=0?p.density:'comfortable',textSize:['normal','large'].indexOf(p.textSize)>=0?p.textSize:'normal',privacy:Boolean(p.privacy),reduceMotion:Boolean(p.reduceMotion),startRoute:['overview','transactions','goals','challenges'].indexOf(p.startRoute)>=0?p.startRoute:'overview'}}
function snapshot(tx){var t=normalizeTransaction(tx);return{id:t.id,type:t.type,amount:t.amount,title:t.title,category:t.category,date:t.date,note:t.note,createdAt:t.createdAt,updatedAt:t.updatedAt,source:t.source}}
function signature(tx){var t=snapshot(tx);return[t.type,t.title.toLocaleLowerCase('de-AT'),t.amount.toFixed(2),t.category.toLocaleLowerCase('de-AT')].join('|')}
function inferMethod(tx,isNew){tx=tx||{};if(tx.source==='wallet')return'wallet';if(tx.source==='manual')return'manual';if(String(tx.id||'').indexOf('imp_')===0||/apple\s*wallet|wallet\s*import|kurzbefehl/i.test(String(tx.note||'')))return'wallet';return isNew?'manual':'legacy'}
function invalidateState(){stateCacheRaw=null;stateCache=null}
function invalidateAudit(){auditCacheRaw=null;auditCache=null}
function invalidatePrefs(){prefCacheRaw=null;prefCache=null}
function readAudit(){var raw=storage.getItem(AUDIT_KEY);if(raw===auditCacheRaw&&auditCache)return clone(auditCache);var a=parse(raw,null),next;if(a&&Array.isArray(a.events))next={version:2,events:a.events};else if(Array.isArray(a))next={version:2,events:a};else next={version:2,events:[]};auditCacheRaw=raw;auditCache=next;perf.auditParses++;return clone(next)}
function writeVerified(key,value){var s=String(value);storage.setItem(key,s);if(storage.getItem(key)!==s)throw new Error('Gespeicherter Wert konnte nicht verifiziert werden')}
function writeAudit(a){try{var clean={version:2,events:Array.isArray(a&&a.events)?a.events:[]},raw=JSON.stringify(clean);writeVerified(AUDIT_KEY,raw);auditCacheRaw=raw;auditCache=clean;perf.auditWrites++;return true}catch(e){storageError=String(e&&e.message||e);return false}}
function eventId(){return uid('evt')}
function pushEvent(a,e){a.events.push({eventId:e.eventId||eventId(),transactionId:String(e.transactionId||''),action:e.action||'updated',at:e.at||iso(),method:e.method||'system',changes:Array.isArray(e.changes)?e.changes:[],snapshot:e.snapshot||null,previous:e.previous||null,originalAt:e.originalAt||null});if(a.events.length>4000)a.events=a.events.slice(-4000)}
function eventsFor(id,a){return((a&&a.events)||[]).filter(function(e){return String(e.transactionId)===String(id)}).sort(function(x,y){return String(y.at).localeCompare(String(x.at))})}
function latestMethod(id,a,tx){var list=eventsFor(id,a),i;for(i=0;i<list.length;i++)if(list[i].action==='created'||list[i].action==='migrated')return list[i].method;return inferMethod(tx,false)}
function methodLabel(m){return m==='manual'?'Manuell in NEST':m==='wallet'?'Apple Wallet / Kurzbefehle':m==='legacy'?'Aus älterer NEST-Version':'NEST System'}
function changedFields(a,b){var A=snapshot(a),B=snapshot(b),keys=['type','amount','title','category','date','note'];return keys.filter(function(k){return String(A[k])!==String(B[k])})}
function ensureAudit(state,a){var known={},i,tx;for(i=0;i<a.events.length;i++)known[String(a.events[i].transactionId)]=true;for(i=0;i<state.transactions.length;i++){tx=state.transactions[i];if(!known[String(tx.id)])pushEvent(a,{transactionId:tx.id,action:'migrated',method:inferMethod(tx,false),originalAt:tx.createdAt?iso(tx.createdAt):null,snapshot:snapshot(tx)})}return a}
function transition(prev,next,a,method){var pm={},nm={},id,i,before,after,changes;for(i=0;i<prev.transactions.length;i++)pm[String(prev.transactions[i].id)]=prev.transactions[i];for(i=0;i<next.transactions.length;i++)nm[String(next.transactions[i].id)]=next.transactions[i];for(id in nm){after=nm[id];before=pm[id];if(!before)pushEvent(a,{transactionId:id,action:'created',method:inferMethod(after,true)==='wallet'?'wallet':method,originalAt:after.createdAt?iso(after.createdAt):null,snapshot:snapshot(after)});else{changes=changedFields(before,after);if(changes.length)pushEvent(a,{transactionId:id,action:'updated',method:method,changes:changes,snapshot:snapshot(after),previous:snapshot(before)})}}for(id in pm)if(!nm[id])pushEvent(a,{transactionId:id,action:'deleted',method:method,snapshot:snapshot(pm[id])});return a}
function backupEnvelope(state){var payload=JSON.stringify(state);return JSON.stringify({schema:1,release:RELEASE,savedAt:iso(),checksum:hashString(payload),state:state})}
function readBackup(){var e=parse(storage.getItem(BACKUP_KEY),null);if(!e||e.schema!==1||!validState(e.state))return null;var clean=normalizeState(e.state);return hashString(JSON.stringify(clean))===e.checksum?clean:null}
function writeBackup(state){try{writeVerified(BACKUP_KEY,backupEnvelope(state));perf.backupWrites++;return true}catch(e){storageError=String(e&&e.message||e);return false}}
function rawState(){var raw=storage.getItem(CORE_KEY);if(raw===stateCacheRaw&&stateCache)return clone(stateCache);var p=parse(raw,null);if(!validState(p)){stateCacheRaw=raw;stateCache=null;return null}var clean=normalizeState(p);stateCacheRaw=raw;stateCache=clean;perf.stateParses++;return clone(clean)}
function writeCore(state){var clean=normalizeState(state),raw=JSON.stringify(clean);writeVerified(CORE_KEY,raw);stateCacheRaw=raw;stateCache=clean;perf.stateWrites++;return clone(clean)}
function loadState(){var s=rawState(),b;if(s)return s;b=readBackup();s=b||initialState();perf.recoveries++;s=writeCore(s);writeBackup(s);return clone(s)}
function saveState(next,opt){var prev=rawState()||initialState(),clean=normalizeState(next),method=opt&&opt.method||'manual',a=ensureAudit(prev,readAudit());clean.version=RELEASE;clean=writeCore(clean);transition(prev,clean,a,method);writeAudit(a);writeBackup(clean);return clone(clean)}
function loadPrefs(){var raw=storage.getItem(PREF_KEY);if(raw===prefCacheRaw&&prefCache)return clone(prefCache);var clean=normalizePrefs(parse(raw,{}));prefCacheRaw=raw;prefCache=clean;perf.prefParses++;return clone(clean)}
function savePrefs(p){var clean=normalizePrefs(p),raw=JSON.stringify(clean);writeVerified(PREF_KEY,raw);prefCacheRaw=raw;prefCache=clean;perf.prefWrites++;return clone(clean)}
function replaceAll(payload){payload=payload||{};var src=payload.core||payload.state||payload;if(!validState(src))throw new Error('Ungültiger NEST Datenstand');var s=writeCore(src);if(payload.audit)writeAudit(payload.audit);if(payload.preferences)savePrefs(payload.preferences);writeBackup(s);return clone(s)}
function resetAll(){storage.removeItem(CORE_KEY);storage.removeItem(BACKUP_KEY);storage.removeItem(AUDIT_KEY);storage.removeItem(PREF_KEY);invalidateState();invalidateAudit();invalidatePrefs()}
function importTransaction(tx){var t=normalizeTransaction(Object.assign({},tx||{},{source:'wallet'}));if(!t.id||t.amount<=0)throw new Error('Ungültige Wallet-Transaktion');var s=loadState(),i;for(i=0;i<s.transactions.length;i++)if(String(s.transactions[i].id)===String(t.id))return{status:'duplicate',transaction:t,state:s};s.transactions.push(t);return{status:'imported',transaction:t,state:saveState(s,{method:'wallet'})}}
function status(){return{available:persistent,persistent:persistent,lastError:storageError,coreKey:CORE_KEY,backupKey:BACKUP_KEY,release:RELEASE,performance:clone(perf)}}
if(root&&typeof root.addEventListener==='function')root.addEventListener('storage',function(e){if(e.key===CORE_KEY)invalidateState();else if(e.key===AUDIT_KEY)invalidateAudit();else if(e.key===PREF_KEY)invalidatePrefs()})
var initial=loadState(),initialAudit=readAudit(),beforeAudit=initialAudit.events.length;initialAudit=ensureAudit(initial,initialAudit);if(initialAudit.events.length!==beforeAudit)writeAudit(initialAudit)
var API={RELEASE:RELEASE,CORE_KEY:CORE_KEY,BACKUP_KEY:BACKUP_KEY,AUDIT_KEY:AUDIT_KEY,PREF_KEY:PREF_KEY,initialState:initialState,normalizeState:normalizeState,normalizeTransaction:normalizeTransaction,normalizeGoal:normalizeGoal,normalizeChallenge:normalizeChallenge,normalizePrefs:normalizePrefs,isCoreStateCandidate:validState,loadState:loadState,saveState:saveState,loadPrefs:loadPrefs,savePrefs:savePrefs,readAudit:readAudit,replaceAll:replaceAll,resetAll:resetAll,importTransaction:importTransaction,status:status,transactionSignature:signature,transactionSnapshot:snapshot,eventsFor:eventsFor,latestMethod:latestMethod,methodLabel:methodLabel,changedFields:changedFields}
root.NestV202=API
root.NestV2Core=API
})(typeof globalThis!=='undefined'?globalThis:this)
