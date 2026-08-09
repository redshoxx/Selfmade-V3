(function(root,factory){
'use strict'
var api=factory(root)
if(typeof module!=='undefined'&&module.exports)module.exports=api
if(root)root.NestShoppingCoreV22=api
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
'use strict'
var RELEASE='2.2.0'
var STORE_KEY='nest-shopping-v2.2'
var BACKUP_KEY='nest-shopping-v2.2-backup'
var PROBE_KEY='nest-shopping-probe-v2.2'
var memory={}
function memoryStorage(){return{getItem:function(k){return Object.prototype.hasOwnProperty.call(memory,k)?memory[k]:null},setItem:function(k,v){memory[k]=String(v)},removeItem:function(k){delete memory[k]}}}
function clone(v){return JSON.parse(JSON.stringify(v))}
function num(v,d){var x=Number(v);return Number.isFinite(x)?x:(d||0)}
function clean(v,max){return String(v==null?'':v).replace(/\s+/g,' ').trim().slice(0,max||180)}
function digits(v){return String(v==null?'':v).replace(/\D/g,'').slice(0,18)}
function uid(prefix){return(prefix||'shop')+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,10)}
function finiteOrNull(v){var x=Number(v);return Number.isFinite(x)?x:null}
function hashString(s){var h=2166136261,i;for(i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(16).padStart(8,'0')}
function defaultState(){return{version:RELEASE,items:[],updatedAt:Date.now()}}
function normalizeNutrition(n){n=n||{};return{energyKcal:finiteOrNull(n.energyKcal),energyKj:finiteOrNull(n.energyKj),fat:finiteOrNull(n.fat),saturatedFat:finiteOrNull(n.saturatedFat),carbs:finiteOrNull(n.carbs),sugars:finiteOrNull(n.sugars),protein:finiteOrNull(n.protein),salt:finiteOrNull(n.salt),fiber:finiteOrNull(n.fiber)}}
function normalizeProduct(p){if(!p||typeof p!=='object')return null;var code=digits(p.code||p.barcode);return{code:code,name:clean(p.name||p.productName||'Unbekanntes Produkt',120),brand:clean(p.brand||p.brands||'',100),quantity:clean(p.quantity||'',60),servingSize:clean(p.servingSize||'',60),image:clean(p.image||'',500),nutriscore:/^[a-e]$/i.test(String(p.nutriscoreGrade||p.nutriscore||''))?String(p.nutriscoreGrade||p.nutriscore).toLowerCase():'',ingredients:clean(p.ingredients||'',1200),allergens:Array.isArray(p.allergens)?p.allergens.map(function(x){return clean(x,80)}).filter(Boolean).slice(0,30):[],categories:clean(p.categories||'',300),nutrition:normalizeNutrition(p.nutrition),source:clean(p.source||'Open Food Facts',80),fetchedAt:num(p.fetchedAt,Date.now())}}
function normalizeItem(x){x=x||{};var product=normalizeProduct(x.product);var barcode=digits(x.barcode||(product&&product.code));return{id:clean(x.id||uid('item'),80),name:clean(x.name||(product&&product.name)||'Produkt',120),count:Math.max(1,Math.min(99,Math.round(num(x.count!=null?x.count:x.quantity,1)))),checked:Boolean(x.checked),barcode:barcode,product:product,note:clean(x.note||'',180),createdAt:num(x.createdAt,Date.now()),updatedAt:num(x.updatedAt,x.createdAt||Date.now())}}
function validState(s){return!!(s&&typeof s==='object'&&!Array.isArray(s)&&Array.isArray(s.items))}
function normalizeState(s){s=s&&typeof s==='object'?s:{};return{version:RELEASE,items:Array.isArray(s.items)?s.items.map(normalizeItem):[],updatedAt:num(s.updatedAt,Date.now())}}
function resolveStorage(input){if(input)return{storage:input,persistent:true,error:''};try{var s=root&&root.localStorage;if(!s)throw new Error('Lokaler Speicher nicht verfügbar');s.setItem(PROBE_KEY,'1');if(s.getItem(PROBE_KEY)!=='1')throw new Error('Speicherprüfung fehlgeschlagen');s.removeItem(PROBE_KEY);return{storage:s,persistent:true,error:''}}catch(e){return{storage:memoryStorage(),persistent:false,error:String(e&&e.message||e)}}}
function createStore(input){var resolved=resolveStorage(input),storage=resolved.storage,persistent=resolved.persistent,lastError=resolved.error
function parse(raw){try{return JSON.parse(raw)}catch(e){return null}}
function writeVerified(key,value){var text=String(value);storage.setItem(key,text);if(storage.getItem(key)!==text)throw new Error('Einkaufsdaten konnten nicht verifiziert werden')}
function envelope(state){var cleanState=normalizeState(state),payload=JSON.stringify(cleanState);return JSON.stringify({schema:1,release:RELEASE,savedAt:new Date().toISOString(),checksum:hashString(payload),state:cleanState})}
function readBackup(){var e=parse(storage.getItem(BACKUP_KEY));if(!e||e.schema!==1||!validState(e.state))return null;var cleanState=normalizeState(e.state);return hashString(JSON.stringify(cleanState))===e.checksum?cleanState:null}
function writeBackup(state){try{writeVerified(BACKUP_KEY,envelope(state));return true}catch(e){lastError=String(e&&e.message||e);return false}}
function load(){var raw=parse(storage.getItem(STORE_KEY)),state=validState(raw)?normalizeState(raw):null;if(!state)state=readBackup()||defaultState();try{writeVerified(STORE_KEY,JSON.stringify(state))}catch(e){lastError=String(e&&e.message||e)}writeBackup(state);return clone(state)}
function save(next){var cleanState=normalizeState(next);cleanState.updatedAt=Date.now();writeVerified(STORE_KEY,JSON.stringify(cleanState));writeBackup(cleanState);return clone(cleanState)}
function addManual(name,count){var state=load(),item=normalizeItem({name:name,count:count||1});if(!item.name||item.name==='Produkt')throw new Error('Produktname fehlt');state.items.unshift(item);return{item:item,state:save(state)}}
function addProduct(product,count){var p=normalizeProduct(product);if(!p||!p.code)throw new Error('Produktdaten ungültig');var state=load(),existing=null,i;for(i=0;i<state.items.length;i++)if(!state.items[i].checked&&state.items[i].barcode===p.code){existing=state.items[i];break}if(existing){existing.count=Math.min(99,existing.count+Math.max(1,Math.round(num(count,1))));existing.product=p;existing.name=p.name||existing.name;existing.updatedAt=Date.now();return{item:existing,state:save(state),merged:true}}var item=normalizeItem({name:p.name,count:count||1,barcode:p.code,product:p});state.items.unshift(item);return{item:item,state:save(state),merged:false}}
function toggle(id){var state=load(),found=false;state.items=state.items.map(function(it){if(it.id!==id)return it;found=true;it.checked=!it.checked;it.updatedAt=Date.now();return it});if(!found)throw new Error('Produkt nicht gefunden');return save(state)}
function setCount(id,count){var state=load(),found=false,value=Math.max(1,Math.min(99,Math.round(num(count,1))));state.items=state.items.map(function(it){if(it.id!==id)return it;found=true;it.count=value;it.updatedAt=Date.now();return it});if(!found)throw new Error('Produkt nicht gefunden');return save(state)}
function remove(id){var state=load(),before=state.items.length;state.items=state.items.filter(function(it){return it.id!==id});if(state.items.length===before)throw new Error('Produkt nicht gefunden');return save(state)}
function clearChecked(){var state=load();state.items=state.items.filter(function(it){return!it.checked});return save(state)}
function replace(data){if(!validState(data))throw new Error('Ungültige Einkaufsdaten');return save(data)}
function exportData(){return{version:RELEASE,state:load()}}
function importData(payload){var state=payload&&payload.state?payload.state:payload;return replace(state)}
function reset(){storage.removeItem(STORE_KEY);storage.removeItem(BACKUP_KEY);if(storage.getItem(STORE_KEY)!==null||storage.getItem(BACKUP_KEY)!==null)throw new Error('Einkaufsdaten konnten nicht vollständig gelöscht werden');return true}
function status(){return{persistent:persistent,available:persistent,lastError:lastError,storeKey:STORE_KEY,backupKey:BACKUP_KEY,release:RELEASE}}
return{RELEASE:RELEASE,STORE_KEY:STORE_KEY,BACKUP_KEY:BACKUP_KEY,normalizeProduct:normalizeProduct,normalizeItem:normalizeItem,normalizeState:normalizeState,load:load,save:save,addManual:addManual,addProduct:addProduct,toggle:toggle,setCount:setCount,remove:remove,clearChecked:clearChecked,replace:replace,exportData:exportData,importData:importData,reset:reset,status:status}}
var store=createStore()
return{RELEASE:RELEASE,STORE_KEY:STORE_KEY,BACKUP_KEY:BACKUP_KEY,normalizeProduct:normalizeProduct,normalizeItem:normalizeItem,normalizeState:normalizeState,validState:validState,createStore:createStore,store:store}
})
