'use strict'

const API_VERSION='4.3.0'
const STORE={
  name:'Lidl Filiale',
  address:'Liebenauer Hauptstrasse 164',
  postalCode:'8041',
  city:'Graz',
  label:'Lidl Liebenau',
  pageUrl:'https://www.lidl.at/s/de-AT/filialsuche/graz/liebenauer-hauptstrasse-164/'
}
const LANDING_URL='https://www.lidl.at/c/lidl-plus-jede-woche-neu/'
const CACHE_MS=30*60*1000
const MAX_CAMPAIGNS=32
const MAX_OFFERS=1400
let memoryCache={at:0,data:null}

function clean(v,max=500){return String(v==null?'':v).replace(/\s+/g,' ').trim().slice(0,max)}
function decodeEntities(text){return String(text||'').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)||32)).replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16)||32))}
function stripTags(v){return clean(decodeEntities(String(v||'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ')),500)}
function htmlToLines(html){return decodeEntities(String(html||'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'\n').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'\n').replace(/<\/(?:article|section|div|p|li|h[1-6]|button|a|span)>/gi,'\n').replace(/<br\s*\/?\s*>/gi,'\n').replace(/<[^>]+>/g,' ')).split(/\r?\n/).map(x=>x.replace(/[ \t]+/g,' ').trim()).filter(Boolean)}
function hash(s){let h=2166136261;for(const ch of String(s||'')){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return(h>>>0).toString(36)}
function safeLidlUrl(value,base=LANDING_URL){try{const u=new URL(decodeEntities(value),base);if(!/^(www\.)?lidl\.at$/i.test(u.hostname))return'';u.hash='';return u.href}catch{return''}}
function parseMoney(v){if(v==null)return null;const m=String(v).replace(/\s/g,'').match(/-?\d{1,5}(?:[.,]\d{1,2})?/);if(!m)return null;const n=Math.abs(Number(m[0].replace(',','.')));return Number.isFinite(n)&&n>0&&n<10000?Math.round(n*100)/100:null}
function ymd(y,m,d){const dt=new Date(Date.UTC(y,m-1,d));if(dt.getUTCFullYear()!==y||dt.getUTCMonth()!==m-1||dt.getUTCDate()!==d)return'';return`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`}
function resolveRange(a,b,c,d,refDate=new Date()){
  const refY=refDate.getFullYear(),refM=refDate.getMonth()+1,fromM=Number(b),toM=Number(d)
  let fromY=refY;if(fromM<refM-6)fromY++;else if(fromM>refM+6)fromY--
  let toY=fromY;if(toM<fromM-6)toY++
  return{validFrom:ymd(fromY,fromM,Number(a)),validTo:ymd(toY,toM,Number(c))}
}
function parseRange(text,refDate=new Date()){
  const s=String(text||''),weekday='(?:Mo|Di|Mi|Do|Fr|Sa|So|Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag)\\.?'
  let m=s.match(new RegExp('Ab\\s+'+weekday+'\\s*(\\d{1,2})\\.(\\d{1,2})\\.?\\s+bis\\s+'+weekday+'\\s*(\\d{1,2})\\.(\\d{1,2})\\.?','i'))
  if(!m)m=s.match(/gültig\s+ab\s*(\d{1,2})\.(\d{1,2})\.?\s+bis\s*(\d{1,2})\.(\d{1,2})\.?/i)
  if(!m)m=s.match(new RegExp('Gültig\\s+von\\s+'+weekday+'\\s*(\\d{1,2})\\.(\\d{1,2})\\.?\\s*[-–]\\s*'+weekday+'\\s*(\\d{1,2})\\.(\\d{1,2})\\.?','i'))
  if(!m)m=s.match(/(?:in der Filiale|gültig|gueltig)\s*(\d{1,2})\.(\d{1,2})\.?\s*[-–]\s*(\d{1,2})\.(\d{1,2})\.?/i)
  return m?resolveRange(m[1],m[2],m[3],m[4],refDate):{}
}
function phaseFor(from,to,on=new Date()){
  const day=`${on.getFullYear()}-${String(on.getMonth()+1).padStart(2,'0')}-${String(on.getDate()).padStart(2,'0')}`
  if(from&&from>day)return'upcoming'
  if(to&&to<day)return'expired'
  return'current'
}
function campaignName(label){
  let s=String(label||'')
  s=s.replace(/gültig\s+ab\s*\d{1,2}\.\d{1,2}\.?\s+bis\s*\d{1,2}\.\d{1,2}\.?/ig,' ')
  s=s.replace(/Ab\s+(?:Mo|Di|Mi|Do|Fr|Sa|So|Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag)\.?\s*\d{1,2}\.\d{1,2}\.?\s+bis\s+(?:Mo|Di|Mi|Do|Fr|Sa|So|Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag)\.?\s*\d{1,2}\.\d{1,2}\.?/ig,' ')
  s=s.replace(/Gültig\s+von\s+(?:Mo|Di|Mi|Do|Fr|Sa|So|Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag)\.?\s*\d{1,2}\.\d{1,2}\.?\s*[-–]\s*(?:Mo|Di|Mi|Do|Fr|Sa|So|Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag)\.?\s*\d{1,2}\.\d{1,2}\.?/ig,' ')
  return clean(s.replace(/^[-–|\s]+|[-–|\s]+$/g,'')||'Aktion',120)
}
function extractCampaigns(html,base=LANDING_URL){
  const out=[],seen=new Set(),re=/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let m
  while((m=re.exec(String(html||'')))){
    const label=stripTags(m[2]),range=parseRange(label)
    if(!range.validFrom||!range.validTo)continue
    const url=safeLidlUrl(m[1],base)
    if(!url)continue
    const parsed=new URL(url)
    if(!/\/c\//i.test(parsed.pathname)||!/\/a\d+\/?$/i.test(parsed.pathname))continue
    if(/rezepte|reisen|flugblatt|newsletter|fotos/i.test(label))continue
    const key=url;if(seen.has(key))continue;seen.add(key)
    const tabCode=parsed.searchParams.get('tabCode')||'',phase=/Next_Sales_Week/i.test(tabCode)?'upcoming':/Current_Sales_Week/i.test(tabCode)?'current':phaseFor(range.validFrom,range.validTo)
    out.push({url:key,label,campaign:campaignName(label),...range,phase,tabCode})
    if(out.length>=MAX_CAMPAIGNS)break
  }
  return out
}
function productCategory(name,campaign=''){
  const t=`${name} ${campaign}`.toLowerCase()
  const rules=[['Obst & Gemüse',/(obst|gemüse|banan|apfel|äpfel|pfirsich|traub|tomat|gurk|paprika|salat|kartoff|zwiebel|beere|melone|zitrone)/],['Milch & Kühlung',/(milch|joghurt|yogurt|käse|butter|topfen|quark|mozzarella|kühl)/],['Fleisch & Fisch',/(fleisch|huhn|hähn|pute|rind|schwein|wurst|schinken|fisch|lachs|thunfisch)/],['Backwaren',/(brot|semmel|brötchen|toast|baguette|croissant|backware)/],['Getränke',/(wasser|saft|cola|limonade|energy|bier|wein|sekt|kaffee|tee|getränk)/],['Tiefkühl',/(tiefkühl|pizza|eiscreme|eis |frozen)/],['Haushalt & Drogerie',/(waschmittel|reiniger|spülmittel|haushalt|toilettenpapier|küchenrolle|shampoo|duschgel|pflege|cien)/],['DIY & Garten',/(parkside|werkzeug|garten|pflanze|blume|akku|bohrer|säge)/],['Mode & Freizeit',/(mode|crivit|esmara|lupilu|shirt|hose|schuh|sport|freizeit)/],['Vorrat & Snacks',/(nudel|pasta|reis|mehl|zucker|öl|müsli|schokolade|keks|snack|konserve)/]]
  for(const [label,re] of rules)if(re.test(t))return label
  return'Sonstiges'
}
function makeOffer({name,price,oldPrice=null,unitText='',lidlPlus=false,discount='',validFrom='',validTo='',campaign='Aktion',sourceUrl=LANDING_URL}){
  name=clean(name,140);price=parseMoney(price);oldPrice=parseMoney(oldPrice)
  if(!name||!price)return null
  return{id:'offer_'+hash([name,price,validFrom,validTo,campaign].join('|')),name,price,oldPrice:oldPrice&&oldPrice>0?oldPrice:null,unitText:clean(unitText,100),lidlPlus:Boolean(lidlPlus),discount:clean(discount,30),validFrom,validTo,phase:phaseFor(validFrom,validTo),campaign:clean(campaign||'Aktion',120),category:productCategory(name,campaign),sourceUrl:clean(sourceUrl||LANDING_URL,500)}
}
function parseOfferLines(lines,defaults={}){
  const out=[]
  for(let i=0;i<lines.length;i++){
    const head=lines[i].match(/^(.{2,160}?)\s+für\s+(\d{1,5}(?:[.,]\d{1,2})?)\s*(?:EUR|€)\s*$/i)
    if(!head)continue
    let price=parseMoney(head[2]),oldPrice=null,unitText='',lidlPlus=false,discount='',range={validFrom:defaults.validFrom||'',validTo:defaults.validTo||''}
    for(const line of lines.slice(i+1,i+18)){
      if(/^vorher\s*:/i.test(line)){const n=parseMoney(line);if(n)oldPrice=n}
      if(/mit\s+Lidl\s+Plus|Lidl\s+Plus/i.test(line))lidlPlus=true
      if(/^[-−]\s*\d{1,2}%/.test(line)||/^\d{1,2}%\s*(günstiger|billiger)/i.test(line))discount=clean(line,30)
      if(/^Je\s+/i.test(line))unitText=clean(line,100)
      const r=parseRange(line);if(r.validFrom)range=r
      const p=line.match(/^(\d{1,5}(?:[.,]\d{1,2})?)\s*€?\*?$/);if(p){const n=parseMoney(p[1]);if(n)price=n}
    }
    const offer=makeOffer({name:head[1],price,oldPrice,unitText,lidlPlus,discount,validFrom:range.validFrom||defaults.validFrom||'',validTo:range.validTo||defaults.validTo||'',campaign:defaults.campaign,sourceUrl:defaults.sourceUrl})
    if(offer)out.push(offer)
  }
  return out
}
function numberValue(v,key=''){
  if(v==null||v==='')return null
  if(typeof v==='number')return Number.isFinite(v)?(key.toLowerCase().includes('cent')?v/100:v):null
  if(typeof v==='string')return parseMoney(v)
  if(typeof v==='object')for(const k of ['amount','value','price','centAmount','salesPrice','sellingPrice']){if(v[k]!=null){const n=numberValue(v[k],k);if(n!=null)return n}}
  return null
}
function normalizeDateValue(v){const s=clean(v,40);if(/^\d{4}-\d{2}-\d{2}/.test(s))return s.slice(0,10);return''}
function jsonCandidate(obj,defaults={}){
  if(!obj||typeof obj!=='object'||Array.isArray(obj))return null
  const name=clean(obj.productName||obj.product_name||obj.name||obj.title||obj.headline||obj.shortDescription,140)
  if(!name||/^(aktion|angebote?|aktuelle angebote|demnächst|lidl plus|mehr anzeigen|kategorien?)$/i.test(name))return null
  let price=null,oldPrice=null
  for(const k of ['offerPrice','salePrice','salesPrice','sellingPrice','currentPrice','price','priceValue']){const n=numberValue(obj[k],k);if(n!=null){price=n;break}}
  for(const k of ['oldPrice','regularPrice','referencePrice','listPrice','wasPrice','strikePrice']){const n=numberValue(obj[k],k);if(n!=null){oldPrice=n;break}}
  if(!(price>0&&price<10000))return null
  const raw=JSON.stringify(obj).slice(0,7000),validFrom=normalizeDateValue(obj.validFrom||obj.startDate||obj.availableFrom)||defaults.validFrom||'',validTo=normalizeDateValue(obj.validTo||obj.endDate||obj.availableTo)||defaults.validTo||''
  if(!validFrom&&!validTo&&!oldPrice&&!/offer|sale|aktion|promotion|lidl\s*plus|€|eur/i.test(raw))return null
  return makeOffer({name,price,oldPrice,unitText:obj.unitText||obj.unit||obj.quantity||obj.packaging||'',lidlPlus:/lidl\s*plus/i.test(raw),discount:obj.discount||obj.discountText||'',validFrom,validTo,campaign:defaults.campaign,sourceUrl:defaults.sourceUrl})
}
function extractJsonOffers(html,defaults={}){
  const found=[],scripts=[...String(html||'').matchAll(/<script\b[^>]*(?:type=["']application\/(?:ld\+json|json)["']|id=["']__NEXT_DATA__["'])[^>]*>([\s\S]*?)<\/script>/gi)]
  let visited=0
  function walk(value,depth=0){
    if(depth>18||visited>5000||found.length>1800||value==null)return
    if(Array.isArray(value)){for(const x of value)walk(x,depth+1);return}
    if(typeof value!=='object')return
    visited++
    const c=jsonCandidate(value,defaults);if(c)found.push(c)
    for(const v of Object.values(value))walk(v,depth+1)
  }
  for(const s of scripts){try{walk(JSON.parse(decodeEntities(s[1])))}catch{}}
  return found
}
function parseOffers(html,defaults={}){return dedupeOffers([...parseOfferLines(htmlToLines(html),defaults),...extractJsonOffers(html,defaults)])}
function dedupeOffers(rows){const map=new Map();for(const x of rows||[]){if(!x||!x.name||!(Number(x.price)>0))continue;const key=[x.name.toLowerCase().replace(/\s+/g,' '),Number(x.price).toFixed(2),x.validFrom||'',x.validTo||''].join('|');const old=map.get(key);if(!old||(!old.oldPrice&&x.oldPrice)||(!old.lidlPlus&&x.lidlPlus))map.set(key,x)}return[...map.values()].slice(0,MAX_OFFERS)}
function extractCookies(response){try{const rows=response.headers.getSetCookie?.()||[];return rows.map(x=>x.split(';')[0]).filter(Boolean)}catch{return[]}}
function mergeCookies(a,b){const map=new Map();for(const row of [...(a||[]),...(b||[])]){const i=row.indexOf('=');if(i>0)map.set(row.slice(0,i),row.slice(i+1))}return[...map].map(([k,v])=>`${k}=${v}`)}
async function fetchPage(url,{cookies=[],referer=''}={}){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),14000)
  try{
    const headers={Accept:'text/html,application/xhtml+xml','Accept-Language':'de-AT,de;q=0.9','User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36 NEST/4.3'}
    if(cookies.length)headers.Cookie=cookies.join('; ')
    if(referer)headers.Referer=referer
    const response=await fetch(url,{signal:controller.signal,redirect:'follow',headers})
    if(!response.ok)throw new Error(`Lidl HTTP ${response.status}`)
    return{html:await response.text(),cookies:extractCookies(response),url:response.url||url}
  }finally{clearTimeout(timer)}
}
async function mapLimit(items,limit,fn){const out=new Array(items.length);let cursor=0;async function worker(){while(true){const i=cursor++;if(i>=items.length)return;try{out[i]=await fn(items[i],i)}catch(error){out[i]={error:clean(error&&error.message,160)}}}}await Promise.all(Array.from({length:Math.min(limit,items.length||1)},worker));return out}
async function fetchCatalog({force=false}={}){
  if(!force&&memoryCache.data&&Date.now()-memoryCache.at<CACHE_MS)return{...memoryCache.data,cached:true}
  const storePage=await fetchPage(STORE.pageUrl),storeVerified=stripTags(storePage.html).includes('Liebenauer Hauptstrasse 164')
  let cookies=mergeCookies([],storePage.cookies)
  const landing=await fetchPage(LANDING_URL,{cookies,referer:STORE.pageUrl});cookies=mergeCookies(cookies,landing.cookies)
  const campaigns=[...extractCampaigns(storePage.html,STORE.pageUrl),...extractCampaigns(landing.html,LANDING_URL)]
  const unique=[],seen=new Set();for(const c of campaigns){if(seen.has(c.url))continue;seen.add(c.url);unique.push(c)}
  let rows=[...parseOffers(storePage.html,{campaign:'Stammfiliale',sourceUrl:STORE.pageUrl}),...parseOffers(landing.html,{campaign:'Lidl Österreich',sourceUrl:LANDING_URL})]
  const pages=await mapLimit(unique,4,async c=>{const p=await fetchPage(c.url,{cookies,referer:STORE.pageUrl});return{campaign:c,offers:parseOffers(p.html,{campaign:c.campaign,validFrom:c.validFrom,validTo:c.validTo,sourceUrl:c.url})}})
  for(const p of pages)if(p&&Array.isArray(p.offers))rows.push(...p.offers)
  const offers=dedupeOffers(rows).filter(x=>x.phase!=='expired'),categories=[...new Set(offers.map(x=>x.category))].sort((a,b)=>a.localeCompare(b,'de-AT'))
  const data={ok:true,apiVersion:API_VERSION,store:{...STORE,verified:storeVerified},source:'lidl.at',sourceUrl:LANDING_URL,fetchedAt:new Date().toISOString(),offers,categories,counts:{current:offers.filter(x=>x.phase==='current').length,upcoming:offers.filter(x=>x.phase==='upcoming').length,total:offers.length},campaigns:unique.length,pagesFetched:pages.filter(x=>x&&!x.error).length,scope:'Stammfiliale Liebenauer Hauptstrasse 164 + öffentliche Lidl-Angebotsseiten mit channel=store'}
  if(offers.length)memoryCache={at:Date.now(),data}
  return data
}
function json(res,status,body,cache='public, s-maxage=1800, stale-while-revalidate=7200'){res.status(status);res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control',cache);return res.json(body)}
async function handler(req,res){if(req.method!=='GET'){res.setHeader('Allow','GET');return json(res,405,{ok:false,error:'method_not_allowed'},'no-store')}try{return json(res,200,await fetchCatalog({force:String(req.query&&req.query.force||'')==='1'}))}catch(error){const timeout=error&&error.name==='AbortError';console.error('Lidl store offer sync failed',error);return json(res,timeout?504:502,{ok:false,error:timeout?'lidl_store_timeout':'lidl_store_unavailable',message:clean(error&&error.message,180)},'no-store')}}

module.exports=handler
module.exports._test={API_VERSION,STORE,LANDING_URL,htmlToLines,parseMoney,parseRange,phaseFor,campaignName,extractCampaigns,productCategory,parseOfferLines,numberValue,jsonCandidate,extractJsonOffers,parseOffers,dedupeOffers,fetchCatalog}
