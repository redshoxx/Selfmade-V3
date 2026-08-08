(function(root){
'use strict'
const RELEASE='2.0.0'
let scheduled=false

function buildButton(){
  const button=document.createElement('button')
  button.type='button'
  button.className='v2-center-add'
  button.dataset.action='add-tx'
  button.setAttribute('aria-label','Neue manuelle Buchung')
  button.innerHTML='<span class="v2-center-add-icon" aria-hidden="true">+</span><span class="v2-center-add-copy"><b>Neue Buchung</b><small>Manuell erfassen</small></span>'
  return button
}

function enhanceNavigation(){
  scheduled=false
  const nav=document.querySelector('.tabs')
  if(!nav)return
  nav.classList.add('v2-nav-centered')
  let add=nav.querySelector('.v2-center-add')
  if(!add){
    add=buildButton()
    const goals=nav.querySelector('button[data-route="goals"]')
    if(goals)nav.insertBefore(add,goals)
    else nav.appendChild(add)
  }
  document.querySelectorAll('.fab').forEach(button=>button.classList.add('v2-legacy-fab'))
}

function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(enhanceNavigation)}
new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true})
window.addEventListener('resize',schedule,{passive:true})
schedule()
root.NestV2Navigation={RELEASE,enhanceNavigation}
})(globalThis)
