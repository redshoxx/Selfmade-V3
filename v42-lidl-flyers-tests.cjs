const fs=require('node:fs')
function ok(cond,msg){if(!cond)throw new Error(msg)}
const Api=require('./api/lidl-flyers.js')._test
ok(Api.API_VERSION==='4.2.0','V4.2 API Version fehlt')
ok(Api.SOURCE_URL==='https://www.lidl.at/c/flugblatt/s10012330','Falsche Lidl Flugblattquelle')
const html=`<html><body>
<h1>Flugblätter & Prospekte Lidl Österreich</h1>
<h2>Aktuelle Flugblätter</h2>
<a href="/l/de/flugblatt/ab-donnerstag-6-8-flugblatt-nat/ar/0"><img src="https://www.lidl.at/assets/weekly.jpg">Ab Donnerstag 6.8. Flugblatt</a>
<a href="/l/de/flugblatt/ab-donnerstag-13-8-flugblatt-nat/ar/0">Ab Donnerstag 13.8. Flugblatt</a>
<h2>Sonderflyer</h2>
<a href="/l/de/flugblatt/saisonales-obst-und-gemuese-lohnt-sich/ar/0">Saisonkalender Obst und Gemüse</a>
<h2>Aktuelle Reiseprospekte</h2>
<a href="/l/de/flugblatt/august-reise-highlights/ar/0">August Reise-Highlights Buchbar ab 29.7.</a>
</body></html>`
const flyers=Api.parseFlyers(html)
ok(flyers.length===4,'Flugblätter werden nicht vollständig erkannt')
ok(flyers.filter(x=>x.category==='weekly').length===2,'Wochenflugblätter falsch gruppiert')
ok(flyers.some(x=>x.category==='special'&&/Saisonkalender/.test(x.title)),'Sonderflyer fehlt')
ok(flyers.some(x=>x.category==='travel'&&/Reise-Highlights/.test(x.title)),'Reiseprospekt fehlt')
ok(flyers[0].image==='https://www.lidl.at/assets/weekly.jpg','Flugblattbild wird nicht erkannt')
ok(Api.safeLidlUrl('https://evil.example/flyer')==='','Fremde Flyer-URL wird nicht blockiert')
ok(Api.titleDate('Ab Donnerstag 6.8. Flugblatt')==='6.8.','Startdatum wird nicht erkannt')
const meta='<meta property="og:image" content="https://www.lidl.at/assets/cover.jpg">'
ok(Api.metaImage(meta,'https://www.lidl.at/l/de/flugblatt/test/ar/0')==='https://www.lidl.at/assets/cover.jpg','Cover-Metadaten werden nicht erkannt')
const index=fs.readFileSync('index.html','utf8'),build=fs.readFileSync('build.mjs','utf8'),sw=fs.readFileSync('sw.js','utf8'),server=fs.readFileSync('local-server.mjs','utf8'),settings=fs.readFileSync('settings-v3.js','utf8'),pkg=JSON.parse(fs.readFileSync('package.json','utf8'))
ok(pkg.version==='4.2.0','Package Version ist nicht 4.2.0')
ok(index.includes('/v42-lidl-flyers.js?v=4.2.0-r16')&&index.includes('/v42-lidl-flyers.css?v=4.2.0-r16'),'V4.2 Flugblatt-UI wird nicht geladen')
ok(!index.includes('/v4-lidl.js')&&!index.includes('/v41-lidl-auto.js'),'Alte Lidl UI wird noch geladen')
ok(server.includes("'/api/lidl-flyers'")&&!server.includes("'/api/lidl-offers'"),'Lokaler Server nutzt nicht die neue Flugblatt-API')
ok(build.includes("'v42-lidl-flyers.js'")&&build.includes("'api/lidl-flyers.js'"),'V4.2 fehlt im Build')
ok(!build.includes("'v4-lidl.js'")&&!build.includes("'v41-lidl-auto.js'"),'Alte Lidl Module sind noch im Build')
ok(sw.includes("nest-v4.2.0-r16")&&sw.includes('/v42-lidl-flyers.js?v=4.2.0-r16'),'V4.2 Cache fehlt')
ok(!settings.includes('NestLidlV4')&&!settings.includes('Lidl Angebote'),'Alte Lidl Einstellungen wurden nicht entfernt')
for(const old of ['v4-lidl.js','v4-lidl.css','v41-lidl-auto.js','v41-lidl-auto.css','v4-lidl-tests.cjs','v41-lidl-auto-tests.cjs','api/lidl-offers.js'])ok(!fs.existsSync(old),`Alte Lidl Datei noch vorhanden: ${old}`)
console.log('NEST V4.2.0 Lidl flyer viewer tests passed')
