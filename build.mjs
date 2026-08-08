import {mkdir,rm,copyFile,readFile} from 'node:fs/promises'
import {spawnSync} from 'node:child_process'
await rm('dist',{recursive:true,force:true});await mkdir('dist',{recursive:true})
for(const f of ['index.html','styles.css','nav.css','settings-v1.3.css','v2.css','v2-nav-center.css','app.js','import.js','settings-v1.3.js','v2-core.js','v2-ui.js','v2-nav-center.js','manifest.webmanifest','sw.js','icon.svg'])await copyFile(f,`dist/${f}`)
for(const f of ['app.js','import.js','settings-v1.3.js','v2-core.js','v2-ui.js','v2-nav-center.js','sw.js','api/import-transaction.js']){const r=spawnSync(process.execPath,['--check',f],{encoding:'utf8'});if(r.status!==0)throw new Error(`${f}: ${r.stderr||r.stdout}`)}
for(const test of ['tests.mjs','import-tests.cjs','v2-tests.cjs']){const r=spawnSync(process.execPath,[test],{encoding:'utf8'});if(r.status!==0)throw new Error(r.stderr||r.stdout);console.log(r.stdout.trim())}
const all=(await Promise.all(['index.html','app.js','import.js','settings-v1.3.js','v2-core.js','v2-ui.js','v2-nav-center.js','manifest.webmanifest','sw.js'].map(f=>readFile(f,'utf8')))).join('\n')
for(const token of ['2.0.0','NEST','Eigene Challenge','Einzahlung','Auszahlung','Sparziele','selfmade-save-v1','nest-audit-v2','NestV2Core','NestV2UI','nestImport','v2-center-add','Neue Buchung'])if(!all.includes(token))throw new Error(`QA fehlt: ${token}`)
for(const token of ['Steiermärkische','George CSV','PSD2','Automatisch verbinden'])if(all.includes(token))throw new Error(`Bank-Rest gefunden: ${token}`)
console.log('NEST V2.0.0: Build, Desktop-Web-App, zentrale Buchungsaktion, Formulare, Wallet-Import und Buchungsprotokoll erfolgreich.')
