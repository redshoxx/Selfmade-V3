import { APP_VERSION, CATEGORIES, autoCategory, categoryById, categoryCounts, createInitialState, frequentSuggestions, listItems, normalizeState, progressFor, sortItems, uid } from './core.js'

const STORAGE_KEY = 'selfmade-einkauf-v2'
const app = document.getElementById('app')
const sheet = document.getElementById('sheet')
const toast = document.getElementById('toast')
const importFile = document.getElementById('import-file')

let state = loadState()
let ui = { storeMode: false, doneOpen: false, expanded: false }

const icons = {
  cart:'<svg viewBox="0 0 24 24"><path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.6L20 8H7"/><circle cx="10" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg>',
  plus:'<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  chevron:'<svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>',
  down:'<svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>',
  back:'<svg viewBox="0 0 24 24"><path d="m15 5-7 7 7 7"/></svg>',
  bag:'<svg viewBox="0 0 24 24"><path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
  share:'<svg viewBox="0 0 24 24"><path d="M12 3v12m0-12 4 4m-4-4L8 7"/><path d="M5 11v9h14v-9"/></svg>',
  check:'<svg viewBox="0 0 24 24"><path d="m5 12 4 4 10-10"/></svg>',
  edit:'<svg viewBox="0 0 24 24"><path d="m4 20 4.5-1 10-10-3.5-3.5-10 10L4 20Z"/></svg>',
  trash:'<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13"/></svg>',
  download:'<svg viewBox="0 0 24 24"><path d="M12 3v12m0 0 5-5m-5 5-5-5M5 20h14"/></svg>',
  upload:'<svg viewBox="0 0 24 24"><path d="M12 17V5m0 0 5 5m-5-5-5 5M5 20h14"/></svg>',
  settings:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.5 1a7 7 0 0 0-2.1-1.2L14 3h-4l-.4 2.7a7 7 0 0 0-2.1 1.2l-2.5-1-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.5-1a7 7 0 0 0 2.1 1.2L10 21h4l.4-2.7a7 7 0 0 0 2.1-1.2l2.5 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z"/></svg>',
  sparkle:'<svg viewBox="0 0 24 24"><path d="m12 3 1.4 4.2L18 9l-4.6 1.8L12 15l-1.4-4.2L6 9l4.6-1.8L12 3Z"/><path d="m18.5 15 .7 2.1 2.3.9-2.3.9-.7 2.1-.7-2.1-2.3-.9 2.3-.9.7-2.1Z"/></svg>',
  list:'<svg viewBox="0 0 24 24"><path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01"/></svg>'
}

