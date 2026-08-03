const shell = document.querySelector('#app-shell');
const dialogRoot = document.querySelector('#dialog-root');
const toastRoot = document.querySelector('#toast-root');

const tabs = ['start', 'money', 'shopping', 'pantry', 'notes'];
const shortcutTab = location.hash ? location.hash.slice(1) : '';
let activeTab = tabs.includes(shortcutTab) ? shortcutTab : (tabs.includes(localStorage.getItem('selfmade-tab')) ? localStorage.getItem('selfmade-tab') : 'start');
let data = null;
let pantryFilter = 'expiry';
let noteQuery = '';
let moneyMode = 'month';
let busy = false;
let scannerStream = null;
let scannerTimer = null;
let receiptImageData = '';
const toastActions = new Map();
let storeMode = {
  active: false,
  categoryIndex: 0,
  checkout: false,
  prices: new Map()
};

let cloudConfig = { enabled: false, storage: 'sqlite' };
let authSession = (() => {
  try { return JSON.parse(localStorage.getItem('selfmade-auth-session') || 'null'); } catch { return null; }
})();
let authMode = 'signin';
let cloudPollBusy = false;

function saveAuthSession(payload) {
  if (!payload?.access_token) return;
  authSession = {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    token_type: payload.token_type || 'bearer',
    expires_at: Date.now() + Math.max(30, Number(payload.expires_in || 3600)) * 1000,
    user: payload.user || authSession?.user || null
  };
  localStorage.setItem('selfmade-auth-session', JSON.stringify(authSession));
}

function clearAuthSession() {
  authSession = null;
  localStorage.removeItem('selfmade-auth-session');
  localStorage.removeItem('selfmade-cloud-household');
}

function cloudHeaders() {
  const headers = {};
  if (authSession?.access_token) headers.authorization = `Bearer ${authSession.access_token}`;
  const household = localStorage.getItem('selfmade-cloud-household');
  if (household) headers['x-selfmade-household'] = household;
  return headers;
}

async function refreshAuthSession() {
  if (!authSession?.refresh_token) throw Object.assign(new Error('Sitzung abgelaufen.'), { status: 401 });
  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refresh_token: authSession.refresh_token })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.access_token) {
    clearAuthSession();
    throw Object.assign(new Error(payload?.error || payload?.message || 'Sitzung abgelaufen.'), { status: 401 });
  }
  saveAuthSession(payload);
  return authSession;
}

const icons = {
  home: '<path d="M3 11.5 12 4l9 7.5v8a1.5 1.5 0 0 1-1.5 1.5h-5v-6h-5v6h-5A1.5 1.5 0 0 1 3 19.5Z"/><path d="M8 21v-7h8v7"/>',
  wallet: '<path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H18a2 2 0 0 1 2 2v2H6.5a2.5 2.5 0 0 0 0 5H21v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/><path d="M20 8H6.5a2.5 2.5 0 0 0 0 5H21V9a1 1 0 0 0-1-1Z"/><circle cx="17.5" cy="10.5" r=".8" fill="currentColor" stroke="none"/>',
  cart: '<circle cx="9" cy="20" r="1.2"/><circle cx="18" cy="20" r="1.2"/><path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h8.7a2 2 0 0 0 2-1.6L21 8H6"/>',
  pantry: '<path d="M5 5h14l-1 16H6Z"/><path d="M4 5h16M8 5V3h8v2M9 10h6"/>',
  notes: '<rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.12 2.12-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.55V20.3h-3v-.09a1.7 1.7 0 0 0-1.03-1.55 1.7 1.7 0 0 0-1.88.34l-.06.06-2.12-2.12.06-.06A1.7 1.7 0 0 0 7 15a1.7 1.7 0 0 0-1.55-1.03H5.3v-3h.15A1.7 1.7 0 0 0 7 9.94a1.7 1.7 0 0 0-.34-1.88L6.6 8l2.12-2.12.06.06a1.7 1.7 0 0 0 1.88.34 1.7 1.7 0 0 0 1.03-1.55V4.6h3v.13a1.7 1.7 0 0 0 1.03 1.55 1.7 1.7 0 0 0 1.88-.34l.06-.06L19.8 8l-.06.06a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.55 1.03h.15v3h-.15A1.7 1.7 0 0 0 19.4 15Z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  chevronLeft: '<path d="m15 18-6-6 6-6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  template: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 8h8M8 12h5M8 16h7"/>',
  store: '<path d="M4 10h16l-1-5H5Z"/><path d="M5 10v10h14V10M9 20v-6h6v6"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6"/>',
  edit: '<path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10Z"/><path d="m14 7 3 3"/>',
  moon: '<path d="M20 15.5A8.5 8.5 0 1 1 8.5 4 7 7 0 0 0 20 15.5Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  film: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14M17 5v14M3 9h4M17 9h4M3 15h4M17 15h4"/>',
  car: '<path d="m5 17-1 2v1h3v-2h10v2h3v-1l-1-2-2-7a2 2 0 0 0-2-1H9a2 2 0 0 0-2 1Z"/><path d="M6 14h12M8 17h.01M16 17h.01"/>',
  basket: '<path d="m4 10 2 10h12l2-10Z"/><path d="m8 10 4-6 4 6M3 10h18"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>',
  pin: '<path d="m14 4 6 6-3 1-4 4-1 5-2-2-2-2 5-1 4-4Z"/><path d="m9 15-5 5"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M8 9v6M11 8v8M14 9v6M17 8v8"/>' ,
  receipt: '<path d="M6 3h12v18l-2-1.5L14 21l-2-1.5L10 21l-2-1.5L6 21Z"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/>',
  printer: '<path d="M7 8V3h10v5M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><path d="M7 14h10v7H7Z"/>',
  repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="m7 22-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
  more: '<circle cx="5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none"/>'
};

