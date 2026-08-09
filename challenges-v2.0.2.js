(function(root,factory){
'use strict'
var api=factory(root&&root.NestV202)
if(typeof module!=='undefined'&&module.exports)module.exports=api
if(root)root.NestChallengesV202=api
})(typeof globalThis!=='undefined'?globalThis:this,function(Core){
'use strict'
var TEMPLATES=[
  {key:'52',name:'52-Wochen-Challenge',target:1378,steps:52,kicker:'Klassiker',detail:'Jede Woche einen Schritt weiter – von 1 € bis 52 €.',accent:'52 Wochen'},
  {key:'30x5',name:'30 Tage × 5 €',target:150,steps:30,kicker:'Kurz & klar',detail:'30 Schritte mit jeweils 5 € – ideal für einen schnellen Start.',accent:'5 € / Tag'},
  {key:'1000',name:'1.000-€-Challenge',target:1000,steps:20,kicker:'Großes Ziel',detail:'20 übersichtliche Schritte mit jeweils 50 € bis 1.000 €.',accent:'50 € / Schritt'}
]
var OLD_DEFAULT_IDS={builtin_52:'52',builtin_30x5:'30x5',builtin_1000:'1000'}
var scheduled=false
function n(v,d){var x=Number(v);return Number.isFinite(x)?x:(d||0)}
function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;')}
function euro(v){try{return new Intl.NumberFormat('de-AT',{style:'currency',currency:'EUR'}).format(n(v,0))}catch(e){return n(v,0).toFixed(2)+' €'}}
function findTemplate(key){for(var i=0;i<TEMPLATES.length;i++)if(TEMPLATES[i].key===key)return TEMPLATES[i];return null}
function exactTemplateMatch(c,t){return !!(c&&t&&String(c.name||'')===t.name&&n(c.target,0)===t.target&&n(c.steps,0)===t.steps)}
function oldTemplateFor(c){var key=OLD_DEFAULT_IDS[String(c&&c.id||'')];var t=findTemplate(key);return t&&exactTemplateMatch(c,t)?t:null}
function isUntouchedAutoDefault(c){var t=oldTemplateFor(c);return !!(t&&!c.custom&&n(c.completed,0)===0&&!c.deadline)}
function templateForChallenge(c){
  if(!c||c.custom)return null
  var id=String(c.id||''),i,t
  t=oldTemplateFor(c);if(t)return t
  for(i=0;i<TEMPLATES.length;i++){
    t=TEMPLATES[i]
    if(id.indexOf('tpl_'+t.key+'_')===0&&exactTemplateMatch(c,t))return t
  }
  return null
}
function progressFor(c){
  var steps=Math.max(1,n(c&&c.steps,1)),completed=Math.max(0,Math.min(steps,n(c&&c.completed,0))),target=Math.max(0,n(c&&c.target,0)),t=templateForChallenge(c),saved,next
  if(t&&t.key==='52'){saved=completed*(completed+1)/2;next=completed<52?completed+1:0}
  else if(t&&t.key==='30x5'){saved=completed*5;next=completed<30?5:0}
  else if(t&&t.key==='1000'){saved=completed*50;next=completed<20?50:0}
  else{saved=steps?target*(completed/steps):0;next=completed<steps?(steps?target/steps:0):0}
  saved=Math.min(target,saved)
  return{completed:completed,steps:steps,target:target,saved:saved,remaining:Math.max(0,target-saved),percent:Math.round((completed/steps)*100),next:next,template:t}
}
function createTemplateChallenge(key,now){
  var t=findTemplate(key),stamp=n(now,Date.now())
  if(!t)return null
  return{id:'tpl_'+t.key+'_'+stamp.toString(36)+'_'+Math.random().toString(36).slice(2,7),name:t.name,target:t.target,steps:t.steps,completed:0,deadline:'',custom:false,createdAt:stamp}
}
function activeTemplateKeys(challenges){
  var found={},list=Array.isArray(challenges)?challenges:[]
  for(var i=0;i<list.length;i++){var t=templateForChallenge(list[i]);if(t)found[t.key]=true}
  return found
}
function cleanupOldDefaults(core){
  core=core||Core;if(!core)return 0
  var state=core.loadState(),before=state.challenges.length
  state.challenges=state.challenges.filter(function(c){return !isUntouchedAutoDefault(c)})
  if(state.challenges.length!==before)core.saveState(state,{method:'system'})
  return before-state.challenges.length
}
function show(message,error){
  if(typeof document==='undefined')return
  var toast=document.getElementById('toast');if(!toast)return
  toast.textContent=message;toast.classList.toggle('bad',!!error);toast.classList.add('show')
  clearTimeout(show.t);show.t=setTimeout(function(){toast.classList.remove('show','bad')},2400)
}
function ensureTemplateDialog(){
  var d=document.getElementById('challengeTemplates202')
  if(d)return d
  d=document.createElement('dialog');d.id='challengeTemplates202';d.className='c203-dialog';d.setAttribute('aria-label','Challenge-Vorlagen');document.body.appendChild(d)
  d.addEventListener('click',function(e){if(e.target===d)d.close()})
  return d
}
function templateDialogMarkup(){
  var state=Core.loadState(),active=activeTemplateKeys(state.challenges),cards=''
  for(var i=0;i<TEMPLATES.length;i++){
    var t=TEMPLATES[i],on=!!active[t.key]
    cards+='<article class="c203-template-card"><div class="c203-template-top"><span>'+esc(t.kicker)+'</span><em>'+esc(t.accent)+'</em></div><h3>'+esc(t.name)+'</h3><p>'+esc(t.detail)+'</p><div class="c203-template-facts"><span><b>'+t.steps+'</b> Schritte</span><span><b>'+esc(euro(t.target))+'</b> Ziel</span></div><button type="button" data-c203-action="add-template" data-template="'+esc(t.key)+'" '+(on?'disabled':'')+'>'+(on?'Bereits aktiv':'Vorlage hinzufügen')+'</button></article>'
  }
  return '<section class="c203-dialog-shell"><header><div><span>NEST VORLAGEN</span><h2>Challenge auswählen</h2><p>Vorlagen werden erst hinzugefügt, wenn du sie bewusst auswählst.</p></div><button type="button" data-c203-action="close-templates" aria-label="Schließen">×</button></header><div class="c203-template-list">'+cards+'</div><footer><button type="button" data-c203-action="close-templates">Fertig</button></footer></section>'
}
function openTemplates(){var d=ensureTemplateDialog();d.innerHTML=templateDialogMarkup();if(!d.open)d.showModal()}
function addTemplate(key){
  var t=findTemplate(key);if(!t)return
  try{
    var state=Core.loadState(),active=activeTemplateKeys(state.challenges)
    if(active[key]){show('Diese Vorlage ist bereits aktiv');return}
    var challenge=createTemplateChallenge(key,Date.now());state.challenges.push(Core.normalizeChallenge(challenge));Core.saveState(state,{method:'system'})
    var d=document.getElementById('challengeTemplates202');if(d&&d.open)d.close()
    if(root.NestAppV202&&root.NestAppV202.reload)root.NestAppV202.reload()
    show(t.name+' hinzugefügt')
  }catch(e){console.error('Challenge template save failed',e);show('Vorlage konnte nicht gespeichert werden',true)}
}
function deleteChallenge(id){
  if(!confirm('Challenge wirklich entfernen? Der bisherige Fortschritt dieser Challenge wird gelöscht.'))return
  try{
    var state=Core.loadState(),before=state.challenges.length
    state.challenges=state.challenges.filter(function(c){return String(c.id)!==String(id)})
    if(state.challenges.length===before)return
    Core.saveState(state,{method:'system'});if(root.NestAppV202&&root.NestAppV202.reload)root.NestAppV202.reload();show('Challenge entfernt')
  }catch(e){console.error('Challenge delete failed',e);show('Challenge konnte nicht entfernt werden',true)}
}
function challengeCard(c){
  var p=progressFor(c),t=p.template,label=t?'Vorlage':'Eigene Challenge',done=p.completed>=p.steps
  return '<article class="c203-active-card"><div class="c203-card-head"><div><span class="c203-kind '+(t?'template':'custom')+'">'+esc(label)+'</span><h3>'+esc(c.name)+'</h3></div><strong>'+p.percent+'%</strong></div><div class="c203-money"><div><small>Gespart</small><b>'+esc(euro(p.saved))+'</b></div><div><small>Noch offen</small><b>'+esc(euro(p.remaining))+'</b></div></div><div class="c203-progress"><i style="width:'+p.percent+'%"></i></div><div class="c203-step-row"><span>'+p.completed+' von '+p.steps+' Schritten</span><span>'+(done?'Abgeschlossen':('Nächster Schritt '+esc(euro(p.next))))+'</span></div><div class="c203-actions"><button type="button" class="primary" data-action="challenge-step" data-id="'+esc(c.id)+'" data-dir="1" '+(done?'disabled':'')+'>'+(done?'Fertig':'Schritt +')+'</button><button type="button" data-action="challenge-step" data-id="'+esc(c.id)+'" data-dir="-1" '+(p.completed<=0?'disabled':'')+'>Zurück</button><button type="button" data-action="edit-challenge" data-id="'+esc(c.id)+'">Bearbeiten</button><button type="button" class="danger" data-c203-action="delete" data-id="'+esc(c.id)+'" aria-label="Challenge entfernen">Entfernen</button></div></article>'
}
function pageMarkup(){
  var state=Core.loadState(),list=state.challenges||[],totalSaved=0,totalTarget=0,cards=''
  for(var i=0;i<list.length;i++){var p=progressFor(list[i]);totalSaved+=p.saved;totalTarget+=p.target;cards+=challengeCard(list[i])}
  var summary='<section class="c203-summary"><div><span>AKTIVE CHALLENGES</span><strong>'+list.length+'</strong></div><div><span>GESPART</span><strong>'+esc(euro(totalSaved))+'</strong></div><div><span>ZIELSUMME</span><strong>'+esc(euro(totalTarget))+'</strong></div></section>'
  var toolbar='<section class="c203-toolbar"><div><span>SPAR-CHALLENGES</span><h2>Deine Challenges</h2><p>Starte nur die Challenges, die du wirklich machen möchtest.</p></div><div class="c203-toolbar-actions"><button type="button" class="primary" data-c203-action="open-templates">Vorlage hinzufügen</button><button type="button" data-action="add-challenge">Eigene Challenge</button></div></section>'
  var content=list.length?'<section class="c203-grid">'+cards+'</section>':'<section class="c203-empty"><div class="c203-empty-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v4a5 5 0 0 1-10 0V4z"/><path d="M7 6H4a3 3 0 0 0 3 3"/><path d="M17 6h3a3 3 0 0 1-3 3"/></svg></div><h3>Noch keine Challenge aktiv</h3><p>Wähle eine NEST-Vorlage oder erstelle deine eigene Challenge. Es wird nichts mehr automatisch hinzugefügt.</p><div><button type="button" class="primary" data-c203-action="open-templates">Vorlage auswählen</button><button type="button" data-action="add-challenge">Eigene erstellen</button></div></section>'
  return '<div class="c203-page">'+toolbar+summary+content+'</div>'
}
function enhanceChallengePage(){
  scheduled=false
  var app=document.getElementById('app');if(!app)return
  var shell=app.querySelector('.shell'),h1=shell&&shell.querySelector('header.top h1');if(!shell||!h1||String(h1.textContent).trim()!=='Challenges')return
  if(shell.querySelector('.c203-page'))return
  var children=Array.prototype.slice.call(shell.children,1);for(var i=0;i<children.length;i++)children[i].remove()
  shell.insertAdjacentHTML('beforeend',pageMarkup())
}
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(enhanceChallengePage)}
function bindBrowser(){
  cleanupOldDefaults(Core)
  var app=document.getElementById('app');if(app)new MutationObserver(schedule).observe(app,{childList:true,subtree:true})
  document.addEventListener('click',function(e){
    var b=e.target.closest&&e.target.closest('[data-c203-action]');if(!b)return
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation()
    var action=b.getAttribute('data-c203-action')
    if(action==='open-templates')openTemplates()
    else if(action==='close-templates'){var d=document.getElementById('challengeTemplates202');if(d&&d.open)d.close()}
    else if(action==='add-template')addTemplate(b.getAttribute('data-template'))
    else if(action==='delete')deleteChallenge(b.getAttribute('data-id'))
  },true)
  schedule()
}
var API={TEMPLATES:TEMPLATES,findTemplate:findTemplate,isUntouchedAutoDefault:isUntouchedAutoDefault,templateForChallenge:templateForChallenge,progressFor:progressFor,createTemplateChallenge:createTemplateChallenge,activeTemplateKeys:activeTemplateKeys,cleanupOldDefaults:cleanupOldDefaults}
if(typeof document!=='undefined'&&Core)bindBrowser()
return API
})
