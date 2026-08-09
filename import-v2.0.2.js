(function(root){
'use strict'
const Core=root.NestV202
const IMPORT_PARAM='nestImport'
const IMPORT_VERSION=1
function decodeUtf8(value){const normalized=String(value||'').replace(/-/g,'+').replace(/_/g,'/'),padded=normalized+'='.repeat((4-normalized.length%4)%4),binary=atob(padded),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));return new TextDecoder().decode(bytes)}
function decodeImport(value){const data=JSON.parse(decodeUtf8(value));if(!data||data.version!==IMPORT_VERSION||!data.transaction)throw new Error('Ungültiger Import');return data.transaction}
function cleanUrl(){const url=new URL(location.href);url.searchParams.delete(IMPORT_PARAM);history.replaceState({},'',url.pathname+(url.searchParams.toString()?`?${url.searchParams}`:'')+url.hash)}
function announce(result){root.__NEST_IMPORT_RESULT__=result;setTimeout(()=>{const t=document.getElementById('toast');if(!t)return;t.textContent=result.status==='duplicate'?'Buchung bereits vorhanden':`${result.transaction.title}: ${new Intl.NumberFormat('de-AT',{style:'currency',currency:'EUR'}).format(result.transaction.amount)} gespeichert`;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2400)},250)}
root.NestImportLogic={decodeImport,importTransaction:tx=>Core.importTransaction(tx)}
if(!Core||typeof location==='undefined')return
const raw=new URL(location.href).searchParams.get(IMPORT_PARAM)
if(!raw)return
try{const result=Core.importTransaction(decodeImport(raw));cleanUrl();announce(result)}catch(error){console.error('Wallet import failed',error);cleanUrl();setTimeout(()=>{const t=document.getElementById('toast');if(t){t.textContent='Wallet-Import konnte nicht sicher gespeichert werden';t.classList.add('show','bad');setTimeout(()=>t.classList.remove('show','bad'),2800)}},250)}
})(globalThis)