function loadState(){
  try { return normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY))) }
  catch { return createInitialState() }
}
function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) }
function mutate(fn,msg){ fn(state); save(); render(); if(msg) showToast(msg) }
function esc(v=''){ return String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;') }
function activeList(){ return state.lists.find(l=>l.id===state.activeListId)||state.lists[0] }
function activeItems(){ return listItems(state) }
function categoryName(id){ return categoryById(id).name }
function formatQty(v){ return Number(v)%1===0 ? String(Number(v)) : String(Number(v)).replace('.',',') }
function nameKey(v=''){ return String(v).trim().toLocaleLowerCase('de-AT') }

function render(){
  document.documentElement.dataset.theme = state.settings?.theme || 'light'
  if(!state.settings?.onboarded){ app.innerHTML = onboarding(); return }
  app.innerHTML = ui.storeMode ? storeMode() : shopping()
}

function onboarding(){
  return `<main class="onboarding"><div class="mark">${icons.cart}</div><div><span class="eyebrow">SELFMADE</span><h1>Deine Einkaufsliste. Sonst nichts.</h1><p>Schnell hinzufügen, automatisch sortieren und im Laden nur sehen, was noch fehlt.</p></div><button class="btn primary" data-action="finish-onboarding">Loslegen</button><small>Version ${APP_VERSION}</small></main>`
}

function shopping(){
  const list = activeList()
  const items = sortItems(activeItems())
  const open = items.filter(i=>!i.done)
  const done = items.filter(i=>i.done)
  const p = progressFor(items)
  const groups = new Map()
  open.forEach(item=>{ if(!groups.has(item.category)) groups.set(item.category,[]); groups.get(item.category).push(item) })
  const reminders = smartSuggestions()

  return `<div class="app-shell"><main class="content shop-page">
    <header class="shop-header">
      <button class="list-title" data-action="open-lists" aria-label="Einkaufsliste wechseln"><span class="eyebrow">EINKAUFSLISTE</span><span><strong>${esc(list.name)}</strong>${icons.down}</span></button>
      <button class="icon-btn" data-action="open-settings" aria-label="Einstellungen">${icons.settings}</button>
    </header>

    <section class="status-line" aria-label="Listenfortschritt"><div><strong>${p.open}</strong><span>${p.open===1?'Artikel fehlt':'Artikel fehlen'}</span></div><div class="status-progress"><i style="width:${p.percent}%"></i></div><small>${p.done} erledigt</small></section>

    <form id="quick-add-form" class="quick-add"><input name="name" maxlength="80" autocomplete="off" enterkeyhint="done" placeholder="Was brauchst du?" aria-label="Produkt hinzufügen"><button aria-label="Hinzufügen">${icons.plus}</button></form>

    ${reminders.length?`<section class="reminder-block"><div class="section-title"><span>${icons.sparkle}</span><div><strong>Nicht vergessen?</strong><small>Aus deinen bisherigen Einkäufen</small></div></div><div class="reminder-chips">${reminders.map(x=>`<button data-action="add-suggestion" data-name="${esc(x.name)}">${icons.plus}<span>${esc(x.name)}</span></button>`).join('')}</div></section>`:''}

    ${open.length?[...groups.entries()].map(([category,group])=>groupBlock(category,group)).join(''):emptyState()}

    ${done.length?`<section class="done-section"><button class="done-toggle" data-action="toggle-done"><span>${ui.doneOpen?icons.down:icons.chevron}</span><div><strong>Erledigt</strong><small>${done.length} Artikel</small></div></button>${ui.doneOpen?`<div class="done-list">${done.map(productRow).join('')}</div>`:''}</section>`:''}
  </main>${actionDock(p.open)}</div>`
}

function smartSuggestions(){
  const openNames = new Set(activeItems().filter(i=>!i.done).map(i=>nameKey(i.name)))
  return frequentSuggestions(state, state.activeListId, 12)
    .filter(item=>!openNames.has(nameKey(item.name)))
    .slice(0,5)
}

function groupBlock(category,items){
  return `<section class="product-group"><div class="group-title"><strong>${esc(categoryName(category))}</strong><small>${items.length}</small></div>${items.map(productRow).join('')}</section>`
}

function productRow(item){
  return `<article class="product-row ${item.done?'done':''}"><button class="check" data-action="toggle-item" data-id="${item.id}" aria-label="${item.done?'Wieder auf die Liste':'Als erledigt markieren'}">${item.done?icons.check:''}</button><button class="product-main" data-action="edit-item" data-id="${item.id}"><strong>${esc(item.name)}</strong><small>${formatQty(item.quantity)} ${esc(item.unit)}${item.note?` · ${esc(item.note)}`:''}</small></button><button class="row-more" data-action="edit-item" data-id="${item.id}" aria-label="Artikel bearbeiten">${icons.chevron}</button></article>`
}

function emptyState(){
  return `<section class="empty-state"><div class="empty-icon">${icons.cart}</div><h2>Alles da.</h2><p>Deine Liste ist leer. Füge direkt ein Produkt hinzu – Selfmade sortiert es automatisch.</p><button class="btn secondary" data-action="add-item">Artikel hinzufügen</button></section>`
}

function actionDock(openCount){
  return `<nav class="action-dock" aria-label="Einkaufsaktionen"><button data-action="open-lists">${icons.list}<span>Listen</span></button><button class="dock-add" data-action="add-item" aria-label="Artikel hinzufügen">${icons.plus}</button><button data-action="toggle-store" ${openCount?'':'disabled'}>${icons.bag}<span>Im Laden</span></button></nav>`
}

function storeMode(){
  const all = sortItems(activeItems())
  const open = all.filter(i=>!i.done)
  const p = progressFor(all)
  const groups = new Map()
  open.forEach(i=>{ if(!groups.has(i.category)) groups.set(i.category,[]); groups.get(i.category).push(i) })

  return `<section class="store-mode"><header><button class="icon-btn" data-action="toggle-store" aria-label="Ladenmodus schließen">${icons.back}</button><div><span>IM LADEN</span><h1>${p.open ? `${p.open} noch offen` : 'Alles erledigt'}</h1></div><b>${p.percent}%</b></header><div class="store-progress"><i style="width:${p.percent}%"></i></div><main>${open.length?[...groups.entries()].map(([category,items])=>`<section><h2>${esc(categoryName(category))}</h2>${items.map(productRow).join('')}</section>`).join(''):`<div class="store-finished"><div>${icons.check}</div><h2>Geschafft.</h2><p>Du hast alles von der Liste.</p><button class="btn primary" data-action="toggle-store">Einkauf beenden</button></div>`}</main></section>`
}

function openItemSheet(id=null){
  const item=id?state.items.find(x=>x.id===id):null
  ui.expanded=false
  sheet.innerHTML=`<form data-form="item" data-id="${item?.id||''}" class="sheet-form"><div class="handle"></div><header><div><span>${item?'ARTIKEL BEARBEITEN':'NEUER ARTIKEL'}</span><h2>${item?esc(item.name):'Zur Liste hinzufügen'}</h2></div><button type="button" class="sheet-close" data-action="close-sheet" aria-label="Schließen">×</button></header><div class="sheet-body"><label>Produkt<input name="name" required maxlength="80" value="${esc(item?.name||'')}" placeholder="z. B. Vollmilch" autocomplete="off"></label><div class="two"><label>Menge<input name="quantity" type="number" min="0.01" step="0.01" inputmode="decimal" value="${item?.quantity||1}"></label><label>Kategorie<select name="category"><option value="auto" ${item?'':'selected'}>Automatisch</option>${CATEGORIES.filter(c=>c.id!=='all').map(c=>`<option value="${c.id}" ${item?.category===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label></div><button type="button" class="more-options" data-action="toggle-options">Weitere Optionen</button><div class="advanced" hidden><label>Einheit<select name="unit">${['Stk.','Pkg.','kg','g','l','ml'].map(u=>`<option ${item?.unit===u?'selected':''}>${u}</option>`).join('')}</select></label><label>Notiz<textarea name="note" maxlength="160" placeholder="Optional">${esc(item?.note||'')}</textarea></label><label class="switch-row"><span><strong>Für später merken</strong><small>Kann bei „Nicht vergessen?“ vorgeschlagen werden.</small></span><input name="favorite" type="checkbox" ${item?.favorite?'checked':''}></label></div></div><footer>${item?`<button type="button" class="delete-link" data-action="delete-item" data-id="${item.id}">Löschen</button>`:'<span></span>'}<button class="btn primary" type="submit">${item?'Speichern':'Hinzufügen'}</button></footer></form>`
  sheet.showModal()
  requestAnimationFrame(()=>sheet.querySelector('input[name=name]')?.focus())
}

function openLists(){
  sheet.innerHTML=`<div class="sheet-form"><div class="handle"></div><header><div><span>DEINE LISTEN</span><h2>Listen wechseln</h2></div><button class="sheet-close" data-action="close-sheet" aria-label="Schließen">×</button></header><div class="sheet-body list-manager">${state.lists.map(list=>`<div class="list-choice ${list.id===state.activeListId?'active':''}"><button data-action="select-list" data-id="${list.id}"><strong>${esc(list.name)}</strong><small>${listItems(state,list.id).filter(i=>!i.done).length} offen</small></button><button data-action="edit-list" data-id="${list.id}" aria-label="Liste umbenennen">${icons.edit}</button>${state.lists.length>1?`<button class="red" data-action="delete-list" data-id="${list.id}" aria-label="Liste löschen">${icons.trash}</button>`:''}</div>`).join('')}<button class="btn secondary wide" data-action="new-list">${icons.plus}<span>Neue Liste</span></button></div></div>`
  sheet.showModal()
}

function openListForm(id=null){
  const list=id?state.lists.find(x=>x.id===id):null
  sheet.innerHTML=`<form data-form="list" data-id="${list?.id||''}" class="sheet-form compact-sheet"><div class="handle"></div><header><div><span>${list?'LISTE UMBENENNEN':'NEUE LISTE'}</span><h2>${list?'Name ändern':'Liste erstellen'}</h2></div><button type="button" class="sheet-close" data-action="close-sheet" aria-label="Schließen">×</button></header><div class="sheet-body"><label>Listenname<input name="name" required maxlength="40" value="${esc(list?.name||'')}" placeholder="z. B. Wocheneinkauf"></label></div><footer><span></span><button class="btn primary" type="submit">${list?'Speichern':'Erstellen'}</button></footer></form>`
  sheet.showModal()
  requestAnimationFrame(()=>sheet.querySelector('input[name=name]')?.focus())
}

function openSettings(){
  const dark=state.settings.theme==='dark'
  sheet.innerHTML=`<div class="sheet-form"><div class="handle"></div><header><div><span>SELFMADE</span><h2>Einstellungen</h2></div><button class="sheet-close" data-action="close-sheet" aria-label="Schließen">×</button></header><div class="sheet-body settings-list"><button data-action="share-list"><div><strong>Liste teilen</strong><small>Offene Artikel versenden oder kopieren</small></div>${icons.share}</button><button data-action="set-theme"><div><strong>Darstellung</strong><small>${dark?'Dunkel':'Hell'} · antippen zum Wechseln</small></div>${icons.chevron}</button><button data-action="export-data"><div><strong>Backup exportieren</strong><small>Listen lokal sichern</small></div>${icons.download}</button><button data-action="import-data"><div><strong>Backup importieren</strong><small>Gesicherte Listen wiederherstellen</small></div>${icons.upload}</button><button class="danger-row" data-action="reset-data"><div><strong>Alle lokalen Daten löschen</strong><small>Listen und Artikel zurücksetzen</small></div>${icons.trash}</button><p class="version">Selfmade · V${APP_VERSION}</p></div></div>`
  sheet.showModal()
}

function closeSheet(){ if(sheet.open) sheet.close() }
function showToast(msg){ toast.textContent=msg; toast.classList.add('show'); clearTimeout(showToast.t); showToast.t=setTimeout(()=>toast.classList.remove('show'),1800) }

function addQuick(name){
  const n=String(name||'').trim()
  if(!n)return
  const key=nameKey(n)
  const current=activeItems().find(i=>nameKey(i.name)===key)
  if(current && !current.done){ showToast(`${current.name} ist schon auf der Liste`); return }
  if(current && current.done){
    mutate(s=>{const item=s.items.find(i=>i.id===current.id);item.done=false;item.completedAt=null;item.updatedAt=Date.now()},`${current.name} wieder auf der Liste`)
    return
  }
  mutate(s=>s.items.push({id:uid('item'),listId:s.activeListId,name:n,category:autoCategory(n),quantity:1,unit:'Stk.',note:'',done:false,favorite:false,createdAt:Date.now(),updatedAt:Date.now(),completedAt:null}),`${n} hinzugefügt`)
}

async function shareList(){
  const list=activeList()
  const open=sortItems(activeItems()).filter(i=>!i.done)
  const text=`${list.name}\n\n${open.map(i=>`○ ${i.name}${i.quantity!==1?` (${formatQty(i.quantity)} ${i.unit})`:''}`).join('\n') || 'Alles erledigt.'}`
  try{
    if(navigator.share) await navigator.share({title:list.name,text})
    else { await navigator.clipboard.writeText(text); showToast('Liste kopiert') }
  }catch{}
}

app.addEventListener('submit',e=>{
  if(e.target.id!=='quick-add-form')return
  e.preventDefault()
  const f=new FormData(e.target)
  addQuick(f.get('name'))
})

sheet.addEventListener('submit',e=>{
  const itemForm=e.target.closest('[data-form=item]')
  if(itemForm){
    e.preventDefault()
    const f=new FormData(itemForm), name=String(f.get('name')||'').trim()
    if(!name)return
    const id=itemForm.dataset.id, category=String(f.get('category')||'auto')
    mutate(s=>{
      const data={name,quantity:Number(f.get('quantity'))||1,unit:String(f.get('unit')||'Stk.'),category:category==='auto'?autoCategory(name):category,note:String(f.get('note')||'').trim(),favorite:f.get('favorite')==='on',updatedAt:Date.now()}
      if(id) Object.assign(s.items.find(x=>x.id===id),data)
      else s.items.push({id:uid('item'),listId:s.activeListId,...data,done:false,createdAt:Date.now(),completedAt:null})
    },id?'Gespeichert':'Hinzugefügt')
    closeSheet()
    return
  }
  const listForm=e.target.closest('[data-form=list]')
  if(listForm){
    e.preventDefault()
    const name=String(new FormData(listForm).get('name')||'').trim().slice(0,40)
    if(!name)return
    const id=listForm.dataset.id
    mutate(s=>{
      if(id) s.lists.find(x=>x.id===id).name=name
      else { const newId=uid('list'); s.lists.push({id:newId,name,createdAt:Date.now()}); s.activeListId=newId }
    },id?'Liste umbenannt':'Liste erstellt')
    closeSheet()
  }
})

document.addEventListener('click',async e=>{
  const b=e.target.closest('[data-action]')
  if(!b)return
  const action=b.dataset.action
  if(action==='finish-onboarding') mutate(s=>s.settings.onboarded=true)
  else if(action==='add-item') openItemSheet()
  else if(action==='edit-item') openItemSheet(b.dataset.id)
  else if(action==='close-sheet') closeSheet()
  else if(action==='toggle-options'){const x=sheet.querySelector('.advanced');x.hidden=!x.hidden;b.textContent=x.hidden?'Weitere Optionen':'Weniger Optionen'}
  else if(action==='toggle-item') mutate(s=>{const i=s.items.find(x=>x.id===b.dataset.id);if(i){i.done=!i.done;i.completedAt=i.done?Date.now():null;i.updatedAt=Date.now()}},b.closest('.store-mode')?'Liste aktualisiert':null)
  else if(action==='toggle-done'){ui.doneOpen=!ui.doneOpen;render()}
  else if(action==='toggle-store'){ui.storeMode=!ui.storeMode;render()}
  else if(action==='open-lists') openLists()
  else if(action==='select-list'){state.activeListId=b.dataset.id;save();closeSheet();render()}
  else if(action==='new-list') openListForm()
  else if(action==='edit-list') openListForm(b.dataset.id)
  else if(action==='delete-list'){const id=b.dataset.id;if(confirm('Liste inklusive aller Artikel löschen?')){mutate(s=>{s.lists=s.lists.filter(x=>x.id!==id);s.items=s.items.filter(x=>x.listId!==id);if(s.activeListId===id)s.activeListId=s.lists[0].id},'Liste gelöscht');openLists()}}
  else if(action==='delete-item'){if(confirm('Artikel löschen?')){mutate(s=>{s.items=s.items.filter(x=>x.id!==b.dataset.id)},'Artikel gelöscht');closeSheet()}}
  else if(action==='add-suggestion') addQuick(b.dataset.name)
  else if(action==='open-settings') openSettings()
  else if(action==='share-list'){await shareList();if(sheet.open)closeSheet()}
  else if(action==='set-theme'){mutate(s=>{s.settings.theme=s.settings.theme==='dark'?'light':'dark'});closeSheet()}
  else if(action==='export-data'){const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),x=document.createElement('a');x.href=url;x.download='selfmade-einkauf-backup.json';x.click();URL.revokeObjectURL(url)}
  else if(action==='import-data') importFile.click()
  else if(action==='reset-data'){if(confirm('Wirklich alle lokalen Listen und Artikel löschen?')){state=createInitialState();state.settings.onboarded=true;save();closeSheet();render();showToast('Daten zurückgesetzt')}}
})

importFile.addEventListener('change',async()=>{
  const f=importFile.files?.[0]
  if(!f)return
  try{state=normalizeState(JSON.parse(await f.text()));state.settings.onboarded=true;save();render();showToast('Backup importiert')}
  catch{showToast('Backup ungültig')}
  finally{importFile.value=''}
})

sheet.addEventListener('click',e=>{if(e.target===sheet)closeSheet()})
if('serviceWorker'in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}))
render()
window.__SELFMADE_READY__=true
document.documentElement.setAttribute('data-app-ready','true')
