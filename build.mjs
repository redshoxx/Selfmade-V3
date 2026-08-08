import {mkdir,rm,copyFile,readFile} from 'node:fs/promises'
import {spawnSync} from 'node:child_process'
await rm('dist',{recursive:true,force:true});await mkdir('dist',{recursive:true})
for(const f of ['index.html','styles.css','app.js','import.js','manifest.webmanifest','sw.js','icon.svg'])await copyFile(f,`dist/${f}`)
for(const f of ['app.js','import.js','sw.js','api/import-transaction.js']){const r=spawnSync(process.execPath,['--check',f],{encoding:'utf8'});if(r.status!==0)throw new Error(`${f}: ${r.stderr||r.stdout}`)}
const t=spawnSync(process.execPath,['tests.mjs'],{encoding:'utf8'});if(t.status!==0)throw new Error(t.stderr||t.stdout)
const i=spawnSync(process.execPath,['import-tests.cjs'],{encoding:'utf8'});if(i.status!==0)throw new Error(i.stderr||i.stdout)
const all=(await Promise.all(['index.html','app.js','import.js','manifest.webmanifest','sw.js'].map(f=>readFile(f,'utf8')))).join('\n')
for(const token of ['1.2.0','NEST','Eigene Challenge','createCustomChallenge','Einzahlung','Auszahlung','Sparziele','selfmade-save-v1','nest-v1.2.0','wallet-import-v1','NestImportLogic'])if(!all.includes(token))throw new Error(`QA fehlt: ${token}`)
for(const token of ['Steiermärkische','George CSV','PSD2','Automatisch verbinden'])if(all.includes(token))throw new Error(`Bank-Rest gefunden: ${token}`)
console.log(t.stdout.trim())
console.log(i.stdout.trim())
console.log('NEST V1.2.0: Build, QA und Wallet-Import erfolgreich.')
