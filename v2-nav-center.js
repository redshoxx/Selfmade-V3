(function(root){
'use strict'
const RELEASE='2.0.1'
let scheduled=false

const ICONS={
  overview:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 10.5 12 3.5l8.5 7"/><path d="M5.5 9.2V20h13V9.2"/><path d="M9.2 20v-6.2h5.6V20"/></svg>`,
  transactions:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.2 3.5h11.6v17l-2.5-1.7-3.3 1.7-3.3-1.7-2.5 1.7z"/><path d="M9 8h6"/><path d="M9 12h6"/><path d="M9 16h3.8"/></svg>`,
  goals:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.2"/><circle cx="12" cy="12" r="4.2"/><path d="m12 12 6-6"/><path d="M15.8 5.9h2.3v2.3"/></svg>`,
  challenges:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 4h8v4.2a4 4 0 0 1-8 0z"/><path d="M8 6H4.5v1.2A3.8 3.8 0 0 0 8 11"/><path d="M16 6h3.5v1.2A3.8 3.8 0 0 1 16 11"/><path d="M12 12.2V17"/><path d="M8.5 20h7"/><path d="M10 17h4"/></svg>`,
  add:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14"/><path d="M5 12h14"/></svg>`
}

function installRouteIcons(nav){
  nav.querySelectorAll('button[data-route]').forEach(button=>{
    const route=button.dataset.route
    const icon=ICONS[route]
    if(!icon)return
    let holder=button.querySelector('b')
    if(!holder){holder=document.createElement('b');button.prepend(holder)}
    holder.classList.add('v2-nav-icon')
    if(holder.dataset.svgIcon!==route){holder.innerHTML=icon;holder.dataset.svgIcon=route}
    holder.setAttribute('aria-hidden','true')
  })
}

function buildButton(){
  const button=document.createElement('button')
  button.type='button'
  button.className='v2-center-add'
  button.dataset.action='add-tx'
  button.setAttribute('aria-label','Neue manuelle Buchung')
  button.innerHTML=`<span class="v2-center-add-icon" aria-hidden="true">${ICONS.add}</span><span class="v2-center-add-copy"><b>Neue Buchung</b><small>Manuell erfassen</small></span>`
  return button
}

function enhanceNavigation(){
  scheduled=false
  const nav=document.querySelector('.tabs')
  if(!nav)return
  nav.classList.add('v2-nav-centered')
  installRouteIcons(nav)
  let add=nav.querySelector('.v2-center-add')
  if(!add){
    add=buildButton()
    const goals=nav.querySelector('button[data-route="goals"]')
    if(goals)nav.insertBefore(add,goals)
    else nav.appendChild(add)
  }
  const version=nav.querySelector('.v2-nav-foot b')
  if(version)version.textContent=`v${RELEASE}`
  document.querySelectorAll('.fab').forEach(button=>button.classList.add('v2-legacy-fab'))
}

function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(enhanceNavigation)}
new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true})
window.addEventListener('resize',schedule,{passive:true})
schedule()
root.NestV2Navigation={RELEASE,ICONS,enhanceNavigation}
})(globalThis)
