import { queueItems, mark, queueStats } from './queue.js';
import { get, del } from './indexed-db.js';
import { replaceLocalId } from './optimistic.js';
import { uploadReceiptImage, deleteReceiptImage } from '../api/receipts.js';
import { store, setState } from '../store.js';

let running = false;

export async function flushQueue(api) {
  if (running || !navigator.onLine || !store.session?.access_token) return;
  running = true;
  try {
    for (const original of await queueItems()) {
      if (original.status === 'synced' || original.attempts >= 5) continue;
      let op = await mark(original, { status: 'syncing' });
      try {
        if (op.blob_key && op.entity === 'receipt') {
          const blob = await get('blobs', op.blob_key);
          if (!blob) throw new Error('Das zwischengespeicherte Bonbild fehlt.');
          const household = store.state?.cloud?.household_id;
          if (!household) throw new Error('Haushalt für den Bildupload fehlt.');
          const imagePath = await uploadReceiptImage(blob, store.cloud, store.session, household);
          op = await mark(op, { payload: { ...op.payload, image_path: imagePath } });
        }
        const result = await api('/api/operations/apply', {
          method: 'POST',
          body: { operation: strip(op) }
        });
        if (result.id_map && store.state) {
          setState(replaceLocalId(result.state || store.state, result.id_map.from, result.id_map.to));
        } else if (result.state) {
          setState(result.state);
        }
        await mark(op, { status: 'synced', synced_at: new Date().toISOString(), last_error: '' });
        if (op.blob_key) await del('blobs', op.blob_key);
        if (op.entity === 'receipt' && op.action === 'delete' && op.payload?.image_path) {
          try { await deleteReceiptImage(op.payload.image_path, store.cloud, store.session); }
          catch (storageError) { console.warn('[selfmade-v15] Bonbild konnte nicht gelöscht werden:', storageError.message); }
        }
        store.sync.lastSuccess = new Date().toISOString();
      } catch (error) {
        const attempts = op.attempts + 1;
        const conflict = error.status === 409;
        await mark(op, {
          status: conflict ? 'conflict' : attempts >= 5 ? 'failed' : 'pending',
          attempts,
          last_error: error.message
        });
        if (conflict) break;
      }
    }
  } finally {
    Object.assign(store.sync, await queueStats());
    running = false;
  }
}

function strip(op) {
  return {
    id: op.id,
    action: op.action,
    entity: op.entity,
    record_id: op.record_id,
    payload: op.payload,
    base_updated_at: op.base_updated_at,
    created_at: op.created_at
  };
}

export async function retryFailed() {
  for (const op of await queueItems()) {
    if (['failed', 'conflict'].includes(op.status)) {
      await mark(op, { status: 'pending', attempts: 0, last_error: '' });
    }
  }
}
