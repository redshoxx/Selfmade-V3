import {readFile} from 'node:fs/promises'
import vm from 'node:vm'
import assert from 'node:assert/strict'
const source=await readFile('app.js','utf8')
const context=vm.createContext({console,Date,Math,Number,String,Array,Object,Boolean,RegExp,JSON,Intl,Map,Set,globalThis:null})
context.globalThis=context
vm.runInContext(source,context,{timeout:2000})
const L=context.NestLogic
assert.equal(L.VERSION,'1.2.0')
let state=L.normalizeState({openingBalance:100,transactions:[{type:'income',amount:50,title:'Gehalt',date:'2026-08-08'},{type:'expense',amount:20,title:'Netflix',date:'2026-08-08'}],goals:[],challenges:[]})
assert.equal(L.summary(state,'2026-08').balance,130)
assert.ok(state.challenges.length>=3)
const c=L.createCustomChallenge({name:'Urlaub',target:600,steps:12,deadline:'2026-12-31'})
assert.equal(c.custom,true);assert.equal(c.target,600);assert.equal(c.steps,12);assert.equal(L.challengeProgress({...c,completed:6}).percent,50)
for(let i=0;i<1000;i++){const x=L.createCustomChallenge({name:`C${i}`,target:(i+1)*10,steps:(i%50)+1});const p=L.challengeProgress({...x,completed:Math.floor(x.steps/2)});assert.ok(p.percent>=0&&p.percent<=100)}
console.log('NEST V1.2.0: 1000 Challenge-Stresstests bestanden.')
