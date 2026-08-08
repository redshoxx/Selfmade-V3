(function(root){
'use strict'
const RELEASE='2.0.0'
const CORE_KEY='selfmade-save-v1'
const AUDIT_KEY='nest-audit-v2'
const PREF_KEY='nest-settings-v1.3'
const Core=root.NestV2Core
let nativeEditId=''
let scheduled=false

function safeParse(value,fallback){try{return JSON.parse(value)}catch{return fallback}}
function loadCore(){const value=safeParse(localStorage.getItem(CORE_KEY),null);return value&&typeof value==='object'?value:{transactions:[],goals:[],challenges:[],openingBalance:0}}
function loadAudit(){return Core?.readAuditValue(localStorage.getItem(AUDIT_KEY))||{version:2,events:[]}}
function loadPrefs(){const p=safeParse(localStorage.getItem(PREF_KEY),{});return p&&typeof p==='object'?p:{}}
function esc(value=''){return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;')}
function euro(value){return new Intl.NumberFormat('de-AT',{style:'currency',currency:'EUR'}).format(Number(value)||0)}
function dateOnly(value){if(!value)return '–';const d=new Date(String(value).length===10?`${value}T12:00:00`:value);return Number.isFinite(d.getTime())?new Intl.DateTimeFormat('de-AT').format(d):String(value)}
function dateTime(value){if(!value)return '–';const d=new Date(value);return Number.isFinite(d.getTime())?new Intl.DateTimeFormat('de-AT',{dateStyle:'medium',timeStyle:'short'}).format(d):'–'}
function txById(id,core=loadCore()){return (core.transactions||[]).find(tx=>String(tx.id)===String(id))}
function eventsFor(id,audit=loadAudit()){return Core?.eventsFor(id,audit)||[]}
function methodFor(tx,audit=loadAudit()){return Core?.latestMethod(tx.id,audit,tx)||'legacy'}
function methodLabel(method){return Core?.methodLabel(method)||'NEST'}
function methodClass(method){return ['wallet','manual','legacy'].includes(method)?method:'system'}
function signature(tx){return Core?.transactionSignature(tx)||[tx.type,tx.title,tx.amount,tx.category].join('|')}
function repeated(tx,core=loadCore()){const sig=signature(tx);return (core.transactions||[]).filter(item=>signature(item)===sig).sort((a,b)=>String(b.date).localeCompare(String(a.date))||Number(b.createdAt||0)-Number(a.createdAt||0))}
function createdAtFor(tx,audit){const event=eventsFor(tx.id,audit).find(item=>item.action==='created'||item.action==='migrated');return event?.originalAt||event?.at||(tx.createdAt?new Date(Number(tx.createdAt)).toISOString():null)}
function toast(message){const el=document.getElementById('toast');if(!el)return;el.textContent=message;el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),2200)}

function ensureDialog(id,label){let dialog=document.getElementById(id);if(dialog)return dialog;dialog=document.createElement('dialog');dialog.id=id;dialog.className='v2-dialog';dialog.setAttribute('aria-label',label);document.body.appendChild(dialog);dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close()});return dialog}
function fieldLabel(key){return({type:'Art',amount:'Betrag',title:'Bezeichnung',category:'Kategorie',date:'Buchungsdatum',note:'Notiz'})[key]||key}
function eventText(event){
  if(event.action==='created'&&event.method==='wallet')return 'Über Apple Wallet / Kurzbefehle verbucht'
  if(event.action==='created')return 'Manuell in NEST verbucht'
  if(event.action==='migrated'&&event.method==='wallet')return 'Wallet-Buchung aus älterer Version übernommen'
  if(event.action==='migrated')return 'Aus älterer NEST-Version übernommen'
  if(event.action==='updated')return event.changes?.length?`Geändert: ${event.changes.map(fieldLabel).join(', ')}`:'Buchung geändert'
  if(event.action==='deleted')return 'Buchung gelöscht'
  return 'Buchung aktualisiert'
}
function historyMarkup(id,audit){const events=eventsFor(id,audit);if(!events.length)return '<div class="v2-empty-history">Noch kein Protokoll vorhanden.</div>';return events.slice(0,12).map(event=>`<div class="v2-timeline-item"><i class="${esc(methodClass(event.method))}"></i><div><b>${esc(eventText(event))}</b><small>${esc(dateTime(event.at))}${event.method?` · ${esc(methodLabel(event.method))}`:''}</small></div></div>`).join('')}
function openTransaction(id){
  const core=loadCore(),audit=loadAudit(),tx=txById(id,core);if(!tx)return
  const method=methodFor(tx,audit),matches=repeated(tx,core),dialog=ensureDialog('v2Transaction','Buchungsdetails')
  const similar=matches.length>1?`<div class="v2-repeat-box"><div><span>Bereits verbucht</span><b>${matches.length}× mit gleichem Betrag und Verwendungszweck</b></div><div class="v2-repeat-list">${matches.slice(0,6).map(item=>`<span>${esc(dateOnly(item.date))}<b>${esc(euro(item.amount))}</b></span>`).join('')}</div></div>`:''
  dialog.innerHTML=`<article class="v2-detail-shell">
    <header class="v2-detail-head"><div><span>VERBUCHTE TRANSAKTION</span><h2>${esc(tx.title||'Buchung')}</h2><p>${esc(tx.category||'Sonstiges')}</p></div><button type="button" data-v2-close aria-label="Schließen">×</button></header>
    <section class="v2-detail-amount ${tx.type==='income'?'income':'expense'}"><small>${tx.type==='income'?'Einzahlung':'Auszahlung'}</small><strong>${tx.type==='income'?'+':'−'} ${esc(euro(tx.amount))}</strong><em>Verbucht</em></section>
    <section class="v2-facts">
      <div><span>Buchungsdatum</span><b>${esc(dateOnly(tx.date))}</b></div>
      <div><span>Erfasst am</span><b>${esc(dateTime(createdAtFor(tx,audit)))}</b></div>
      <div><span>Verbucht über</span><b>${esc(methodLabel(method))}</b></div>
      <div><span>Status</span><b>Verbucht</b></div>
    </section>
    ${tx.note?`<section class="v2-note"><span>Notiz</span><p>${esc(tx.note)}</p></section>`:''}
    ${similar}
    <section class="v2-history"><div class="v2-section-title"><span>Buchungsverlauf</span><p>Wann und wie diese Buchung erfasst oder geändert wurde.</p></div>${historyMarkup(tx.id,audit)}</section>
    <footer class="v2-detail-actions"><button type="button" class="secondary" data-v2-close>Schließen</button><button type="button" class="primary" data-v2-edit="${esc(tx.id)}">Buchung bearbeiten</button></footer>
  </article>`
  dialog.showModal()
}
function openAudit(){
  const audit=loadAudit(),events=[...(audit.events||[])].sort((a,b)=>String(b.at).localeCompare(String(a.at))).slice(0,150),dialog=ensureDialog('v2Audit','Buchungsprotokoll')
  const rows=events.length?events.map(event=>{const snap=event.snapshot||{};return `<div class="v2-audit-row"><div class="v2-audit-icon ${esc(methodClass(event.method))}"></div><div class="v2-audit-main"><strong>${esc(snap.title||'Buchung')}</strong><span>${esc(eventText(event))}</span><small>${esc(dateTime(event.at))} · ${esc(methodLabel(event.method))}</small></div><b>${snap.amount!=null?esc(euro(snap.amount)):''}</b></div>`}).join(''):'<div class="v2-empty-history">Noch keine Protokolleinträge vorhanden.</div>'
  dialog.innerHTML=`<article class="v2-audit-shell"><header class="v2-detail-head"><div><span>NEST V${RELEASE}</span><h2>Buchungsprotokoll</h2><p>Erstellungen, Änderungen und Löschungen nachvollziehen.</p></div><button type="button" data-v2-close aria-label="Schließen">×</button></header><div class="v2-audit-list">${rows}</div><footer class="v2-detail-actions"><button type="button" class="primary" data-v2-close>Fertig</button></footer></article>`
  dialog.showModal()
}

