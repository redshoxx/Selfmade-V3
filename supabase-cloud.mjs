const jsonHeaders = { 'content-type': 'application/json' };

function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/$/, '');
}

async function readJson(response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return { message: text }; }
}

function apiError(response, payload) {
  const code = String(payload?.code || '').toUpperCase();
  const rawMessage = payload?.msg || payload?.message || payload?.error_description || payload?.error || `Supabase-Fehler ${response.status}`;
  const ambiguousBootstrap = code === '42702'
    && /household_id/i.test(String(rawMessage))
    && /ambiguous/i.test(String(rawMessage));
  const migrationMissing = ['PGRST202', 'PGRST204', 'PGRST205', '42P01', '42883'].includes(code)
    || /selfmade_(households|household_states|bootstrap|update_state)/i.test(String(rawMessage))
      && /(not found|could not find|does not exist|schema cache)/i.test(String(rawMessage));
  const message = ambiguousBootstrap
    ? 'Die installierte Supabase-Funktion ist veraltet. Führe die Hotfix-Datei supabase/migrations/20260803_fix_bootstrap_household_id_ambiguity.sql im Supabase SQL Editor aus.'
    : migrationMissing
      ? 'Die Selfmade-Datenbank ist in Supabase noch nicht eingerichtet. Führe die Datei supabase/migrations/20260803_selfmade_cloud.sql im Supabase SQL Editor aus.'
      : rawMessage;
  const error = new Error(message);
  error.status = ambiguousBootstrap || migrationMissing ? 503 : response.status;
  error.code = ambiguousBootstrap ? 'migration_hotfix_required' : migrationMissing ? 'migration_required' : code || undefined;
  error.payload = payload;
  return error;
}

export function getBearerToken(req) {
  const value = String(req.headers.authorization || '');
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || '';
}

export function createSupabaseCloud(options = {}) {
  const url = normalizeBaseUrl(options.url);
  const publishableKey = String(options.publishableKey || '').trim();
  const enabled = Boolean(url && publishableKey);

  async function request(endpoint, { method = 'GET', token = '', body, headers = {} } = {}) {
    if (!enabled) throw Object.assign(new Error('Supabase ist nicht konfiguriert.'), { status: 503 });
    const response = await fetch(`${url}${endpoint}`, {
      method,
      headers: {
        apikey: publishableKey,
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(body === undefined ? {} : jsonHeaders),
        ...headers
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const payload = await readJson(response);
    if (!response.ok) throw apiError(response, payload);
    return { response, payload };
  }

  async function signUp({ email, password, displayName }) {
    const { payload } = await request('/auth/v1/signup', {
      method: 'POST',
      body: {
        email,
        password,
        data: { display_name: displayName || email.split('@')[0] }
      }
    });
    return payload;
  }

  async function signIn({ email, password }) {
    const { payload } = await request('/auth/v1/token?grant_type=password', {
      method: 'POST',
      body: { email, password }
    });
    return payload;
  }

  async function refresh(refreshToken) {
    const { payload } = await request('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      body: { refresh_token: refreshToken }
    });
    return payload;
  }

  async function signOut(token) {
    const { payload } = await request('/auth/v1/logout', { method: 'POST', token });
    return payload || { ok: true };
  }

  async function getUser(token) {
    const { payload } = await request('/auth/v1/user', { token });
    return payload;
  }

  async function listHouseholds(token) {
    const { payload } = await request('/rest/v1/selfmade_households?select=id,name,owner_id,created_at,updated_at&order=created_at.asc', {
      token,
      headers: { accept: 'application/json' }
    });
    return Array.isArray(payload) ? payload : [];
  }

  async function loadStateRows(token, householdId = '') {
    const filter = householdId ? `&household_id=eq.${encodeURIComponent(householdId)}` : '&order=updated_at.desc&limit=1';
    const { payload } = await request(`/rest/v1/selfmade_household_states?select=household_id,version,data,updated_at${filter}`, {
      token,
      headers: { accept: 'application/json' }
    });
    return Array.isArray(payload) ? payload : [];
  }

  async function bootstrap(token, { displayName, householdName, initialState }) {
    const { payload } = await request('/rest/v1/rpc/selfmade_bootstrap', {
      method: 'POST',
      token,
      body: {
        p_display_name: displayName || 'Selfmade',
        p_household_name: householdName || 'Mein Haushalt',
        p_initial_state: initialState
      }
    });
    const row = Array.isArray(payload) ? payload[0] : payload;
    if (!row) throw Object.assign(new Error('Supabase-Haushalt konnte nicht initialisiert werden.'), { status: 500 });
    return {
      householdId: row.household_id,
      householdName: row.household_name,
      version: Number(row.state_version),
      data: row.state_data,
      updatedAt: row.state_updated_at
    };
  }

  async function loadOrBootstrap(token, { householdId = '', initialState, displayName, householdName }) {
    let rows = await loadStateRows(token, householdId);
    if (!rows.length && householdId) rows = await loadStateRows(token, '');
    if (!rows.length) return bootstrap(token, { displayName, householdName, initialState });
    const row = rows[0];
    const households = await listHouseholds(token);
    const household = households.find((item) => item.id === row.household_id);
    return {
      householdId: row.household_id,
      householdName: household?.name || householdName || 'Mein Haushalt',
      version: Number(row.version),
      data: row.data,
      updatedAt: row.updated_at
    };
  }

  async function saveState(token, { householdId, expectedVersion, state }) {
    try {
      const { payload } = await request('/rest/v1/rpc/selfmade_update_state', {
        method: 'POST',
        token,
        body: {
          p_household_id: householdId,
          p_expected_version: expectedVersion,
          p_state: state
        }
      });
      const row = Array.isArray(payload) ? payload[0] : payload;
      if (!row) throw new Error('Supabase hat keine Versionsnummer zurückgegeben.');
      return { version: Number(row.state_version), updatedAt: row.state_updated_at };
    } catch (error) {
      const text = `${error.message} ${JSON.stringify(error.payload || {})}`.toLowerCase();
      if (text.includes('version_conflict') || error.payload?.code === '40001') {
        throw Object.assign(new Error('Die Daten wurden auf einem anderen Gerät geändert. Bitte neu laden.'), { status: 409, code: 'version_conflict' });
      }
      throw error;
    }
  }

  return {
    enabled,
    url,
    signUp,
    signIn,
    refresh,
    signOut,
    getUser,
    listHouseholds,
    loadOrBootstrap,
    saveState
  };
}
