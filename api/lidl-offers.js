'use strict'
const Lidl=require('../v4-lidl.js')

const API_VERSION='4.1.0'
const ROOT_URL='https://www.lidl.at/c/'
const CACHE_MS=30*60*1000
const MAX_CAMPAIGNS=14
let memoryCache={at:0,data:null}

function clean(v,max=500){return String(v==null?'':v).replace(/\s+/g,' ').trim().slice(0,max)}
function decodeEntities(text){return String(text||'').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)||32)).replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16)||32))}
function htmlToText(html){return decodeEntities(String(html||'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'\n').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'\n').replace(/<\/(?:article|section|div|p|li|h[1-6]|button|a)>/gi,'\n').replace(/<br\s*\/?\s*>/gi,'\n').replace(/<[^>]+>/g,' ')).split(/\r?\n/).map(x=>x.replace(/[ \t]+/g,' ').trim()).filter(Boolean).join('\n')}
function parseGermanRange(text,refDate=new Date()){
  const m=String(text||'').match(/Ab\s+(?:Mo|Di|Mi|Do|Fr|Sa|So)\.?\s*(\d{1,2})\.(\d{1,2})\.?\s+bis\s+(?:Mo|Di|Mi|Do|Fr|Sa|So)\.?\s*(\d{1,2})\.(\d{1,2})\.?/i)
  if(!m)return{}
  const refY=refDate.getFullYear(),refM=refDate.getMonth()+1
  let y=refY,fromM=Number(m[2]),toM=Number(m[4])
  if(fromM<refM-6)y++
  if(fromM>refM+6)y--
  let toY=y;if(toM<fromM-6)toY++
  const validFrom=`${y}-${String(fromM).padStart(2,'0')}-${String(Number(m[1])).padStart(2,'0')}`
  const validTo=`${toY}-${String(toM).padStart(2,'0')}-${String(Number(m[3])).padStart(2,'0')}`
  return{validFrom,validTo}
}
function stripTags(v){return clean(decodeEntities(String(v||'').replace(/<[^>]+>/g,' ')),240)}
function extractCampaignLinks(html,base=ROOT_URL){
  const out=[],seen=new Set(),re=/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let m
  while((m=re.exec(String(html||'')))){
    const label=stripTags(m[2])
    if(!/\bAb\s+(?:Mo|Di|Mi|Do|Fr|Sa|So)\./i.test(label))continue
    let url
    try{url=new URL(decodeEntities(m[1]),base)}catch{continue}
    if(url.hostname!=='www.lidl.at'&&url.hostname!=='lidl.at')continue
    if(!/\/c\/.+\/a\d+/i.test(url.pathname))continue
    url.hash='';url.search=''
    if(seen.has(url.href))continue
    seen.add(url.href);out.push({url:url.href,label})
    if(out.length>=MAX_CAMPAIGNS)break
  }
  return out
}
function numberValue(v,key=''){
  if(v==null)return null
  if(typeof v==='number')return Number.isFinite(v)?(key.toLowerCase().includes('cent')?v/100:v):null
  if(typeof v==='string'){
    const s=v.replace(/\s/g,'').replace(/[^0-9,.-]/g,'').replace(',','.')
    const n=Number(s);return Number.isFinite(n)?n:null
  }
  if(typeof v==='object')for(const k of ['amount','value','price','centAmount']){if(v[k]!=null){const n=numberValue(v[k],k);if(n!=null)return n}}
  return null
}
function jsonCandidate(obj,defaults,sourceUrl){
  if(!obj||typeof obj!=='object'||Array.isArray(obj))return null
  const name=clean(obj.productName||obj.product_name||obj.name||obj.title||obj.headline,140)
  if(!name||/^(aktion|angebote?|lidl plus|mehr anzeigen|kategorien?)$/i.test(name))return null
  let price=null,oldPrice=null
  for(const k of ['offerPrice','salePrice','sellingPrice','currentPrice','price','priceValue']){const n=numberValue(obj[k],k);if(n!=null){price=n;break}}
  for(const k of ['oldPrice','regularPrice','referencePrice','listPrice','wasPrice']){const n=numberValue(obj[k],k);if(n!=null){oldPrice=n;break}}
  if(!(price>0&&price<5000))return null
  const validFrom=clean(obj.validFrom||obj.startDate||obj.availableFrom||defaults.validFrom,20)
  const validTo=clean(obj.validTo||obj.endDate||obj.availableTo||defaults.validTo,20)
  const raw=JSON.stringify(obj).slice(0,5000)
  const unitText=clean(obj.unitText||obj.unit||obj.quantity||obj.packaging,90)
  if(!oldPrice&&!validFrom&&!validTo&&!unitText&&!/offer|aktion|promotion|lidl\s*plus/i.test(raw))return null
  return{name,price:Math.round(price*100)/100,oldPrice:oldPrice>0?Math.round(oldPrice*100)/100:null,validFrom,validTo,lidlPlus:/lidl\s*plus/i.test(raw),unitText,source:'lidl.at-auto',sourceUrl}
}
function extractJsonOffers(html,defaults,sourceUrl){
  const found=[],scripts=[...String(html||'').matchAll(/<script\b[^>]*(?:type=["']application\/(?:ld\+json|json)["']|id=["']__NEXT_DATA__["'])[^>]*>([\s\S]*?)<\/script>/gi)]
  function walk(value,depth=0){
    if(depth>16||found.length>500||value==null)return
    if(Array.isArray(value)){for(const x of value)walk(x,depth+1);return}
    if(typeof value!=='object')return
    const c=jsonCandidate(value,defaults,sourceUrl);if(c)found.push(c)
    for(const v of Object.values(value))walk(v,depth+1)
  }
  for(const s of scripts){try{walk(JSON.parse(decodeEntities(s[1])))}catch{}}
  return found
}
function dedupeOffers(rows){
  const map=new Map()
  for(const x of rows||[]){
    if(!x||!x.name||!(Number(x.price)>0))continue
    const key=[String(x.name).toLowerCase().replace(/\s+/g,' ').trim(),Number(x.price).toFixed(2),x.validFrom||'',x.validTo||''].join('|')
    const old=map.get(key);if(!old||(!old.oldPrice&&x.oldPrice))map.set(key,x)
  }
  return [...map.values()].slice(0,600)
}
function parsePage(html,sourceUrl,defaults={}){
  const text=htmlToText(html),range={...defaults,...parseGermanRange(text)}
  let rows=[]
  try{rows=Lidl.parseImport(text,{...range,source:'lidl.at-auto',sourceUrl})||[]}catch{}
  rows.push(...extractJsonOffers(html,range,sourceUrl))
  return dedupeOffers(rows)
}
async function fetchWithTimeout(url,ms=12000){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),ms)
  try{return await fetch(url,{signal:controller.signal,redirect:'follow',headers:{Accept:'text/html,application/xhtml+xml','Accept-Language':'de-AT,de;q=0.9','User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36 NEST/4.1'}})}finally{clearTimeout(timer)}
}
async function getHtml(url){const r=await fetchWithTimeout(url);if(!r.ok)throw new Error(`Lidl HTTP ${r.status}`);return r.text()}
async function mapLimit(items,limit,fn){const out=new Array(items.length);let cursor=0;async function worker(){while(true){const i=cursor++;if(i>=items.length)return;try{out[i]=await fn(items[i],i)}catch(e){out[i]={error:String(e&&e.message||e)}}}}await Promise.all(Array.from({length:Math.min(limit,items.length)},worker));return out}
async function fetchOffers({force=false}={}){
  if(!force&&memoryCache.data&&Date.now()-memoryCache.at<CACHE_MS)return{...memoryCache.data,cached:true}
  const rootHtml=await getHtml(ROOT_URL),campaigns=extractCampaignLinks(rootHtml),rows=[...parsePage(rootHtml,ROOT_URL,{})]
  const pages=await mapLimit(campaigns,4,async c=>{const html=await getHtml(c.url);const range=parseGermanRange(c.label);return{url:c.url,label:c.label,offers:parsePage(html,c.url,range)}})
  for(const p of pages)if(p&&Array.isArray(p.offers))rows.push(...p.offers)
  const offers=dedupeOffers(rows),data={ok:true,apiVersion:API_VERSION,source:'lidl.at',sourceUrl:ROOT_URL,fetchedAt:new Date().toISOString(),offers,campaigns:campaigns.length,pagesFetched:pages.filter(x=>x&&!x.error).length,warning:offers.length?'':'no_offers_parsed'}
  if(offers.length){memoryCache={at:Date.now(),data}}
  return data
}
function json(res,status,body,cache='public, s-maxage=1800, stale-while-revalidate=10800'){res.status(status);res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control',cache);return res.json(body)}
async function handler(req,res){
  if(req.method!=='GET'){res.setHeader('Allow','GET');return json(res,405,{ok:false,error:'method_not_allowed'},'no-store')}
  try{return json(res,200,await fetchOffers({force:String(req.query&&req.query.force||'')==='1'}))}
  catch(error){const timeout=error&&error.name==='AbortError';console.error('Lidl offer sync failed',error);return json(res,timeout?504:502,{ok:false,error:timeout?'lidl_timeout':'lidl_unavailable',message:clean(error&&error.message,160)},'no-store')}
}
module.exports=handler
module.exports._test={API_VERSION,ROOT_URL,htmlToText,parseGermanRange,extractCampaignLinks,parsePage,dedupeOffers,jsonCandidate,fetchOffers}
