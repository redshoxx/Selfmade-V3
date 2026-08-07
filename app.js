import { APP_VERSION, CATEGORIES, autoCategory, categoryById, categoryCounts, createInitialState, frequentSuggestions, listItems, normalizeState, progressFor, sortItems, topCategories, weeklyStats, uid } from './core.js'

const STORAGE_KEY = 'selfmade-einkauf-v2'
const app = document.getElementById('app')
const sheet = document.getElementById('sheet')
const toast = document.getElementById('toast')
const importFile = document.getElementById('import-file')

let state = loadState()
let ui = { route: 'home', category: 'all', storeMode: false, expanded: false }

const icons = {
  home:'<svg viewBox="0 0 24 24"><path d="M3.5 10.5 12 3l8.5 7.5V21h-6v-6h-5v6h-6Z"/></svg>',
  cart:'<svg viewBox="0 0 24 24"><path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.6L20 8H7"/><circle cx="10" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg>',
  grid:'<svg viewBox="0 0 24 24"><rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/></svg>',
  chart:'<svg viewBox="0 0 24 24"><path d="M5 20V11M12 20V5M19 20v-7"/></svg>',
  more:'<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>',
  plus:'<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  chevron:'<svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>',
  back:'<svg viewBox="0 0 24 24"><path d="m15 5-7 7 7 7"/></svg>',
  bag:'<svg viewBox="0 0 24 24"><path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
  share:'<svg viewBox="0 0 24 24"><path d="M12 3v12m0-12 4 4m-4-4L8 7"/><path d="M5 11v9h14v-9"/></svg>',
  search:'<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 4 4"/></svg>',
  check:'<svg viewBox="0 0 24 24"><path d="m5 12 4 4 10-10"/></svg>',
  edit:'<svg viewBox="0 0 24 24"><path d="m4 20 4.5-1 10-10-3.5-3.5-10 10L4 20Z"/></svg>',
  trash:'<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13"/></svg>',
  download:'<svg viewBox="0 0 24 24"><path d="M12 3v12m0 0 5-5m-5 5-5-5M5 20h14"/></svg>',
  upload:'<svg viewBox="0 0 24 24"><path d="M12 17V5m0 0 5 5m-5-5-5 5M5 20h14"/></svg>'
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

function pageHeader(title, subtitle='', actions=''){
  return `<header class="page-header"><div><p>${esc(subtitle)}</p><h1>${esc(title)}</h1></div><div class="header-actions">${actions}</div></header>`
}

function render(){
  document.documentElement.dataset.theme = state.settings?.theme || 'light'
  if(!state.settings?.onboarded){ app.innerHTML = onboarding(); return }
  app.innerHTML = `<div class="app-shell"><main class="screen">${route()}</main>${nav()}</div>`
}
function route(){
  if(ui.storeMode) return storeMode()
  if(ui.route==='shop') return shopping()
  if(ui.route==='categories') return categories()
  if(ui.route==='stats') return stats()
  if(ui.route==='more') return more()
  return home()
}
function nav(){
  const tabs=[['home','Home',icons.home],['shop','Einkauf',icons.cart],['categories','Kategorien',icons.grid],['stats','Statistik',icons.chart],['more','Mehr',icons.more]]
  return `<nav class="bottom-nav" aria-label="Hauptnavigation">${tabs.map(([r,l,i])=>`<button class="nav-item ${ui.route===r?'active':''}" data-route="${r}">${i}<span>${l}</span></button>`).join('')}</nav>`
}
function onboarding(){
  return `<main class="onboarding"><div class="mark">${icons.cart}</div><div><span class="eyebrow">SELFMADE</span><h1>Einkaufen, ohne darüber nachzudenken.</h1><p>Eine ruhige Einkaufsliste, die Produkte automatisch sortiert und im Laden genau das zeigt, was noch fehlt.</p></div><button class="btn primary" data-action="finish-onboarding">Loslegen</button><small>Version ${APP_VERSION}</small></main>`
}

function home(){
  const list=activeList(), items=activeItems(), p=progressFor(items), next=sortItems(items).filter(i=>!i.done).slice(0,4)
  const today=new Intl.DateTimeFormat('de-AT',{weekday:'long',day:'2-digit',month:'long'}).format(new Date())
  return `<section class="content home-page">
    ${pageHeader('Guten Tag',today,`<button class="icon-btn" data-action="open-lists" aria-label="Listen wechseln">${icons.more}</button>`)}
    <section class="hero-summary"><div><span class="eyebrow">${esc(list.name)}</span><h2>${p.open ? `${p.open} Artikel fehlen noch` : 'Alles erledigt'}</h2><p>${p.total ? `${p.done} von ${p.total} bereits erledigt.` : 'Deine Liste ist bereit für den nächsten Einkauf.'}</p></div><div class="progress-ring" style="--p:${p.percent}"><b>${p.percent}%</b></div></section>
    <section><div class="section-head"><h2>Heute</h2><button data-route="shop">Liste öffnen</button></div>${next.length?`<div class="preview-list">${next.map(i=>`<div><span>${esc(i.name)}</span><small>${esc(categoryName(i.category))}</small></div>`).join('')}</div>`:`<div class="empty-inline">Noch nichts offen. Füge deinen nächsten Artikel hinzu.</div>`}</section>
    <section><div class="section-head"><h2>Schnellzugriff</h2></div><div class="quick-grid"><button data-action="add-item">${icons.plus}<span>Artikel</span></button><button data-action="toggle-store">${icons.bag}<span>Im Laden</span></button><button data-action="open-lists">${icons.grid}<span>Listen</span></button><button data-route="stats">${icons.chart}<span>Statistik</span></button></div></section>
    <section><div class="section-head"><h2>Für dich relevant</h2></div><div class="insight-row"><div><span>Automatisch sortiert</span><strong>${Object.values(categoryCounts(items)).filter(Boolean).length}</strong><small>aktive Kategorien</small></div><div><span>Diese Woche</span><strong>${weeklyStats(items).reduce((a,b)=>a+b.count,0)}</strong><small>erledigte Artikel</small></div></div></section>
  </section>`
}

function shopping(){
  const list=activeList(), all=sortItems(activeItems()), counts=categoryCounts(all), filtered=all.filter(i=>ui.category==='all'||i.category===ui.category)
  const groups = new Map()
  filtered.forEach(i=>{ const key=i.done?'done':i.category; if(!groups.has(key)) groups.set(key,[]); groups.get(key).push(i) })
  const suggestions=frequentSuggestions(state).slice(0,5)
  return `<section class="content shop-page">
    ${pageHeader('Einkauf',list.name,`<button class="icon-btn" data-action="share-list" aria-label="Teilen">${icons.share}</button>`)}
    <form id="quick-add-form" class="search-add"><span>${icons.search}</span><input name="name" maxlength="80" autocomplete="off" placeholder="Produkt hinzufügen …" aria-label="Produkt hinzufügen"><button aria-label="Hinzufügen">${icons.plus}</button></form>
    ${suggestions.length?`<div class="suggestions">${suggestions.map(s=>`<button data-action="add-suggestion" data-name="${esc(s.name)}">${esc(s.name)}</button>`).join('')}</div>`:''}
    <div class="filter-strip"><button class="${ui.category==='all'?'active':''}" data-action="filter-category" data-category="all">Alle <span>${all.length}</span></button>${CATEGORIES.filter(c=>c.id!=='all'&&(counts[c.id]||0)).map(c=>`<button class="${ui.category===c.id?'active':''}" data-action="filter-category" data-category="${c.id}">${esc(c.name)} <span>${counts[c.id]}</span></button>`).join('')}</div>
    ${filtered.length?[...groups.entries()].map(([key,items])=>groupBlock(key,items)).join(''):emptyState()}
    <button class="fab" data-action="add-item" aria-label="Artikel hinzufügen">${icons.plus}</button>
  </section>`
}
function groupBlock(key,items){
  const title=key==='done'?'Erledigt':categoryName(key)
  return `<section class="product-group"><div class="group-title"><span>${esc(title)}</span><small>${items.length}</small></div>${items.map(productRow).join('')}</section>`
}
function productRow(item){
  return `<article class="product-row ${item.done?'done':''}"><button class="check" data-action="toggle-item" data-id="${item.id}" aria-label="${item.done?'Wieder öffnen':'Erledigen'}">${item.done?icons.check:''}</button><button class="product-main" data-action="edit-item" data-id="${item.id}"><strong>${esc(item.name)}</strong><small>${formatQty(item.quantity)} ${esc(item.unit)}${item.note?` · ${esc(item.note)}`:''}</small></button><button class="row-more" data-action="edit-item" data-id="${item.id}" aria-label="Bearbeiten">${icons.chevron}</button></article>`
}
function emptyState(){ return `<div class="empty-state"><div>${icons.cart}</div><h2>Noch nichts auf deiner Liste</h2><p>Füge deinen ersten Artikel hinzu. Selfmade erkennt die passende Kategorie automatisch.</p><button class="btn primary" data-action="add-item">Artikel hinzufügen</button></div>` }

function categories(){
  const counts=categoryCounts(activeItems())
  return `<section class="content">${pageHeader('Kategorien','Automatisch organisiert')}<div class="category-list">${CATEGORIES.filter(c=>c.id!=='all').map(c=>`<button data-action="open-category" data-category="${c.id}"><div><strong>${esc(c.name)}</strong><small>${counts[c.id]||0} Artikel</small></div>${icons.chevron}</button>`).join('')}</div></section>`
}
function stats(){
  const items=activeItems(), week=weeklyStats(items), max=Math.max(1,...week.map(x=>x.count)), top=topCategories(items,4), p=progressFor(items)
  return `<section class="content">${pageHeader('Statistik','Dein Einkaufsrhythmus')}<div class="metric"><span>Aktuelle Liste</span><strong>${p.open}</strong><small>offene Artikel</small></div><section class="chart"><div class="section-head"><h2>Letzte 7 Tage</h2><span>${week.reduce((a,b)=>a+b.count,0)} erledigt</span></div><div class="bars">${week.map(d=>`<div><i style="height:${Math.max(6,(d.count/max)*100)}%"></i><span>${d.label}</span></div>`).join('')}</div></section><section><div class="section-head"><h2>Top Kategorien</h2></div><div class="rank-list">${top.length?top.map((t,i)=>`<div><b>${i+1}</b><span>${esc(t.name)}</span><strong>${t.count}</strong></div>`).join(''):'<p class="muted">Noch nicht genug Daten.</p>'}</div></section></section>`
}
function more(){
  return `<section class="content">${pageHeader('Mehr','Einstellungen & Daten')}<div class="settings-list"><button data-action="open-lists"><div><strong>Listen verwalten</strong><small>Erstellen, wechseln und umbenennen</small></div>${icons.chevron}</button><button data-action="set-theme"><div><strong>Darstellung</strong><small>${state.settings.theme==='dark'?'Dunkel':'Hell'}</small></div>${icons.chevron}</button><button data-action="export-data"><div><strong>Backup exportieren</strong><small>Lokale Daten sichern</small></div>${icons.download}</button><button data-action="import-data"><div><strong>Backup importieren</strong><small>Gesicherte Daten wiederherstellen</small></div>${icons.upload}</button></div><button class="danger" data-action="reset-data">Alle lokalen Daten löschen</button><p class="version">Selfmade · V${APP_VERSION}</p></section>`
}
function storeMode(){
  const items=sortItems(activeItems()).filter(i=>!i.done), p=progressFor(activeItems())
  const grouped=new Map(); items.forEach(i=>{ if(!grouped.has(i.category)) grouped.set(i.category,[]); grouped.get(i.category).push(i) })
  return `<section class="store-mode"><header><button class="icon-btn" data-action="toggle-store">${icons.back}</button><div><span>IM LADEN</span><h1>${p.open} noch offen</h1></div><b>${p.percent}%</b></header><div class="store-progress"><i style="width:${p.percent}%"></i></div><main>${items.length?[...grouped.entries()].map(([c,x])=>`<section><h2>${esc(categoryName(c))}</h2>${x.map(productRow).join('')}</section>`).join(''):`<div class="empty-state"><div>${icons.check}</div><h2>Einkauf erledigt</h2><p>Alle Artikel sind abgehakt.</p><button class="btn primary" data-action="toggle-store">Zurück zur Liste</button></div>`}</main></section>`
}

function openItemSheet(id=null,forcedCategory=null){
  const item=id?state.items.find(x=>x.id===id):null
  ui.expanded=false
  sheet.innerHTML=`<form data-form="item" data-id="${item?.id||''}" class="sheet-form"><div class="handle"></div><header><div><span>${item?'ARTIKEL BEARBEITEN':'NEUER ARTIKEL'}</span><h2>${item?esc(item.name):'Produkt hinzufügen'}</h2></div><button type="button" class="sheet-close" data-action="close-sheet">×</button></header><div class="sheet-body"><label>Produktname<input name="name" required maxlength="80" value="${esc(item?.name||'')}" placeholder="z. B. Vollmilch"></label><div class="two"><label>Menge<input name="quantity" type="number" min="0.01" step="0.01" inputmode="decimal" value="${item?.quantity||1}"></label><label>Kategorie<select name="category"><option value="auto">Automatisch</option>${CATEGORIES.filter(c=>c.id!=='all').map(c=>`<option value="${c.id}" ${(item?.category||forcedCategory)===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label></div><button type="button" class="more-options" data-action="toggle-options">Weitere Optionen</button><div class="advanced" hidden><label>Einheit<select name="unit">${['Stk.','Pkg.','kg','g','l','ml'].map(u=>`<option ${item?.unit===u?'selected':''}>${u}</option>`).join('')}</select></label><label>Notiz<textarea name="note" maxlength="160" placeholder="Optional">${esc(item?.note||'')}</textarea></label></div></div><footer>${item?`<button type="button" class="delete-link" data-action="delete-item" data-id="${item.id}">Löschen</button>`:'<span></span>'}<button class="btn primary" type="submit">${item?'Speichern':'Hinzufügen'}</button></footer></form>`
  sheet.showModal(); requestAnimationFrame(()=>sheet.querySelector('input[name=name]')?.focus())
}
function openLists(){
  sheet.innerHTML=`<div class="sheet-form"><div class="handle"></div><header><div><span>EINKAUFSLISTEN</span><h2>Meine Listen</h2></div><button class="sheet-close" data-action="close-sheet">×</button></header><div class="sheet-body list-manager">${state.lists.map(l=>`<div class="list-choice ${l.id===state.activeListId?'active':''}"><button data-action="select-list" data-id="${l.id}"><strong>${esc(l.name)}</strong><small>${listItems(state,l.id).filter(i=>!i.done).length} offen</small></button><button data-action="rename-list" data-id="${l.id}">${icons.edit}</button>${state.lists.length>1?`<button class="red" data-action="delete-list" data-id="${l.id}">${icons.trash}</button>`:''}</div>`).join('')}<button class="btn secondary" data-action="new-list">Neue Liste erstellen</button></div></div>`; sheet.showModal()
}
function closeSheet(){ if(sheet.open) sheet.close() }
function showToast(msg){ toast.textContent=msg; toast.classList.add('show'); clearTimeout(showToast.t); showToast.t=setTimeout(()=>toast.classList.remove('show'),1800) }
function addQuick(name){ const n=String(name||'').trim(); if(!n)return; mutate(s=>s.items.push({id:uid('item'),listId:s.activeListId,name:n,category:autoCategory(n),quantity:1,unit:'Stk.',note:'',done:false,favorite:false,createdAt:Date.now(),updatedAt:Date.now(),completedAt:null}),`${n} hinzugefügt`) }

app.addEventListener('submit',e=>{ if(e.target.id==='quick-add-form'){ e.preventDefault(); const f=new FormData(e.target); addQuick(f.get('name')) } })
sheet.addEventListener('submit',e=>{
  const form=e.target.closest('[data-form=item]'); if(!form)return; e.preventDefault(); const f=new FormData(form), name=String(f.get('name')||'').trim(); if(!name)return
  const id=form.dataset.id, cat=String(f.get('category')||'auto'); mutate(s=>{ const data={name,quantity:Number(f.get('quantity'))||1,unit:String(f.get('unit')||'Stk.'),category:cat==='auto'?autoCategory(name):cat,note:String(f.get('note')||'').trim(),updatedAt:Date.now()}; if(id){Object.assign(s.items.find(x=>x.id===id),data)} else s.items.push({id:uid('item'),listId:s.activeListId,...data,done:false,favorite:false,createdAt:Date.now(),completedAt:null}) },id?'Gespeichert':'Hinzugefügt'); closeSheet()
})
document.addEventListener('click',async e=>{
  const r=e.target.closest('[data-route]'); if(r){ui.route=r.dataset.route;ui.category='all';render();return}
  const b=e.target.closest('[data-action]'); if(!b)return; const a=b.dataset.action
  if(a==='finish-onboarding') mutate(s=>s.settings.onboarded=true)
  else if(a==='add-item') openItemSheet(null,b.dataset.category||null)
  else if(a==='edit-item') openItemSheet(b.dataset.id)
  else if(a==='close-sheet') closeSheet()
  else if(a==='toggle-options'){ const x=sheet.querySelector('.advanced'); x.hidden=!x.hidden; b.textContent=x.hidden?'Weitere Optionen':'Weniger Optionen' }
  else if(a==='toggle-item') mutate(s=>{const i=s.items.find(x=>x.id===b.dataset.id);if(i){i.done=!i.done;i.completedAt=i.done?Date.now():null;i.updatedAt=Date.now()}})
  else if(a==='filter-category'){ui.category=b.dataset.category;render()}
  else if(a==='open-category'){ui.route='shop';ui.category=b.dataset.category;render()}
  else if(a==='toggle-store'){ui.storeMode=!ui.storeMode;render()}
  else if(a==='open-lists') openLists()
  else if(a==='select-list'){state.activeListId=b.dataset.id;save();closeSheet();render()}
  else if(a==='new-list'){const n=prompt('Name der neuen Liste:','Neue Liste')?.trim();if(n){mutate(s=>{const id=uid('list');s.lists.push({id,name:n.slice(0,40),createdAt:Date.now()});s.activeListId=id});closeSheet()}}
  else if(a==='rename-list'){const l=state.lists.find(x=>x.id===b.dataset.id),n=prompt('Liste umbenennen:',l?.name||'')?.trim();if(l&&n){mutate(s=>{s.lists.find(x=>x.id===l.id).name=n.slice(0,40)});openLists()}}
  else if(a==='delete-list'){const id=b.dataset.id;if(confirm('Liste inklusive Artikel löschen?')){mutate(s=>{s.lists=s.lists.filter(x=>x.id!==id);s.items=s.items.filter(x=>x.listId!==id);if(s.activeListId===id)s.activeListId=s.lists[0].id});openLists()}}
  else if(a==='delete-item'){if(confirm('Artikel löschen?')){mutate(s=>s.items=s.items.filter(x=>x.id!==b.dataset.id),'Artikel gelöscht');closeSheet()}}
  else if(a==='add-suggestion') addQuick(b.dataset.name)
  else if(a==='share-list'){const l=activeList(),text=`${l.name}\n\n${sortItems(activeItems()).filter(i=>!i.done).map(i=>`○ ${i.name}`).join('\n')}`;try{if(navigator.share)await navigator.share({title:l.name,text});else{await navigator.clipboard.writeText(text);showToast('Liste kopiert')}}catch{}}
  else if(a==='set-theme'){mutate(s=>s.settings.theme=s.settings.theme==='dark'?'light':'dark')}
  else if(a==='export-data'){const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),x=document.createElement('a');x.href=url;x.download='selfmade-backup.json';x.click();URL.revokeObjectURL(url)}
  else if(a==='import-data') importFile.click()
  else if(a==='reset-data'){if(confirm('Alle lokalen Daten löschen?')){state=createInitialState();save();render()}}
})
importFile.addEventListener('change',async()=>{const f=importFile.files?.[0];if(!f)return;try{state=normalizeState(JSON.parse(await f.text()));state.settings.onboarded=true;save();render();showToast('Backup importiert')}catch{showToast('Backup ungültig')}finally{importFile.value=''}})
sheet.addEventListener('click',e=>{if(e.target===sheet)closeSheet()})
if('serviceWorker'in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}))
render()
window.__SELFMADE_READY__=true
document.documentElement.setAttribute('data-app-ready','true')