function decorateNav(){const nav=document.querySelector('.tabs');if(!nav)return;if(!nav.querySelector('.v2-nav-brand'))nav.insertAdjacentHTML('afterbegin',`<div class="v2-nav-brand"><div>N</div><span><b>NEST</b><small>Finance Workspace</small></span></div>`);if(!nav.querySelector('.v2-nav-foot'))nav.insertAdjacentHTML('beforeend',`<div class="v2-nav-foot"><span>Web & Mobile</span><b>v${RELEASE}</b></div>`)}
function activeRoute(){return document.querySelector('.tabs button.active[data-route]')?.dataset.route||'overview'}
function decorateRoute(){document.documentElement.dataset.v2Route=activeRoute();document.documentElement.dataset.nestRelease=RELEASE}
function decorateRows(){
  const core=loadCore(),audit=loadAudit()
  document.querySelectorAll('.row[data-action="edit-tx"][data-id]').forEach(row=>{const tx=txById(row.dataset.id,core);if(!tx)return;const existing=row.querySelector('.v2-booking-meta');if(existing)existing.remove();const method=methodFor(tx,audit),matches=repeated(tx,core),stamp=createdAtFor(tx,audit),meta=document.createElement('span');meta.className='v2-booking-meta';meta.innerHTML=`<i class="v2-method ${esc(methodClass(method))}">${esc(method==='wallet'?'Wallet':method==='manual'?'Manuell':'Übernommen')}</i><span>${esc(dateTime(stamp))}</span>${matches.length>1?`<i class="v2-repeat">${matches.length}× verbucht</i>`:''}`;row.querySelector('.row-main')?.appendChild(meta);row.classList.add('v2-tx-row')})
}
function injectLedgerSummary(){
  if(activeRoute()!=='transactions')return
  const shell=document.querySelector('.shell');if(!shell||shell.querySelector('.v2-ledger-summary'))return
  const core=loadCore(),audit=loadAudit(),txs=core.transactions||[],wallet=txs.filter(tx=>methodFor(tx,audit)==='wallet').length,manual=txs.filter(tx=>methodFor(tx,audit)==='manual').length,groups=new Map();txs.forEach(tx=>groups.set(signature(tx),(groups.get(signature(tx))||0)+1));const recurring=[...groups.values()].filter(n=>n>1).length
  const card=document.createElement('section');card.className='v2-ledger-summary';card.innerHTML=`<div class="v2-ledger-title"><div><span>BUCHUNGSZENTRALE</span><h2>Nachvollziehbar verbucht</h2><p>Quelle, Zeitpunkt und Änderungen jeder Buchung im Blick.</p></div><button type="button" data-v2-audit>Protokoll öffnen</button></div><div class="v2-ledger-stats"><div><small>Gesamt</small><b>${txs.length}</b></div><div><small>Wallet</small><b>${wallet}</b></div><div><small>Manuell seit v2</small><b>${manual}</b></div><div><small>Wiederkehrend</small><b>${recurring}</b></div></div>`
  const head=shell.querySelector('.section-head');if(head)head.after(card)
}
function decorateForms(){
  const form=document.querySelector('#sheet form.sheet');if(!form)return;form.classList.add('v2-form');const body=form.querySelector('.sheet-body');if(body&&!body.querySelector('.v2-form-intro')){const kind=form.dataset.form||'';const copy=kind==='transaction'?['Buchung erfassen','Sauber verbuchen – Betrag, Kategorie und Datum bleiben nachvollziehbar.']:kind==='goal'?['Sparziel','Zielbetrag und Zeitraum klar definieren.']:kind==='challenge'?['Challenge','Eine eigene Spar-Challenge konfigurieren.']:['Eingabe','Daten übersichtlich bearbeiten.'];body.insertAdjacentHTML('afterbegin',`<div class="v2-form-intro"><span>NEST V${RELEASE}</span><b>${esc(copy[0])}</b><p>${esc(copy[1])}</p></div>`)}form.querySelectorAll('.sheet-body label').forEach(label=>label.classList.add('v2-field'))
}
function decorateSettings(){const dialog=document.getElementById('settings13');if(!dialog?.open)return;const version=dialog.querySelector('.s13-head span');if(version)version.textContent=`NEST · VERSION ${RELEASE}`;const about=dialog.querySelector('.s13-about b');if(about)about.textContent=`NEST ${RELEASE}`;dialog.classList.add('v2-settings')}
function enhance(){scheduled=false;decorateNav();decorateRoute();decorateRows();injectLedgerSummary();decorateForms();decorateSettings()}
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(enhance)}

