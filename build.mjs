import {mkdir,rm,readFile,writeFile} from 'node:fs/promises'
import {gunzipSync} from 'node:zlib'
import {spawnSync} from 'node:child_process'
const VERSION='1.1.0'
const segments=['bundle-0.b64','bundle-1.b64','bundle-2.b64','bundle-3.b64','bundle-4.b64'].filter(async()=>true)
const parts=[]
for(let i=0;;i++){try{parts.push(await readFile(`bundle-${i}.b64`,'utf8'))}catch{break}}
if(!parts.length)throw new Error('Keine Bundle-Segmente gefunden.')
const archive=JSON.parse(gunzipSync(Buffer.from(parts.join(''),'base64')).toString('utf8'))
await rm('dist',{recursive:true,force:true});await mkdir('dist',{recursive:true})
const requiredFiles=['index.html','styles.css','app.js','manifest.webmanifest','sw.js','icon.svg']
for(const f of requiredFiles){if(typeof archive[f]!=='string'||!archive[f].length)throw new Error(`Datei fehlt: ${f}`);await writeFile(`dist/${f}`,archive[f])}
for(const f of ['dist/app.js','dist/sw.js']){const r=spawnSync(process.execPath,['--check',f],{encoding:'utf8'});if(r.status!==0)throw new Error(`${f} Syntaxfehler\n${r.stderr||r.stdout}`)}
const all=requiredFiles.map(f=>archive[f]).join('\n')
for(const t of ['selfmade-version" content="1.1.0"','Einzahlung','Auszahlung','Wofür / von wem?','Netflix','Sparziele','Challenges','openingBalance','transactions','selfmade-save-v1','data-app-ready','__SELFMADE_READY__'])if(!all.includes(t))throw new Error(`QA fehlt: ${t}`)
for(const t of ['Steiermärkische','George CSV','PSD2','Automatisch verbinden','parseBankCsv'])if(all.includes(t))throw new Error(`Entfernte Funktion noch vorhanden: ${t}`)
console.log(`Selfmade Save V${VERSION}: vollständig manuelle App erfolgreich gebaut.`)