function icon(name, size = 20, filled = false) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] ?? icons.more}</svg>`;
}

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const currency = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const number = new Intl.NumberFormat('de-AT', { maximumFractionDigits: 2 });
const money = (value) => currency.format(Number(value ?? 0));
const signedMoney = (value) => `${Number(value) >= 0 ? '+' : '−'}${money(Math.abs(Number(value)))}`;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function emojiForCategory(category) {
  return ({
    'Obst & Gemüse': '🥬',
    'Backwaren': '🥖',
    'Kühlregal': '🥛',
    'Tiefkühl': '❄️',
    'Haushalt': '🧻',
    'Vorrat': '🥣',
    'Lebensmittel': '🛒',
    'Freizeit': '🎬',
    'Wohnen': '🏠',
    'Mobilität': '🚗',
    'Sonstiges': '📦'
  })[category] ?? '📦';
}

function emojiForItem(item) {
  const name = String(item?.name ?? '').toLocaleLowerCase('de');
  if (name.includes('hackfleisch') || name.includes('hähnchen') || name.includes('fleisch')) return '🥩';
  if (name.includes('milch') || name.includes('joghurt') || name.includes('butter')) return '🥛';
  if (name.includes('tomat') || name.includes('salat') || name.includes('banane')) return '🥬';
  if (name.includes('brot')) return '🥖';
  if (name.includes('käse')) return '🧀';
  return emojiForCategory(item?.category);
}

function budgetIcon(name) {
  return ({ cart: 'cart', film: 'film', home: 'home', car: 'car', basket: 'basket' })[name] ?? 'wallet';
}

function todayLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function dateLabel() {
  return new Intl.DateTimeFormat('de-AT', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
}

function monthLabel(value) {
  const [year, month] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('de-AT', { month: 'short', year: '2-digit' }).format(new Date(year, month - 1, 1)).replace('.', '');
}

function expiryInfo(date) {
  if (!date) return { label: 'Datum?', className: 'ok', days: 9999 };
  const a = new Date(`${todayLocal()}T12:00:00`);
  const b = new Date(`${date}T12:00:00`);
  const days = Math.round((b - a) / 86400000);
  if (days < 0) return { label: days === -1 ? 'gestern abgelaufen' : `seit ${Math.abs(days)} Tagen abgelaufen`, className: 'urgent', days };
  if (days === 0) return { label: 'heute', className: 'urgent', days };
  if (days === 1) return { label: 'morgen', className: 'soon', days };
  if (days < 14) return { label: `in ${days} Tagen`, className: 'soon', days };
  if (days < 60) return { label: `in ${Math.round(days / 7)} Wochen`, className: 'ok', days };
  return { label: `in ${Math.round(days / 30)} Monaten`, className: 'ok', days };
}

function recipeIdeas() {
  const urgent = data?.pantry?.filter((item) => !item.inbox && item.expiry_date && expiryInfo(item.expiry_date).days <= 3) || [];
  const names = urgent.map((item) => item.name.toLocaleLowerCase('de'));
  const ideas = [];
  if (names.some((name) => name.includes('hack')) && names.some((name) => name.includes('tomat'))) {
    ideas.push({ title: 'Schnelle Tomaten-Hack-Pfanne', content: 'Hackfleisch anbraten, Tomaten dazugeben, würzen und mit Brot oder Nudeln servieren.' });
  }
  if (names.some((name) => name.includes('joghurt')) && names.some((name) => name.includes('salat'))) {
    ideas.push({ title: 'Salat mit Joghurt-Dressing', content: 'Joghurt mit Zitronensaft, Salz, Pfeffer und Kräutern verrühren und über den Salat geben.' });
  }
  if (!ideas.length && urgent.length) {
    ideas.push({ title: `Resteküche mit ${urgent.slice(0, 2).map((item) => item.name).join(' und ')}`, content: `Heute verwenden: ${urgent.map((item) => item.name).join(', ')}. Als Pfanne, Suppe oder Ofengericht kombinieren.` });
  }
  return ideas.slice(0, 2);
}

function cacheAppState(payload) {
  const statePayload = payload?.state || (payload?.settings && payload?.summary ? payload : null);
  if (statePayload) {
    try { localStorage.setItem('selfmade-state-cache', JSON.stringify(statePayload)); } catch {}
  }
}

async function api(path, options = {}, allowRefresh = true) {
  const requestOptions = {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...cloudHeaders(),
      ...(options.headers ?? {})
    }
  };
  try {
    const response = await fetch(path, requestOptions);
    const payload = response.status === 204 ? null : await response.json().catch(() => ({}));
    if (response.status === 401 && cloudConfig.enabled && allowRefresh && authSession?.refresh_token && !path.startsWith('/api/auth/')) {
      await refreshAuthSession();
      return api(path, options, false);
    }
    if (!response.ok) {
      const error = new Error(payload?.error ?? payload?.message ?? `Fehler ${response.status}`);
      error.status = response.status;
      error.code = payload?.code;
      throw error;
    }
    cacheAppState(payload);
    const statePayload = payload?.state || (payload?.settings && payload?.summary ? payload : null);
    if (statePayload?.cloud?.household_id) localStorage.setItem('selfmade-cloud-household', statePayload.cloud.household_id);
    return payload;
  } catch (error) {
    const method = String(options.method || 'GET').toUpperCase();
    const isNetworkError = error instanceof TypeError || !navigator.onLine;
    if (!isNetworkError) throw error;
    if (method === 'GET' && path === '/api/state') {
      const cached = localStorage.getItem('selfmade-state-cache');
      if (cached) {
        toast('Offline – zwischengespeicherte Daten werden angezeigt.');
        return JSON.parse(cached);
      }
    }
    if (method !== 'GET' && !path.startsWith('/api/auth/')) {
      const body = String(options.body || '');
      if (body.length > 750000) throw new Error('Diese große Änderung kann offline nicht vorgemerkt werden.');
      const queue = JSON.parse(localStorage.getItem('selfmade-offline-queue') || '[]');
      queue.push({ path, method, body, queued_at: new Date().toISOString() });
      localStorage.setItem('selfmade-offline-queue', JSON.stringify(queue.slice(-50)));
      toast('Offline gespeichert – wird bei Verbindung synchronisiert.');
      return data || JSON.parse(localStorage.getItem('selfmade-state-cache') || 'null');
    }
    throw new Error('Keine Verbindung und keine Offline-Daten verfügbar.');
  }
}

async function flushOfflineQueue() {
  const queue = JSON.parse(localStorage.getItem('selfmade-offline-queue') || '[]');
  if (!queue.length || !navigator.onLine) return;
  const remaining = [];
  for (const item of queue) {
    try {
      const response = await fetch(item.path, { method: item.method, headers: { 'content-type': 'application/json', ...cloudHeaders() }, body: item.body || undefined });
      if (!response.ok) remaining.push(item);
    } catch { remaining.push(item); }
  }
  localStorage.setItem('selfmade-offline-queue', JSON.stringify(remaining));
  if (remaining.length < queue.length) {
    try { data = await api('/api/state'); renderApp(); toast(`${queue.length - remaining.length} Offline-Änderungen synchronisiert`); } catch {}
  }
}


function renderAuthScreen(message = '') {
  const signup = authMode === 'signup';
  shell.innerHTML = `<div class="auth-screen">
    <div class="auth-brand"><img src="/icon-192.png" alt="Selfmade"><div><strong>Selfmade Cloud</strong><small>Deine Haushaltsdaten sicher auf allen Geräten.</small></div></div>
    <section class="auth-card">
      <div class="auth-tabs"><button class="${signup ? '' : 'active'}" data-action="auth-mode" data-mode="signin">Anmelden</button><button class="${signup ? 'active' : ''}" data-action="auth-mode" data-mode="signup">Registrieren</button></div>
      ${message ? `<div class="auth-message">${escapeHtml(message)}</div>` : ''}
      <form data-auth-form="${signup ? 'signup' : 'signin'}" class="form-grid">
        ${signup ? field('Name', 'display_name', '', 'text', 'autocomplete="name" maxlength="80" required') : ''}
        ${field('E-Mail', 'email', '', 'email', 'autocomplete="email" required')}
        ${field('Passwort', 'password', '', 'password', `autocomplete="${signup ? 'new-password' : 'current-password'}" minlength="8" required`)}
        <button class="btn btn-primary block">${signup ? 'Konto erstellen' : 'Anmelden'}</button>
      </form>
      <p class="auth-footnote">Die App verwendet den Supabase-Publishable-Key. Der Service-Role-Key wird nicht im Browser gespeichert.</p>
    </section>
  </div>`;
}

async function bootstrapApplication() {
  try {
    const response = await fetch('/api/cloud/config', { headers: { accept: 'application/json' } });
    cloudConfig = response.ok ? await response.json() : { enabled: false, storage: 'sqlite' };
  } catch {
    cloudConfig = { enabled: false, storage: 'sqlite' };
  }

  if (cloudConfig.enabled) {
    if (!authSession?.access_token) {
      renderAuthScreen();
      return;
    }
    if (authSession.expires_at && authSession.expires_at < Date.now() + 60_000) {
      try { await refreshAuthSession(); } catch { renderAuthScreen('Deine Sitzung ist abgelaufen.'); return; }
    }
  }

  await refresh();
}

async function cloudBackgroundRefresh() {
  if (!cloudConfig.enabled || !authSession?.access_token || cloudPollBusy || busy || storeMode.active || dialogRoot.innerHTML || !navigator.onLine) return;
  cloudPollBusy = true;
  try {
    const next = await api('/api/state');
    const beforeVersion = Number(data?.cloud?.version || 0);
    const nextVersion = Number(next?.cloud?.version || 0);
    if (!data || nextVersion > beforeVersion) {
      data = next;
      renderApp();
      if (beforeVersion) toast('Cloud-Daten aktualisiert');
    }
  } catch (error) {
    if (error.status === 401) {
      clearAuthSession();
      renderAuthScreen('Bitte erneut anmelden.');
    }
  } finally {
    cloudPollBusy = false;
  }
}

function applyTheme() {
  const theme = data?.settings?.theme ?? 'light';
  const resolved = theme === 'system'
    ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme;
  document.documentElement.dataset.theme = resolved;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#0f0f12' : '#f0eee9');
}

function statusBar() {
  return `<div class="status-bar">
    <span class="status-time">${new Intl.DateTimeFormat('de-AT', { hour: '2-digit', minute: '2-digit' }).format(new Date())}</span>
    <span class="status-icons"><span class="signal"><i></i><i></i><i></i><i></i></span><span>5G</span><span class="battery"></span></span>
  </div>`;
}

function iosInstallTip() {
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (!isIos || standalone) return '';
  return `<section class="ios-install-tip"><span class="install-app-icon"><img src="/apple-touch-icon.png" alt=""></span><span><strong>Als iPhone-App verwenden</strong><small>In Safari auf Teilen tippen und „Zum Home-Bildschirm“ wählen. Danach startet Selfmade ohne Browserleiste.</small></span></section>`;
}

function header() {
  if (activeTab === 'start') {
    return `<header class="page-header">
      <div class="page-title-wrap"><p class="eyebrow">${escapeHtml(dateLabel())}</p><h1 class="page-title">Hallo ${escapeHtml(data.settings.display_name)}</h1></div>
      <div class="header-actions">${cloudConfig.enabled ? `<span class="cloud-indicator" title="Supabase synchronisiert">Cloud</span>` : ``}<button class="icon-button" data-action="global-search" aria-label="Suchen">${icon('search', 18)}</button><button class="icon-button" data-action="settings" aria-label="Einstellungen">${icon('settings', 18)}</button></div>
    </header>`;
  }
  if (activeTab === 'money') {
    return `<header class="page-header">
      <div class="page-title-wrap"><h1 class="page-title compact">Geld</h1></div>
      <div class="header-actions">
        <button class="icon-button small" data-action="import-receipt" aria-label="Kassenbon importieren">${icon('receipt', 17)}</button>
        <div class="month-switcher">
          <button data-action="month-prev" aria-label="Vorheriger Monat">‹</button>
          <strong>${escapeHtml(monthLabel(data.month))}</strong>
          <button data-action="month-next" aria-label="Nächster Monat">›</button>
        </div>
      </div>
    </header>`;
  }
  if (activeTab === 'shopping') {
    return `<header class="page-header">
      <div class="page-title-wrap"><h1 class="page-title compact">Einkauf</h1></div>
      <div class="header-actions">
        <button class="icon-button small" data-action="scan-barcode" aria-label="Barcode scannen">${icon('scan', 17)}</button>
        <button class="btn btn-secondary small" data-action="templates">${icon('template', 13)} Vorlagen</button>
        <button class="btn btn-primary small" data-action="start-store">Im Laden</button>
      </div>
    </header>`;
  }
  if (activeTab === 'pantry') {
    return `<header class="page-header">
      <div class="page-title-wrap"><h1 class="page-title compact">Vorrat</h1></div>
      <button class="round-button primary" data-action="add-pantry" aria-label="Vorrat hinzufügen">${icon('plus', 19)}</button>
    </header>`;
  }
  return `<header class="page-header">
    <div class="page-title-wrap"><h1 class="page-title compact">Notizen</h1></div>
    <button class="round-button primary" data-action="add-note" aria-label="Notiz hinzufügen">${icon('plus', 19)}</button>
  </header>`;
}

function tabBar() {
  const tabData = [
    ['start', 'home', 'Start', 0],
    ['money', 'wallet', 'Geld', 0],
    ['shopping', 'cart', 'Einkauf', data.badges.shopping],
    ['pantry', 'pantry', 'Vorrat', data.badges.pantry],
    ['notes', 'notes', 'Notizen', 0]
  ];
  return `<nav class="tab-bar" aria-label="Hauptnavigation">
    ${tabData.map(([id, iconName, label, badge]) => `<button class="tab-button ${activeTab === id ? 'active' : ''}" data-action="tab" data-tab="${id}">
      <span class="tab-icon">${icon(iconName, 21)}${badge ? `<span class="tab-badge">${badge}</span>` : ''}</span><span>${label}</span>
    </button>`).join('')}
  </nav>`;
}

function renderDashboard() {
  const urgent = data.pantry
    .filter((item) => !item.inbox && item.expiry_date)
    .sort((a, b) => (a.expiry_date ?? '').localeCompare(b.expiry_date ?? ''))
    .slice(0, 3);
  const spentRatio = data.summary.income ? data.summary.expense / data.summary.income : 0;
  const challengeRatio = data.challenge.completed_fields / data.challenge.total_fields;
  return `<div class="content-stack">
    ${iosInstallTip()}
    <section class="card hero-balance">
      <div class="hero-top">
        <div><div class="metric-label">Bleibt diesen Monat</div><div class="metric-value big">${signedMoney(data.summary.remaining)}</div></div>
        <div class="hero-month">${escapeHtml(new Intl.DateTimeFormat('de-AT', { month: 'long' }).format(new Date()))}</div>
      </div>
      <div class="progress-track"><div class="progress-fill" style="width:${clamp(spentRatio * 100, 0, 100)}%"></div></div>
      <div class="progress-labels"><span>${money(data.summary.income)} rein</span><span>${money(data.summary.expense)} raus</span></div>
    </section>

    <div class="metric-grid">
      <section class="card metric-card"><div class="metric-label">Gespart</div><div class="metric-value">${money(data.summary.savings)}</div></section>
      <button class="card metric-card" style="text-align:left;color:inherit" data-action="tab" data-tab="shopping"><div class="metric-label">Einkauf offen</div><div class="metric-value">${data.badges.shopping} Einträge</div></button>
    </div>

    <section class="section">
      <div class="section-title-row"><h2 class="section-title">Schnellaktionen</h2><span class="section-meta">für iPhone optimiert</span></div>
      <div class="quick-tool-grid">
        <button class="card quick-tool" data-action="scan-barcode">${icon('scan', 20)}<span><strong>Barcode scannen</strong><small>Produkt direkt hinzufügen</small></span></button>
        <button class="card quick-tool" data-action="import-receipt">${icon('receipt', 20)}<span><strong>Kassenbon</strong><small>Foto und Positionen importieren</small></span></button>
        <button class="card quick-tool" data-action="recurring">${icon('repeat', 20)}<span><strong>Routinen</strong><small>Wiederkehrende Einkäufe</small></span></button>
        <button class="card quick-tool" data-action="export-data">${icon('download', 20)}<span><strong>Backup</strong><small>Daten als JSON exportieren</small></span></button>
      </div>
    </section>

    <section class="section">
      <div class="section-title-row"><h2 class="section-title">Läuft ab</h2><span class="section-meta danger">${data.badges.pantry} dringend</span></div>
      <div class="card list-card">
        ${urgent.length ? urgent.map((item) => {
          const exp = expiryInfo(item.expiry_date);
          return `<button class="list-row clickable" style="width:100%;border-left:0;border-right:0;border-top:0;background:transparent;color:inherit;text-align:left" data-action="edit-pantry" data-id="${item.id}">
            <span class="row-emoji">${emojiForItem(item)}</span>
            <span class="row-body"><span class="row-title">${escapeHtml(item.name)}</span><span class="row-sub">${escapeHtml(item.quantity)} im ${escapeHtml(item.category)}</span></span>
            <span class="row-chip ${exp.className === 'urgent' ? 'red' : 'orange'}">${escapeHtml(exp.label)}</span>
          </button>`;
        }).join('') : `<div class="empty-state"><strong>Nichts läuft bald ab</strong><span>Dein Vorrat ist aktuell entspannt.</span></div>`}
      </div>
    </section>

    ${recipeIdeas().length ? `<section class="section">
      <div class="section-title-row"><h2 class="section-title">Heute verwerten</h2><span class="section-meta">aus deinem Vorrat</span></div>
      <div class="recipe-grid">${recipeIdeas().map((idea) => `<button class="card recipe-card" data-action="save-recipe" data-title="${escapeHtml(idea.title)}" data-content="${escapeHtml(encodeURIComponent(idea.content))}"><span>🍳</span><strong>${escapeHtml(idea.title)}</strong><small>Als Notiz speichern</small></button>`).join('')}</div>
    </section>` : ''}

    <section class="section">
      <div class="section-title-row"><h2 class="section-title">1-€-Challenge</h2></div>
      <button class="card challenge" style="width:100%;color:inherit;text-align:left" data-action="tab" data-tab="money">
        <div class="challenge-top"><span class="challenge-title">Feld ${data.challenge.current_field} ist dran</span><span class="challenge-value">${money(data.challenge.saved_amount)}</span></div>
        <div class="progress-track"><div class="progress-fill" style="width:${challengeRatio * 100}%"></div></div>
        <div class="challenge-meta">${data.challenge.completed_fields} von ${data.challenge.total_fields} Feldern · Ziel ${money(data.challenge.target_amount)}</div>
      </button>
    </section>
  </div>`;
}

function renderMoney() {
  if (moneyMode === 'save') return renderSavings();
  const ratio = data.summary.income ? data.summary.expense / data.summary.income : 0;
  return `<div class="content-stack">
    <div class="segmented">
      <button class="active" data-action="money-mode" data-mode="month">Monat</button>
      <button data-action="money-mode" data-mode="save">Sparen</button>
    </div>

    <section class="card dark-card hero-balance">
      <div><div class="metric-label" style="color:inherit;opacity:.65">Bleibt übrig</div><div class="metric-value big">${signedMoney(data.summary.remaining)}</div></div>
      <div class="progress-track" style="background:color-mix(in srgb,currentColor 18%,transparent)"><div class="progress-fill" style="width:${clamp(ratio * 100, 0, 100)}%"></div></div>
      <div class="progress-labels" style="color:inherit;opacity:.68"><span>${money(data.summary.income)} rein</span><span>${money(data.summary.expense)} raus</span></div>
    </section>

    <div class="money-actions">
      <button class="btn btn-primary" data-action="add-transaction" data-type="expense">${icon('plus', 15)} Ausgabe</button>
      <button class="btn btn-secondary" data-action="add-transaction" data-type="income">${icon('plus', 15)} Einnahme</button>
      <button class="btn btn-secondary" data-action="export-transactions-csv">${icon('download', 15)} CSV</button>
      <button class="btn btn-secondary" data-action="print-money-report">${icon('printer', 15)} Bericht</button>
    </div>

    <section class="section">
      <div class="section-title-row"><h2 class="section-title">Budgets</h2><span class="section-meta">${data.budgets.filter((item) => item.spent / item.limit_amount >= .85).length} von ${data.budgets.length} knapp</span></div>
      <div class="budget-list">
        ${data.budgets.map((item) => {
          const ratio = item.limit_amount ? item.spent / item.limit_amount : 0;
          const remaining = item.limit_amount - item.spent;
          return `<button class="card budget-card" style="width:100%;color:inherit;text-align:left" data-action="edit-budget" data-id="${item.id}">
            <div class="budget-top"><span class="budget-icon">${icon(budgetIcon(item.icon), 16)}</span><span class="budget-name">${escapeHtml(item.name)}</span><span class="budget-money" ${remaining < 0 ? 'style="color:var(--red)"' : ''}>${money(item.spent)}</span></div>
            <div class="progress-track"><div class="progress-fill ${item.accent}" style="width:${clamp(ratio * 100, 0, 100)}%"></div></div>
            <div class="budget-caption ${remaining < 0 ? 'over' : ''}">${remaining >= 0 ? `noch ${money(remaining)} von ${money(item.limit_amount)}` : `${money(Math.abs(remaining))} über dem Budget`}</div>
          </button>`;
        }).join('')}
      </div>
    </section>

    <section class="section">
      <div class="section-title-row"><h2 class="section-title">Buchungen</h2><span class="section-meta">${data.transactions.length}</span></div>
      <div class="card list-card">
        ${data.transactions.slice(0, 8).map((item) => `<button class="list-row clickable" style="width:100%;border-left:0;border-right:0;border-top:0;background:transparent;color:inherit;text-align:left" data-action="transaction-menu" data-id="${item.id}">
          <span class="row-emoji">${item.type === 'income' ? '💶' : emojiForCategory(item.category)}</span>
          <span class="row-body"><span class="row-title">${escapeHtml(item.category)}</span><span class="row-sub">${escapeHtml(item.note || item.booked_on)}${item.member_id ? ` · ${escapeHtml(memberName(item.member_id))}` : ''}</span></span>
          <span class="row-amount" style="color:${item.type === 'income' ? 'var(--green)' : 'var(--text)'}">${item.type === 'income' ? '+' : '−'}${money(item.amount)}</span>
        </button>`).join('')}
      </div>
    </section>

    ${(data.receipts || []).length ? `<section class="section">
      <div class="section-title-row"><h2 class="section-title">Kassenbons</h2><span class="section-meta">${data.receipts.length} importiert</span></div>
      <div class="card list-card">
        ${data.receipts.slice(0, 4).map((receipt) => `<button class="list-row clickable" style="width:100%;border-left:0;border-right:0;border-top:0;background:transparent;color:inherit;text-align:left" data-action="receipt-detail" data-id="${receipt.id}"><span class="row-emoji">🧾</span><span class="row-body"><span class="row-title">${escapeHtml(receipt.store_name || 'Kassenbon')}</span><span class="row-sub">${escapeHtml(receipt.receipt_date)} · ${receipt.parsed_items.length} Positionen</span></span><span class="row-amount">${money(receipt.total)}</span></button>`).join('')}
      </div>
    </section>` : ''}

    <section class="section">
      <div class="section-title-row"><h2 class="section-title">Preisverlauf</h2><span class="section-meta">aus Einkäufen und Bons</span></div>
      <div class="card list-card">
        ${(data.price_history || []).slice(0, 6).map((item) => `<div class="list-row"><span class="row-emoji">${emojiForCategory(item.category)}</span><span class="row-body"><span class="row-title">${escapeHtml(item.name)}</span><span class="row-sub">${item.purchase_count} Käufe · zuletzt ${escapeHtml(item.last_store || 'ohne Händler')}</span></span><span class="price-history"><strong>${money(item.last_price)}</strong><small>Ø ${money(item.average_price)}</small></span></div>`).join('') || `<div class="empty-state compact"><span>Noch keine Preisdaten vorhanden.</span></div>`}
      </div>
    </section>
  </div>`;
}

function renderSavings() {
  const progress = data.challenge.saved_amount / data.challenge.target_amount;
  return `<div class="content-stack">
    <div class="segmented">
      <button data-action="money-mode" data-mode="month">Monat</button>
      <button class="active" data-action="money-mode" data-mode="save">Sparen</button>
    </div>
    <section class="card hero-balance">
      <div class="hero-top"><div><div class="metric-label">Gespart</div><div class="metric-value big">${money(data.summary.savings)}</div></div><span class="row-chip green">Ziel im Blick</span></div>
      <div class="progress-track"><div class="progress-fill green" style="width:${clamp(progress * 100, 0, 100)}%"></div></div>
      <div class="progress-labels"><span>Challenge ${money(data.challenge.saved_amount)}</span><span>Ziel ${money(data.challenge.target_amount)}</span></div>
    </section>
    <section class="card challenge">
      <div class="challenge-top"><span class="challenge-title">1-€-Challenge</span><span class="challenge-value">Feld ${data.challenge.current_field}</span></div>
      <div class="metric-value big">${money(data.challenge.current_field)}</div>
      <div class="challenge-meta">Lege als Nächstes den Betrag deines aktuellen Feldes zurück.</div>
      <button class="btn btn-primary block" data-action="complete-challenge">Feld ${data.challenge.current_field} abschließen</button>
    </section>
    <section class="card pad">
      <div class="section-title-row"><h2 class="section-title">Sparbetrag anpassen</h2></div>
      <div style="height:8px"></div>
      <button class="btn btn-secondary block" data-action="edit-savings">Aktuell ${money(data.summary.savings)}</button>
    </section>
  </div>`;
}

function shoppingGroups() {
  const order = ['Obst & Gemüse', 'Backwaren', 'Kühlregal', 'Tiefkühl', 'Vorrat', 'Haushalt', 'Sonstiges'];
  const map = new Map();
  for (const item of data.shopping) {
    if (!map.has(item.category)) map.set(item.category, []);
    map.get(item.category).push(item);
  }
  return [...map.entries()].sort((a, b) => {
    const ai = order.indexOf(a[0]);
    const bi = order.indexOf(b[0]);
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
  });
}

function renderShopping() {
  const checked = data.shopping.filter((item) => item.checked).length;
  const total = data.shopping.length;
  return `<div class="content-stack">
    <div class="shopping-progress"><div class="progress-track"><div class="progress-fill green" style="width:${total ? checked / total * 100 : 0}%"></div></div><span>${checked} / ${total}</span></div>
    <div class="quick-chips">
      ${(data.suggestions?.length ? data.suggestions : ['Spülmittel', 'Haferflocken', 'Olivenöl'].map((name) => ({ name, quantity: '1', category: name === 'Spülmittel' ? 'Haushalt' : 'Vorrat', reason: 'Vorschlag' }))).map((item) => `<button class="pill dashed" data-action="add-suggestion" data-name="${escapeHtml(item.name)}" data-quantity="${escapeHtml(item.quantity)}" data-category="${escapeHtml(item.category)}">+ ${escapeHtml(item.name)}</button>`).join('')}
      <button class="pill active" data-action="recurring">${icon('repeat', 13)} Routinen</button>
    </div>
    ${shoppingGroups().map(([category, items]) => `<section class="category-block">
      <div class="category-heading"><span class="category-name">${emojiForCategory(category)} &nbsp;${escapeHtml(category)}</span><span class="category-count">${items.length}</span></div>
      <div class="card list-card">
        ${items.map((item) => shoppingRow(item)).join('')}
      </div>
    </section>`).join('') || `<div class="card empty-state"><div class="empty-icon">${icon('cart', 25)}</div><strong>Liste ist leer</strong><span>Füge unten den ersten Artikel hinzu.</span></div>`}
    <div class="bottom-composer">
      <form class="composer-row" data-form="quick-shopping"><input class="input composer-input" name="name" placeholder="Was fehlt? z. B. 2 Milch" autocomplete="off"><button class="round-button primary" aria-label="Hinzufügen">${icon('plus', 19)}</button></form>
    </div>
  </div>`;
}

function shoppingRow(item) {
  const numeric = /^\d+$/.test(item.quantity);
  return `<div class="list-row shopping-row">
    <button class="check ${item.checked ? 'checked' : ''}" data-action="toggle-shopping" data-id="${item.id}" aria-label="${item.checked ? 'Abhaken rückgängig' : 'Abhaken'}">${item.checked ? icon('check', 15) : ''}</button>
    <button class="row-body" style="border:0;background:transparent;color:inherit;text-align:left;padding:0" data-action="edit-shopping" data-id="${item.id}"><span class="row-title">${escapeHtml(item.name)}</span>${item.note || item.member_id ? `<span class="row-sub">${[item.note, memberName(item.member_id)].filter(Boolean).map(escapeHtml).join(' · ')}</span>` : ''}</button>
    ${numeric ? `<span class="quantity-stepper"><button class="step-button" data-action="quantity" data-id="${item.id}" data-delta="-1">−</button><span class="step-value">${escapeHtml(item.quantity)}</span><button class="step-button" data-action="quantity" data-id="${item.id}" data-delta="1">+</button></span>` : `<span class="row-chip">${escapeHtml(item.quantity)}</span>`}
  </div>`;
}

function renderPantry() {
  const inbox = data.pantry.filter((item) => item.inbox);
  let items = data.pantry.filter((item) => !item.inbox);
  if (pantryFilter === 'expiry') items = items.filter((item) => expiryInfo(item.expiry_date).days <= 14);
  if (pantryFilter === 'buy') items = items.filter((item) => item.buy_again || item.low_stock);
  return `<div class="content-stack">
    ${inbox.length ? `<section class="pantry-inbox">
      <div class="inbox-top"><span class="inbox-title">${inbox.length} Sachen einräumen</span><button class="pill active" data-action="arrange-all">Alle</button></div>
      <div class="inbox-list">${inbox.map((item) => `<div class="inbox-item"><span>${emojiForCategory(item.category)}</span><span>${escapeHtml(item.name)} · ${escapeHtml(item.quantity)}</span><button class="pill" data-action="arrange-pantry" data-id="${item.id}">Datum?</button></div>`).join('')}</div>
      <div class="inbox-note">Verschwindet zwei Stunden nach dem Einkauf von selbst.</div>
    </section>` : ''}
    <div class="filter-tabs">
      <button class="${pantryFilter === 'expiry' ? 'active' : ''}" data-action="pantry-filter" data-filter="expiry">Läuft ab</button>
      <button class="${pantryFilter === 'buy' ? 'active' : ''}" data-action="pantry-filter" data-filter="buy">Nachkaufen</button>
      <button class="${pantryFilter === 'all' ? 'active' : ''}" data-action="pantry-filter" data-filter="all">Alles</button>
    </div>
    <div class="card list-card">
      ${items.length ? items.map((item) => {
        const exp = expiryInfo(item.expiry_date);
        return `<button class="list-row clickable expiry-row ${exp.className}" style="width:100%;border-left:0;border-right:0;border-top:0;background:transparent;color:inherit;text-align:left" data-action="edit-pantry" data-id="${item.id}">
          <span class="row-body"><span class="row-title">${escapeHtml(item.name)}</span><span class="row-sub expiry-copy ${exp.className}">${escapeHtml(item.location || item.category)} · ${escapeHtml(exp.label)}${item.buy_again || item.low_stock ? ' · nachkaufen' : ''}${item.note ? ` · ${escapeHtml(item.note)}` : ''}</span></span>
          <span class="pantry-quantity"><strong>${escapeHtml(item.quantity)}${item.unit ? ` ${escapeHtml(item.unit)}` : ''}</strong>${item.low_stock ? `<small>Mindestbestand</small>` : ''}</span>
        </button>`;
      }).join('') : `<div class="empty-state"><div class="empty-icon">${icon('pantry', 25)}</div><strong>Keine Treffer</strong><span>In diesem Bereich sind keine Artikel.</span></div>`}
    </div>
  </div>`;
}

const noteColor = {
  blue: 'var(--accent)', green: 'var(--green)', orange: 'var(--orange)', yellow: 'var(--yellow)', purple: 'var(--purple)', red: 'var(--red)'
};

function notesGridHtml() {
  const query = noteQuery.trim().toLocaleLowerCase('de');
  const notes = data.notes.filter((item) => !query || `${item.title} ${item.content} ${item.tag || ''} ${item.related_name || ''}`.toLocaleLowerCase('de').includes(query));
  if (!notes.length) return `<div class="card empty-state" style="grid-column:1/-1"><div class="empty-icon">${icon('search', 25)}</div><strong>Keine Notiz gefunden</strong><span>Prüfe den Suchbegriff oder lege eine neue Notiz an.</span></div>`;
  return notes.map((item) => `<article class="card note-card" style="--note-accent:${noteColor[item.accent] ?? 'var(--accent)'}" data-action="edit-note" data-id="${item.id}" tabindex="0">
    ${item.pinned ? `<div class="note-kicker">${icon('pin', 9)} angeheftet</div>` : ''}
    <h2 class="note-title">${escapeHtml(item.title)}</h2>
    ${item.content ? `<div class="note-content">${escapeHtml(item.content)}</div>` : ''}
    ${item.tag || item.due_date || item.related_name ? `<div class="note-meta-row">${item.tag ? `<span>${escapeHtml(item.tag)}</span>` : ''}${item.due_date ? `<span>${escapeHtml(item.due_date)}</span>` : ''}${item.related_name ? `<span>${escapeHtml(item.related_name)}</span>` : ''}</div>` : ''}
    ${item.checklist_total ? `<div class="note-progress"><div class="progress-track"><div class="progress-fill green" style="width:${clamp(item.checklist_done / item.checklist_total * 100, 0, 100)}%"></div></div><span>${item.checklist_done} von ${item.checklist_total} erledigt</span></div>` : ''}
  </article>`).join('');
}

function renderNotes() {
  return `<div class="content-stack">
    <div class="search-field">${icon('search', 16)}<input class="input" id="note-search" value="${escapeHtml(noteQuery)}" placeholder="In Notizen suchen" autocomplete="off"></div>
    <div class="notes-grid">${notesGridHtml()}</div>
  </div>`;
}

function renderContent() {
  return ({ start: renderDashboard, money: renderMoney, shopping: renderShopping, pantry: renderPantry, notes: renderNotes })[activeTab]();
}

function renderApp() {
  if (!data) return;
  applyTheme();
  if (storeMode.active) {
    shell.innerHTML = renderStoreMode();
    return;
  }
  shell.innerHTML = `<div class="app">${statusBar()}${header()}<main class="content-scroll">${renderContent()}</main>${tabBar()}</div>`;
}

function storeCategories() {
  return shoppingGroups().map(([category, items]) => ({ category, items }));
}

function storeTotal() {
  return data.shopping.filter((item) => item.checked).reduce((sum, item) => sum + Number(storeMode.prices.get(item.id) ?? item.price ?? 0), 0);
}

function renderStoreMode() {
  const groups = storeCategories();
  if (!groups.length) {
    storeMode.active = false;
    queueMicrotask(renderApp);
    return '';
  }
  const idx = clamp(storeMode.categoryIndex, 0, groups.length - 1);
  storeMode.categoryIndex = idx;
  const current = groups[idx];
  if (storeMode.checkout) return renderCheckout(groups);
  const checkedCount = current.items.filter((item) => item.checked).length;
  const totalChecked = data.shopping.filter((item) => item.checked).length;
  return `<div class="store-mode">
    ${statusBar()}
    <header class="store-header">
      <div class="store-kicker"><span>IM LADEN</span><button class="btn btn-soft small" data-action="end-store">Beenden</button></div>
      <div class="store-progress">${groups.map((_, i) => `<i class="${i < idx ? 'done' : i === idx ? 'current' : ''}"></i>`).join('')}</div>
    </header>
    <main class="store-content">
      <h1 class="store-title">${emojiForCategory(current.category)} ${escapeHtml(current.category)}</h1>
      <div class="store-subtitle">Abteilung ${idx + 1} von ${groups.length} · ${checkedCount} von ${current.items.length} Sachen</div>
      ${current.items.map((item) => `<div class="store-item ${item.checked ? 'done' : ''}">
        <button class="check ${item.checked ? 'checked' : ''}" data-action="toggle-store-item" data-id="${item.id}">${item.checked ? icon('check', 15) : ''}</button>
        <div class="row-body"><div class="row-title">${escapeHtml(item.name)}</div><div class="row-sub">${escapeHtml(item.quantity)}${item.note ? ` · ${escapeHtml(item.note)}` : ''}</div></div>
        <input class="price-input" inputmode="decimal" aria-label="Preis ${escapeHtml(item.name)}" data-action="store-price" data-id="${item.id}" value="${number.format(storeMode.prices.get(item.id) ?? item.price ?? 0)} €">
      </div>`).join('')}
      ${totalChecked ? `<section class="card pad store-cart"><div class="section-title-row"><h2 class="section-title">Im Wagen · ${totalChecked}</h2><strong>${money(storeTotal())}</strong></div></section>` : ''}
    </main>
    <footer class="store-footer"><div class="store-footer-row"><button class="btn btn-soft" data-action="store-prev" ${idx === 0 ? 'disabled' : ''}>${icon('chevronLeft', 18)}</button><button class="btn btn-primary" data-action="store-next">${idx === groups.length - 1 ? 'Einkauf fertig' : `Weiter zu ${groups[idx + 1].category}`}</button></div></footer>
  </div>`;
}

function renderCheckout(groups) {
  const checked = data.shopping.filter((item) => item.checked);
  const total = storeTotal();
  return `<div class="store-mode">
    ${statusBar()}
    <header class="store-header">
      <div class="store-kicker"><span>ABSCHLUSS</span><button class="btn btn-soft small" data-action="end-store">Beenden</button></div>
      <div class="store-progress">${groups.map(() => '<i class="done"></i>').join('')}</div>
    </header>
    <main class="store-content" style="display:grid;align-content:end">
      <section class="card checkout-panel">
        <div><div class="metric-label">Einkauf abschließen</div><div class="row-sub">${escapeHtml(dateLabel())} · ${checked.length} Sachen</div></div>
        <div><div class="metric-label">Summe der eingetippten Preise</div><div class="checkout-total">${money(total)}</div><div class="checkout-warning">1 Eintrag ohne Preis zählt nicht mit.</div></div>
        <div class="check-option"><span class="ok">${icon('check', 12)}</span>Als Ausgabe in Lebensmittel buchen</div>
        <div class="check-option"><span class="ok">${icon('check', 12)}</span>${checked.filter((item) => item.category !== 'Haushalt').length} Posten in Vorrat hochzählen</div>
        <div class="check-option"><span class="ok">${icon('check', 12)}</span>Reihenfolge dieses Ladens merken</div>
      </section>
    </main>
    <footer class="store-footer"><div class="money-actions"><button class="btn btn-soft" data-action="end-store">Nur wegräumen</button><button class="btn btn-primary" data-action="checkout">Abschließen</button></div></footer>
  </div>`;
}

function openDialog(title, content, form = null) {
  dialogRoot.innerHTML = `<div class="dialog-backdrop" data-action="backdrop-close"><section class="dialog" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
    <div class="dialog-handle"></div>
    <div class="dialog-header"><h2 class="dialog-title">${escapeHtml(title)}</h2><button class="icon-button small" data-action="close-dialog" aria-label="Schließen">${icon('close', 17)}</button></div>
    ${form ? `<form class="form-grid" data-form="${form}">${content}</form>` : content}
  </section></div>`;
  queueMicrotask(() => dialogRoot.querySelector('input, textarea, select, button')?.focus());
}

function closeDialog() { stopScanner(); dialogRoot.innerHTML = ''; receiptImageData = ''; }

function field(label, name, value = '', type = 'text', extra = '') {
  return `<div class="field"><label for="field-${name}">${label}</label><input class="input" id="field-${name}" name="${name}" type="${type}" value="${escapeHtml(value)}" ${extra}></div>`;
}

function selectField(label, name, value, options) {
  return `<div class="field"><label for="field-${name}">${label}</label><select class="select" id="field-${name}" name="${name}">${options.map((option) => `<option value="${escapeHtml(option)}" ${option === value ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('')}</select></div>`;
}

function showOnboarding() {
  openDialog('Willkommen bei Selfmade', `
    <div class="onboarding-hero"><img src="/icon-192.png" alt="Selfmade"><div><strong>Dein Haushalt. Klar organisiert.</strong><small>Einkauf, Vorrat, Geld, Notizen, Barcodes und Kassenbons greifen ineinander.</small></div></div>
    ${field('Dein Name', 'display_name', data.settings.display_name, 'text', 'maxlength="40" required')}
    ${field('Haushaltsname', 'household_name', data.settings.household_name || 'Mein Haushalt', 'text', 'maxlength="60" required')}
    <label class="checkbox-row"><input type="checkbox" name="notifications">Ablauf- und Routinehinweise aktivieren</label>
    <div class="dialog-actions"><button class="btn btn-primary block">App einrichten</button></div>
  `, 'onboarding');
}

function openGlobalSearch() {
  openDialog('Globale Suche', `
    <div class="field"><label for="global-search">Alles durchsuchen</label><input class="input" id="global-search" type="search" placeholder="Milch, WLAN, Budget …" autocomplete="off"></div>
    <div id="global-search-results" class="card list-card"><div class="empty-state compact"><span>Suchbegriff eingeben.</span></div></div>
  `);
}

function renderGlobalSearch(query) {
  const q = String(query || '').trim().toLocaleLowerCase('de');
  const root = dialogRoot.querySelector('#global-search-results');
  if (!root) return;
  if (!q) {
    root.innerHTML = `<div class="empty-state compact"><span>Suchbegriff eingeben.</span></div>`;
    return;
  }
  const results = [];
  data.shopping.forEach((item) => { if (`${item.name} ${item.note} ${item.category}`.toLowerCase().includes(q)) results.push({ tab: 'shopping', icon: 'cart', title: item.name, meta: `Einkauf · ${item.quantity}` }); });
  data.pantry.forEach((item) => { if (`${item.name} ${item.category}`.toLowerCase().includes(q)) results.push({ tab: 'pantry', icon: 'pantry', title: item.name, meta: `Vorrat · ${item.quantity}` }); });
  data.notes.forEach((item) => { if (`${item.title} ${item.content}`.toLowerCase().includes(q)) results.push({ tab: 'notes', icon: 'notes', title: item.title, meta: 'Notiz' }); });
  data.transactions.forEach((item) => { if (`${item.category} ${item.note}`.toLowerCase().includes(q)) results.push({ tab: 'money', icon: 'wallet', title: item.note || item.category, meta: `${item.category} · ${money(item.amount)}` }); });
  (data.receipts || []).forEach((item) => { if (`${item.store_name} ${item.ocr_text}`.toLowerCase().includes(q)) results.push({ tab: 'money', icon: 'receipt', title: item.store_name || 'Kassenbon', meta: `${item.receipt_date} · ${money(item.total)}` }); });
  root.innerHTML = results.length ? results.slice(0, 20).map((item) => `<button class="list-row clickable" style="width:100%;border-left:0;border-right:0;border-top:0;background:transparent;color:inherit;text-align:left" data-action="search-go" data-tab="${item.tab}"><span class="row-emoji">${icon(item.icon, 17)}</span><span class="row-body"><span class="row-title">${escapeHtml(item.title)}</span><span class="row-sub">${escapeHtml(item.meta)}</span></span>${icon('chevronRight', 16)}</button>`).join('') : `<div class="empty-state compact"><span>Keine Treffer gefunden.</span></div>`;
}

async function enableNotifications() {
  if (!('Notification' in window)) return toast('Benachrichtigungen werden von diesem Browser nicht unterstützt.', 'error');
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      localStorage.setItem('selfmade-notifications', '1');
      toast('Benachrichtigungen aktiviert');
      checkNotifications(true);
    } else toast('Benachrichtigungen wurden nicht erlaubt.', 'error');
  } catch { toast('Benachrichtigungen konnten nicht aktiviert werden.', 'error'); }
}

