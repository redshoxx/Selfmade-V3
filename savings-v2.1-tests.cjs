const assert=require('node:assert/strict')
const S=require('./savings-v2.1.js')

assert.equal(S.RELEASE,'2.1.0')
let p=S.goalProgress({target:1000,saved:250})
assert.equal(p.percent,25)
assert.equal(p.remaining,750)

p=S.challengeProgress({target:500,steps:10,completed:4})
assert.equal(p.percent,40)
assert.equal(p.saved,200)
assert.equal(p.remaining,300)

const t=S.totals({
  goals:[{target:1000,saved:250},{target:500,saved:500}],
  challenges:[{target:300,steps:10,completed:5},{target:200,steps:4,completed:1}]
})
assert.equal(t.items,4)
assert.equal(t.goalCount,2)
assert.equal(t.challengeCount,2)
assert.equal(t.goalSaved,750)
assert.equal(t.challengeSaved,200)
assert.equal(t.progressSaved,950)
assert.equal(t.target,2000)

console.log('NEST v2.1 unified savings regression tests passed.')
