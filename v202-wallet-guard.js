(function(root){
'use strict'
function createGuard(Core){
  function isNearWalletDuplicate(incoming,state=Core.loadState(),audit=Core.readAudit()){
    const tx=Core.normalizeTransaction({...incoming,source:'wallet'}),sig=Core.transactionSignature(tx),created=Number(tx.createdAt)||Date.now()
    return (state.transactions||[]).some(existing=>{
      if(Core.transactionSignature(existing)!==sig||String(existing.date)!==String(tx.date))return false
      const method=Core.latestMethod(existing.id,audit,existing)
      if(method!=='wallet')return false
      const previous=Number(existing.createdAt)||0
      return previous>0&&Math.abs(created-previous)<=120000
    })
  }
  const original=Core.importTransaction.bind(Core)
  function importTransaction(transaction){const state=Core.loadState(),tx=Core.normalizeTransaction({...transaction,source:'wallet'});if(state.transactions.some(item=>String(item.id)===String(tx.id))||isNearWalletDuplicate(tx,state,Core.readAudit()))return{status:'duplicate',transaction:tx,state};return original(tx)}
  return{isNearWalletDuplicate,importTransaction}
}
if(typeof module!=='undefined'&&module.exports)module.exports={createGuard}
const Core=root.NestV202
if(!Core)return
const guard=createGuard(Core)
Core.importTransaction=guard.importTransaction
root.NestWalletGuardV202=guard
})(typeof globalThis!=='undefined'?globalThis:this)