function checkNotifications(force = false) {
  if (!data || localStorage.getItem('selfmade-notifications') !== '1' || !('Notification' in window) || Notification.permission !== 'granted') return;
  const key = `selfmade-notified-${todayLocal()}`;
  if (!force && localStorage.getItem(key)) return;
  const urgent = data.pantry.filter((item) => !item.inbox && item.expiry_date && expiryInfo(item.expiry_date).days <= 1);
  const recurring = (data.recurring || []).filter((item) => item.due);
  if (!urgent.length && !recurring.length) return;
  const body = [urgent.length ? `${urgent.length} Vorratsprodukte laufen bald ab.` : '', recurring.length ? `${recurring.length} Routinen sind fällig.` : ''].filter(Boolean).join(' ');
  try { new Notification('Selfmade – heute wichtig', { body, icon: '/icon-192.png' }); } catch {}
  localStorage.setItem(key, '1');
}

function memberName(id) {
  return data.members?.find((member) => member.id === Number(id))?.name || '';
}

function memberSelectField(value = '') {
  return `<div class="field"><label for="field-member_id">Zuständig</label><select class="select" id="field-member_id" name="member_id"><option value="">Nicht zugeordnet</option>${(data.members || []).map((member) => `<option value="${member.id}" ${Number(value) === member.id ? 'selected' : ''}>${escapeHtml(member.name)}</option>`).join('')}</select></div>`;
}

