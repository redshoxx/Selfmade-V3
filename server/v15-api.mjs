import { randomUUID } from 'node:crypto';
import {
  applyOperation,
  checkout,
  emptyBackup,
  getState,
  importReceipt,
  isoDate,
  normalizeBackup,
  parseReceiptText,
  statusError,
  validateBackupForImport
} from './state-engine.mjs';
import { createSupabaseCloud, getBearerToken } from './supabase-cloud.mjs';
import { DEFAULT_SUPABASE_PUBLISHABLE_KEY, DEFAULT_SUPABASE_URL, RECEIPT_BUCKET } from './public-config.mjs';

const MAX_JSON_BODY = 1_500_000;
let localBackup = emptyBackup();
let localVersion = 1;

function sendJson(res, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
    ...extraHeaders
  };
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    for (const [key, value] of Object.entries(extraHeaders)) res.setHeader?.(key, value);
    return res.status(status).json(payload);
  }
  res.writeHead(status, headers);
  res.end(body);
}
function noContent(res) {
  if (typeof res.status === 'function') return res.status(204).end();
  res.writeHead(204, { 'cache-control': 'no-store' });
  res.end();
}
async function readBody(req, maxBytes = MAX_JSON_BODY) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') {
    if (Buffer.byteLength(req.body) > maxBytes) throw statusError(413, 'Anfrage ist zu groß.');
    try { return JSON.parse(req.body); } catch { throw statusError(400, 'Ungültiges JSON.'); }
  }
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) throw statusError(413, 'Anfrage ist zu groß.');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw statusError(400, 'Ungültiges JSON.'); }
}
function routeId(pathname, prefix) {
  if (!pathname.startsWith(prefix)) return null;
  const raw = pathname.slice(prefix.length);
  return /^\d+$/.test(raw) ? Number(raw) : null;
}
function uuidOperation(entity, action, recordId, payload, baseUpdatedAt = '') {
  return { id: randomUUID(), entity, action, record_id: recordId, payload, base_updated_at: baseUpdatedAt, created_at: new Date().toISOString() };
}
function authRequired(token) {
  if (!token) throw statusError(401, 'Bitte anmelden.');
}
function cloudMeta(snapshot) {
  return { household_id: snapshot.householdId, household_name: snapshot.householdName, version: snapshot.version, updated_at: snapshot.updatedAt };
}

function createRuntimeCloud() {
  if (process.env.SELFMADE_STORAGE === 'memory') return createSupabaseCloud({ url: '', publishableKey: '' });
  const url = process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || DEFAULT_SUPABASE_PUBLISHABLE_KEY;
  return createSupabaseCloud({ url, publishableKey });
}

async function loadSnapshot(cloud, token, householdId = '') {
  if (!cloud.enabled) return { householdId: 'local', householdName: localBackup.tables.settings[0]?.household_name || 'Lokal', version: localVersion, data: normalizeBackup(localBackup), updatedAt: new Date().toISOString() };
  authRequired(token);
  const user = await cloud.auth.user(token);
  return cloud.loadOrBootstrap(token, {
    householdId,
    initialState: emptyBackup(),
    displayName: user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Selfmade',
    householdName: user?.user_metadata?.household_name || 'Mein Haushalt'
  });
}
async function saveSnapshot(cloud, token, snapshot, backup) {
  if (!cloud.enabled) {
    localBackup = normalizeBackup(backup);
    localVersion += 1;
    return { version: localVersion, updatedAt: new Date().toISOString() };
  }
  return cloud.saveState(token, { householdId: snapshot.householdId, expectedVersion: snapshot.version, state: backup });
}
async function mutateSnapshot({ cloud, token, householdId, operation, mutator }) {
  let attempts = 0;
  while (attempts < 3) {
    attempts += 1;
    const snapshot = await loadSnapshot(cloud, token, householdId);
    let backup = normalizeBackup(snapshot.data);
    let mutation;
    try {
      mutation = operation ? applyOperation(backup, operation) : await mutator(backup);
      backup = mutation.backup || backup;
    } catch (error) {
      if (error.backup && error.status === 409) {
        try { await saveSnapshot(cloud, token, snapshot, error.backup); } catch {}
      }
      throw error;
    }
    try {
      const saved = await saveSnapshot(cloud, token, snapshot, backup);
      const meta = { household_id: snapshot.householdId, household_name: snapshot.householdName, version: saved.version, updated_at: saved.updatedAt };
      return { ...mutation, backup, cloud: meta, state: getState(backup, meta) };
    } catch (error) {
      if (error.code !== 'version_conflict' || attempts >= 3) throw error;
    }
  }
  throw statusError(409, 'Synchronisierungskonflikt. Bitte erneut versuchen.', 'version_conflict');
}

