const assert=require('node:assert/strict')
const Core=require('./v202-core.js')
class MemoryStorage{
  constructor(){this.map=new Map();this.fail=false}
  getItem(k){return this.map.has(k)?this.map.get(k):null}
  setItem(k,v){if(this.fail)throw new Error('write blocked');this.map.set(k,String(v))}
  removeItem(k){this.map.delete(k)}
}
const storage=new MemoryStorage(),repo=Core.createRepository(storage)
assert.equal(repo.RELEASE,'2.0.2')
let state=repo.loadState()
assert.equal(state.version,'2.0.2')
assert.ok(Array.isArray(state.transactions))
state.transactions.push(repo.normalizeTransaction({id:'tx_manual',type:'expense',amount:12.5,title:'Test Einkauf',category:'Lebensmittel',date:'2026-08-09',source:'manual',createdAt:1000}))
state=repo.saveState(state,{method:'manual'})
assert.equal(repo.loadState().transactions.length,1)
assert.equal(repo.loadState().transactions[0].amount,12.5)
let audit=repo.readAudit()
assert.equal(repo.eventsFor('tx_manual',audit)[0].action,'created')
assert.equal(repo.latestMethod('tx_manual',audit,state.transactions[0]),'manual')
state.transactions[0].amount=13.5
state=repo.saveState(state,{method:'manual'})
audit=repo.readAudit()
assert.ok(repo.eventsFor('tx_manual',audit).some(e=>e.action==='updated'&&e.changes.includes('amount')))
const wallet=repo.importTransaction({id:'imp_wallet_1',type:'expense',amount:4.2,title:'BILLA',category:'Lebensmittel',date:'2026-08-09',note:'Apple Wallet'})
assert.equal(wallet.status,'imported')
assert.equal(repo.importTransaction({id:'imp_wallet_1',type:'expense',amount:4.2,title:'BILLA',category:'Lebensmittel',date:'2026-08-09'}).status,'duplicate')
audit=repo.readAudit()
const walletTx=repo.loadState().transactions.find(t=>t.id==='imp_wallet_1')
assert.equal(repo.latestMethod('imp_wallet_1',audit,walletTx),'wallet')
const beforeCorrupt=repo.loadState()
storage.setItem(repo.CORE_KEY,'{broken')
const recovered=repo.loadState()
assert.equal(recovered.transactions.length,beforeCorrupt.transactions.length)
assert.equal(recovered.transactions.find(t=>t.id==='tx_manual').amount,13.5)
repo.savePrefs({appearance:'dark',density:'compact',textSize:'large',privacy:true,reduceMotion:true,startRoute:'transactions'})
assert.equal(repo.loadPrefs().startRoute,'transactions')
const stable=repo.loadState()
storage.fail=true
assert.throws(()=>repo.saveState({...stable,openingBalance:999},{method:'manual'}),/write blocked/)
storage.fail=false
assert.notEqual(repo.loadState().openingBalance,999)
state=repo.loadState();state.transactions=state.transactions.filter(t=>t.id!=='tx_manual');repo.saveState(state,{method:'manual'})
assert.ok(repo.eventsFor('tx_manual',repo.readAudit()).some(e=>e.action==='deleted'))
repo.resetAll()
assert.equal(storage.getItem(repo.CORE_KEY),null)
assert.equal(storage.getItem(repo.BACKUP_KEY),null)
console.log('NEST v2.0.2 persistence regression tests passed.')