function openSettings() {
  openDialog('Einstellungen', `
    ${field('Name', 'display_name', data.settings.display_name, 'text', 'maxlength="40" required')}
    ${field('Haushalt', 'household_name', data.settings.household_name || 'Mein Haushalt', 'text', 'maxlength="60" required')}
    <div class="field"><label for="field-theme">Darstellung</label><select class="select" id="field-theme" name="theme"><option value="light" ${data.settings.theme === 'light' ? 'selected' : ''}>Hell</option><option value="dark" ${data.settings.theme === 'dark' ? 'selected' : ''}>Dunkel</option><option value="system" ${data.settings.theme === 'system' ? 'selected' : ''}>System</option></select></div>
    ${field('Gespart', 'savings', data.settings.savings, 'number', 'min="0" step="0.01"')}
    ${cloudConfig.enabled ? `<section class="cloud-settings-card"><div><strong>Supabase Cloud</strong><small>${escapeHtml(data.cloud?.household_name || data.settings.household_name)} · Version ${Number(data.cloud?.version || 0)}</small></div><div class="cloud-settings-actions"><button type="button" class="btn btn-secondary small" data-action="cloud-sync">Jetzt synchronisieren</button><button type="button" class="btn btn-danger small" data-action="auth-signout">Abmelden</button></div></section>` : `<section class="cloud-settings-card muted"><div><strong>Lokale Speicherung</strong><small>SUPABASE_URL und SUPABASE_PUBLISHABLE_KEY sind nicht gesetzt.</small></div></section>`}
    <div class="settings-tools">
      <button type="button" class="btn btn-secondary" data-action="enable-notifications">Benachrichtigungen</button>
      <button type="button" class="btn btn-secondary" data-action="export-data">Backup exportieren</button>
      <input id="backup-file" type="file" accept="application/json,.json" hidden>
      <label for="backup-file" class="btn btn-secondary backup-import-label">Backup importieren</label>
    </div>
    <div class="section-title-row"><h3 class="section-title">Haushaltsmitglieder</h3><button type="button" class="pill active" data-action="add-member">+ Mitglied</button></div>
    <div class="card list-card member-list">${(data.members || []).map((member) => `<button type="button" class="list-row clickable" style="width:100%;border-left:0;border-right:0;border-top:0;background:transparent;color:inherit;text-align:left" data-action="edit-member" data-id="${member.id}"><span class="member-avatar">${escapeHtml(member.avatar)}</span><span class="row-body"><span class="row-title">${escapeHtml(member.name)}</span><span class="row-sub">${escapeHtml(member.role)}</span></span>${icon('chevronRight', 16)}</button>`).join('')}</div>
    <div class="dialog-actions"><button type="button" class="btn btn-danger" data-action="confirm-reset">Zurücksetzen</button><button class="btn btn-primary">Speichern</button></div>
  `, 'settings');
}

