const fs=require('node:fs')
const vm=require('node:vm')
function ok(cond,msg){if(!cond)throw new Error(msg)}
function clone(v){return JSON.parse(JSON.stringify(v))}
function ymd(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
const now=new Date(),startDate=ymd(new Date(now.getFullYear(),now.getMonth()-1,1))
const anchor={id:'tx_recurring_test',type:'expense',amount:19.99,title:'Test Abo',category:'Abos & Verträge',date:startDate,note:'',createdAt:1,updatedAt:1,source:'manual'}
let state={openingBalance:0,transactions:[anchor],goals:[],challenges:[]}
const storage=new Map()
const localStorage={getItem:k=>storage.has(k)?storage.get(k):null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)}
const Core={CORE_KEY:'core-test',loadState:()=>clone(state),saveState:next=>(state=clone(next),clone(state))}
const document={readyState:'complete',visibilityState:'visible',title:'',documentElement:{dataset:{}},querySelector:()=>null,querySelectorAll:()=>[],getElementById:()=>null,addEventListener:()=>{}}
const context={console,Intl,Date,Math,JSON,Number,String,Array,Map,Set,RegExp,encodeURIComponent,decodeURIComponent,localStorage,document,NestV202:Core,MutationObserver:class{observe(){}},requestAnimationFrame:fn=>fn(),setTimeout:()=>0,setInterval:()=>0,clearTimeout:()=>{},addEventListener:()=>{}}
context.globalThis=context
vm.runInNewContext(fs.readFileSync('v32-bookings.js','utf8'),context,{filename:'v32-bookings.js'})
const Rec=context.NestRecurringV321
ok(Rec&&typeof Rec.processDue==='function','Recurring API fehlt')
Rec.save({version:1,schedules:[{transactionId:anchor.id,frequency:'monthly',startDate,generated:[],createdAt:1,updatedAt:1}]})
const first=Rec.processDue(false)
ok(first===1,'Monatliche Fälligkeit wurde nicht genau einmal erzeugt')
ok(state.transactions.length===2,'Automatische Buchung fehlt')
const generated=state.transactions.find(t=>t.id!==anchor.id)
ok(generated&&generated.source==='system','Automatische Buchung ist nicht als Systembuchung markiert')
ok(generated.note.startsWith('@nest-recurring-occurrence:'),'Automatische Buchung hat keine Serienkennung')
const second=Rec.processDue(false)
ok(second===0&&state.transactions.length===2,'Doppelte wiederkehrende Buchung wurde erzeugt')
state.transactions=state.transactions.filter(t=>t.id===anchor.id)
const afterDelete=Rec.processDue(false)
ok(afterDelete===0&&state.transactions.length===1,'Bewusst gelöschte automatische Buchung wurde erneut erzeugt')
for(const frequency of ['monthly','quarterly','semiannual','yearly']){Rec.save({version:1,schedules:[{transactionId:anchor.id,frequency,startDate,generated:[],createdAt:1,updatedAt:1}]});ok(Rec.load().schedules[0].frequency===frequency,`Intervall fehlt: ${frequency}`)}
console.log('NEST V3.2.1 recurring behavior tests passed')
