const fs=require('node:fs')
function ok(cond,msg){if(!cond)throw new Error(msg)}
function ymd(d){return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
const Lidl=require('./v4-lidl.js')
ok(Lidl.RELEASE==='4.0.0','V4 Release fehlt')
ok(typeof Lidl.parseImport==='function'&&typeof Lidl.matchScore==='function','V4 Kern-API fehlt')
const sample=`Bananen für 0.99 EUR
Bananen
vorher: 1.79 €
mit Lidl Plus
-44%
0.99€*
Je kg
in der Filiale 10.08. - 12.08.`
const parsed=Lidl.parseImport(sample,{validFrom:'2026-08-10',validTo:'2026-08-12'})
ok(parsed.length===1,'Lidl.at Text wurde nicht erkannt')
ok(parsed[0].name==='Bananen'&&parsed[0].price===0.99,'Angebotspreis wurde falsch gelesen')
ok(parsed[0].oldPrice===1.79&&parsed[0].lidlPlus===true,'Alter Preis/Lidl Plus fehlt')
const csv=Lidl.parseImport('Milch | 0,99 | 1,39 | 2026-08-10 | 2026-08-12 | plus')
ok(csv.length===1&&csv[0].price===0.99&&csv[0].lidlPlus,'Zeilenimport funktioniert nicht')
ok(Lidl.matchScore('Milch','Milbona Vollmilch 3,5%')>=.8,'Milch-Matching zu schwach')
ok(Lidl.matchScore('Waschmittel','Formil Waschmittel Caps')>=.75,'Waschmittel-Matching zu schwach')
ok(Lidl.matchScore('Bananen','Parkside Akkuschrauber')<.3,'Unpassende Produkte werden zu stark gematcht')
Lidl.reset()
const now=new Date(),from=ymd(now),to=ymd(new Date(now.getFullYear(),now.getMonth(),now.getDate()+7))
Lidl.mergeOffers([{name:'Milbona Vollmilch',price:0.99,oldPrice:1.39,validFrom:from,validTo:to,lidlPlus:true},{name:'Formil Waschmittel',price:3.99,oldPrice:5.49,validFrom:from,validTo:to}],{storeLabel:'Lidl Test'})
const state=Lidl.load()
ok(state.offers.length===2&&state.profile.storeLabel==='Lidl Test','Angebote/Filiale werden nicht gespeichert')
const shop={items:[{id:'1',name:'Milch',amount:2,unit:'stk',checked:false},{id:'2',name:'Waschmittel',amount:1,unit:'stk',checked:false},{id:'3',name:'Brot',amount:1,unit:'stk',checked:false}]}
const summary=Lidl.plannedSummary(shop,state)
ok(summary.count===2,'Einkaufslisten-Matching findet nicht beide Angebote')
ok(summary.savings>1,'Ersparnis wird nicht berechnet')
const milk=Lidl.bestOfferForItem(shop.items[0],state.offers,state,true)
ok(milk&&milk.offer.price===0.99,'Bestes Angebot wird nicht gefunden')
Lidl.ignoreMatch('Milch',milk.offer.id)
const ignored=Lidl.bestOfferForItem(shop.items[0],Lidl.load().offers,Lidl.load(),true)
ok(!ignored,'Ignorierte Zuordnung wird weiterhin verwendet')
Lidl.resetIgnored()
const exported=Lidl.exportData()
Lidl.reset();Lidl.importData(exported)
ok(Lidl.load().offers.length===2,'V4 Export/Import verliert Angebote')
const css=fs.readFileSync('v4-lidl.css','utf8')
ok(css.includes('.v4-lidl-entry')&&css.includes('.v4-shop-offer')&&css.includes('.v4-lidl-dialog'),'V4 UI Styles fehlen')
console.log('NEST V4.0.0 Lidl offer intelligence tests passed')