function openMember(member = null) {
  openDialog(member ? 'Mitglied bearbeiten' : 'Mitglied hinzufügen', `
    <input type="hidden" name="id" value="${member?.id ?? ''}">
    ${field('Name', 'name', member?.name ?? '', 'text', 'maxlength="40" required')}
    <div class="form-row">${field('Kürzel', 'avatar', member?.avatar ?? '', 'text', 'maxlength="2"')}${field('Rolle', 'role', member?.role ?? 'Mitglied', 'text', 'maxlength="40"')}</div>
    <div class="dialog-actions">${member ? `<button type="button" class="btn btn-danger" data-action="delete-member" data-id="${member.id}">Löschen</button>` : `<button type="button" class="btn btn-secondary" data-action="close-dialog">Abbrechen</button>`}<button class="btn btn-primary">Speichern</button></div>
  `, 'member');
}

function stopScanner() {
  if (scannerTimer) cancelAnimationFrame(scannerTimer);
  scannerTimer = null;
  if (scannerStream) scannerStream.getTracks().forEach((track) => track.stop());
  scannerStream = null;
}

function openBarcodeScanner() {
  stopScanner();
  openDialog('Barcode scannen', `
    <div class="scanner-panel">
      <video id="barcode-video" playsinline muted></video>
      <div class="scanner-frame"><span></span></div>
    </div>
    <div class="alert info">Auf iPhones funktioniert die automatische Erkennung abhängig von der Safari-Version. Die manuelle Eingabe bleibt immer verfügbar.</div>
    <div class="field"><label for="barcode-value">Barcode</label><input class="input" id="barcode-value" inputmode="numeric" autocomplete="off" placeholder="z. B. 9000000000011"></div>
    <div class="dialog-actions stacked-actions">
      <button class="btn btn-secondary" type="button" data-action="start-barcode-camera">${icon('scan', 15)} Kamera starten</button>
      <button class="btn btn-primary" type="button" data-action="lookup-barcode">Produkt suchen</button>
    </div>
  `);
}

async function startBarcodeCamera() {
  if (!navigator.mediaDevices?.getUserMedia) return toast('Kamerazugriff wird von diesem Browser nicht unterstützt.', 'error');
  if (!('BarcodeDetector' in window)) return toast('Automatische Barcode-Erkennung ist hier nicht verfügbar. Bitte Barcode manuell eingeben.', 'error');
  try {
    scannerStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    const video = dialogRoot.querySelector('#barcode-video');
    if (!video) return stopScanner();
    video.srcObject = scannerStream;
    await video.play();
    const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'qr_code'] });
    const scan = async () => {
      if (!scannerStream || !dialogRoot.querySelector('#barcode-video')) return;
      try {
        const codes = await detector.detect(video);
        if (codes[0]?.rawValue) {
          dialogRoot.querySelector('#barcode-value').value = codes[0].rawValue;
          stopScanner();
          toast('Barcode erkannt');
          await lookupBarcode(codes[0].rawValue);
          return;
        }
      } catch {}
      scannerTimer = requestAnimationFrame(scan);
    };
    scan();
  } catch (error) {
    stopScanner();
    toast(error.name === 'NotAllowedError' ? 'Kamerazugriff wurde nicht erlaubt.' : 'Kamera konnte nicht gestartet werden.', 'error');
  }
}

async function lookupBarcode(rawValue = '') {
  const barcode = String(rawValue || dialogRoot.querySelector('#barcode-value')?.value || '').trim();
  if (!barcode) return toast('Bitte Barcode eingeben oder scannen.', 'error');
  try {
    const result = await api(`/api/catalog/lookup?barcode=${encodeURIComponent(barcode)}`);
    stopScanner();
    if (result.product) {
      closeDialog();
      openShopping({
        name: result.product.name,
        quantity: result.product.default_quantity,
        category: result.product.category,
        price: result.product.last_price,
        note: result.product.brand ? `Marke: ${result.product.brand}` : ''
      });
      toast('Produkt aus dem Katalog geladen');
      return;
    }
    openDialog('Neues Barcode-Produkt', `
      <input type="hidden" name="barcode" value="${escapeHtml(barcode)}">
      ${field('Produkt', 'name', '', 'text', 'maxlength="80" required')}
      ${field('Marke', 'brand', '', 'text', 'maxlength="60"')}
      ${selectField('Kategorie', 'category', 'Sonstiges', ['Obst & Gemüse', 'Backwaren', 'Kühlregal', 'Tiefkühl', 'Vorrat', 'Haushalt', 'Sonstiges'])}
      <div class="form-row">${field('Standardmenge', 'default_quantity', '1', 'text', 'maxlength="30" required')}${field('Letzter Preis', 'last_price', '', 'number', 'min="0" step="0.01"')}</div>
      <div class="dialog-actions"><button type="button" class="btn btn-secondary" data-action="close-dialog">Abbrechen</button><button class="btn btn-primary">Im Katalog speichern</button></div>
    `, 'catalog-product');
  } catch (error) { toast(error.message, 'error'); }
}

function openReceiptImport() {
  receiptImageData = '';
  openDialog('Kassenbon importieren', `
    <div class="receipt-upload">
      <input id="receipt-file" type="file" accept="image/*" capture="environment">
      <label for="receipt-file">${icon('receipt', 22)}<strong>Bon fotografieren oder auswählen</strong><small>Das Bild bleibt in deiner lokalen App-Datenbank.</small></label>
      <img id="receipt-preview" alt="Kassenbon Vorschau" hidden>
    </div>
    <div class="field"><label for="receipt-ocr">Erkannter oder kopierter Bon-Text</label><textarea class="textarea" id="receipt-ocr" name="ocr_text" placeholder="BILLA\nVollmilch 1,29\nTomaten 2,49\nGesamt 3,78"></textarea></div>
    <button type="button" class="btn btn-secondary block" data-action="parse-receipt">Text analysieren</button>
    <form class="form-grid" data-form="receipt">
      <input type="hidden" name="items_json" value="[]">
      <div class="form-row">${field('Geschäft', 'store_name', '', 'text', 'maxlength="60"')}${field('Datum', 'receipt_date', todayLocal(), 'date', 'required')}</div>
      <div class="form-row">${field('Gesamtsumme', 'total', '', 'number', 'min="0" step="0.01"')}${selectField('Kategorie', 'transaction_category', 'Lebensmittel', ['Lebensmittel', 'Haushalt', 'Freizeit', 'Sonstiges'])}</div>
      <div id="receipt-items" class="receipt-items"><div class="empty-state compact"><span>Noch keine Positionen analysiert.</span></div></div>
      <label class="checkbox-row"><input type="checkbox" name="book_transaction" checked>Als Ausgabe verbuchen</label>
      <label class="checkbox-row"><input type="checkbox" name="transfer_to_pantry">Lebensmittel in den Vorrat übernehmen</label>
      <div class="dialog-actions"><button type="button" class="btn btn-secondary" data-action="close-dialog">Abbrechen</button><button class="btn btn-primary">Importieren</button></div>
    </form>
  `);
}

async function parseReceiptDialog() {
  const text = dialogRoot.querySelector('#receipt-ocr')?.value || '';
  if (!text.trim()) return toast('Bitte zuerst Bon-Text einfügen.', 'error');
  try {
    const parsed = await api('/api/receipts/parse', { method: 'POST', body: JSON.stringify({ ocr_text: text }) });
    const form = dialogRoot.querySelector('form[data-form="receipt"]');
    if (!form) return;
    form.elements.store_name.value = parsed.store_name || '';
    form.elements.total.value = parsed.total || '';
    form.elements.items_json.value = JSON.stringify(parsed.items || []);
    const target = dialogRoot.querySelector('#receipt-items');
    target.innerHTML = parsed.items?.length ? parsed.items.map((item) => `<div class="receipt-item"><span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.category)}</small></span><b>${money(item.price)}</b></div>`).join('') : `<div class="empty-state compact"><span>Keine Positionen erkannt. Geschäft und Summe können trotzdem manuell gespeichert werden.</span></div>`;
    toast(`${parsed.items?.length || 0} Positionen erkannt`);
  } catch (error) { toast(error.message, 'error'); }
}

function openRecurring() {
  openDialog('Wiederkehrende Einkäufe', `
    <form class="form-grid recurring-form" data-form="recurring">
      ${field('Produkt', 'name', '', 'text', 'maxlength="80" required')}
      <div class="form-row">${field('Menge', 'quantity', '1', 'text', 'maxlength="30" required')}${field('Intervall in Tagen', 'frequency_days', '7', 'number', 'min="1" max="365" required')}</div>
      ${selectField('Kategorie', 'category', 'Kühlregal', ['Obst & Gemüse', 'Backwaren', 'Kühlregal', 'Tiefkühl', 'Vorrat', 'Haushalt', 'Sonstiges'])}
      ${field('Nächster Termin', 'next_due', todayLocal(), 'date', 'required')}
      <div class="dialog-actions"><button class="btn btn-primary block">Routine hinzufügen</button></div>
    </form>
    <div class="section-title-row"><h3 class="section-title">Aktive Routinen</h3><span class="section-meta">${data.recurring?.length || 0}</span></div>
    <div class="card list-card recurring-list">
      ${(data.recurring || []).map((item) => `<div class="list-row"><span class="row-emoji">${emojiForCategory(item.category)}</span><span class="row-body"><span class="row-title">${escapeHtml(item.name)}</span><span class="row-sub">${escapeHtml(item.quantity)} · alle ${item.frequency_days} Tage · ${item.next_due}</span></span><button class="icon-button small" data-action="delete-recurring" data-id="${item.id}" aria-label="Routine löschen">${icon('trash', 15)}</button></div>`).join('') || `<div class="empty-state compact"><span>Noch keine Routinen vorhanden.</span></div>`}
    </div>
  `);
}

