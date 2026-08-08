(function(root){
'use strict'
const RELEASE='1.3.0'
const CORE_KEY='selfmade-save-v1'
const PREF_KEY='nest-settings-v1.3'
const DEFAULTS={appearance:'system',density:'comfortable',textSize:'normal',privacy:false,reduceMotion:false,startRoute:'overview'}
const ROUTES=new Set(['overview','transactions','goals','challenges'])
const APPEARANCES=new Set(['system','light','dark'])
const DENSITIES=new Set(['comfortable','compact'])
const TEXT_SIZES=new Set(['normal','large'])
let startApplied=false

function safeParse(value,fallback){try{const parsed=JSON.parse(value);return parsed&&typeof parsed==='object'?parsed:fallback}catch{return fallback}}
function loadPrefs(){const raw=safeParse(localStorage.getItem(PREF_KEY),{});return{
  appearance:APPEARANCES.has(raw.appearance)?raw.appearance:DEFAULTS.appearance,
  density:DENSITIES.has(raw.density)?raw.density:DEFAULTS.density,
  textSize:TEXT_SIZES.has(raw.textSize)?raw.textSize:DEFAULTS.textSize,
  privacy:Boolean(raw.privacy),
  reduceMotion:Boolean(raw.reduceMotion),
  startRoute:ROUTES.has(raw.startRoute)?raw.startRoute:DEFAULTS.startRoute
}}
function loadCore(){return safeParse(localStorage.getItem(CORE_KEY),{version:RELEASE,openingBalance:0,transactions:[],goals:[],challenges:[],settings:{onboarded:true,theme:'light'}})}
function resolvedTheme(appearance){if(appearance==='light'||appearance==='dark')return appearance;return matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}
function applyPrefs(prefs=loadPrefs()){
  const html=document.documentElement
  const theme=resolvedTheme(prefs.appearance)
  if(html.dataset.theme!==theme)html.dataset.theme=theme
  html.dataset.nestAppearance=prefs.appearance
  html.dataset.density=prefs.density
  html.dataset.textSize=prefs.textSize
  html.dataset.privacy=prefs.privacy?'on':'off'
  html.dataset.reduceMotion=prefs.reduceMotion?'on':'off'
}
function savePrefs(prefs){localStorage.setItem(PREF_KEY,JSON.stringify(prefs));applyPrefs(prefs)}
function euroInput(value){const n=Number(value);return Number.isFinite(n)?String(Math.round(n*100)/100):'0'}
function esc(value=''){return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;')}
function toast(message){const el=document.getElementById('toast');if(!el)return;el.textContent=message;el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),2200)}

function ensureDialog(){
  let dialog=document.getElementById('settings13')
  if(dialog)return dialog
  dialog=document.createElement('dialog')
  dialog.id='settings13'
  dialog.setAttribute('aria-label','NEST Einstellungen')
  document.body.appendChild(dialog)
  dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close()})
  dialog.addEventListener('close',()=>{dialog.innerHTML=''})
  return dialog
}
function switchRow(name,label,detail,checked){return `<label class="s13-row s13-switch-row"><span><b>${esc(label)}</b><small>${esc(detail)}</small></span><input class="s13-switch" type="checkbox" name="${esc(name)}" ${checked?'checked':''}></label>`}
function selectRow(name,label,detail,value,options){return `<label class="s13-row"><span><b>${esc(label)}</b><small>${esc(detail)}</small></span><select name="${esc(name)}">${options.map(([v,l])=>`<option value="${esc(v)}" ${v===value?'selected':''}>${esc(l)}</option>`).join('')}</select></label>`}
function openSettings(){
  const prefs=loadPrefs(),core=loadCore(),dialog=ensureDialog()
  dialog.innerHTML=`<form class="s13-shell" id="settings13form">
    <header class="s13-head"><div><span>NEST · VERSION ${RELEASE}</span><h2>Einstellungen</h2></div><button type="button" class="s13-close" data-s13="close" aria-label="Schließen">×</button></header>
    <div class="s13-body">
      <section class="s13-section"><div class="s13-section-title"><span>Darstellung</span><p>Optik und Lesbarkeit anpassen</p></div><div class="s13-card">
        ${selectRow('appearance','Erscheinungsbild','Automatisch oder festes Theme',prefs.appearance,[['system','System'],['light','Hell'],['dark','Dunkel']])}
        ${selectRow('density','Ansicht','Mehr Luft oder kompakter',prefs.density,[['comfortable','Komfortabel'],['compact','Kompakt']])}
        ${selectRow('textSize','Schriftgröße','Für bessere Lesbarkeit',prefs.textSize,[['normal','Standard'],['large','Groß']])}
        ${switchRow('privacy','Beträge verbergen','Finanzbeträge auf dem Bildschirm unkenntlich machen',prefs.privacy)}
        ${switchRow('reduceMotion','Animationen reduzieren','Weniger Bewegungen und Übergänge verwenden',prefs.reduceMotion)}
      </div></section>
      <section class="s13-section"><div class="s13-section-title"><span>Bedienung</span><p>Start und Navigation festlegen</p></div><div class="s13-card">
        ${selectRow('startRoute','Startseite','Diese Ansicht nach dem Öffnen anzeigen',prefs.startRoute,[['overview','Übersicht'],['transactions','Buchungen'],['goals','Sparziele'],['challenges','Challenges']])}
      </div></section>
      <section class="s13-section"><div class="s13-section-title"><span>Finanzen</span><p>Grundlage für deinen Kontostand</p></div><div class="s13-card">
        <label class="s13-row"><span><b>Startbetrag</b><small>Wird zum berechneten Kontostand addiert</small></span><div class="s13-money"><input name="openingBalance" type="number" step="0.01" inputmode="decimal" value="${esc(euroInput(core.openingBalance))}"><i>€</i></div></label>
      </div></section>
      <section class="s13-section"><div class="s13-section-title"><span>Daten</span><p>Lokale Daten sichern oder wiederherstellen</p></div><div class="s13-card s13-actions">
        <button type="button" data-s13="export"><span><b>Backup exportieren</b><small>Buchungen, Ziele, Challenges und Einstellungen</small></span><em>Export</em></button>
        <button type="button" data-s13="import"><span><b>Backup importieren</b><small>Vorhandene lokale Daten ersetzen</small></span><em>Import</em></button>
        <button type="button" class="danger" data-s13="reset"><span><b>Alle lokalen Daten löschen</b><small>NEST auf einen leeren Zustand zurücksetzen</small></span><em>Löschen</em></button>
        <input id="settings13file" type="file" accept="application/json,.json" hidden>
      </div></section>
      <section class="s13-about"><b>NEST ${RELEASE}</b><p>Finanzdaten bleiben lokal im App-Speicher. Der optionale Wallet-Import benötigt keine direkte Bankanbindung.</p></section>
    </div>
    <footer class="s13-foot"><button type="button" class="secondary" data-s13="close">Abbrechen</button><button class="primary" type="submit">Änderungen speichern</button></footer>
  </form>`
  bindDialog(dialog)
  dialog.showModal()
}
function bindDialog(dialog){
  const form=dialog.querySelector('#settings13form')
  form.addEventListener('submit',event=>{
    event.preventDefault()
    const fd=new FormData(form)
    const prefs={
      appearance:APPEARANCES.has(fd.get('appearance'))?fd.get('appearance'):DEFAULTS.appearance,
      density:DENSITIES.has(fd.get('density'))?fd.get('density'):DEFAULTS.density,
      textSize:TEXT_SIZES.has(fd.get('textSize'))?fd.get('textSize'):DEFAULTS.textSize,
      privacy:fd.get('privacy')==='on',reduceMotion:fd.get('reduceMotion')==='on',
      startRoute:ROUTES.has(fd.get('startRoute'))?fd.get('startRoute'):DEFAULTS.startRoute
    }
    const core=loadCore(),openingBalance=Number(fd.get('openingBalance'))
    core.openingBalance=Number.isFinite(openingBalance)?openingBalance:0
    core.settings=core.settings&&typeof core.settings==='object'?core.settings:{}
    core.settings.theme=resolvedTheme(prefs.appearance)
    localStorage.setItem(CORE_KEY,JSON.stringify(core))
    savePrefs(prefs)
    dialog.close();toast('Einstellungen gespeichert')
    setTimeout(()=>location.reload(),280)
  })
  dialog.querySelectorAll('[data-s13="close"]').forEach(btn=>btn.addEventListener('click',()=>dialog.close()))
  dialog.querySelector('[data-s13="export"]').addEventListener('click',exportBackup)
  dialog.querySelector('[data-s13="import"]').addEventListener('click',()=>dialog.querySelector('#settings13file').click())
  dialog.querySelector('#settings13file').addEventListener('change',event=>importBackup(event.target.files?.[0],dialog))
  dialog.querySelector('[data-s13="reset"]').addEventListener('click',()=>resetData(dialog))
  form.querySelectorAll('select,input[type="checkbox"]').forEach(control=>control.addEventListener('change',()=>{
    const live={...loadPrefs(),appearance:form.elements.appearance.value,density:form.elements.density.value,textSize:form.elements.textSize.value,privacy:form.elements.privacy.checked,reduceMotion:form.elements.reduceMotion.checked,startRoute:form.elements.startRoute.value}
    applyPrefs(live)
  }))
}
async function exportBackup(){
  const payload={product:'NEST',version:RELEASE,exportedAt:new Date().toISOString(),core:loadCore(),preferences:loadPrefs()}
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'})
  const file=new File([blob],`nest-backup-${new Date().toISOString().slice(0,10)}.json`,{type:'application/json'})
  try{if(navigator.share&&navigator.canShare?.({files:[file]})){await navigator.share({title:'NEST Backup',files:[file]});return}}catch(error){if(error?.name==='AbortError')return}
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=file.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);toast('Backup erstellt')
}
async function importBackup(file,dialog){
  if(!file)return
  try{
    const data=JSON.parse(await file.text())
    const core=data.core&&typeof data.core==='object'?data.core:(Array.isArray(data.transactions)?data:null)
    if(!core||!Array.isArray(core.transactions))throw new Error('invalid')
    if(!confirm('Dieses Backup ersetzt deine aktuellen lokalen NEST-Daten. Fortfahren?'))return
    localStorage.setItem(CORE_KEY,JSON.stringify(core))
    if(data.preferences&&typeof data.preferences==='object')localStorage.setItem(PREF_KEY,JSON.stringify({...DEFAULTS,...data.preferences}))
    dialog.close();location.reload()
  }catch{toast('Backup konnte nicht gelesen werden')}
}
function resetData(dialog){
  if(!confirm('Alle lokalen Buchungen, Sparziele, Challenges und Einstellungen wirklich löschen?'))return
  localStorage.removeItem(CORE_KEY);localStorage.removeItem(PREF_KEY);dialog.close();location.reload()
}
function applyStartRoute(){
  if(startApplied)return
  const prefs=loadPrefs();if(prefs.startRoute==='overview'){startApplied=true;return}
  const target=document.querySelector(`.tabs button[data-route="${prefs.startRoute}"]`)
  if(!target)return
  startApplied=true;target.click()
}

applyPrefs()
const media=matchMedia('(prefers-color-scheme: dark)')
media.addEventListener?.('change',()=>{const p=loadPrefs();if(p.appearance==='system')applyPrefs(p)})
new MutationObserver(()=>applyPrefs()).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']})
document.addEventListener('click',event=>{
  const settings=event.target.closest?.('[data-action="settings"]')
  if(!settings)return
  event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();openSettings()
},true)
const readyObserver=new MutationObserver(()=>applyStartRoute())
readyObserver.observe(document.getElementById('app')||document.body,{childList:true,subtree:true})
requestAnimationFrame(()=>applyStartRoute())
root.NestSettingsV13={RELEASE,loadPrefs,applyPrefs,openSettings}
})(globalThis)
