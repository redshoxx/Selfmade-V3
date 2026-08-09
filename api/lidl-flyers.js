'use strict'

const API_VERSION='4.2.0'
const SOURCE_URL='https://www.lidl.at/c/flugblatt/s10012330'
const CACHE_MS=30*60*1000
const MAX_FLYERS=30
let memoryCache={at:0,data:null}

function clean(v,max=300){return String(v==null?'':v).replace(/\s+/g,' ').trim().slice(0,max)}
function decodeEntities(text){return String(text||'').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)||32)).replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16)||32))}
function stripTags(v){return clean(decodeEntities(String(v||'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ')),260)}
function safeLidlUrl(value,base=SOURCE_URL){try{const u=new URL(decodeEntities(value),base);if(!/^(www\.)?lidl\.at$/i.test(u.hostname))return'';u.hash='';return u.href}catch{return''}}
function hash(s){let h=2166136261;for(const ch of String(s||'')){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return(h>>>0).toString(36)}
function attr(tag,name){const m=String(tag||'').match(new RegExp('\\b'+name+'\\s*=\\s*["\\\']([^"\\\']+)["\\\']','i'));return m?decodeEntities(m[1]):''}
function imageFromHtml(html,base=SOURCE_URL){
  const srcset=String(html||'').match(/\bsrcset\s*=\s*["']([^"']+)["']/i)
  if(srcset){const choices=decodeEntities(srcset[1]).split(',').map(x=>x.trim().split(/\s+/)[0]).filter(Boolean);const u=safeLidlUrl(choices[choices.length-1],base);if(u)return u}
  for(const key of ['src','data-src','data-lazy-src']){const m=String(html||'').match(new RegExp('\\b'+key+'\\s*=\\s*["\\\']([^"\\\']+)["\\\']','i'));if(m){const u=safeLidlUrl(m[1],base);if(u)return u}}
  const bg=String(html||'').match(/background-image\s*:\s*url\((?:["']?)([^)"']+)(?:["']?)\)/i);if(bg){const u=safeLidlUrl(bg[1],base);if(u)return u}
  return''
}
function sectionInfo(text){const t=clean(text,120).toLowerCase();if(t.includes('reiseprospekt'))return{key:'travel',label:'Reiseprospekte'};if(t.includes('sonderflyer'))return{key:'special',label:'Sonderflyer'};if(t.includes('aktuelle flugbl'))return{key:'weekly',label:'Aktuelle Flugblätter'};return null}
function titleDate(title){const m=String(title||'').match(/Ab\s+(?:Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag|Mo\.?|Di\.?|Mi\.?|Do\.?|Fr\.?|Sa\.?|So\.?)\s*(\d{1,2}\.\d{1,2}\.?)/i);return m?clean(m[1],16):''}
function fallbackCategory(title){const t=String(title||'').toLowerCase();if(/reise|urlaub|highlights|buchbar/.test(t))return{key:'travel',label:'Reiseprospekte'};if(/flugblatt/.test(t))return{key:'weekly',label:'Aktuelle Flugblätter'};return{key:'special',label:'Sonderflyer'}}
function parseFlyers(html,base=SOURCE_URL){
  const source=String(html||''),out=[],seen=new Set();let section={key:'weekly',label:'Aktuelle Flugblätter'}
  const re=/<(h[1-4])\b[^>]*>([\s\S]*?)<\/\1>|<a\b([^>]*)href\s*=\s*["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi
  let m
  while((m=re.exec(source))){
    if(m[1]){const next=sectionInfo(stripTags(m[2]));if(next)section=next;continue}
    const url=safeLidlUrl(m[4],base);if(!url||!/\/l\/de\/flugblatt\//i.test(url)||!/\/ar\/\d+\/?(?:\?|$)/i.test(url))continue
    if(seen.has(url))continue
    let title=stripTags(m[6]);if(!title)title=clean(attr(m[3]+' '+m[5],'aria-label')||attr(m[3]+' '+m[5],'title'),180)
    if(!title||/^(mehr|öffnen|anzeigen)$/i.test(title))continue
    const cat=sectionInfo(section.label)||fallbackCategory(title),image=imageFromHtml(m[6],url)
    seen.add(url);out.push({id:'flyer_'+hash(url),title,category:cat.key,categoryLabel:cat.label,dateText:titleDate(title),url,image})
    if(out.length>=MAX_FLYERS)break
  }
  return out
}
function metaImage(html,base){
  const patterns=[/<meta\b[^>]*property=["']og:image(?::secure_url)?["'][^>]*content=["']([^"']+)["']/i,/<meta\b[^>]*content=["']([^"']+)["'][^>]*property=["']og:image(?::secure_url)?["']/i,/<meta\b[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i]
  for(const re of patterns){const m=String(html||'').match(re);if(m){const u=safeLidlUrl(m[1],base);if(u)return u}}
  return imageFromHtml(html,base)
}
async function fetchWithTimeout(url,ms=12000){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),ms);try{return await fetch(url,{signal:controller.signal,redirect:'follow',headers:{Accept:'text/html,application/xhtml+xml','Accept-Language':'de-AT,de;q=0.9','User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36 NEST/4.2'}})}finally{clearTimeout(timer)}}
async function getHtml(url){const r=await fetchWithTimeout(url);if(!r.ok)throw new Error(`Lidl HTTP ${r.status}`);return r.text()}
async function enrichCover(flyer){if(flyer.image)return flyer;try{const html=await getHtml(flyer.url),image=metaImage(html,flyer.url);return image?{...flyer,image}:flyer}catch{return flyer}}
async function mapLimit(items,limit,fn){const out=new Array(items.length);let cursor=0;async function worker(){while(true){const i=cursor++;if(i>=items.length)return;out[i]=await fn(items[i],i)}}await Promise.all(Array.from({length:Math.min(limit,items.length||1)},worker));return out}
async function fetchFlyers({force=false}={}){
  if(!force&&memoryCache.data&&Date.now()-memoryCache.at<CACHE_MS)return{...memoryCache.data,cached:true}
  try{
    const html=await getHtml(SOURCE_URL),parsed=parseFlyers(html,SOURCE_URL),flyers=await mapLimit(parsed,3,enrichCover)
    if(!flyers.length)throw new Error('Keine Flugblätter erkannt')
    const counts={weekly:flyers.filter(x=>x.category==='weekly').length,special:flyers.filter(x=>x.category==='special').length,travel:flyers.filter(x=>x.category==='travel').length}
    const data={ok:true,apiVersion:API_VERSION,source:'lidl.at',sourceUrl:SOURCE_URL,fetchedAt:new Date().toISOString(),flyers,counts}
    memoryCache={at:Date.now(),data};return data
  }catch(error){if(memoryCache.data)return{...memoryCache.data,cached:true,stale:true,warning:clean(error&&error.message,140)};throw error}
}
function json(res,status,body,cache='public, s-maxage=1800, stale-while-revalidate=10800'){res.status(status);res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control',cache);return res.json(body)}
async function handler(req,res){if(req.method!=='GET'){res.setHeader('Allow','GET');return json(res,405,{ok:false,error:'method_not_allowed'},'no-store')}try{return json(res,200,await fetchFlyers({force:String(req.query&&req.query.force||'')==='1'}))}catch(error){const timeout=error&&error.name==='AbortError';console.error('Lidl flyer sync failed',error);return json(res,timeout?504:502,{ok:false,error:timeout?'lidl_flyer_timeout':'lidl_flyer_unavailable',message:clean(error&&error.message,160)},'no-store')}}

module.exports=handler
module.exports._test={API_VERSION,SOURCE_URL,clean,decodeEntities,stripTags,safeLidlUrl,imageFromHtml,sectionInfo,titleDate,parseFlyers,metaImage,fetchFlyers}
