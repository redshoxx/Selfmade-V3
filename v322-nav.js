(function(root){
'use strict'
const RELEASE='4.4.0'
const HOME='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 10.5 12 3.5l8.5 7v9a1 1 0 0 1-1 1h-5v-6h-5v6h-5a1 1 0 0 1-1-1z"/></svg>'
let queued=false
function release(){document.title='NEST 4.4';document.documentElement.dataset.nestRelease=RELEASE;const meta=document.querySelector('meta[name="nest-version"]');if(meta)meta.content=RELEASE;const top=document.querySelector('.v3-top>div>span');if(top&&top.textContent!=='NEST · V'+RELEASE)top.textContent='NEST · V'+RELEASE}
function injectStyle(){if(document.getElementById('v322NavStyle'))return;const style=document.createElement('style');style.id='v322NavStyle';style.textContent=`
.v322-top-actions{display:flex;align-items:center;gap:7px;flex:0 0 auto}
.v322-home-btn,.v322-top-actions .v3-icon-btn{width:40px!important;height:40px!important;border:1px solid var(--line)!important;border-radius:13px!important;background:var(--surface)!important;color:var(--text)!important;display:grid!important;place-items:center!important;box-shadow:0 5px 16px rgba(20,18,15,.05)!important}
.v322-home-btn svg,.v322-top-actions .v3-icon-btn svg{width:20px!important;height:20px!important}
.v322-home-btn{opacity:.72;transition:transform .11s ease,opacity .11s ease,background .11s ease!important}
.v322-home-btn.active{opacity:1;background:var(--surface2)!important}
.v322-home-btn:active,.v322-top-actions .v3-icon-btn:active{transform:scale(.94)!important}
.v3-nav.v31-nav.v322-nav{grid-template-columns:repeat(5,minmax(0,1fr))!important;padding-left:8px!important;padding-right:8px!important}
.v3-nav.v31-nav.v322-nav [data-route="overview"]{display:none!important}
.v3-nav.v31-nav.v322-nav [data-route="transactions"]{grid-column:1!important}
.v3-nav.v31-nav.v322-nav [data-v31-route="tasks"]{grid-column:2!important}
.v3-nav.v31-nav.v322-nav [data-route="shopping"]{grid-column:4!important}
.v3-nav.v31-nav.v322-nav [data-route="savings"]{grid-column:5!important}
.v3-nav.v31-nav.v322-nav [data-v31-more]{display:none!important}
.v3-nav.v31-nav.v322-nav>button:not(.v3-plus){width:100%!important;min-width:0!important}
@media(max-width:430px){.v322-top-actions{gap:6px}.v322-home-btn,.v322-top-actions .v3-icon-btn{width:39px!important;height:39px!important;border-radius:12px!important}.v3-nav.v31-nav.v322-nav{grid-template-columns:repeat(5,minmax(0,1fr))!important;padding-left:6px!important;padding-right:6px!important}.v3-nav.v31-nav.v322-nav>button span{font-size:7px!important}}
`;document.head.appendChild(style)}
function enhance(){queued=false;injectStyle();release();const nav=document.querySelector('.v3-nav');if(nav){nav.classList.add('v322-nav');const oldHome=nav.querySelector('[data-route="overview"]');if(oldHome)oldHome.remove()}const top=document.querySelector('.v3-top');if(!top)return;const settings=top.querySelector('[data-v3="settings"]');let actions=top.querySelector('.v322-top-actions');if(!actions){actions=document.createElement('div');actions.className='v322-top-actions';if(settings)top.insertBefore(actions,settings);else top.appendChild(actions)}let home=actions.querySelector('.v322-home-btn');if(!home){home=document.createElement('button');home.type='button';home.className='v322-home-btn';home.setAttribute('data-route','overview');home.setAttribute('aria-label','Übersicht');home.setAttribute('title','Übersicht');home.innerHTML=HOME;actions.appendChild(home)}if(settings&&settings.parentElement!==actions)actions.appendChild(settings);const page=document.querySelector('.v3-main')?.dataset.page;home.classList.toggle('active',page==='overview')}
function schedule(){if(queued)return;queued=true;requestAnimationFrame(enhance)}
const app=document.getElementById('app');if(app)new MutationObserver(schedule).observe(app,{childList:true});if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();root.addEventListener('pageshow',schedule);root.addEventListener('load',schedule,{once:true});setTimeout(schedule,100);root.NestNavV322={RELEASE,enhance,schedule}
})(globalThis)