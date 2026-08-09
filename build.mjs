import {mkdir,rm,copyFile,readFile} from 'node:fs/promises'
import {spawnSync} from 'node:child_process'
await rm('dist',{recursive:true,force:true});await mkdir('dist',{recursive:true})
const active=['index.html','v3.css','v3-shopping.css','v301-shopping.css','tasks-v3.1.css','v3-dialogs.css','v32-bookings.css','boot-v2.0.2.js','v202-core-safe.js','shopping-core-v3.js','tasks-core-v3.1-fixed.js','tasks-v3.1.js','v202-wallet-guard.js','import-v2.0.2.js','app-v3.js','settings-v3.js','v301-shopping.js','v32-bookings.js','manifest.webmanifest','sw.js','icon.svg','icon-maskable.svg']
for(const f of active)await copyFile(f,`dist/${f}`)
for(const f of ['boot-v2.0.2.js','v202-core-safe.js','shopping-core-v3.js','tasks-core-v3.1-fixed.js','tasks-v3.1.js','v202-wallet-guard.js','import-v2.0.2.js','app-v3.js','settings-v3.js','v301-shopping.js','v32-bookings.js','sw.js','api/import-transaction.js','api/product-lookup.js']){const r=spawnSync(process.execPath,['--check',f],{encoding:'utf8'});if(r.status!==0)throw new Error(`${f}: ${r.stderr||r.stdout}`)}
for(const test of ['tests.mjs','import-tests.cjs','v2-tests.cjs','v202-tests.cjs','v3-tests.cjs','v301-v31-tests.cjs','tasks-v3.1-fixed-tests.cjs','v32-tests.cjs']){const r=spawnSync(process.execPath,[test],{encoding:'utf8'});if(r.status!==0)throw new Error(`${test}: ${r.stderr||r.stdout}`);console.log(r.stdout.trim())}
const sources=['index.html','v3.css','v3-shopping.css','v301-shopping.css','tasks-v3.1.css','v3-dialogs.css','v32-bookings.css','boot-v2.0.2.js','v202-core-safe.js','shopping-core-v3.js','tasks-core-v3.1-fixed.js','tasks-v3.1.js','v202-wallet-guard.js','import-v2.0.2.js','app-v3.js','settings-v3.js','v301-shopping.js','v32-bookings.js','manifest.webmanifest','sw.js','vercel.json','api/import-transaction.js','api/product-lookup.js']
const all=(await Promise.all(sources.map(f=>readFile(f,'utf8')))).join('\n')
for(const token of ['3.2.0','v32-bookings','Lebensmittel','Mobilität','Gehalt','Rückzahlung','selfmade-save-v1','nest-shopping-v2.2','nest-tasks-v3.1','nest-tasks-v3.1-backup','NestTasksCoreV31','Aufgaben','Heute','Demnächst','Erledigt','Wöchentlich','Monatlich','reminderMinutes','moveTomorrow','v31-reordering','v31-swipe-action','Rückgängig','Verknüpfen mit','Aufgabenspeicher','tasks:','v3-plus','Barcode scannen','Kalorien','Fett','camera=(self)','@zxing/browser@0.2.1','Vollständiges Backup'])if(!all.includes(token))throw new Error(`QA fehlt: ${token}`)
const index=await readFile('index.html','utf8')
if(index.indexOf('/tasks-v3.1.js')>index.indexOf('/app-v3.js'))throw new Error('Aufgaben-Click-Layer muss vor app-v3 geladen werden')
if(index.indexOf('/v32-bookings.js')<index.indexOf('/app-v3.js'))throw new Error('NEST 3.2 Buchungs-UI muss nach app-v3 geladen werden')
if(index.includes('/tasks-core-v3.1.js'))throw new Error('Veralteter Aufgaben-Core noch aktiv')
for(const forbidden of ['app-v2.0.2.js','shopping-v2.2.js','savings-v2.1.js','savings-v2.1-compact.js','challenges-v2.0.2.js','release-v2.2.js','settings-v2.2.js','v2-ui.js','settings-v1.3.js'])if(index.includes(forbidden))throw new Error(`Alte UI noch aktiv: ${forbidden}`)
for(const forbidden of ['Storage.prototype.setItem','camera=()'])if(all.includes(forbidden))throw new Error(`Risiko aktiv: ${forbidden}`)
for(const token of ['Steiermärkische','George CSV','PSD2','Automatisch verbinden'])if(all.includes(token))throw new Error(`Bank-Rest gefunden: ${token}`)
console.log('NEST V3.2.0: Kategorie-Icons für Buchungen, Aufgaben, Erinnerungen, Einkauf, Scanner, Backup und Persistenz geprüft.')
