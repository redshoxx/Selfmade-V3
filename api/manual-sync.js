'use strict'
const crypto=require('node:crypto')

const TABLE=(process.env.NEST_SYNC_TABLE||'nest_manual_sync').trim()
const SUPABASE_URL=(process.env.NEST_SUPABASE_URL||'').replace(/\/$/,'')
const SERVICE_KEY=process.env.NEST_SUPABASE_SERVICE_ROLE_KEY||''

function json(res,status,body){
  res.statusCode=status
  res.setHeader('Content-Type','application/json; charset=utf-8')
  res.setHeader('Cache-Control','no-store')
  res.setHeader('Access-Control-Allow-Origin','*')
  res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers','Content-Type')
  res.end(JSON.stringify(body))
}
function hash(value){return crypto.createHash('sha256').update(String(value)).digest('hex')}
function safeId(value){return /^[a-zA-Z0-9_-]{16,100}$/.test(String(value||''))?String(value):''}
function validPayload(value){
  if(!value||typeof value!=='object'||Array.isArray(value))return false
  const core=value.core
  return !!(core&&typeof core==='object'&&Array.isArray(core.transactions)&&Array.isArray(core.goals)&&Array.isArray(core.challenges))
}
async function supabase(path,options={}){
  const response=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{
    ...options,
    headers:{
      apikey:SERVICE_KEY,
      Authorization:`Bearer ${SERVICE_KEY}`,
      'Content-Type':'application/json',
      ...(options.headers||{})
    }
  })
  const text=await response.text()
  let body=null
  try{body=text?JSON.parse(text):null}catch{body=text}
  if(!response.ok){
    const error=new Error(body?.message||body?.hint||`Supabase ${response.status}`)
    error.status=response.status
    error.details=body
    throw error
  }
  return body
}

module.exports=async function handler(req,res){
  if(req.method==='OPTIONS')return json(res,204,{})
  if(req.method!=='POST')return json(res,405,{ok:false,error:'Nur POST ist erlaubt.'})
  if(!SUPABASE_URL||!SERVICE_KEY)return json(res,503,{ok:false,error:'Die NEST-Sync-Datenbank ist noch nicht verbunden.'})
  if(!/^[a-zA-Z0-9_]{3,80}$/.test(TABLE))return json(res,500,{ok:false,error:'Ungültige Sync-Tabellenkonfiguration.'})

  try{
    const input=req.body&&typeof req.body==='object'?req.body:JSON.parse(req.body||'{}')
    const deviceId=safeId(input.deviceId)
    const deviceToken=String(input.deviceToken||'')
    const payload=input.payload
    if(!deviceId||deviceToken.length<32||deviceToken.length>180||!validPayload(payload))return json(res,400,{ok:false,error:'Ungültiger Synchronisierungsstand.'})

    const tokenHash=hash(deviceToken)
    const encoded=encodeURIComponent(deviceId)
    const existing=await supabase(`${TABLE}?device_id=eq.${encoded}&select=device_id,device_token_hash&limit=1`,{method:'GET'})
    if(Array.isArray(existing)&&existing[0]&&existing[0].device_token_hash!==tokenHash)return json(res,403,{ok:false,error:'Dieses Gerät kann diesen Datenstand nicht überschreiben.'})

    const now=new Date().toISOString()
    const row={
      device_id:deviceId,
      device_token_hash:tokenHash,
      app_version:String(payload.version||'').slice(0,30),
      payload,
      client_updated_at:String(payload.clientUpdatedAt||now).slice(0,40),
      synced_at:now
    }
    const saved=await supabase(`${TABLE}?on_conflict=device_id`,{
      method:'POST',
      headers:{Prefer:'resolution=merge-duplicates,return=representation'},
      body:JSON.stringify(row)
    })
    return json(res,200,{ok:true,syncedAt:now,syncId:Array.isArray(saved)&&saved[0]?.id?saved[0].id:null})
  }catch(error){
    console.error('manual-sync failed',error)
    return json(res,error?.status>=400&&error.status<600?error.status:500,{ok:false,error:'Synchronisierung fehlgeschlagen.'})
  }
}
