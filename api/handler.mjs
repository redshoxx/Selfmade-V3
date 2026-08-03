import { createPureVercelHandler } from '../vercel-api.mjs';
import { createSupabaseCloud, getBearerToken } from '../supabase-cloud.mjs';
import { DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_PUBLISHABLE_KEY } from '../supabase-public-config.mjs';

export const config = {
  maxDuration: 30
};

const handle = createPureVercelHandler();
const cloud = createSupabaseCloud({
  url: process.env.SUPABASE_URL ?? DEFAULT_SUPABASE_URL,
  publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY ?? DEFAULT_SUPABASE_PUBLISHABLE_KEY
});

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(payload));
}

async function handleStateVersion(req, res) {
  try {
    if (!cloud.enabled) {
      return sendJson(res, 503, { error: 'Supabase ist nicht konfiguriert.', code: 'supabase_not_configured' });
    }
    const token = getBearerToken(req);
    if (!token) return sendJson(res, 401, { error: 'Bitte zuerst anmelden.', code: 'auth_required' });
    const requestedHousehold = String(req.headers['x-selfmade-household'] || '').trim();
    const meta = await cloud.loadStateMeta(token, requestedHousehold);
    return sendJson(res, 200, meta ? {
      enabled: true,
      household_id: meta.householdId,
      version: meta.version,
      updated_at: meta.updatedAt
    } : {
      enabled: true,
      household_id: requestedHousehold || null,
      version: 0,
      updated_at: null
    });
  } catch (error) {
    console.error('[selfmade-version-check]', error);
    return sendJson(res, error.status || 500, {
      error: error.message || 'Interner Serverfehler.',
      code: error.code
    });
  }
}

export default async function handler(req, res) {
  const pathValue = Array.isArray(req.query?.path)
    ? req.query.path.join('/')
    : String(req.query?.path || '').replace(/^\/+/, '');

  let apiPath = pathValue;
  if (!apiPath) {
    const original = String(req.headers['x-vercel-original-url'] || req.headers['x-original-url'] || '');
    const match = original.match(/^\/api\/(.+?)(?:\?|$)/);
    if (match) apiPath = match[1];
  }

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query || {})) {
    if (key === 'path') continue;
    if (Array.isArray(value)) value.forEach((entry) => query.append(key, String(entry)));
    else if (value !== undefined) query.set(key, String(value));
  }

  req.url = `/api/${apiPath || 'health'}${query.size ? `?${query.toString()}` : ''}`;
  if (req.method === 'GET' && req.url.split('?')[0] === '/api/state/version') {
    return handleStateVersion(req, res);
  }
  return handle(req, res);
}
