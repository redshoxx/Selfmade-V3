'use strict'

const CATEGORIES=['Lebensmittel','Wohnen','Mobilität','Freizeit','Shopping','Gesundheit','Haushalt','Abos & Verträge','Sparen','Sonstiges','Gehalt','Bonus','Verkauf','Rückzahlung','Geschenk']
const MAX_DATA_URL=8*1024*1024

function cors(res){res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');res.setHeader('Cache-Control','no-store')}
function clean(v,max=120){return String(v==null?'':v).replace(/\s+/g,' ').trim().slice(0,max)}
function validDate(v){const s=String(v||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return'';const d=new Date(`${s}T12:00:00`);return Number.isFinite(d.getTime())?s:''}
function validImage(value){return typeof value==='string'&&value.length<=MAX_DATA_URL&&/^data:image\/(?:png|jpe?g|webp);base64,[A-Za-z0-9+/=\r\n]+$/i.test(value)}
function outputText(data){if(typeof data?.output_text==='string'&&data.output_text.trim())return data.output_text.trim();const parts=[];for(const item of data?.output||[]){for(const c of item?.content||[]){if(c?.type==='output_text'&&typeof c.text==='string')parts.push(c.text)}}return parts.join('\n').trim()}
function normalize(x){x=x&&typeof x==='object'?x:{};const amount=Math.round(Math.max(0,Number(x.amount)||0)*100)/100;const category=CATEGORIES.includes(x.category)?x.category:'Sonstiges';const type=x.type==='income'?'income':'expense';return{recognized:Boolean(x.recognized)&&amount>0,title:clean(x.title||'Buchung',100),amount,type,date:validDate(x.date),category,currency:clean(x.currency||'EUR',8).toUpperCase(),confidence:Math.max(0,Math.min(1,Number(x.confidence)||0)),note:clean(x.note||'',180)}}

module.exports=async function handler(req,res){
  cors(res)
  if(req.method==='OPTIONS')return res.status(204).end()
  if(req.method!=='POST')return res.status(405).json({ok:false,error:'method_not_allowed'})
  const image=req.body&&typeof req.body==='object'?req.body.image:null
  if(!validImage(image))return res.status(400).json({ok:false,error:'invalid_image'})
  const apiKey=process.env.OPENAI_API_KEY
  if(!apiKey)return res.status(503).json({ok:false,error:'screenshot_ai_not_configured'})
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),40000)
  try{
    const model=process.env.OPENAI_SCREENSHOT_MODEL||'gpt-5-mini'
    const prompt=`Du liest einen Screenshot einer Bank-, Karten- oder Wallet-Buchung für eine österreichische Finanz-App aus. Extrahiere genau eine sichtbare Buchung. Nutze den tatsächlich abgebuchten/erhaltenen Betrag, nicht Kontostand oder verfügbaren Betrag. title soll Händler, Empfänger oder eine kurze Buchungsbezeichnung sein. type ist expense bei Abbuchung/Zahlung und income bei Gutschrift/Eingang. date im Format YYYY-MM-DD; falls kein Datum sicher erkennbar ist, leere Zeichenkette. Wähle category exakt aus: ${CATEGORIES.join(', ')}. currency normalerweise EUR; falls sichtbar eine andere Währung. confidence zwischen 0 und 1. recognized=false, wenn keine eindeutige Buchung erkennbar ist. note nur für eine kurze wichtige Zusatzinfo, sonst leer.`
    const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({model,store:false,input:[{role:'user',content:[{type:'input_text',text:prompt},{type:'input_image',image_url:image,detail:'high'}]}],text:{format:{type:'json_schema',name:'nest_screenshot_transaction',strict:true,schema:{type:'object',additionalProperties:false,properties:{recognized:{type:'boolean'},title:{type:'string'},amount:{type:'number'},type:{type:'string',enum:['expense','income']},date:{type:'string'},category:{type:'string',enum:CATEGORIES},currency:{type:'string'},confidence:{type:'number'},note:{type:'string'}},required:['recognized','title','amount','type','date','category','currency','confidence','note']}}}})})
    const raw=await response.json().catch(()=>null)
    if(!response.ok){console.error('Screenshot AI failed',response.status,raw?.error?.type||raw?.error?.code||'unknown');return res.status(502).json({ok:false,error:'screenshot_ai_failed'})}
    const text=outputText(raw)
    let parsed
    try{parsed=JSON.parse(text)}catch{console.error('Screenshot AI invalid JSON');return res.status(502).json({ok:false,error:'invalid_ai_result'})}
    const transaction=normalize(parsed)
    if(!transaction.recognized)return res.status(422).json({ok:false,error:'transaction_not_recognized'})
    return res.status(200).json({ok:true,transaction,model})
  }catch(error){
    if(error?.name==='AbortError')return res.status(504).json({ok:false,error:'screenshot_ai_timeout'})
    console.error('Screenshot transaction error',error?.message||error)
    return res.status(500).json({ok:false,error:'screenshot_ai_error'})
  }finally{clearTimeout(timer)}
}

module.exports._test={CATEGORIES,validImage,validDate,outputText,normalize}