async function exportData() {
  try {
    const payload = await api('/api/export');
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `selfmade-backup-${todayLocal()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast('Backup erstellt');
  } catch (error) { toast(error.message, 'error'); }
}

function downloadBlob(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function csvCell(value) {
  const text = String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
}

function exportTransactionsCsv() {
  const header = ['Datum', 'Typ', 'Kategorie', 'Beschreibung', 'Mitglied', 'Betrag'];
  const rows = data.transactions.map((item) => [
    item.booked_on,
    item.type === 'income' ? 'Einnahme' : 'Ausgabe',
    item.category,
    item.note,
    item.member_id ? memberName(item.member_id) : '',
    Number(item.amount).toFixed(2).replace('.', ',')
  ]);
  const csv = '\uFEFF' + [header, ...rows].map((row) => row.map(csvCell).join(';')).join('\r\n');
  downloadBlob(`selfmade-buchungen-${data.month}.csv`, csv, 'text/csv;charset=utf-8');
  toast('CSV exportiert');
}

function printMoneyReport() {
  const popup = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700');
  if (!popup) return toast('Pop-up wurde blockiert.', 'error');
  const budgets = data.budgets.map((item) => `<tr><td>${escapeHtml(item.name)}</td><td>${money(item.spent)}</td><td>${money(item.limit_amount)}</td><td>${money(item.limit_amount - item.spent)}</td></tr>`).join('');
  const transactions = data.transactions.map((item) => `<tr><td>${escapeHtml(item.booked_on)}</td><td>${item.type === 'income' ? 'Einnahme' : 'Ausgabe'}</td><td>${escapeHtml(item.category)}</td><td>${escapeHtml(item.note || '')}</td><td>${item.type === 'income' ? '+' : '−'}${money(item.amount)}</td></tr>`).join('');
  popup.document.write(`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Selfmade Finanzbericht ${escapeHtml(data.month)}</title><style>
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#111827;margin:36px}h1{margin:0 0 4px}p{color:#6b7280}.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:24px 0}.card{border:1px solid #e5e7eb;border-radius:14px;padding:16px}.card b{font-size:22px;display:block;margin-top:6px}table{width:100%;border-collapse:collapse;margin:10px 0 26px;font-size:12px}th,td{text-align:left;padding:9px;border-bottom:1px solid #e5e7eb}th{background:#f8fafc}@media print{body{margin:14mm}.no-print{display:none}}
  </style></head><body><h1>Selfmade Finanzbericht</h1><p>${escapeHtml(data.settings.household_name)} · ${escapeHtml(data.month)}</p><div class="summary"><div class="card">Einnahmen<b>${money(data.summary.income)}</b></div><div class="card">Ausgaben<b>${money(data.summary.expense)}</b></div><div class="card">Verbleibend<b>${money(data.summary.remaining)}</b></div></div><h2>Budgets</h2><table><thead><tr><th>Kategorie</th><th>Ausgegeben</th><th>Limit</th><th>Rest</th></tr></thead><tbody>${budgets}</tbody></table><h2>Buchungen</h2><table><thead><tr><th>Datum</th><th>Typ</th><th>Kategorie</th><th>Beschreibung</th><th>Betrag</th></tr></thead><tbody>${transactions}</tbody></table><script>window.onload=()=>{window.print()}<\/script></body></html>`);
  popup.document.close();
}

async function imageFileToDataUrl(file) {
  const raw = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = raw;
  });
  const max = 1600;
  const scale = Math.min(1, max / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', .82);
}

function openTransaction(type) {
  openDialog(type === 'income' ? 'Einnahme' : 'Ausgabe', `
    <input type="hidden" name="type" value="${type}">
    ${field('Betrag', 'amount', '', 'number', 'min="0.01" step="0.01" inputmode="decimal" required')}
    ${selectField('Kategorie', 'category', type === 'income' ? 'Einkommen' : 'Lebensmittel', type === 'income' ? ['Einkommen', 'Verkauf', 'Sonstiges'] : ['Lebensmittel', 'Freizeit', 'Wohnen', 'Mobilität', 'Haushalt', 'Versicherung', 'Sonstiges'])}
    ${field('Beschreibung', 'note', '', 'text', 'maxlength="160" placeholder="z. B. Wocheneinkauf"')}
    ${field('Datum', 'booked_on', todayLocal(), 'date', 'required')}
    ${memberSelectField('')}
    <div class="dialog-actions"><button type="button" class="btn btn-secondary" data-action="close-dialog">Abbrechen</button><button class="btn btn-primary">Buchen</button></div>
  `, 'transaction');
}

function openShopping(item = null) {
  const isExisting = Boolean(item?.id);
  openDialog(isExisting ? 'Artikel bearbeiten' : 'Artikel hinzufügen', `
    <input type="hidden" name="id" value="${item?.id ?? ''}">
    ${field('Produkt', 'name', item?.name ?? '', 'text', 'maxlength="80" required')}
    <div class="form-row">${field('Menge', 'quantity', item?.quantity ?? '1', 'text', 'maxlength="30" required')}${field('Preis', 'price', item?.price ?? '', 'number', 'min="0" step="0.01"')}</div>
    ${selectField('Abteilung', 'category', item?.category ?? 'Obst & Gemüse', ['Obst & Gemüse', 'Backwaren', 'Kühlregal', 'Tiefkühl', 'Vorrat', 'Haushalt', 'Sonstiges'])}
    ${memberSelectField(item?.member_id ?? '')}
    ${field('Notiz', 'note', item?.note ?? '', 'text', 'maxlength="140"')}
    <div class="dialog-actions">${isExisting ? `<button type="button" class="btn btn-danger" data-action="delete-shopping" data-id="${item.id}">${icon('trash', 15)} Löschen</button>` : `<button type="button" class="btn btn-secondary" data-action="close-dialog">Abbrechen</button>`}<button class="btn btn-primary">Speichern</button></div>
  `, 'shopping');
}

function openPantry(item = null, arranging = false) {
  openDialog(arranging ? 'Einräumen' : item ? 'Vorrat bearbeiten' : 'Vorrat hinzufügen', `
    <input type="hidden" name="id" value="${item?.id ?? ''}">
    <input type="hidden" name="inbox" value="${arranging ? '0' : item?.inbox ? '1' : '0'}">
    ${field('Produkt', 'name', item?.name ?? '', 'text', 'maxlength="80" required')}
    <div class="form-row">${field('Menge', 'quantity', item?.quantity ?? '1', 'text', 'maxlength="30" required')}${field('Einheit', 'unit', item?.unit ?? '', 'text', 'maxlength="20" placeholder="Stück, g, l"')}</div>
    ${selectField('Bereich', 'category', item?.category ?? 'Kühlregal', ['Obst & Gemüse', 'Backwaren', 'Kühlregal', 'Tiefkühl', 'Vorrat', 'Haushalt', 'Sonstiges'])}
    ${selectField('Lagerort', 'location', item?.location ?? (item?.category === 'Tiefkühl' ? 'Gefrierschrank' : item?.category === 'Kühlregal' ? 'Kühlschrank' : 'Vorratsschrank'), ['Kühlschrank', 'Gefrierschrank', 'Vorratsschrank', 'Keller', 'Sonstiges'])}
    <div class="form-row">${field('Ablaufdatum', 'expiry_date', item?.expiry_date ?? '', 'date')}${field('Kaufdatum', 'purchase_date', item?.purchase_date ?? '', 'date')}</div>
    <div class="form-row">${field('Geöffnet am', 'opened_at', item?.opened_at ?? '', 'date')}${field('Mindestbestand', 'min_quantity', item?.min_quantity ?? 0, 'number', 'min="0" step="0.01"')}</div>
    ${field('Preis', 'price', item?.price ?? '', 'number', 'min="0" step="0.01"')}
    ${field('Notiz', 'note', item?.note ?? '', 'text', 'maxlength="140"')}
    <label class="checkbox-row"><input type="checkbox" name="buy_again" ${item?.buy_again || item?.low_stock ? 'checked' : ''}>Nachkaufen markieren</label>
    <div class="dialog-actions">${item && !arranging ? `<button type="button" class="btn btn-danger" data-action="delete-pantry" data-id="${item.id}">${icon('trash', 15)} Löschen</button>` : `<button type="button" class="btn btn-secondary" data-action="close-dialog">Abbrechen</button>`}<button class="btn btn-primary">${arranging ? 'Einräumen' : 'Speichern'}</button></div>
  `, 'pantry');
}

function openNote(item = null) {
  const selected = item?.accent ?? 'blue';
  openDialog(item ? 'Notiz bearbeiten' : 'Neue Notiz', `
    <input type="hidden" name="id" value="${item?.id ?? ''}">
    <input type="hidden" name="accent" value="${selected}">
    ${field('Titel', 'title', item?.title ?? '', 'text', 'maxlength="100" required')}
    <div class="field"><label for="field-content">Inhalt</label><textarea class="textarea" id="field-content" name="content" maxlength="5000" placeholder="Schreib etwas auf …">${escapeHtml(item?.content ?? '')}</textarea></div>
    <div class="form-row">${field('Tag', 'tag', item?.tag ?? '', 'text', 'maxlength="40" placeholder="z. B. Rezept"')}${field('Fällig', 'due_date', item?.due_date ?? '', 'date')}</div>
    <div class="form-row">${selectField('Verknüpfung', 'related_type', item?.related_type ?? '', ['', 'Einkauf', 'Vorrat', 'Geld'])}${field('Verknüpft mit', 'related_name', item?.related_name ?? '', 'text', 'maxlength="80"')}</div>
    <div class="form-row">${field('Erledigt', 'checklist_done', item?.checklist_done ?? 0, 'number', 'min="0" step="1"')}${field('Gesamt', 'checklist_total', item?.checklist_total ?? 0, 'number', 'min="0" step="1"')}</div>
    <div class="field"><label>Farbe</label><div class="color-picker">${Object.keys(noteColor).map((color) => `<button type="button" class="color-dot ${color === selected ? 'selected' : ''}" style="background:${noteColor[color]}" data-action="note-color" data-color="${color}" aria-label="${color}"></button>`).join('')}</div></div>
    <label class="checkbox-row"><input type="checkbox" name="pinned" ${item?.pinned ? 'checked' : ''}>Anheften</label>
    ${item ? `<button type="button" class="btn btn-secondary block" data-action="archive-note" data-id="${item.id}">Archivieren</button>` : ''}
    <div class="dialog-actions">${item ? `<button type="button" class="btn btn-danger" data-action="delete-note" data-id="${item.id}">${icon('trash', 15)} Löschen</button>` : `<button type="button" class="btn btn-secondary" data-action="close-dialog">Abbrechen</button>`}<button class="btn btn-primary">Speichern</button></div>
  `, 'note');
}

function openBudget(item) {
  openDialog(`${item.name}-Budget`, `
    <input type="hidden" name="id" value="${item.id}">
    ${field('Monatslimit', 'limit_amount', item.limit_amount, 'number', 'min="0" step="0.01" required')}
    <div class="alert info">Aktuell ausgegeben: ${money(item.spent)}</div>
    <div class="dialog-actions"><button type="button" class="btn btn-secondary" data-action="close-dialog">Abbrechen</button><button class="btn btn-primary">Speichern</button></div>
  `, 'budget');
}

function openTemplates() {
  const templates = [
    ['Wocheneinkauf', ['Tomaten', 'Bananen', 'Vollkornbrot', 'Vollmilch', 'Joghurt natur']],
    ['Frühstück', ['Haferflocken', 'Vollmilch', 'Bananen']],
    ['Haushalt', ['Klopapier', 'Spülmittel', 'Müllbeutel']]
  ];
  openDialog('Vorlagen', `<div class="content-stack">${templates.map(([name, items], index) => `<button class="card pad" style="text-align:left;color:inherit" data-action="apply-template" data-index="${index}"><strong>${name}</strong><div class="row-sub">${items.join(' · ')}</div></button>`).join('')}</div>`);
}

function openReceiptDetail(receipt) {
  if (!receipt) return;
  openDialog(receipt.store_name || 'Kassenbon', `
    ${receipt.image_path ? `<img class="receipt-detail-image" src="${escapeHtml(receipt.image_path)}" alt="Kassenbon">` : ''}
    <div class="card pad"><div class="metric-label">${escapeHtml(receipt.receipt_date)}</div><div class="metric-value">${money(receipt.total)}</div></div>
    <div class="receipt-items">${receipt.parsed_items.length ? receipt.parsed_items.map((item) => `<div class="receipt-item"><span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.quantity || '1')}</small></span><b>${money(item.price)}</b></div>`).join('') : `<div class="empty-state compact"><span>Keine Einzelpositionen gespeichert.</span></div>`}</div>
    <div class="dialog-actions"><button class="btn btn-primary block" data-action="close-dialog">Schließen</button></div>
  `);
}

function openTransactionMenu(item) {
  openDialog(item.note || item.category, `<div class="card pad"><div class="metric-label">${item.booked_on}</div><div class="metric-value">${item.type === 'income' ? '+' : '−'}${money(item.amount)}</div><div class="row-sub">${escapeHtml(item.category)}</div></div><div class="dialog-actions"><button class="btn btn-secondary" data-action="close-dialog">Schließen</button><button class="btn btn-danger" data-action="delete-transaction" data-id="${item.id}">${icon('trash', 15)} Löschen</button></div>`);
}

function toast(message, type = '', actionLabel = '', actionFn = null) {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const id = actionFn ? `toast-${Date.now()}-${Math.random().toString(16).slice(2)}` : '';
  if (actionFn) toastActions.set(id, actionFn);
  el.innerHTML = `<span>${escapeHtml(message)}</span>${actionFn ? `<button data-toast-action="${id}">${escapeHtml(actionLabel)}</button>` : ''}`;
  toastRoot.append(el);
  setTimeout(() => { toastActions.delete(id); el.remove(); }, actionFn ? 6000 : 3200);
}

async function deleteWithUndo(kind, item) {
  if (!item || busy) return;
  const config = {
    shopping: {
      deletePath: `/api/shopping/${item.id}`,
      label: 'Artikel gelöscht',
      restore: () => api('/api/shopping', { method: 'POST', body: JSON.stringify({ name: item.name, quantity: item.quantity, category: item.category, note: item.note, price: item.price, member_id: item.member_id }) })
    },
    pantry: {
      deletePath: `/api/pantry/${item.id}`,
      label: 'Vorratsartikel gelöscht',
      restore: () => api('/api/pantry', { method: 'POST', body: JSON.stringify({ name: item.name, quantity: item.quantity, unit: item.unit, category: item.category, location: item.location, expiry_date: item.expiry_date, purchase_date: item.purchase_date, opened_at: item.opened_at, min_quantity: item.min_quantity, price: item.price, note: item.note, buy_again: item.buy_again, inbox: item.inbox }) })
    },
    note: {
      deletePath: `/api/notes/${item.id}`,
      label: 'Notiz gelöscht',
      restore: () => api('/api/notes', { method: 'POST', body: JSON.stringify({ title: item.title, content: item.content, tag: item.tag, due_date: item.due_date, related_type: item.related_type, related_name: item.related_name, accent: item.accent, pinned: item.pinned, checklist_done: item.checklist_done, checklist_total: item.checklist_total }) })
    },
    transaction: {
      deletePath: `/api/transactions/${item.id}`,
      label: 'Buchung gelöscht',
      restore: () => api('/api/transactions', { method: 'POST', body: JSON.stringify({ type: item.type, amount: item.amount, category: item.category, note: item.note, booked_on: item.booked_on, member_id: item.member_id }) })
    }
  }[kind];
  if (!config) return;
  busy = true;
  try {
    data = await api(config.deletePath, { method: 'DELETE' });
    closeDialog();
    renderApp();
    toast(config.label, '', 'Rückgängig', async () => {
      try {
        data = await config.restore();
        renderApp();
        toast('Wiederhergestellt');
      } catch (error) { toast(error.message, 'error'); }
    });
  } catch (error) { toast(error.message, 'error'); }
  finally { busy = false; }
}

async function refresh() {
  data = await api('/api/state');
  if (data?.cloud?.household_id) localStorage.setItem('selfmade-cloud-household', data.cloud.household_id);
  renderApp();
  checkNotifications();
  if (!localStorage.getItem('selfmade-onboarded-v3')) queueMicrotask(showOnboarding);
  queueMicrotask(flushOfflineQueue);
}

async function mutate(fn, successMessage = '') {
  if (busy) return;
  busy = true;
  try {
    const result = await fn();
    if (result?.state) data = result.state;
    else if (result?.settings || result?.summary) data = result;
    else data = await api('/api/state');
    closeDialog();
    renderApp();
    if (successMessage) toast(successMessage);
  } catch (error) {
    if (error.status === 409 || error.code === 'version_conflict') {
      try { data = await api('/api/state'); renderApp(); } catch {}
      toast('Cloud-Konflikt erkannt. Die aktuelle Version wurde neu geladen.', 'error');
    } else if (error.status === 401 && cloudConfig.enabled) {
      clearAuthSession();
      renderAuthScreen('Bitte erneut anmelden.');
    } else {
      toast(error.message, 'error');
    }
  } finally {
    busy = false;
  }
}

async function patchShopping(id, patch) {
  await mutate(() => api(`/api/shopping/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }));
}

