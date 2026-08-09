'use strict'
const API_VERSION='v3.6'
const FIELDS=['code','product_name','brands','quantity','product_quantity','product_quantity_unit','serving_size','serving_quantity','serving_quantity_unit','image_front_small_url','image_front_url','image_url','nutriments','nutrition_data_per','nutriscore_grade','nutrition_grades','ingredients_text','allergens_tags','categories','categories_tags']
function json(res,status,body,cache){res.status(status);res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control',cache||'no-store');return res.json(body)}
function cleanText(v,max=500){return String(v==null?'':v).replace(/\s+/g,' ').trim().slice(0,max)}
function normalizeBarcode(v){const code=String(v==null?'':v).replace(/\D/g,'');return /^\d{7,14}$/.test(code)?code:''}
function finite(v){if(v==null||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null}
function round(v){return v==null?null:Math.round(v*1000)/1000}
function nutrient(n,key){const raw=finite(n&&n[`${key}_100g`]);if(raw==null||raw<0)return null;return round(raw)}
function energy(n){let kcal=finite(n&&n['energy-kcal_100g']),kj=finite(n&&n['energy-kj_100g']);if(kj==null)kj=finite(n&&n.energy_100g);if(kcal==null&&kj!=null)kcal=kj/4.184;if(kj==null&&kcal!=null)kj=kcal*4.184;if(kcal!=null&&(kcal<0||kcal>2500))kcal=null;if(kj!=null&&(kj<0||kj>11000))kj=null;return{energyKcal:round(kcal),energyKj:round(kj)}}
function nutrition(n={}){const e=energy(n);return{energyKcal:e.energyKcal,energyKj:e.energyKj,fat:nutrient(n,'fat'),saturatedFat:nutrient(n,'saturated-fat'),carbs:nutrient(n,'carbohydrates'),sugars:nutrient(n,'sugars'),protein:nutrient(n,'proteins'),salt:nutrient(n,'salt'),fiber:nutrient(n,'fiber')}}
function normalizeAllergen(v){return cleanText(String(v||'').replace(/^[a-z]{2}:/i,'').replace(/-/g,' '),80)}
function categoryFromProduct(p={}){const source=`${p.product_name||''} ${p.categories||''} ${(p.categories_tags||[]).join(' ')}`.toLowerCase();const rules=[['Obst & Gemüse',/(fruit|vegetable|gemüse|obst|apfel|apple|banan|tomat|gurk|paprika|salat|kartoff|zwiebel|karotte|beere)/],['Milch & Kühlung',/(dairy|milk|milch|yog|joghurt|cheese|käse|butter|quark|topfen|mozzarella)/],['Fleisch & Fisch',/(meat|fish|fleisch|huhn|chicken|beef|rind|pork|schwein|wurst|ham|schinken|lachs|salmon|tuna|thunfisch)/],['Backwaren',/(bread|brot|bakery|backware|toast|baguette|croissant|brötchen|semmel)/],['Getränke',/(beverage|drink|water|wasser|juice|saft|cola|coffee|kaffee|tea|tee)/],['Tiefkühl',/(frozen|tiefkühl|ice-cream|eiscreme)/],['Vorrat',/(pasta|nudel|rice|reis|flour|mehl|sugar|zucker|oil|öl|cereal|müsli|chocolate|schokolade|biscuit|keks|snack|canned|konserve)/]];for(const [label,re] of rules)if(re.test(source))return label;return'Sonstiges'}
function quantityInfo(p={}){const q=finite(p.product_quantity),u=cleanText(p.product_quantity_unit,10).toLowerCase();return{display:cleanText(p.quantity,80),value:q!=null&&q>0?round(q):null,unit:u==='g'||u==='ml'?u:''}}
function mapProduct(p={},barcode=''){const grade=cleanText(p.nutriscore_grade||p.nutrition_grades,4).toLowerCase(),q=quantityInfo(p),nutri=nutrition(p.nutriments);return{code:normalizeBarcode(p.code)||barcode,name:cleanText(p.product_name||'Unbekanntes Produkt',120),brand:cleanText(p.brands,100),quantity:q.display,productQuantity:q.value,productQuantityUnit:q.unit,servingSize:cleanText(p.serving_size,80),image:cleanText(p.image_front_small_url||p.image_front_url||p.image_url,500),nutriscoreGrade:/^[a-e]$/.test(grade)?grade:'',ingredients:cleanText(p.ingredients_text,1600),allergens:Array.isArray(p.allergens_tags)?p.allergens_tags.map(normalizeAllergen).filter(Boolean).slice(0,30):[],categories:cleanText(p.categories,500),category:categoryFromProduct(p),nutrition:nutri,nutritionAvailable:Object.values(nutri).some(v=>v!=null),nutritionBasis:'100g',source:'Open Food Facts',fetchedAt:Date.now()}}
async function fetchWithTimeout(url,options={},ms=9000){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),ms);try{return await fetch(url,{...options,signal:controller.signal})}finally{clearTimeout(timer)}}
async function handler(req,res){
  if(req.method!=='GET'){res.setHeader('Allow','GET');return json(res,405,{ok:false,error:'method_not_allowed'})}
  const barcode=normalizeBarcode(req.query&&req.query.barcode)
  if(!barcode)return json(res,400,{ok:false,error:'invalid_barcode'})
  const endpoint=`https://world.openfoodfacts.org/api/${API_VERSION}/product/${encodeURIComponent(barcode)}?product_type=food&lc=de&cc=at&fields=${encodeURIComponent(FIELDS.join(','))}`
  try{
    const response=await fetchWithTimeout(endpoint,{headers:{Accept:'application/json','User-Agent':'NEST/3.0.0 (https://selfmade-v3.vercel.app)'}},9000)
    if(response.status===404)return json(res,200,{ok:true,found:false,barcode},'public, s-maxage=3600, stale-while-revalidate=86400')
    if(response.status===429)return json(res,429,{ok:false,error:'product_service_rate_limited'})
    if(!response.ok)return json(res,502,{ok:false,error:'product_service_error',status:response.status})
    const data=await response.json(),product=data&&data.product
    if(!product)return json(res,200,{ok:true,found:false,barcode},'public, s-maxage=3600, stale-while-revalidate=86400')
    return json(res,200,{ok:true,found:true,barcode,product:mapProduct(product,barcode)},'public, s-maxage=43200, stale-while-revalidate=172800')
  }catch(error){const timeout=error&&error.name==='AbortError';console.error('Open Food Facts lookup failed',error);return json(res,timeout?504:502,{ok:false,error:timeout?'product_service_timeout':'product_service_unavailable'})}
}
module.exports=handler
module.exports._test={API_VERSION,FIELDS,normalizeBarcode,nutrient,energy,nutrition,quantityInfo,categoryFromProduct,mapProduct}
