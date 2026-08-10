'use strict'
const fs=require('node:fs')
const vm=require('node:vm')
const assert=require('node:assert/strict')
const Shopping=require('./shopping-core-v3.js')
const Tasks=require('./tasks-core-v3.1-fixed.js')

class CountingStorage{
  constructor(){this.map=new Map();this.getCount=0;this.setCount=0;this.removeCount=0}
  getItem(k){this.getCount++;return this.map.has(k)?this.map.get(k):null}
  setItem(k,v){this.setCount++;this.map.set(k,String(v))}
  removeItem(k){this.removeCount++;this.map.delete(k)}
}

function assertReadOnlyLoads(store,label){
  store.load()
  const before=store.status().performance
  for(let i=0;i<200;i++)store.load()
  const after=store.status().performance
  assert.equal(after.writes,before.writes,`${label}: reine Reads schreiben Hauptspeicher`)
  assert.equal(after.backupWrites,before.backupWrites,`${label}: reine Reads schreiben Backups`)
}

const shopStorage=new CountingStorage(),shop=Shopping.createStore(shopStorage)
assertReadOnlyLoads(shop,'Einkauf')
shop.addManual({name:'Milch',amount:1,unit:'stk'})
const shopWrites=shopStorage.setCount
for(let i=0;i<200;i++)shop.load()
assert.equal(shopStorage.setCount,shopWrites,'Einkauf: Cache verhindert wiederholte setItem-Aufrufe nicht')
assert.equal(shop.load().items.length,1,'Einkauf: Daten nach Cache-Optimierung verloren')

const taskStorage=new CountingStorage(),tasks=Tasks.createStore(taskStorage)
assertReadOnlyLoads(tasks,'Aufgaben')
tasks.add({title:'Performance Test',date:'2026-08-10'})
const taskWrites=taskStorage.setCount
for(let i=0;i<200;i++)tasks.load()
assert.equal(taskStorage.setCount,taskWrites,'Aufgaben: Cache verhindert wiederholte setItem-Aufrufe nicht')
assert.equal(tasks.load().tasks.length,1,'Aufgaben: Daten nach Cache-Optimierung verloren')

const coreStorage=new CountingStorage()
const context={
  console,Date,Math,Number,String,Array,Object,Boolean,RegExp,JSON,Intl,Map,Set,
  localStorage:coreStorage,
  addEventListener:()=>{},
  structuredClone:global.structuredClone
}
context.globalThis=context
vm.runInNewContext(fs.readFileSync('v202-core-safe.js','utf8'),context,{filename:'v202-core-safe.js',timeout:3000})
const Core=context.NestV202
assert.ok(Core&&typeof Core.loadState==='function','Finanzkern wurde nicht geladen')
assert.equal(Core.normalizePrefs({startRoute:'tasks'}).startRoute,'tasks','Aufgaben kann nicht als Startseite gespeichert werden')
const coreBefore=coreStorage.setCount
for(let i=0;i<200;i++)Core.loadState()
assert.equal(coreStorage.setCount,coreBefore,'Finanzkern: reine Reads erzeugen Speicherwrites')
let coreState=Core.loadState()
coreState.transactions.push(Core.normalizeTransaction({id:'perf_tx',type:'expense',amount:9.99,title:'Performance',category:'Sonstiges',date:'2026-08-10',source:'manual'}))
Core.saveState(coreState,{method:'manual'})
const coreAfterSave=coreStorage.setCount
for(let i=0;i<200;i++)Core.loadState()
assert.equal(coreStorage.setCount,coreAfterSave,'Finanzkern: Reads nach Save erzeugen weitere Writes')
assert.equal(Core.loadState().transactions.some(x=>x.id==='perf_tx'),true,'Finanzkern: gespeicherte Buchung fehlt')
const stable=Core.loadState(),manualBeforeCorrupt=coreStorage.setCount
coreStorage.setItem(Core.CORE_KEY,'{broken')
const recovered=Core.loadState()
assert.equal(recovered.transactions.length,stable.transactions.length,'Finanzkern: Recovery aus Backup fehlgeschlagen')
assert.ok(coreStorage.setCount>manualBeforeCorrupt+1,'Finanzkern: beschädigter Hauptspeicher wurde nicht repariert')

const app=fs.readFileSync('app-v3.js','utf8')
const bookings=fs.readFileSync('v32-bookings.js','utf8')
const taskUi=fs.readFileSync('tasks-v3.1.js','utf8')
const index=fs.readFileSync('index.html','utf8')
const css=fs.readFileSync('v44-performance.css','utf8')
assert.ok(app.includes("RELEASE='4.4.0',TX_BATCH=120"),'V4.4 Renderer/Batch fehlt')
assert.ok(app.includes("if(String(t.date||'')>today)return"),'Zukünftige Buchungen werden im Kontostand nicht ausgeschlossen')
assert.ok(app.includes('render(false,false)'),'Render ohne unnötiges Core-Reload fehlt')
assert.ok(app.includes("data-v3=\"tx-more\"")&&app.includes('txLimit+=TX_BATCH'),'Gestaffelte Buchungsliste fehlt')
assert.ok(app.includes('const currencyFormatter=new Intl.NumberFormat'),'Wiederverwendbarer Formatter fehlt')
assert.ok(bookings.includes('if(created>0)root.NestAppV3?.render?.(false);else schedule()'),'Buchungsmodul erzwingt weiterhin doppelten Render')
assert.ok(taskUi.includes("RELEASE='4.4.0'")&&taskUi.includes('lastTaskMarkup')&&taskUi.includes('linkStateCache'),'Aufgaben-Rendercache fehlt')
assert.ok(taskUi.includes("if(base===target)queueMicrotask(()=>root.NestAppV3?.render?.(false,false))"),'Aufgaben können bei gleicher Basisroute hängen bleiben')
assert.ok(!index.includes('var taskMode=false,saving=false')&&!index.includes('function saveTask(form)'),'Alter doppelter Aufgaben-Bridge ist noch aktiv')
assert.ok(css.includes('content-visibility:auto')&&css.includes('.v44-load-more'),'V4.4 Browser-Rendering-Optimierung fehlt')
assert.ok(css.includes('backdrop-filter:none!important'),'Mobile Blur-Optimierung fehlt')
console.log('NEST V4.4.0 performance, storage-cache, recovery, task routing and render regression tests passed')
