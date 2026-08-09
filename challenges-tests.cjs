const assert=require('node:assert/strict')
const C=require('./challenges-v2.0.2.js')

assert.equal(C.TEMPLATES.length,12)
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

const t365=C.createTemplateChallenge('365x1',4000)
t365.completed=31
p=C.progressFor(t365)
assert.equal(p.saved,31)
assert.equal(p.next,1)
assert.equal(p.remaining,334)

const t2000=C.createTemplateChallenge('2000',5000)
t2000.completed=40
p=C.progressFor(t2000)
assert.equal(p.saved,2000)
assert.equal(p.next,0)
assert.equal(p.percent,100)

p=C.progressFor({id:'own',name:'Eigene',target:500,steps:10,completed:3,custom:true})
assert.equal(p.saved,150)
assert.equal(p.next,50)

const keys=C.activeTemplateKeys([t52,t30,{id:'own',name:'Eigene',target:100,steps:10,completed:0,custom:true}])
assert.equal(keys['52'],true)
assert.equal(keys['30x5'],true)
assert.equal(keys['1000'],undefined)

for(const template of C.TEMPLATES){
  const tx=C.createTemplateChallenge(template.key,6000)
  assert.ok(tx)
  tx.completed=tx.steps
  const complete=C.progressFor(tx)
  assert.equal(complete.saved,template.target,template.name+' muss am Ende exakt den Zielbetrag erreichen')
  assert.equal(complete.remaining,0)
  assert.equal(complete.percent,100)
}

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
console.log('NEST expanded challenge template regression tests passed.')