async function exportFullBackup(){
  const payload={product:'NEST',version:RELEASE,exportedAt:new Date().toISOString(),core:loadCore(),preferences:loadPrefs(),audit:loadAudit()}
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),file=new File([blob],`nest-v2-backup-${new Date().toISOString().slice(0,10)}.json`,{type:'application/json'})
  try{if(navigator.share&&navigator.canShare?.({files:[file]})){await navigator.share({title:'NEST v2 Backup',files:[file]});return}}catch(error){if(error?.name==='AbortError')return}
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=file.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);toast('V2-Backup mit Buchungshistorie erstellt')
}
async function importFullBackup(file){if(!file)return;try{const data=JSON.parse(await file.text()),core=data.core&&typeof data.core==='object'?data.core:(Array.isArray(data.transactions)?data:null);if(!core||!Array.isArray(core.transactions))throw new Error('invalid');if(!confirm('Dieses Backup ersetzt die aktuellen lokalen NEST-Daten inklusive Buchungshistorie. Fortfahren?'))return;localStorage.setItem(CORE_KEY,JSON.stringify(core));if(data.preferences&&typeof data.preferences==='object')localStorage.setItem(PREF_KEY,JSON.stringify(data.preferences));if(data.audit&&typeof data.audit==='object')localStorage.setItem(AUDIT_KEY,JSON.stringify(data.audit));location.reload()}catch{toast('Backup konnte nicht gelesen werden')}}
function resetAll(){if(!confirm('Alle lokalen Buchungen, Ziele, Challenges, Einstellungen und das Buchungsprotokoll löschen?'))return;localStorage.removeItem(CORE_KEY);localStorage.removeItem(PREF_KEY);localStorage.removeItem(AUDIT_KEY);location.reload()}

