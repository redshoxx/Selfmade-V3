import { createPureVercelHandler } from '../vercel-api.mjs';
import { createSupabaseCloud, getBearerToken } from '../supabase-cloud.mjs';
import { DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_PUBLISHABLE_KEY } from '../supabase-public-config.mjs';

export const config = {
  maxDuration: 30
};

const REQUIRED_SUPABASE_PROJECT_REF = 'dpqhoesiniberglymdtb';

function projectRefFromUrl(value) {
  try {
    const hostname = new URL(String(value || '').trim()).hostname;
    return hostname.endsWith('.supabase.co') ? hostname.slice(0, -'.supabase.co'.length) : '';
  } catch {
    return '';
  }
}

const environmentUrl = String(process.env.SUPABASE_URL || '').trim();
const environmentPublishableKey = String(process.env.SUPABASE_PUBLISHABLE_KEY || '').trim();
const validEnvironmentOverride = projectRefFromUrl(environmentUrl) === REQUIRED_SUPABASE_PROJECT_REF
  && environmentPublishableKey.startsWith('sb_publishable_');

const supabaseUrl = validEnvironmentOverride ? environmentUrl : DEFAULT_SUPABASE_URL;
const supabasePublishableKey = validEnvironmentOverride
  ? environmentPublishableKey
  : DEFAULT_SUPABASE_PUBLISHABLE_KEY;
const supabaseConfigSource = validEnvironmentOverride
  ? 'vercel-environment'
  : environmentUrl
    ? 'repository-default-stale-environment-ignored'
    : 'repository-default';

const handle = createPureVercelHandler({
  supabaseUrl,
  supabasePublishableKey
});
const cloud = createSupabaseCloud({
  url: supabaseUrl,
  publishableKey: supabasePublishableKey
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
  const pathname = req.url.split('?')[0];

  if (req.method === 'GET' && pathname === '/api/cloud/config') {
    return sendJson(res, 200, {
      enabled: cloud.enabled,
      storage: cloud.enabled ? 'supabase' : 'unconfigured',
      project_ref: projectRefFromUrl(supabaseUrl) || null,
      config_source: supabaseConfigSource
    });
  }
  if (req.method === 'GET' && pathname === '/api/state/version') {
    return handleStateVersion(req, res);
  }
  return handle(req, res);
}