function addMonth(value, delta) {
  const [year, month] = value.split('-').map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

shell.addEventListener('submit', async (event) => {
  const form = event.target.closest('form[data-auth-form]');
  if (!form) return;
  event.preventDefault();
  const values = Object.fromEntries(new FormData(form));
  try {
    const endpoint = form.dataset.authForm === 'signup' ? '/api/auth/signup' : '/api/auth/signin';
    const payload = await api(endpoint, { method: 'POST', body: JSON.stringify(values) }, false);
    if (payload?.access_token) {
      saveAuthSession(payload);
      localStorage.setItem('selfmade-onboarded-v3', '1');
      await refresh();
      toast(form.dataset.authForm === 'signup' ? 'Konto erstellt und angemeldet' : 'Angemeldet');
    } else if (form.dataset.authForm === 'signup') {
      authMode = 'signin';
      renderAuthScreen('Konto erstellt. Bestätige gegebenenfalls zuerst die E-Mail und melde dich danach an.');
    } else {
      throw new Error('Anmeldung fehlgeschlagen.');
    }
  } catch (error) {
    renderAuthScreen(error.message);
  }
});

shell.addEventListener('click', async (event) => {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;

  if (action === 'tab') {
    activeTab = target.dataset.tab;
    localStorage.setItem('selfmade-tab', activeTab);
    history.replaceState(null, '', `#${activeTab}`);
    renderApp();
  } else if (action === 'global-search') openGlobalSearch();
  else if (action === 'scan-barcode') openBarcodeScanner();
  else if (action === 'import-receipt') openReceiptImport();
  else if (action === 'recurring') openRecurring();
  else if (action === 'export-data') exportData();
  else if (action === 'export-transactions-csv') exportTransactionsCsv();
  else if (action === 'print-money-report') printMoneyReport();
  else if (action === 'add-suggestion') {
    await mutate(() => api('/api/shopping', { method: 'POST', body: JSON.stringify({ name: target.dataset.name, quantity: target.dataset.quantity || '1', category: target.dataset.category || 'Sonstiges' }) }), `${target.dataset.name} hinzugefügt`);
  } else if (action === 'save-recipe') {
    await mutate(() => api('/api/notes', { method: 'POST', body: JSON.stringify({ title: target.dataset.title, content: decodeURIComponent(target.dataset.content || ''), accent: 'green' }) }), 'Rezept als Notiz gespeichert');
  } else if (action === 'receipt-detail') openReceiptDetail(data.receipts?.find((item) => item.id === Number(target.dataset.id)));
  else if (action === 'settings') openSettings();
  else if (action === 'auth-mode') { authMode = target.dataset.mode === 'signup' ? 'signup' : 'signin'; renderAuthScreen(); }
  else if (action === 'auth-signout') {
    try { await api('/api/auth/signout', { method: 'POST' }); } catch {}
    clearAuthSession();
    closeDialog();
    data = null;
    renderAuthScreen('Du wurdest abgemeldet.');
  }
  else if (action === 'cloud-sync') {
    try { data = await api('/api/state'); closeDialog(); renderApp(); toast('Supabase-Synchronisierung abgeschlossen'); } catch (error) { toast(error.message, 'error'); }
  }
  else if (action === 'add-transaction') openTransaction(target.dataset.type);
  else if (action === 'money-mode') { moneyMode = target.dataset.mode; renderApp(); }
  else if (action === 'month-prev' || action === 'month-next') {
    const selected_month = addMonth(data.month, action === 'month-prev' ? -1 : 1);
    await mutate(() => api('/api/settings', { method: 'PATCH', body: JSON.stringify({ selected_month }) }));
  } else if (action === 'edit-budget') openBudget(data.budgets.find((item) => item.id === Number(target.dataset.id)));
  else if (action === 'transaction-menu') openTransactionMenu(data.transactions.find((item) => item.id === Number(target.dataset.id)));
  else if (action === 'edit-savings') openDialog('Sparbetrag', `${field('Gespart', 'savings', data.settings.savings, 'number', 'min="0" step="0.01" required')}<div class="dialog-actions"><button type="button" class="btn btn-secondary" data-action="close-dialog">Abbrechen</button><button class="btn btn-primary">Speichern</button></div>`, 'savings');
  else if (action === 'complete-challenge') toast('Die Challenge-Funktion ist als nächster Backend-Schritt vorbereitet.');
  else if (action === 'toggle-shopping') {
    const item = data.shopping.find((entry) => entry.id === Number(target.dataset.id));
    await patchShopping(item.id, { checked: !item.checked });
  } else if (action === 'quantity') {
    const item = data.shopping.find((entry) => entry.id === Number(target.dataset.id));
    const next = Math.max(1, Number(item.quantity) + Number(target.dataset.delta));
    await patchShopping(item.id, { quantity: String(next) });
  } else if (action === 'edit-shopping') openShopping(data.shopping.find((item) => item.id === Number(target.dataset.id)));
  else if (action === 'quick-shopping') {
    await mutate(() => api('/api/shopping', { method: 'POST', body: JSON.stringify({ name: target.dataset.name, quantity: '1', category: target.dataset.name === 'Spülmittel' ? 'Haushalt' : 'Vorrat' }) }), `${target.dataset.name} hinzugefügt`);
  } else if (action === 'templates') openTemplates();
  else if (action === 'start-store') {
    if (!data.shopping.length) return toast('Die Einkaufsliste ist leer.', 'error');
    storeMode = { active: true, categoryIndex: 0, checkout: false, prices: new Map(data.shopping.map((item) => [item.id, item.price ?? 0])) };
    renderApp();
  } else if (action === 'pantry-filter') { pantryFilter = target.dataset.filter; renderApp(); }
  else if (action === 'add-pantry') openPantry();
  else if (action === 'edit-pantry') openPantry(data.pantry.find((item) => item.id === Number(target.dataset.id)));
  else if (action === 'arrange-pantry') openPantry(data.pantry.find((item) => item.id === Number(target.dataset.id)), true);
  else if (action === 'arrange-all') {
    const inbox = data.pantry.filter((item) => item.inbox);
    if (inbox.length) openPantry(inbox[0], true);
  } else if (action === 'add-note') openNote();
  else if (action === 'edit-note') openNote(data.notes.find((item) => item.id === Number(target.dataset.id)));
  else if (action === 'toggle-store-item') {
    const item = data.shopping.find((entry) => entry.id === Number(target.dataset.id));
    await patchShopping(item.id, { checked: !item.checked });
  } else if (action === 'store-prev') { storeMode.categoryIndex = Math.max(0, storeMode.categoryIndex - 1); renderApp(); }
  else if (action === 'store-next') {
    const groups = storeCategories();
    if (storeMode.categoryIndex >= groups.length - 1) storeMode.checkout = true;
    else storeMode.categoryIndex += 1;
    renderApp();
  } else if (action === 'end-store') { storeMode.active = false; storeMode.checkout = false; renderApp(); }
  else if (action === 'checkout') {
    const items = data.shopping.filter((item) => item.checked).map((item) => ({ id: item.id, price: storeMode.prices.get(item.id) ?? item.price ?? 0 }));
    if (!items.length) return toast('Es ist kein Artikel im Wagen.', 'error');
    await mutate(() => api('/api/checkout', { method: 'POST', body: JSON.stringify({ items }) }), 'Einkauf abgeschlossen');
    storeMode.active = false;
    storeMode.checkout = false;
    activeTab = 'pantry';
    renderApp();
  }
});

shell.addEventListener('input', (event) => {
  if (event.target.id === 'note-search') {
    noteQuery = event.target.value;
    const grid = shell.querySelector('.notes-grid');
    if (grid) grid.innerHTML = notesGridHtml();
  }
  if (event.target.dataset.action === 'store-price') {
    const raw = event.target.value.replace(/[^0-9,.-]/g, '').replace(',', '.');
    storeMode.prices.set(Number(event.target.dataset.id), Math.max(0, Number(raw) || 0));
    const cart = shell.querySelector('.store-cart strong');
    if (cart) cart.textContent = money(storeTotal());
  }
});

shell.addEventListener('submit', async (event) => {
  const form = event.target.closest('form[data-form]');
  if (!form) return;
  event.preventDefault();
  const values = Object.fromEntries(new FormData(form));
  if (form.dataset.form === 'quick-shopping') {
    const raw = String(values.name ?? '').trim();
    if (!raw) return;
    const match = raw.match(/^(\d+(?:[,.]\d+)?(?:\s?(?:kg|g|l|ml|Stück|Packung|Becher))?)\s+(.+)$/i);
    const quantity = match ? match[1] : '1';
    const name = match ? match[2] : raw;
    await mutate(() => api('/api/shopping', { method: 'POST', body: JSON.stringify({ name, quantity, category: 'Sonstiges' }) }), `${name} hinzugefügt`);
  }
});

dialogRoot.addEventListener('click', async (event) => {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;
  if (action === 'close-dialog') closeDialog();
  else if (action === 'backdrop-close' && event.target === target) closeDialog();
  else if (action === 'search-go') { activeTab = target.dataset.tab; localStorage.setItem('selfmade-tab', activeTab); closeDialog(); renderApp(); }
  else if (action === 'enable-notifications') enableNotifications();
  else if (action === 'export-data') exportData();
  else if (action === 'add-member') openMember();
  else if (action === 'edit-member') openMember(data.members?.find((item) => item.id === Number(target.dataset.id)));
  else if (action === 'delete-member') await mutate(() => api(`/api/members/${target.dataset.id}`, { method: 'DELETE' }), 'Mitglied gelöscht');
  else if (action === 'start-barcode-camera') startBarcodeCamera();
  else if (action === 'lookup-barcode') lookupBarcode();
  else if (action === 'parse-receipt') parseReceiptDialog();
  else if (action === 'delete-recurring') await mutate(() => api(`/api/recurring/${target.dataset.id}`, { method: 'DELETE' }), 'Routine gelöscht');
  else if (action === 'confirm-reset') {
    openDialog('Alles zurücksetzen?', `<div class="alert danger">Alle eigenen Änderungen werden gelöscht und die Beispieldaten wiederhergestellt.</div><div class="dialog-actions"><button class="btn btn-secondary" data-action="close-dialog">Abbrechen</button><button class="btn btn-danger" data-action="reset">Zurücksetzen</button></div>`);
  } else if (action === 'reset') await mutate(() => api('/api/reset', { method: 'POST', body: '{}' }), 'Beispieldaten wiederhergestellt');
  else if (action === 'delete-shopping') await deleteWithUndo('shopping', data.shopping.find((item) => item.id === Number(target.dataset.id)));
  else if (action === 'delete-pantry') await deleteWithUndo('pantry', data.pantry.find((item) => item.id === Number(target.dataset.id)));
  else if (action === 'archive-note') await mutate(() => api(`/api/notes/${target.dataset.id}`, { method: 'PATCH', body: JSON.stringify({ archived: true }) }), 'Notiz archiviert');
  else if (action === 'delete-note') await deleteWithUndo('note', data.notes.find((item) => item.id === Number(target.dataset.id)));
  else if (action === 'delete-transaction') await deleteWithUndo('transaction', data.transactions.find((item) => item.id === Number(target.dataset.id)));
  else if (action === 'note-color') {
    dialogRoot.querySelector('input[name="accent"]').value = target.dataset.color;
    dialogRoot.querySelectorAll('.color-dot').forEach((el) => el.classList.toggle('selected', el === target));
  } else if (action === 'apply-template') {
    const templates = [
      [{ name: 'Tomaten', quantity: '500 g', category: 'Obst & Gemüse' }, { name: 'Bananen', quantity: '6', category: 'Obst & Gemüse' }, { name: 'Vollkornbrot', quantity: '1', category: 'Backwaren' }, { name: 'Vollmilch', quantity: '2', category: 'Kühlregal' }, { name: 'Joghurt natur', quantity: '4', category: 'Kühlregal' }],
      [{ name: 'Haferflocken', quantity: '1', category: 'Vorrat' }, { name: 'Vollmilch', quantity: '1', category: 'Kühlregal' }, { name: 'Bananen', quantity: '4', category: 'Obst & Gemüse' }],
      [{ name: 'Klopapier', quantity: '1', category: 'Haushalt' }, { name: 'Spülmittel', quantity: '1', category: 'Haushalt' }, { name: 'Müllbeutel', quantity: '1', category: 'Haushalt' }]
    ];
    const items = templates[Number(target.dataset.index)];
    try {
      busy = true;
      for (const item of items) await api('/api/shopping', { method: 'POST', body: JSON.stringify(item) });
      data = await api('/api/state');
      closeDialog();
      renderApp();
      toast('Vorlage hinzugefügt');
    } catch (error) { toast(error.message, 'error'); } finally { busy = false; }
  }
});

dialogRoot.addEventListener('input', (event) => {
  if (event.target.id === 'global-search') renderGlobalSearch(event.target.value);
});

dialogRoot.addEventListener('change', async (event) => {
  if (event.target.id === 'backup-file') {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const backup = JSON.parse(await file.text());
      data = await api('/api/import', { method: 'POST', body: JSON.stringify(backup) });
      closeDialog();
      renderApp();
      toast('Backup importiert');
    } catch (error) { toast(error.message || 'Backup konnte nicht importiert werden.', 'error'); }
    return;
  }
  if (event.target.id !== 'receipt-file') return;
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    receiptImageData = await imageFileToDataUrl(file);
    const preview = dialogRoot.querySelector('#receipt-preview');
    if (preview) { preview.src = receiptImageData; preview.hidden = false; }
    toast('Bonbild übernommen');
  } catch {
    toast('Bild konnte nicht verarbeitet werden.', 'error');
  }
});

