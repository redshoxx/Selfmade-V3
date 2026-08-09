const fs=require('node:fs')
function ok(cond,msg){if(!cond)throw new Error(msg)}
const Api=require('./api/lidl-offers.js')._test
ok(Api.API_VERSION==='4.1.0','V4.1 API Version fehlt')
const landing=`<html><body><a href="/c/aktion/a10100448">Ab Mo. 10.8. bis Mi. 12.8. Aktion</a><a href="/c/frische-angebote/a10100447">Ab Do. 13.8. bis Fr. 14.8. Frische Angebote</a></body></html>`
const links=Api.extractCampaignLinks(landing)
ok(links.length===2&&links[0].url.startsWith('https://www.lidl.at/'),'Lidl Kampagnenlinks werden nicht erkannt')
const range=Api.parseGermanRange('Ab Mo. 10.8. bis Mi. 12.8.',new Date('2026-08-09T12:00:00'))
ok(range.validFrom==='2026-08-10'&&range.validTo==='2026-08-12','Lidl Aktionszeitraum wird falsch gelesen')
const product=`<article><h3>Bananen</h3><p>vorher: 1.79 €</p><p>mit Lidl Plus</p><strong>0.99€*</strong><p>Je kg</p><p>in der Filiale 10.08. - 12.08.</p></article>`
const parsed=Api.parsePage(product,'https://www.lidl.at/c/frische-angebote/a10100447',{validFrom:'2026-08-10',validTo:'2026-08-12'})
ok(parsed.length>=1,'Automatischer Lidl Produktparser findet kein Angebot')
const bananas=parsed.find(x=>String(x.name).toLowerCase().includes('banan'))||parsed[0]
ok(Number(bananas.price)===0.99,'Automatischer Angebotspreis ist falsch')
ok(Number(bananas.oldPrice)===1.79,'Automatischer alter Preis ist falsch')
ok(bananas.lidlPlus===true,'Lidl Plus Kennzeichnung fehlt')
const index=fs.readFileSync('index.html','utf8'),sw=fs.readFileSync('sw.js','utf8'),build=fs.readFileSync('build.mjs','utf8'),server=fs.readFileSync('local-server.mjs','utf8'),pkg=JSON.parse(fs.readFileSync('package.json','utf8'))
ok(pkg.version==='4.1.0'&&pkg.scripts.start==='node local-server.mjs','V4.1 Startscript fehlt')
ok(index.includes('/v41-lidl-auto.js?v=4.1.0-r15')&&index.includes('/v41-lidl-auto.css?v=4.1.0-r15'),'V4.1 Auto-Sync wird nicht geladen')
ok(sw.includes("nest-v4.1.0-r15")&&sw.includes('/v41-lidl-auto.js?v=4.1.0-r15'),'V4.1 Cache fehlt')
ok(server.includes("'/api/lidl-offers'")&&server.includes("'/api/product-lookup'"),'Lokaler NEST API Server fehlt')
ok(build.includes("'v41-lidl-auto.js'")&&build.includes("'api/lidl-offers.js'"),'V4.1 fehlt im Build')
console.log('NEST V4.1.0 automatic Lidl offer sync tests passed')
