const fs=require('node:fs')
function read(f){return fs.readFileSync(f,'utf8')}
function ok(cond,msg){if(!cond)throw new Error(msg)}
const js=read('v32-bookings.js'),css=read('v32-bookings.css'),index=read('index.html'),sw=read('sw.js'),pkg=JSON.parse(read('package.json')),build=read('build.mjs'),settings=read('settings-v3.js')
const categories=['Lebensmittel','Wohnen','Mobilität','Freizeit','Shopping','Gesundheit','Haushalt','Abos & Verträge','Sparen','Sonstiges','Gehalt','Bonus','Verkauf','Rückzahlung','Geschenk']
ok(pkg.version==='4.4.0','package version ist nicht 4.4.0')
ok(js.includes("RELEASE='4.4.0'"),'V4.4 Buchungsmodul fehlt')
for(const c of categories)ok(js.includes(`'${c}'`)||js.includes(`\"${c}\"`),`Kategorie fehlt: ${c}`)
for(const token of ['monthly','quarterly','semiannual','yearly','Monatlich','Vierteljährlich','Alle 6 Monate','Jährlich','processRecurring','nest-recurring-v3.2.1','Nächste Buchung'])ok(js.includes(token),`Wiederholungsfunktion fehlt: ${token}`)
ok(index.includes('/v32-bookings.css?v=4.4.0-r19'),'Buchungs-CSS wird nicht geladen')
ok(index.includes('/v32-bookings.js?v=4.4.0-r19'),'Buchungs-JS wird nicht geladen')
ok(index.indexOf('/v32-bookings.js')>index.indexOf('/app-v3.js'),'Buchungsmodul muss nach app-v3 geladen werden')
ok(sw.includes('/v32-bookings.js?v=4.4.0-r19')&&sw.includes('/v32-bookings.css?v=4.4.0-r19'),'Buchungs-Assets fehlen im Service Worker')
ok(build.includes("'v32-bookings.js'")&&build.includes("'v32-bookings.css'"),'Buchungs-Assets fehlen im Build')
ok(css.includes('[data-v32-category="lebensmittel"]')&&css.includes('[data-v32-category="gehalt"]'),'Kategorie-Farben fehlen')
ok(css.includes('.v321-recurring')&&css.includes('.v321-recurring-preview'),'Wiederholungs-UI fehlt')
ok(settings.includes('recurring:recurring()?.exportData?.()')&&settings.includes('recurring()?.reset?.()'),'Wiederholungen fehlen im Backup/Reset')
ok(js.includes('if(created>0)root.NestAppV3?.render?.(false);else schedule()'),'Doppelter Buchungsrender wurde wieder eingeführt')
console.log('NEST V4.4 booking and recurring compatibility tests passed')