dialogRoot.addEventListener('submit', async (event) => {
  const form = event.target.closest('form[data-form]');
  if (!form) return;
  event.preventDefault();
  const fd = new FormData(form);
  const values = Object.fromEntries(fd);
  const kind = form.dataset.form;

  if (kind === 'onboarding') {
    try {
      data = await api('/api/settings', { method: 'PATCH', body: JSON.stringify({ display_name: values.display_name, household_name: values.household_name }) });
      localStorage.setItem('selfmade-onboarded-v3', '1');
      if (fd.has('notifications')) await enableNotifications();
      closeDialog();
      renderApp();
      toast('Selfmade ist eingerichtet');
    } catch (error) { toast(error.message, 'error'); }
  } else if (kind === 'settings') {
    await mutate(() => api('/api/settings', { method: 'PATCH', body: JSON.stringify({ display_name: values.display_name, household_name: values.household_name, theme: values.theme, savings: Number(values.savings) }) }), 'Einstellungen gespeichert');
  } else if (kind === 'savings') {
    await mutate(() => api('/api/settings', { method: 'PATCH', body: JSON.stringify({ savings: Number(values.savings) }) }), 'Sparbetrag gespeichert');
  } else if (kind === 'transaction') {
    await mutate(() => api('/api/transactions', { method: 'POST', body: JSON.stringify({ ...values, amount: Number(values.amount) }) }), 'Buchung gespeichert');
  } else if (kind === 'budget') {
    await mutate(() => api(`/api/budgets/${values.id}`, { method: 'PATCH', body: JSON.stringify({ limit_amount: Number(values.limit_amount) }) }), 'Budget gespeichert');
  } else if (kind === 'shopping') {
    const payload = { name: values.name, quantity: values.quantity, category: values.category, member_id: values.member_id || null, note: values.note, price: values.price === '' ? null : Number(values.price) };
    await mutate(() => values.id ? api(`/api/shopping/${values.id}`, { method: 'PATCH', body: JSON.stringify(payload) }) : api('/api/shopping', { method: 'POST', body: JSON.stringify(payload) }), 'Artikel gespeichert');
  } else if (kind === 'pantry') {
    const payload = { name: values.name, quantity: values.quantity, unit: values.unit, category: values.category, location: values.location, expiry_date: values.expiry_date || null, purchase_date: values.purchase_date || null, opened_at: values.opened_at || null, min_quantity: Number(values.min_quantity || 0), price: values.price === '' ? null : Number(values.price), note: values.note, buy_again: fd.has('buy_again'), inbox: values.inbox === '1' };
    if (values.id && values.inbox === '0') payload.inbox = false;
    await mutate(() => values.id ? api(`/api/pantry/${values.id}`, { method: 'PATCH', body: JSON.stringify(payload) }) : api('/api/pantry', { method: 'POST', body: JSON.stringify(payload) }), values.inbox === '0' ? 'Artikel eingeräumt' : 'Vorrat gespeichert');
  } else if (kind === 'note') {
    const payload = { title: values.title, content: values.content, tag: values.tag, due_date: values.due_date || null, related_type: values.related_type, related_name: values.related_name, accent: values.accent, pinned: fd.has('pinned'), checklist_done: Number(values.checklist_done), checklist_total: Number(values.checklist_total) };
    await mutate(() => values.id ? api(`/api/notes/${values.id}`, { method: 'PATCH', body: JSON.stringify(payload) }) : api('/api/notes', { method: 'POST', body: JSON.stringify(payload) }), 'Notiz gespeichert');
  } else if (kind === 'member') {
    const payload = { name: values.name, avatar: values.avatar, role: values.role };
    await mutate(() => values.id ? api(`/api/members/${values.id}`, { method: 'PATCH', body: JSON.stringify(payload) }) : api('/api/members', { method: 'POST', body: JSON.stringify(payload) }), 'Mitglied gespeichert');
  } else if (kind === 'catalog-product') {
    const payload = { barcode: values.barcode, name: values.name, brand: values.brand, category: values.category, default_quantity: values.default_quantity, last_price: values.last_price === '' ? null : Number(values.last_price) };
    try {
      data = await api('/api/catalog', { method: 'POST', body: JSON.stringify(payload) });
      closeDialog();
      renderApp();
      openShopping({ name: payload.name, quantity: payload.default_quantity, category: payload.category, price: payload.last_price, note: payload.brand ? `Marke: ${payload.brand}` : '' });
      toast('Produkt im Katalog gespeichert');
    } catch (error) { toast(error.message, 'error'); }
  } else if (kind === 'recurring') {
    await mutate(() => api('/api/recurring', { method: 'POST', body: JSON.stringify({ name: values.name, quantity: values.quantity, category: values.category, frequency_days: Number(values.frequency_days), next_due: values.next_due, enabled: true }) }), 'Routine gespeichert');
  } else if (kind === 'receipt') {
    let items = [];
    try { items = JSON.parse(values.items_json || '[]'); } catch {}
    const ocrText = dialogRoot.querySelector('#receipt-ocr')?.value || '';
    const payload = {
      store_name: values.store_name,
      receipt_date: values.receipt_date,
      total: values.total === '' ? null : Number(values.total),
      transaction_category: values.transaction_category,
      items,
      ocr_text: ocrText,
      image_data_url: receiptImageData,
      book_transaction: fd.has('book_transaction'),
      transfer_to_pantry: fd.has('transfer_to_pantry')
    };
    await mutate(() => api('/api/receipts', { method: 'POST', body: JSON.stringify(payload) }), 'Kassenbon importiert');
  }
});

toastRoot.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-toast-action]');
  if (!button) return;
  const fn = toastActions.get(button.dataset.toastAction);
  toastActions.delete(button.dataset.toastAction);
  button.closest('.toast')?.remove();
  if (fn) await fn();
});

window.addEventListener('online', flushOfflineQueue);

window.addEventListener('hashchange', () => {
  const tab = location.hash.slice(1);
  if (tabs.includes(tab)) { activeTab = tab; localStorage.setItem('selfmade-tab', tab); renderApp(); }
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (dialogRoot.innerHTML) closeDialog();
    else if (storeMode.active) { storeMode.active = false; renderApp(); }
  }
});

matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (data?.settings?.theme === 'system') applyTheme();
});

setInterval(() => {
  const time = document.querySelector('.status-time');
  if (time) time.textContent = new Intl.DateTimeFormat('de-AT', { hour: '2-digit', minute: '2-digit' }).format(new Date());
}, 30000);

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

setInterval(cloudBackgroundRefresh, 15000);

bootstrapApplication().catch((error) => {
  if (error.status === 401 && cloudConfig.enabled) {
    clearAuthSession();
    renderAuthScreen('Bitte anmelden.');
    return;
  }
  shell.innerHTML = `<div class="boot-screen"><div class="boot-logo">!</div><strong>App konnte nicht geladen werden</strong><span>${escapeHtml(error.message)}</span><button class="btn btn-primary" onclick="location.reload()">Erneut versuchen</button></div>`;
});
