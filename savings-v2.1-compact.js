(function(root){
'use strict'
var scheduled=false
function plusIcon(){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>'}
function ensureDialog(){
  var d=document.getElementById('v21QuickAdd')
  if(d)return d
  d=document.createElement('dialog')
  d.id='v21QuickAdd'
  d.className='v21-quick-dialog'
  d.setAttribute('aria-label','Sparprojekt hinzufügen')
  d.innerHTML='<section class="v21-quick-sheet"><div class="v21-quick-handle"></div><header><div><span>SPAREN</span><h2>Was möchtest du hinzufügen?</h2></div><button type="button" data-v21-quick="close" aria-label="Schließen">×</button></header><div class="v21-quick-options"><button type="button" data-v21-create="goal"><i>+</i><span><b>Sparziel</b><small>Eigenes Ziel mit Betrag und optionalem Datum</small></span><em>›</em></button><button type="button" data-v21-create="template"><i>✦</i><span><b>Challenge-Vorlage</b><small>Eine fertige Spar-Challenge auswählen</small></span><em>›</em></button><button type="button" data-v21-create="challenge"><i>○</i><span><b>Eigene Challenge</b><small>Schritte und Zielbetrag selbst festlegen</small></span><em>›</em></button></div></section>'
  document.body.appendChild(d)
  d.addEventListener('click',function(e){if(e.target===d)d.close()})
  return d
}
function openDialog(){var d=ensureDialog();if(!d.open)d.showModal()}
function appAction(action){
  var app=document.getElementById('app');if(!app)return
  var b=document.createElement('button');b.type='button';b.hidden=true;b.setAttribute('data-action',action);app.appendChild(b);b.click();b.remove()
}
function templateAction(){
  var b=document.createElement('button');b.type='button';b.hidden=true;b.setAttribute('data-c203-action','open-templates');document.body.appendChild(b);b.click();b.remove()
}
function compactPage(){
  scheduled=false
  var page=document.querySelector('.v21-savings');if(!page||page.getAttribute('data-v21-compact')==='1')return
  page.setAttribute('data-v21-compact','1');page.classList.add('v21-compact')
  var hero=page.querySelector('.v21-hero');if(hero){var actions=hero.querySelector('.v21-hero-actions');if(actions){actions.innerHTML='<button type="button" class="v21-quick-add" data-v21-quick="open" aria-label="Sparziel oder Challenge hinzufügen">'+plusIcon()+'</button>'}}
  var sectionActions=page.querySelectorAll('.v21-section-action');for(var i=0;i<sectionActions.length;i++)sectionActions[i].remove()
  var sections=page.querySelectorAll('.v21-section');for(var j=0;j<sections.length;j++){
    var empty=sections[j].querySelector('.v21-empty');if(!empty)continue
    var title=sections[j].querySelector('.v21-section-head h2');var isGoal=title&&String(title.textContent).trim()==='Sparziele'
    empty.innerHTML='<div class="v21-compact-empty-icon">'+(isGoal?'◎':'◇')+'</div><div><h3>'+(isGoal?'Noch kein Sparziel':'Noch keine Challenge')+'</h3><p>'+(isGoal?'Über + kannst du dein erstes Sparziel anlegen.':'Über + kannst du eine Vorlage wählen oder eine eigene Challenge erstellen.')+'</p></div>'
  }
}
function schedule(){if(scheduled)return;scheduled=true;if(typeof requestAnimationFrame==='function')requestAnimationFrame(compactPage);else setTimeout(compactPage,0)}
document.addEventListener('click',function(e){
  var quick=e.target.closest&&e.target.closest('[data-v21-quick]');if(quick){e.preventDefault();e.stopPropagation();var q=quick.getAttribute('data-v21-quick');if(q==='open')openDialog();else if(q==='close'){var d=document.getElementById('v21QuickAdd');if(d&&d.open)d.close()}return}
  var create=e.target.closest&&e.target.closest('[data-v21-create]');if(!create)return
  e.preventDefault();e.stopPropagation();var d=document.getElementById('v21QuickAdd');if(d&&d.open)d.close();var type=create.getAttribute('data-v21-create')
  setTimeout(function(){if(type==='goal')appAction('add-goal');else if(type==='challenge')appAction('add-challenge');else if(type==='template')templateAction()},30)
},true)
var app=document.getElementById('app');if(app)new MutationObserver(schedule).observe(app,{childList:true,subtree:true});schedule()
root.NestSavingsCompactV21={open:openDialog,refresh:compactPage}
})(typeof globalThis!=='undefined'?globalThis:this)
