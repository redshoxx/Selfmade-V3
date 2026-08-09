(function(root){
'use strict'
const RELEASE='3.2.0'
const ICONS={
  lebensmittel:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 6h2l1.6 8.5h9.8l2-6H6.1"/><circle cx="9.5" cy="19" r="1.2"/><circle cx="17" cy="19" r="1.2"/></svg>',
  wohnen:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 10.5 12 3.8l8.5 6.7V20h-6v-5.5h-5V20h-6z"/></svg>',
  mobilitaet:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 16.5h14l-1.2-5.2A2 2 0 0 0 15.9 9H8.1a2 2 0 0 0-1.9 2.3L5 16.5Z"/><path d="M7 9 8.5 5h7L17 9M4 13h2M18 13h2"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="16.5" cy="17.5" r="1.5"/></svg>',
  freizeit:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 9h8a4 4 0 0 1 3.7 5.5l-1 2.3a2 2 0 0 1-3.1.8L13.8 16h-3.6l-1.8 1.6a2 2 0 0 1-3.1-.8l-1-2.3A4 4 0 0 1 8 9Z"/><path d="M8 12v3M6.5 13.5h3M15.5 12.5h.01M17.5 14.5h.01"/></svg>',
  shopping:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
  gesundheit:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.7A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z"/><path d="M12 9v6M9 12h6"/></svg>',
  haushalt:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 20h8M10 20l1-8h2l1 8M9 12h6l-1-7h-4l-1 7Z"/><path d="M8 5h8"/></svg>',
  abos:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.5h12v17l-3-1.7-3 1.7-3-1.7-3 1.7z"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>',
  sparen:'<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="7" rx="6" ry="3"/><path d="M6 7v5c0 1.7 2.7 3 6 3s6-1.3 6-3V7M6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5"/></svg>',
  gehalt:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="6" width="17" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6.5 9h.01M17.5 15h.01"/></svg>',
  bonus:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.2 5 5.3.6-4 3.6 1.1 5.3-4.6-2.7-4.6 2.7 1.1-5.3-4-3.6L9.8 8 12 3Z"/></svg>',
  verkauf:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12.5 11.5 5H19v7.5L11.5 20 4 12.5Z"/><circle cx="15.5" cy="8.5" r="1.2"/></svg>',
  rueckzahlung:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7H4v-4M4.5 7A8 8 0 1 1 5 17"/></svg>',
  geschenk:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10h16v10H4zM3 7h18v3H3zM12 7v13"/><path d="M12 7H8.5A2.5 2.5 0 1 1 11 4.5L12 7Zm0 0h3.5A2.5 2.5 0 1 0 13 4.5L12 7Z"/></svg>',
  sonstiges:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/></svg>'
}
const KEY_BY_CATEGORY={
  'Lebensmittel':'lebensmittel','Wohnen':'wohnen','Mobilität':'mobilitaet','Freizeit':'freizeit','Shopping':'shopping','Gesundheit':'gesundheit','Haushalt':'haushalt','Abos & Verträge':'abos','Sparen':'sparen','Sonstiges':'sonstiges','Gehalt':'gehalt','Bonus':'bonus','Verkauf':'verkauf','Rückzahlung':'rueckzahlung','Geschenk':'geschenk'
}
function setText(el,value){if(el&&el.textContent!==value)el.textContent=value}
function release(){
  document.title='NEST 3.2'
  document.documentElement.dataset.nestRelease=RELEASE
  const meta=document.querySelector('meta[name="nest-version"]');if(meta&&meta.content!==RELEASE)meta.content=RELEASE
  const top=document.querySelector('.v3-top>div>span');if(top)setText(top,'NEST · V'+RELEASE)
}
function enhanceRow(row){
  if(!row||row.dataset.v32Ready==='1')return
  const copy=row.querySelector('.v3-row-copy'),meta=copy?.querySelector('small'),icon=row.querySelector('.v3-row-icon')
  if(!copy||!meta||!icon)return
  const parts=String(meta.textContent||'').split(' · '),category=(parts.shift()||'Sonstiges').trim(),date=parts.join(' · ').trim(),key=KEY_BY_CATEGORY[category]||'sonstiges'
  row.dataset.v32Category=key
  row.dataset.v32Ready='1'
  icon.classList.add('v32-category-icon')
  icon.innerHTML=ICONS[key]||ICONS.sonstiges
  let badge=copy.querySelector('.v32-category-badge')
  if(!badge){badge=document.createElement('span');badge.className='v32-category-badge';copy.insertBefore(badge,meta)}
  badge.textContent=category
  meta.textContent=date
}
let queued=false
function enhance(){
  queued=false
  release()
  document.querySelectorAll('.v3-row[data-v3="tx-detail"]').forEach(enhanceRow)
}
function schedule(){if(queued)return;queued=true;queueMicrotask(enhance)}
const app=document.getElementById('app')
if(app)new MutationObserver(schedule).observe(app,{childList:true,subtree:true})
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule()
root.NestBookingsV32={RELEASE,enhance}
})(globalThis)
