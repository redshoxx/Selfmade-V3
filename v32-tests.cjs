const fs=require('node:fs')
function read(f){return fs.readFileSync(f,'utf8')}
function ok(cond,msg){if(!cond)throw new Error(msg)}
const js=read('v32-bookings.js'),css=read('v32-bookings.css'),index=read('index.html'),sw=read('sw.js'),pkg=JSON.parse(read('package.json')),build=read('build.mjs')
const categories=['Lebensmittel','Wohnen','Mobilität','Freizeit','Shopping','Gesundheit','Haushalt','Abos & Verträge','Sparen','Sonstiges','Gehalt','Bonus','Verkauf','Rückzahlung','Geschenk']
ok(pkg.version==='3.2.0','package version ist nicht 3.2.0')
ok(js.includes("RELEASE='3.2.0'"),'3.2 release fehlt im Buchungsmodul')
for(const c of categories)ok(js.includes(`'${c}'`)||js.includes(`\"${c}\"`),`Kategorie fehlt: ${c}`)
ok(index.includes('/v32-bookings.css?v=3.2.0-r10'),'3.2 CSS wird nicht geladen')
ok(index.includes('/v32-bookings.js?v=3.2.0-r10'),'3.2 JS wird nicht geladen')
ok(index.indexOf('/v32-bookings.js')>index.indexOf('/app-v3.js'),'Buchungsmodul muss nach app-v3 geladen werden')
ok(sw.includes("nest-v3.2.0-r10"),'3.2 Cache fehlt')
ok(sw.includes('/v32-bookings.js?v=3.2.0-r10')&&sw.includes('/v32-bookings.css?v=3.2.0-r10'),'3.2 Assets fehlen im Service Worker')
ok(build.includes("'v32-bookings.js'")&&build.includes("'v32-bookings.css'"),'3.2 Assets fehlen im Build')
ok(css.includes('[data-v32-category="lebensmittel"]')&&css.includes('[data-v32-category="gehalt"]'),'Kategorie-Farben fehlen')
console.log('NEST V3.2.0 booking UI tests passed')
