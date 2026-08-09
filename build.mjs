import {mkdir,rm,copyFile,readFile} from 'node:fs/promises'
import {spawnSync} from 'node:child_process'
await rm('dist',{recursive:true,force:true});await mkdir('dist',{recursive:true})
const active=['index.html','v3.css','v3-shopping.css','v301-shopping.css','v3-dialogs.css','boot-v2.0.2.js','v202-core-safe.js','shopping-core-v3.js','v202-wallet-guard.js','import-v2.0.2.js','app-v3.js','settings-v3.js','v301-shopping.js','manifest.webmanifest','sw.js','icon.svg']
for(const f of active)await copyFile(f,`dist/${f}`)
for(const f of ['boot-v2.0.2.js','v202-core-safe.js','shopping-core-v3.js','v202-wallet-guard.js','import-v2.0.2.js','app-v3.js','settings-v3.js','v301-shopping.js','sw.js','api/import-transaction.js','api/product-lookup.js']){const r=spawnSync(process.execPath,['--check',f],{encoding:'utf8'});if(r.status!==0)throw new Error(`${f}: ${r.stderr||r.stdout}`)}
for(const test of ['tests.mjs','import-tests.cjs','v2-tests.cjs','v202-tests.cjs','v3-tests.cjs','v301-tests.cjs']){const r=spawnSync(process.execPath,[test],{encoding:'utf8'});if(r.status!==0)throw new Error(`${test}: ${r.stderr||r.stdout}`);console.log(r.stdout.trim())}
const sources=['index.html','v3.css','v3-shopping.css','v301-shopping.css','v3-dialogs.css','boot-v2.0.2.js','v202-core-safe.js','shopping-core-v3.js','v202-wallet-guard.js','import-v2.0.2.js','app-v3.js','settings-v3.js','v301-shopping.js','manifest.webmanifest','sw.js','vercel.json','api/import-transaction.js','api/product-lookup.js']
const all=(await Promise.all(sources.map(f=>readFile(f,'utf8')))).join('\n')
for(const token of ['3.0.1','selfmade-save-v1','nest-shopping-v2.2','NestShoppingCoreV3','v3-plus','Produkt hinzufügen','Barcode scannen','Kalorien','Fett','energy-kcal_100g','product_quantity','API_PATH_VERSION','camera=(self)','startViewTransition','@zxing/browser@0.2.1','Vollständiges Backup','Obst & Gemüse','Milch & Kühlung','v301-swipe-delete','Rückgängig','pointermove','.v3-product-img{display:none!important}','width:26px;height:26px'])if(!all.includes(token))throw new Error(`QA fehlt: ${token}`)
const index=await readFile('index.html','utf8')
for(const forbidden of ['app-v2.0.2.js','shopping-v2.2.js','savings-v2.1.js','savings-v2.1-compact.js','challenges-v2.0.2.js','release-v2.2.js','settings-v2.2.js','v2-ui.js','settings-v1.3.js'])if(index.includes(forbidden))throw new Error(`Alte UI noch aktiv: ${forbidden}`)
for(const forbidden of ['Storage.prototype.setItem','camera=()'])if(all.includes(forbidden))throw new Error(`Risiko aktiv: ${forbidden}`)
for(const token of ['Steiermärkische','George CSV','PSD2','Automatisch verbinden'])if(all.includes(token))throw new Error(`Bank-Rest gefunden: ${token}`)
console.log('NEST V3.0.1: kompakte Einkaufszeilen, kleine Checkbox, Swipe-Löschen mit Rückgängig, Scanner, Persistenz und mobile Navigation geprüft.')
