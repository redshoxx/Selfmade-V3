(function(root){
'use strict'
const STORAGE_KEY='selfmade-save-v1'
const IMPORT_PARAM='nestImport'
const IMPORT_VERSION=1

function base64UrlToUtf8(value){
  const normalized=String(value||'').replace(/-/g,'+').replace(/_/g,'/')
  const padded=normalized+'='.repeat((4-normalized.length%4)%4)
  const binary=atob(padded)
  const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}
function decodeImport(value){
  const data=JSON.parse(base64UrlToUtf8(value))
  if(!data||data.version!==IMPORT_VERSION||!data.transaction)throw new Error('Ungültiger Import')
  return data.transaction
}
function normalizeTransaction(x={}){
  const amount=Number(x.amount)
  if(!x.id||!Number.isFinite(amount)||amount<=0)throw new Error('Ungültige Transaktion')
  return{
    id:String(x.id).slice(0,80),
    type:x.type==='income'?'income':'expense',
    amount:Math.round(amount*100)/100,
    title:String(x.title||'Wallet-Buchung').slice(0,80),
    category:String(x.category||'Sonstiges').slice(0,50),
    date:String(x.date||new Date().toISOString().slice(0,10)).slice(0,10),
    note:String(x.note||'Apple Wallet Import').slice(0,180),
    createdAt:Number.isFinite(Number(x.createdAt))?Number(x.createdAt):Date.now()
  }
}
function importTransaction(transaction,storage){
  const tx=normalizeTransaction(transaction)
  let state={version:'1.2.0',openingBalance:0,transactions:[],goals:[],challenges:[],settings:{onboarded:true,theme:'light'}}
  try{const parsed=JSON.parse(storage.getItem(STORAGE_KEY));if(parsed&&typeof parsed==='object')state=parsed}catch{}
  if(!Array.isArray(state.transactions))state.transactions=[]
  if(state.transactions.some(item=>String(item?.id)===tx.id))return{status:'duplicate',transaction:tx}
  state.transactions.push(tx)
  storage.setItem(STORAGE_KEY,JSON.stringify(state))
  return{status:'imported',transaction:tx}
}
function cleanImportUrl(){
  const url=new URL(location.href)
  url.searchParams.delete(IMPORT_PARAM)
  const query=url.searchParams.toString()
  history.replaceState({},'',url.pathname+(query?`?${query}`:'')+url.hash)
}
function toastImport(result){
  setTimeout(()=>{
    const toast=document.getElementById('toast');if(!toast)return
    toast.textContent=result.status==='duplicate'?'Buchung bereits importiert':`${result.transaction.title}: ${new Intl.NumberFormat('de-AT',{style:'currency',currency:'EUR'}).format(result.transaction.amount)} importiert`
    toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),2200)
  },120)
}

root.NestImportLogic={STORAGE_KEY,decodeImport,normalizeTransaction,importTransaction}
if(typeof location==='undefined'||typeof localStorage==='undefined'||typeof URL==='undefined')return
const raw=new URL(location.href).searchParams.get(IMPORT_PARAM)
if(!raw)return
try{const result=importTransaction(decodeImport(raw),localStorage);cleanImportUrl();toastImport(result)}catch(error){cleanImportUrl();setTimeout(()=>{const toast=document.getElementById('toast');if(toast){toast.textContent='Wallet-Import konnte nicht verarbeitet werden';toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),2200)}},120)}
})(globalThis)
