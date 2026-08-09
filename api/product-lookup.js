'use strict'
const FIELDS=['code','product_name','brands','quantity','serving_size','image_front_small_url','image_front_url','image_url','nutriments','nutriscore_grade','nutrition_grades','ingredients_text','allergens_tags','categories']
function json(res,status,body,cache){res.status(status);res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control',cache||'no-store');return res.json(body)}
function cleanText(v,max=400){return String(v==null?'':v).replace(/\s+/g,' ').trim().slice(0,max)}
function normalizeBarcode(v){const code=String(v==null?'':v).replace(/\D/g,'');return /^\d{7,14}$/.test(code)?code:''}
function numOrNull(v){const n=Number(v);return Number.isFinite(n)?Math.round(n*1000)/1000:null}
function nutrition(n={}){return{energyKcal:numOrNull(n['energy-kcal_100g']),energyKj:numOrNull(n['energy-kj_100g']??n.energy_100g),fat:numOrNull(n.fat_100g),saturatedFat:numOrNull(n['saturated-fat_100g']),carbs:numOrNull(n.carbohydrates_100g),sugars:numOrNull(n.sugars_100g),protein:numOrNull(n.proteins_100g),salt:numOrNull(n.salt_100g),fiber:numOrNull(n.fiber_100g)}}
function normalizeAllergen(v){return cleanText(String(v||'').replace(/^[a-z]{2}:/i,'').replace(/-/g,' '),80)}
function mapProduct(p={},barcode=''){const grade=cleanText(p.nutriscore_grade||p.nutrition_grades,4).toLowerCase();return{code:normalizeBarcode(p.code)||barcode,name:cleanText(p.product_name||'Unbekanntes Produkt',120),brand:cleanText(p.brands,100),quantity:cleanText(p.quantity,60),servingSize:cleanText(p.serving_size,60),image:cleanText(p.image_front_small_url||p.image_front_url||p.image_url,500),nutriscoreGrade:/^[a-e]$/.test(grade)?grade:'',ingredients:cleanText(p.ingredients_text,1200),allergens:Array.isArray(p.allergens_tags)?p.allergens_tags.map(normalizeAllergen).filter(Boolean).slice(0,30):[],categories:cleanText(p.categories,300),nutrition:nutrition(p.nutriments),source:'Open Food Facts',fetchedAt:Date.now()}}
async function fetchWithTimeout(url,options={},ms=8000){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),ms);try{return await fetch(url,{...options,signal:controller.signal})}finally{clearTimeout(timer)}}
async function handler(req,res){
  if(req.method!=='GET'){res.setHeader('Allow','GET');return json(res,405,{ok:false,error:'method_not_allowed'})}
  const barcode=normalizeBarcode(req.query&&req.query.barcode)
  if(!barcode)return json(res,400,{ok:false,error:'invalid_barcode'})
  const endpoint=`https://world.openfoodfacts.org/api/v3/product/${encodeURIComponent(barcode)}.json?fields=${encodeURIComponent(FIELDS.join(','))}`
  try{
    const response=await fetchWithTimeout(endpoint,{headers:{'Accept':'application/json','User-Agent':'NEST/2.2.0 (https://selfmade-v3.vercel.app; product-lookup)'}},8000)
    if(response.status===404)return json(res,200,{ok:true,found:false,barcode},'public, s-maxage=3600, stale-while-revalidate=86400')
    if(!response.ok)return json(res,502,{ok:false,error:'product_service_error',status:response.status})
    const data=await response.json()
    const product=data&&data.product
    if(!product||data.status===0)return json(res,200,{ok:true,found:false,barcode},'public, s-maxage=3600, stale-while-revalidate=86400')
    return json(res,200,{ok:true,found:true,barcode,product:mapProduct(product,barcode)},'public, s-maxage=21600, stale-while-revalidate=86400')
  }catch(error){const timeout=error&&error.name==='AbortError';console.error('Open Food Facts lookup failed',error);return json(res,timeout?504:502,{ok:false,error:timeout?'product_service_timeout':'product_service_unavailable'})}
}
module.exports=handler
module.exports._test={normalizeBarcode,numOrNull,nutrition,mapProduct,normalizeAllergen,FIELDS}
