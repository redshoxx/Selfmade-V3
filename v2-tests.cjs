const assert=require('node:assert/strict')
const V2=require('./v2-core.js')

assert.equal(V2.RELEASE,'2.0.0')
assert.equal(V2.classifySource({id:'imp_123',note:'Import: Apple Wallet'},true),'wallet')
assert.equal(V2.classifySource({id:'tx_123',note:''},true),'manual')
assert.equal(V2.classifySource({id:'tx_old',note:''},false),'legacy')

const a={id:'a',type:'expense',amount:12.9,title:'BILLA',category:'Lebensmittel',date:'2026-08-08',note:'',createdAt:1000}
const b={...a,date:'2026-08-09'}
assert.equal(V2.transactionSignature(a),V2.transactionSignature(b))
assert.deepEqual(V2.changedFields(a,b),['date'])

let audit={version:2,events:[]}
let previous={transactions:[]}
let next={transactions:[a]}
audit=V2.applyTransition(previous,next,audit,2000)
assert.equal(audit.events.length,1)
assert.equal(audit.events[0].action,'created')
assert.equal(audit.events[0].method,'manual')

previous=next
next={transactions:[{...a,amount:13.5}]}
audit=V2.applyTransition(previous,next,audit,3000)
assert.equal(audit.events.length,2)
assert.equal(audit.events[1].action,'updated')
assert.deepEqual(audit.events[1].changes,['amount'])

previous=next
next={transactions:[]}
audit=V2.applyTransition(previous,next,audit,4000)
assert.equal(audit.events.length,3)
assert.equal(audit.events[2].action,'deleted')

let migrated=V2.ensureAuditForExisting({transactions:[{...a,id:'old'}]},{version:2,events:[]},5000)
assert.equal(migrated.events[0].action,'migrated')
assert.equal(migrated.events[0].method,'legacy')
console.log('NEST v2.0.0: Audit-, Quellen- und Wiederholungslogik erfolgreich getestet.')
