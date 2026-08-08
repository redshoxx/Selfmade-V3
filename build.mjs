import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import vm from 'node:vm'

const VERSION='1.0.1'
const bundles=['bundle-0.b64','bundle-1.b64','bundle-2.b64','bundle-3.b64']

function makeSmokeContext(savedRaw=null){
  class El{
    constructor(id=''){this.id=id;this.innerHTML='';this.textContent='';this.value='';this.files=[];this.open=false;this.dataset={};this.classList={add(){},remove(){}}}
    addEventListener(){} setAttribute(k,v){this[k]=v} removeAttribute(k){delete this[k]} showModal(){this.open=true} close(){this.open=false} click(){}
  }
  const elements=Object.fromEntries(['app','sheet','toast','bank-file','boot-error-text','boot-reload'].map(id=>[id,new El(id)]))
  const document={documentElement:{dataset:{},setAttribute(k,v){this[k]=v}},getElementById(id){return elements[id]||null},addEventListener(){},createElement(){return new El('created')}}
  const context={console,document,localStorage:{getItem(){return savedRaw},setItem(){}},navigator:{},location:{reload(){}},addEventListener(){},Intl,Date,Math,Number,String,Array,Object,Boolean,RegExp,JSON,Set,Map,URL,Blob,FormData:function(){this.get=function(){return''}},setTimeout(){return 1},clearTimeout(){},confirm(){return true}}
  context.window=context;context.globalThis=context
  return{context:vm.createContext(context),elements,document}
}
function smoke(script,savedRaw,label){
  const{context,elements,document}=makeSmokeContext(savedRaw)
  vm.runInContext(script,context,{filename:`selfmade-${label}.js`,timeout:1500})
  if(context.__SELFMADE_READY__!==true)throw new Error(`Runtime-Smoke ${label}: READY fehlt`)
  if(document.documentElement['data-app-ready']!=='true')throw new Error(`Runtime-Smoke ${label}: data-app-ready fehlt`)
  if(!elements.app.innerHTML||/Startfehler/.test(elements.app.innerHTML))throw new Error(`Runtime-Smoke ${label}: Render fehlgeschlagen`)
}

await rm('dist',{recursive:true,force:true});await mkdir('dist',{recursive:true})
const b64=(await Promise.all(bundles.map(f=>readFile(f,'utf8')))).join('')
let html=gunzipSync(Buffer.from(b64,'base64')).toString('utf8')

// V1.0.0 enthielt zwei direkt aneinandergehängte IIFEs. Ohne Semikolon wurde
// der zweite Block als Aufruf auf dem Rückgabewert des ersten interpretiert.
const broken=/\}\)\(typeof globalThis!==['"]undefined['"]\?globalThis:this\)\s*\(function\(\)\{/m
if(!broken.test(html))throw new Error('Bekannter Startfehler konnte im Bundle nicht eindeutig gefunden werden')
html=html.replace(broken,"})(typeof globalThis!=='undefined'?globalThis:this);\n(function(){")
html=html.replace(/1\.0\.0/g,VERSION)

const scriptMatch=html.match(/<script>([\s\S]*?)<\/script>/i)
if(!scriptMatch)throw new Error('Inline-App-Script fehlt')
const onboarded=JSON.stringify({version:VERSION,goals:[],challenges:[],transactions:[],bank:{name:'Steiermärkische Sparkasse',lastImport:null,lastKnownBalance:null,source:'George CSV'},settings:{onboarded:true,theme:'light'}})
smoke(scriptMatch[1],null,'frisch')
smoke(scriptMatch[1],onboarded,'mit-daten')

const required=['Selfmade Save','Sparziele','Challenges','Steiermärkische Sparkasse','George CSV importieren','Automatisch verbinden','parseBankCsv','Auszahlungen','selfmade-save-v1','data-app-ready','selfmade-version" content="1.0.1"','mobile-web-app-capable" content="yes"','apple-mobile-web-app-capable" content="yes"']
for(const token of required)if(!html.includes(token))throw new Error(`QA-Prüfung fehlt: ${token}`)
const forbidden=['Einkaufsliste','Was brauchst du?','Im Laden','Nicht vergessen?','Selfmade Einkauf']
for(const token of forbidden)if(html.includes(token))throw new Error(`Alte Einkaufs-App erkannt: ${token}`)
await writeFile('dist/index.html',html)
for(const file of ['manifest.webmanifest','icon.svg','sw.js'])await copyFile(file,`dist/${file}`)
console.log(`Selfmade Save V${VERSION}: Startfehler behoben, Runtime-Smoke erfolgreich.`)
