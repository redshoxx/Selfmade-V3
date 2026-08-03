export async function resolveConflict(api,id,choice){return api('/api/conflicts/resolve',{method:'POST',body:{conflict_id:id,choice}})}