function mapEntity(pathname) {
  const definitions = [
    ['/api/members/', 'member'], ['/api/budgets/', 'budget'], ['/api/transactions/', 'transaction'],
    ['/api/recurring/', 'recurring'], ['/api/shopping/', 'shopping'], ['/api/pantry/', 'pantry'],
    ['/api/notes/', 'note'], ['/api/catalog/', 'catalog'], ['/api/receipts/', 'receipt']
  ];
  for (const [prefix, entity] of definitions) {
    const id = routeId(pathname, prefix);
    if (id) return { entity, id };
  }
  return null;
}
function collectionEntity(pathname) {
  return ({
    '/api/members': 'member', '/api/budgets': 'budget', '/api/transactions': 'transaction',
    '/api/recurring': 'recurring', '/api/shopping': 'shopping', '/api/pantry': 'pantry',
    '/api/notes': 'note', '/api/catalog': 'catalog'
  })[pathname] || '';
}

async function lookupOpenFoodFacts(barcode) {
  if (!/^\d{6,64}$/.test(barcode)) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);
  try {
    const fields = 'product_name,product_name_de,brands,quantity,categories_tags';
    const response = await fetch(`https://world.openfoodfacts.org/api/v3/product/${encodeURIComponent(barcode)}?fields=${fields}`, { headers: { 'user-agent': 'Selfmade/15.0' }, signal: controller.signal });
    if (!response.ok) return null;
    const product = (await response.json())?.product;
    const name = String(product?.product_name_de || product?.product_name || '').trim();
    if (!name) return null;
    const tags = Array.isArray(product?.categories_tags) ? product.categories_tags.join(' ').toLowerCase() : '';
    const category = /dair|milk|yogurt|cheese|butter/.test(tags) ? 'Kühlregal'
      : /bread|bakery|pastr/.test(tags) ? 'Backwaren'
        : /fruit|vegetable/.test(tags) ? 'Obst & Gemüse'
          : /frozen/.test(tags) ? 'Tiefkühl' : 'Vorrat';
    return { barcode, name: name.slice(0, 80), brand: String(product?.brands || '').slice(0, 60), category, default_quantity: String(product?.quantity || '1').slice(0, 30), last_price: null, source: 'openfoodfacts' };
  } catch { return null; } finally { clearTimeout(timer); }
}

function resolveConflict(backup, conflictId, choice) {
  const conflict = backup.tables.sync_conflicts.find((row) => row.id === conflictId);
  if (!conflict) throw statusError(404, 'Konflikt nicht gefunden.');
  if (!['cloud', 'local', 'both'].includes(choice)) throw statusError(400, 'Ungültige Konfliktentscheidung.');
  conflict.status = 'resolved';
  conflict.resolution = choice;
  conflict.resolved_at = new Date().toISOString();
  if (choice === 'local') {
    const applied = applyOperation(backup, { id: randomUUID(), entity: conflict.entity, action: 'update', record_id: conflict.record_id, payload: conflict.local_record, base_updated_at: '' });
    return { backup: applied.backup, result: conflict };
  }
  if (choice === 'both' && ['note', 'shopping', 'pantry'].includes(conflict.entity)) {
    const applied = applyOperation(backup, { id: randomUUID(), entity: conflict.entity, action: 'create', record_id: `local-${randomUUID()}`, payload: { ...conflict.local_record, title: conflict.local_record.title ? `${conflict.local_record.title} (lokal)` : undefined, name: conflict.local_record.name ? `${conflict.local_record.name} (lokal)` : undefined } });
    return { backup: applied.backup, result: conflict };
  }
  return { backup, result: conflict };
}

