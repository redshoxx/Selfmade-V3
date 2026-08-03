const JSON_HEADERS = { 'content-type': 'application/json' };

function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/$/, '');
}
async function readJson(response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return { message: text }; }
}
function errorFrom(response, payload) {
  const message = payload?.msg || payload?.message || payload?.error_description || payload?.error || `Supabase-Fehler ${response.status}`;
  const error = new Error(message);
  error.status = response.status;
  error.code = payload?.code;
  error.payload = payload;
  return error;
}
export function getBearerToken(req) {
  const value = String(req.headers?.authorization || '');
  return value.match(/^Bearer\s+(.+)$/i)?.[1] || '';
}

export function createSupabaseCloud({ url, publishableKey } = {}) {
  const baseUrl = normalizeBaseUrl(url);
  const key = String(publishableKey || '').trim();
  const enabled = Boolean(baseUrl && key);

  async function request(endpoint, { method = 'GET', token = '', body, headers = {}, signal } = {}) {
    if (!enabled) throw Object.assign(new Error('Supabase ist nicht konfiguriert.'), { status: 503 });
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers: {
        apikey: key,
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(body === undefined ? {} : JSON_HEADERS),
        ...headers
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal
    });
    const payload = await readJson(response);
    if (!response.ok) throw errorFrom(response, payload);
    return { response, payload };
  }

  const auth = {
    async signUp({ email, password, displayName }) {
      return (await request('/auth/v1/signup', { method: 'POST', body: { email, password, data: { display_name: displayName || email.split('@')[0] } } })).payload;
    },
    async signIn({ email, password }) {
      return (await request('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } })).payload;
    },
    async refresh(refreshToken) {
      return (await request('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: refreshToken } })).payload;
    },
    async signOut(token) {
      return (await request('/auth/v1/logout', { method: 'POST', token })).payload || { ok: true };
    },
    async resetPassword(email, redirectTo = '') {
      return (await request('/auth/v1/recover', { method: 'POST', body: { email, ...(redirectTo ? { gotrue_meta_security: { captcha_token: '' }, redirect_to: redirectTo } : {}) } })).payload || { ok: true };
    },
    async user(token) {
      return (await request('/auth/v1/user', { token })).payload;
    }
  };

  async function listHouseholds(token) {
    const { payload } = await request('/rest/v1/selfmade_households?select=id,name,owner_id,created_at,updated_at&order=created_at.asc', { token, headers: { accept: 'application/json' } });
    return Array.isArray(payload) ? payload : [];
  }
  async function loadStateRows(token, householdId = '') {
    const filter = householdId ? `&household_id=eq.${encodeURIComponent(householdId)}` : '&order=updated_at.desc&limit=1';
    const { payload } = await request(`/rest/v1/selfmade_household_states?select=household_id,version,data,updated_at${filter}`, { token, headers: { accept: 'application/json' } });
    return Array.isArray(payload) ? payload : [];
  }
  async function bootstrap(token, { displayName, householdName, initialState }) {
    const { payload } = await request('/rest/v1/rpc/selfmade_bootstrap', {
      method: 'POST', token,
      body: { p_display_name: displayName || 'Selfmade', p_household_name: householdName || 'Mein Haushalt', p_initial_state: initialState }
    });
    const row = Array.isArray(payload) ? payload[0] : payload;
    if (!row) throw Object.assign(new Error('Supabase-Haushalt konnte nicht initialisiert werden.'), { status: 500 });
    return { householdId: row.household_id, householdName: row.household_name, version: Number(row.state_version), data: row.state_data, updatedAt: row.state_updated_at };
  }
  async function loadOrBootstrap(token, { householdId = '', initialState, displayName, householdName }) {
    let rows = await loadStateRows(token, householdId);
    if (!rows.length && householdId) rows = await loadStateRows(token, '');
    if (!rows.length) return bootstrap(token, { displayName, householdName, initialState });
    const row = rows[0];
    const households = await listHouseholds(token);
    const household = households.find((item) => item.id === row.household_id);
    return { householdId: row.household_id, householdName: household?.name || householdName || 'Mein Haushalt', version: Number(row.version), data: row.data, updatedAt: row.updated_at };
  }
  async function saveState(token, { householdId, expectedVersion, state }) {
    try {
      const { payload } = await request('/rest/v1/rpc/selfmade_update_state', {
        method: 'POST', token,
        body: { p_household_id: householdId, p_expected_version: expectedVersion, p_state: state }
      });
      const row = Array.isArray(payload) ? payload[0] : payload;
      if (!row) throw new Error('Supabase hat keine Versionsnummer zurückgegeben.');
      return { version: Number(row.state_version), updatedAt: row.state_updated_at };
    } catch (error) {
      const detail = `${error.message} ${JSON.stringify(error.payload || {})}`.toLowerCase();
      if (detail.includes('version_conflict') || error.payload?.code === '40001') throw Object.assign(new Error('Versionskonflikt.'), { status: 409, code: 'version_conflict' });
      throw error;
    }
  }

  return { enabled, url: baseUrl, publishableKey: key, request, auth, listHouseholds, loadOrBootstrap, saveState };
}
