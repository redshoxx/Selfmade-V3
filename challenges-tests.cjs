const assert=require('node:assert/strict')
const C=require('./challenges-v2.0.2.js')

assert.equal(C.TEMPLATES.length,3)
assert.equal(C.isUntouchedAutoDefault({id:'builtin_52',name:'52-Wochen-Challenge',target:1378,steps:52,completed:0,deadline:'',custom:false}),true)
assert.equal(C.isUntouchedAutoDefault({id:'builtin_52',name:'52-Wochen-Challenge',target:1378,steps:52,completed:1,deadline:'',custom:false}),false)
assert.equal(C.isUntouchedAutoDefault({id:'builtin_52',name:'Meine 52 Wochen',target:1378,steps:52,completed:0,deadline:'',custom:false}),false)

const t52=C.createTemplateChallenge('52',1000)
t52.completed=3
let p=C.progressFor(t52)
assert.equal(p.saved,6)
assert.equal(p.next,4)
assert.equal(p.remaining,1372)

const t30=C.createTemplateChallenge('30x5',2000)
t30.completed=2
p=C.progressFor(t30)
assert.equal(p.saved,10)
assert.equal(p.next,5)

const t1000=C.createTemplateChallenge('1000',3000)
t1000.completed=4
p=C.progressFor(t1000)
assert.equal(p.saved,200)
assert.equal(p.next,50)

p=C.progressFor({id:'own',name:'Eigene',target:500,steps:10,completed:3,custom:true})
assert.equal(p.saved,150)
assert.equal(p.next,50)

const keys=C.activeTemplateKeys([t52,t30,{id:'own',name:'Eigene',target:100,steps:10,completed:0,custom:true}])
assert.equal(keys['52'],true)
assert.equal(keys['30x5'],true)
assert.equal(keys['1000'],undefined)

let saved=null
const mock={
  loadState(){return{transactions:[],goals:[],challenges:[
    {id:'builtin_52',name:'52-Wochen-Challenge',target:1378,steps:52,completed:0,deadline:'',custom:false},
    {id:'builtin_30x5',name:'30 Tage × 5 €',target:150,steps:30,completed:4,deadline:'',custom:false},
    {id:'custom_1',name:'Urlaub',target:600,steps:12,completed:0,deadline:'',custom:true}
  ]}},
  saveState(state){saved=state;return state}
}
assert.equal(C.cleanupOldDefaults(mock),1)
assert.equal(saved.challenges.length,2)
assert.ok(saved.challenges.some(x=>x.id==='builtin_30x5'))
assert.ok(saved.challenges.some(x=>x.id==='custom_1'))
console.log('NEST challenge template regression tests passed.')