export function createV15Handler() {
  const cloud = createRuntimeCloud();
  return async function handler(req, res) {
    const method = String(req.method || 'GET').toUpperCase();
    const url = new URL(req.url || '/', 'http://localhost');
    const pathname = url.pathname;
    const token = getBearerToken(req);
    const householdId = String(req.headers?.['x-selfmade-household'] || '');

    try {
      if (method === 'OPTIONS') return noContent(res);
      if (pathname === '/api/health') return sendJson(res, 200, { ok: true, version: '15.0.0', storage: cloud.enabled ? 'supabase' : 'memory', time: new Date().toISOString() });
      if (pathname === '/api/cloud/config') return sendJson(res, 200, { enabled: cloud.enabled, storage: cloud.enabled ? 'supabase' : 'memory', url: cloud.url, publishable_key: cloud.publishableKey, receipt_bucket: RECEIPT_BUCKET, realtime_table: 'selfmade_household_states', version: '15.0.0' });

      if (pathname === '/api/auth/signup' && method === 'POST') {
        const body = await readBody(req, 50_000);
        return sendJson(res, 200, await cloud.auth.signUp({ email: String(body.email || '').trim(), password: String(body.password || ''), displayName: String(body.display_name || '').trim() }));
      }
      if (pathname === '/api/auth/signin' && method === 'POST') {
        const body = await readBody(req, 50_000);
        return sendJson(res, 200, await cloud.auth.signIn({ email: String(body.email || '').trim(), password: String(body.password || '') }));
      }
      if (pathname === '/api/auth/refresh' && method === 'POST') {
        const body = await readBody(req, 50_000);
        return sendJson(res, 200, await cloud.auth.refresh(String(body.refresh_token || '')));
      }
      if (pathname === '/api/auth/signout' && method === 'POST') {
        authRequired(token);
        await cloud.auth.signOut(token);
        return sendJson(res, 200, { ok: true });
      }
      if (pathname === '/api/auth/password-reset' && method === 'POST') {
        const body = await readBody(req, 50_000);
        await cloud.auth.resetPassword(String(body.email || '').trim(), String(body.redirect_to || ''));
        return sendJson(res, 200, { ok: true });
      }

      if (pathname === '/api/state' && method === 'GET') {
        const snapshot = await loadSnapshot(cloud, token, householdId);
        const meta = cloudMeta(snapshot);
        return sendJson(res, 200, getState(snapshot.data, meta), { etag: `W/"selfmade-${snapshot.version}"` });
      }
      if (pathname === '/api/export' && method === 'GET') {
        const snapshot = await loadSnapshot(cloud, token, householdId);
        return sendJson(res, 200, { ...normalizeBackup(snapshot.data), exported_at: new Date().toISOString(), selfmade_version: '15.0.0' });
      }
      if (pathname === '/api/import' && method === 'POST') {
        const body = await readBody(req, 5_200_000);
        const replacement = validateBackupForImport(body);
        const result = await mutateSnapshot({ cloud, token, householdId, mutator: () => ({ backup: replacement }) });
        return sendJson(res, 200, result.state);
      }
      if (pathname === '/api/reset' && method === 'POST') {
        const result = await mutateSnapshot({ cloud, token, householdId, mutator: () => ({ backup: emptyBackup() }) });
        return sendJson(res, 200, result.state);
      }

      if (pathname === '/api/operations/apply' && method === 'POST') {
        const body = await readBody(req);
        const result = await mutateSnapshot({ cloud, token, householdId, operation: body.operation || body });
        return sendJson(res, 200, { state: result.state, duplicate: result.duplicate, id_map: result.id_map, operation_id: (body.operation || body).id });
      }
      if (pathname === '/api/conflicts/resolve' && method === 'POST') {
        const body = await readBody(req, 100_000);
        const result = await mutateSnapshot({ cloud, token, householdId, mutator: (backup) => resolveConflict(backup, String(body.conflict_id || ''), String(body.choice || 'cloud')) });
        return sendJson(res, 200, { state: result.state });
      }

      if (pathname === '/api/receipts/parse' && method === 'POST') {
        const body = await readBody(req, 200_000);
        return sendJson(res, 200, parseReceiptText(body.ocr_text));
      }
      if (pathname === '/api/receipts' && method === 'POST') {
        const body = await readBody(req);
        const operation = uuidOperation('receipt', 'create', `local-${randomUUID()}`, body);
        const result = await mutateSnapshot({ cloud, token, householdId, operation });
        return sendJson(res, 201, { state: result.state, receipt: result.result });
      }
      const receiptId = routeId(pathname, '/api/receipts/');
      if (receiptId && method === 'PATCH') {
        const body = await readBody(req);
        const result = await mutateSnapshot({ cloud, token, householdId, operation: uuidOperation('receipt', 'update', receiptId, body, String(body.base_updated_at || '')) });
        return sendJson(res, 200, { state: result.state, receipt: result.result });
      }
      if (receiptId && method === 'DELETE') {
        const result = await mutateSnapshot({ cloud, token, householdId, operation: uuidOperation('receipt', 'delete', receiptId, {}) });
        return sendJson(res, 200, result.state);
      }

      if (pathname === '/api/checkout' && method === 'POST') {
        const body = await readBody(req);
        const result = await mutateSnapshot({ cloud, token, householdId, mutator: (backup) => checkout(backup, body) });
        return sendJson(res, 200, { state: result.state, total: result.total, count: result.count });
      }

      if (pathname === '/api/challenge' && method === 'POST') {
        const body = await readBody(req);
        const result = await mutateSnapshot({ cloud, token, householdId, operation: uuidOperation('challenge', 'create', 1, body) });
        return sendJson(res, 201, result.state);
      }
      if (pathname === '/api/challenge/complete' && method === 'POST') {
        const body = await readBody(req);
        const result = await mutateSnapshot({ cloud, token, householdId, operation: uuidOperation('challenge', 'complete', 1, body) });
        return sendJson(res, 200, result.state);
      }
      if (pathname === '/api/challenge' && method === 'PATCH') {
        const body = await readBody(req);
        const result = await mutateSnapshot({ cloud, token, householdId, operation: uuidOperation('challenge', 'update', 1, body) });
        return sendJson(res, 200, result.state);
      }
      if (pathname === '/api/challenge' && method === 'DELETE') {
        const result = await mutateSnapshot({ cloud, token, householdId, operation: uuidOperation('challenge', 'reset', 1, {}) });
        return sendJson(res, 200, result.state);
      }

      if (pathname === '/api/settings' && method === 'PATCH') {
        const body = await readBody(req);
        const snapshot = await loadSnapshot(cloud, token, householdId);
        const current = normalizeBackup(snapshot.data).tables.settings[0];
        const result = await mutateSnapshot({ cloud, token, householdId, operation: uuidOperation('settings', 'update', 1, body, String(body.base_updated_at || current.updated_at || '')) });
        return sendJson(res, 200, result.state);
      }

      if (pathname === '/api/catalog/lookup' && method === 'GET') {
        const barcode = String(url.searchParams.get('barcode') || '').trim().slice(0, 64);
        const snapshot = await loadSnapshot(cloud, token, householdId);
        const backup = normalizeBackup(snapshot.data);
        const local = backup.tables.product_catalog.find((row) => row.barcode === barcode);
        if (local) return sendJson(res, 200, { product: local, source: 'local' });
        const external = await lookupOpenFoodFacts(barcode);
        if (!external) return sendJson(res, 200, { product: null, source: 'none' });
        const result = await mutateSnapshot({ cloud, token, householdId, operation: uuidOperation('catalog', 'create', `local-${randomUUID()}`, external) });
        return sendJson(res, 200, { product: result.result, source: 'openfoodfacts' });
      }

      const entityMatch = mapEntity(pathname);
      if (entityMatch && ['PATCH', 'DELETE'].includes(method)) {
        const body = method === 'PATCH' ? await readBody(req) : {};
        const result = await mutateSnapshot({ cloud, token, householdId, operation: uuidOperation(entityMatch.entity, method === 'PATCH' ? 'update' : 'delete', entityMatch.id, body, String(body.base_updated_at || '')) });
        return sendJson(res, 200, result.state);
      }
      const entity = collectionEntity(pathname);
      if (entity && method === 'POST') {
        const body = await readBody(req);
        const result = await mutateSnapshot({ cloud, token, householdId, operation: uuidOperation(entity, 'create', `local-${randomUUID()}`, body) });
        return sendJson(res, 201, result.state);
      }

      return sendJson(res, 404, { error: 'Route nicht gefunden.' });
    } catch (error) {
      const status = Number(error.status) || 500;
      if (status >= 500) console.error('[selfmade-v15]', error);
      return sendJson(res, status, { error: error.message || 'Interner Fehler.', code: error.code || undefined, conflict: error.conflict || undefined, duplicate: error.duplicate || undefined });
    }
  };
}
