(function(root){
'use strict'
const Core=root.NestV202
if(!Core)return
const original=Core.importTransaction.bind(Core)
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
Core.importTransaction=function(transaction){const state=Core.loadState(),tx=Core.normalizeTransaction({...transaction,source:'wallet'});if(state.transactions.some(item=>String(item.id)===String(tx.id))||isNearWalletDuplicate(tx,state,Core.readAudit()))return{status:'duplicate',transaction:tx,state};return original(tx)}
root.NestWalletGuardV202={isNearWalletDuplicate}
if(typeof module!=='undefined'&&module.exports)module.exports={isNearWalletDuplicate}
})(typeof globalThis!=='undefined'?globalThis:this)