document.addEventListener('click',event=>{
  const row=event.target.closest?.('.row[data-action="edit-tx"][data-id]');if(row){if(nativeEditId===row.dataset.id){nativeEditId='';return}event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();openTransaction(row.dataset.id);return}
  const close=event.target.closest?.('[data-v2-close]');if(close){event.preventDefault();close.closest('dialog')?.close();return}
  const edit=event.target.closest?.('[data-v2-edit]');if(edit){event.preventDefault();const id=edit.dataset.v2Edit;edit.closest('dialog')?.close();nativeEditId=id;requestAnimationFrame(()=>document.querySelector(`.row[data-id="${CSS.escape(id)}"]`)?.click());return}
  if(event.target.closest?.('[data-v2-audit]')){event.preventDefault();openAudit();return}
  const s13=event.target.closest?.('[data-s13]');if(s13?.dataset.s13==='export'){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();exportFullBackup();return}
  if(s13?.dataset.s13==='import'){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();document.getElementById('settings13file')?.click();return}
  if(s13?.dataset.s13==='reset'){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();resetAll();return}
},true)
document.addEventListener('change',event=>{if(event.target?.id!=='settings13file')return;event.stopPropagation();event.stopImmediatePropagation();importFullBackup(event.target.files?.[0])},true)

new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','open']})
window.addEventListener('resize',schedule,{passive:true})
root.NestV2UI={RELEASE,openTransaction,openAudit,enhance}
schedule()
})(globalThis)
