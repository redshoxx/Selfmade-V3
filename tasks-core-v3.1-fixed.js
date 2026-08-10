(function(root,factory){
'use strict'
var api=factory(root)
if(typeof module!=='undefined'&&module.exports)module.exports=api
if(root)root.NestTasksCoreV31=api
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
'use strict'
var RELEASE='3.1.0'
var STORE_KEY='nest-tasks-v3.1'
var BACKUP_KEY='nest-tasks-v3.1-backup'
var PROBE_KEY='nest-tasks-probe-v3.1'
var memory={}
var PRIORITIES=['low','normal','high']
var REPEATS=['none','daily','weekly','monthly']
var LINK_TYPES=['none','shopping','transaction','savings']
function memoryStorage(){return{getItem:function(k){return Object.prototype.hasOwnProperty.call(memory,k)?memory[k]:null},setItem:function(k,v){memory[k]=String(v)},removeItem:function(k){delete memory[k]}}}
function clone(v){if(typeof structuredClone==='function')try{return structuredClone(v)}catch(e){}return JSON.parse(JSON.stringify(v))}
function clean(v,max){return String(v==null?'':v).replace(/\s+/g,' ').trim().slice(0,max||180)}
function num(v,d){var n=Number(v);return Number.isFinite(n)?n:(d==null?0:d)}
function uid(prefix){return(prefix||'task')+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,9)}
function validDate(v){var s=String(v||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return'';var p=s.split('-').map(Number),d=new Date(p[0],p[1]-1,p[2],12,0,0,0);if(d.getFullYear()!==p[0]||d.getMonth()!==p[1]-1||d.getDate()!==p[2])return'';return s}
function validTime(v){return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(v||''))?String(v):''}
function localDate(d){d=d||new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function dateFromLocal(value,time){var date=validDate(value);if(!date)return null;var parts=date.split('-').map(Number),t=validTime(time||'09:00').split(':').map(Number),d=new Date(parts[0],parts[1]-1,parts[2],t[0]||0,t[1]||0,0,0);return Number.isFinite(d.getTime())?d:null}
function addDays(value,days){var d=dateFromLocal(value,'12:00');if(!d)return value;d.setDate(d.getDate()+days);return localDate(d)}
function nextMonthly(value){var d=dateFromLocal(value,'12:00');if(!d)return value;var day=d.getDate();d.setDate(1);d.setMonth(d.getMonth()+1);var last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();d.setDate(Math.min(day,last));return localDate(d)}
function nextDate(value,repeat){repeat=String(repeat||'none');if(repeat==='daily')return addDays(value,1);if(repeat==='weekly')return addDays(value,7);if(repeat==='monthly')return nextMonthly(value);return value}
function bucket(task,today){today=today||localDate();if(task.completed)return'completed';return task.date<=today?'today':'upcoming'}
function hashString(s){var h=2166136261,i;for(i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(16).padStart(8,'0')}
function normalizePriority(v){v=String(v||'normal');return PRIORITIES.indexOf(v)>=0?v:'normal'}
function normalizeRepeat(v){v=String(v||'none');return REPEATS.indexOf(v)>=0?v:'none'}
function normalizeLinkType(v){v=String(v||'none');return LINK_TYPES.indexOf(v)>=0?v:'none'}
function normalizeReminderMinutes(v){if(v==null||v==='')return null;var raw=Number(v);if(!Number.isFinite(raw))return null;var n=Math.round(raw);return[-1440,-60,-15,0].indexOf(n)>=0?n:null}
function normalizeTask(x,index){x=x||{};var date=validDate(x.date)||localDate();var completed=Boolean(x.completed);return{id:clean(x.id||uid('task'),90),title:clean(x.title||'Aufgabe',140),date:date,time:validTime(x.time),priority:normalizePriority(x.priority),reminderMinutes:normalizeReminderMinutes(x.reminderMinutes),repeat:normalizeRepeat(x.repeat),linkType:normalizeLinkType(x.linkType),linkId:clean(x.linkId||'',100),completed:completed,completedAt:completed?num(x.completedAt,Date.now()):0,createdAt:num(x.createdAt,Date.now()),updatedAt:num(x.updatedAt,x.createdAt||Date.now()),order:Number.isFinite(Number(x.order))?Number(x.order):num(index,0),seriesId:clean(x.seriesId||x.id||'',90),occurrenceOf:clean(x.occurrenceOf||'',90),remindedAt:num(x.remindedAt,0)}}
function validState(s){return!!(s&&typeof s==='object'&&!Array.isArray(s)&&Array.isArray(s.tasks))}
function normalizeState(s){s=s&&typeof s==='object'?s:{};var tasks=Array.isArray(s.tasks)?s.tasks.map(normalizeTask):[];return{version:RELEASE,tasks:tasks,updatedAt:num(s.updatedAt,Date.now())}}
function defaultState(){return{version:RELEASE,tasks:[],updatedAt:Date.now()}}
function resolveStorage(input){if(input)return{storage:input,persistent:true,error:''};try{var s=root&&root.localStorage;if(!s)throw new Error('Lokaler Speicher nicht verfügbar');s.setItem(PROBE_KEY,'1');if(s.getItem(PROBE_KEY)!=='1')throw new Error('Speicherprüfung fehlgeschlagen');s.removeItem(PROBE_KEY);return{storage:s,persistent:true,error:''}}catch(e){return{storage:memoryStorage(),persistent:false,error:String(e&&e.message||e)}}}
function createStore(input){var resolved=resolveStorage(input),storage=resolved.storage,persistent=resolved.persistent,lastError=resolved.error,cacheRaw=null,cacheState=null,perf={parses:0,writes:0,backupWrites:0,recoveries:0}
function parse(raw){try{return JSON.parse(raw)}catch(e){return null}}
function writeVerified(key,value){var text=String(value);storage.setItem(key,text);if(storage.getItem(key)!==text)throw new Error('Aufgabendaten konnten nicht verifiziert werden')}
function envelope(state){var payload=JSON.stringify(state);return JSON.stringify({schema:1,release:RELEASE,savedAt:new Date().toISOString(),checksum:hashString(payload),state:state})}
function readBackup(){var e=parse(storage.getItem(BACKUP_KEY));if(!e||!validState(e.state))return null;var normalized=normalizeState(e.state);if(e.checksum&&hashString(JSON.stringify(normalized))!==e.checksum)return null;return normalized}
function writeBackup(state){try{writeVerified(BACKUP_KEY,envelope(state));perf.backupWrites++;return true}catch(e){lastError=String(e&&e.message||e);return false}}
function remember(raw,state){cacheRaw=raw;cacheState=state;return clone(state)}
function load(){var rawText=storage.getItem(STORE_KEY);if(rawText===cacheRaw&&cacheState)return clone(cacheState);var raw=parse(rawText),state=validState(raw)?normalizeState(raw):null;if(state){perf.parses++;return remember(rawText,state)}state=readBackup()||defaultState();perf.recoveries++;try{var repaired=JSON.stringify(state);writeVerified(STORE_KEY,repaired);perf.writes++;remember(repaired,state)}catch(e){lastError=String(e&&e.message||e);cacheRaw=null;cacheState=null}writeBackup(state);return clone(state)}
function save(next){var cleanState=normalizeState(next);cleanState.updatedAt=Date.now();var raw=JSON.stringify(cleanState);writeVerified(STORE_KEY,raw);perf.writes++;cacheRaw=raw;cacheState=cleanState;writeBackup(cleanState);return clone(cleanState)}
function add(data){data=data||{};var state=load(),task=normalizeTask(Object.assign({},data,{id:data.id||uid('task'),createdAt:Date.now(),updatedAt:Date.now(),order:state.tasks.length?Math.max.apply(null,state.tasks.map(function(x){return num(x.order,0)}))+1:0}));if(!clean(data.title,140))throw new Error('Aufgabe fehlt');task.seriesId=task.seriesId||task.id;state.tasks.push(task);return{task:task,state:save(state)}}
function update(id,patch){var state=load(),found=false;state.tasks=state.tasks.map(function(t,i){if(t.id!==id)return t;found=true;return normalizeTask(Object.assign({},t,patch||{},{id:t.id,createdAt:t.createdAt,updatedAt:Date.now(),order:t.order}),i)});if(!found)throw new Error('Aufgabe nicht gefunden');return save(state)}
function createNextOccurrence(state,task){if(!task||task.repeat==='none'||!task.date)return null;var date=nextDate(task.date,task.repeat),series=task.seriesId||task.id,exists=state.tasks.some(function(x){return x.seriesId===series&&x.date===date&&!x.completed});if(exists)return null;var next=normalizeTask(Object.assign({},task,{id:uid('task'),date:date,completed:false,completedAt:0,createdAt:Date.now(),updatedAt:Date.now(),order:task.order+.01,seriesId:series,occurrenceOf:task.id,remindedAt:0}));state.tasks.push(next);return next}
function toggle(id){var state=load(),task=state.tasks.find(function(x){return x.id===id});if(!task)throw new Error('Aufgabe nicht gefunden');task.completed=!task.completed;task.completedAt=task.completed?Date.now():0;task.updatedAt=Date.now();task.remindedAt=0;if(task.completed)createNextOccurrence(state,task);return save(state)}
function remove(id){var state=load(),before=state.tasks.length;state.tasks=state.tasks.filter(function(t){return t.id!==id});if(state.tasks.length===before)throw new Error('Aufgabe nicht gefunden');return save(state)}
function moveTomorrow(id,baseDate){var tomorrow=addDays(baseDate||localDate(),1);return update(id,{date:tomorrow,completed:false,completedAt:0,remindedAt:0})}
function reorder(ids){ids=Array.isArray(ids)?ids:[];var state=load(),positions=new Map(ids.map(function(id,i){return[id,i]}));state.tasks=state.tasks.map(function(t){return positions.has(t.id)?Object.assign({},t,{order:positions.get(t.id),updatedAt:Date.now()}):t});return save(state)}
function reminderAt(task){if(!task||task.completed||task.reminderMinutes==null)return null;var d=dateFromLocal(task.date,task.time||'09:00');if(!d)return null;return d.getTime()+task.reminderMinutes*60000}
function dueReminders(now){now=num(now,Date.now());return load().tasks.filter(function(t){var at=reminderAt(t);return at!=null&&at<=now&&!t.completed&&(!t.remindedAt||t.remindedAt<at)})}
function markReminded(id,stamp){return update(id,{remindedAt:num(stamp,Date.now())})}
function replace(data){if(!validState(data))throw new Error('Ungültige Aufgabendaten');return save(data)}
function exportData(){return{version:RELEASE,state:load()}}
function importData(payload){var state=payload&&payload.state?payload.state:payload;return replace(state)}
function reset(){storage.removeItem(STORE_KEY);storage.removeItem(BACKUP_KEY);cacheRaw=null;cacheState=null;if(storage.getItem(STORE_KEY)!==null||storage.getItem(BACKUP_KEY)!==null)throw new Error('Aufgabendaten konnten nicht vollständig gelöscht werden');return true}
function status(){return{persistent:persistent,available:persistent,lastError:lastError,storeKey:STORE_KEY,backupKey:BACKUP_KEY,release:RELEASE,performance:clone(perf)}}
return{RELEASE:RELEASE,STORE_KEY:STORE_KEY,BACKUP_KEY:BACKUP_KEY,load:load,save:save,add:add,update:update,toggle:toggle,remove:remove,moveTomorrow:moveTomorrow,reorder:reorder,reminderAt:reminderAt,dueReminders:dueReminders,markReminded:markReminded,replace:replace,exportData:exportData,importData:importData,reset:reset,status:status}}
var store=createStore()
return{RELEASE:RELEASE,STORE_KEY:STORE_KEY,BACKUP_KEY:BACKUP_KEY,PRIORITIES:PRIORITIES,REPEATS:REPEATS,LINK_TYPES:LINK_TYPES,normalizeTask:normalizeTask,normalizeState:normalizeState,validState:validState,localDate:localDate,addDays:addDays,nextDate:nextDate,reminderAt:function(task){return store.reminderAt(task)},bucket:bucket,createStore:createStore,store:store}
})