import{all,put}from'./indexed-db.js';import{uuid,localId}from'../utils/ids.js';
export async function enqueue({entity,action,recordId,payload,baseUpdatedAt='',blobKey=''}){const op={id:uuid(),action,entity,record_id:recordId??(action==='create'?localId():null),payload,base_updated_at:baseUpdatedAt,created_at:new Date().toISOString(),status:'pending',attempts:0,last_error:'',blob_key:blobKey};await put('operations',op);return op}
export async function queueItems(){return(await all('operations')).sort((a,b)=>a.created_at.localeCompare(b.created_at))}
export async function queueStats(){const rows=await queueItems();return{pending:rows.filter(r=>['pending','syncing'].includes(r.status)).length,failed:rows.filter(r=>r.status==='failed').length,conflicts:rows.filter(r=>r.status==='conflict').length}}
export async function mark(op,patch){const next={...op,...patch};await put('operations',next);return next}
