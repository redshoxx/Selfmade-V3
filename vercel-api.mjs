import { createSupabaseCloud, getBearerToken } from './supabase-cloud.mjs';
import { INITIAL_BACKUP } from './seed-backup.mjs';
import { DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_PUBLISHABLE_KEY } from './supabase-public-config.mjs';

const TABLES = [
  'settings', 'members', 'budgets', 'transactions', 'recurring_items',
  'shopping_items', 'pantry_items', 'notes', 'product_catalog',
  'purchases', 'receipts', 'challenge'
];

const nowIso = () => new Date().toISOString();
const isoDate = (date = new Date()) => {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};
const shiftDate = (days) => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return isoDate(date);
};
const normalizeMonth = (value) => /^\d{4}-\d{2}$/.test(value ?? '') ? value : isoDate().slice(0, 7);
const asBool = (value) => value ? 1 : 0;
const asNumber = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

function clone(value) {
  return structuredClone ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

function normalizeBackup(value) {
  if (!value || Number(value.version) !== 3 || typeof value.tables !== 'object') {
    throw Object.assign(new Error('Ungültiger Cloud-Datenstand.'), { status: 500 });
  }
  const backup = { version: 3, exported_at: value.exported_at || nowIso(), tables: {} };
  for (const table of TABLES) backup.tables[table] = Array.isArray(value.tables[table]) ? clone(value.tables[table]) : [];
  removeLegacyPlaceholderData(backup);
  return backup;
}

function removeLegacyPlaceholderData(backup) {
  const t = backup.tables;
  const legacyDetected =
    t.product_catalog.some((row) => row.brand === 'Beispielmarke') ||
    t.purchases.some((row) => row.source === 'seed') ||
    t.notes.some((row) => ['Packliste Wochenende', 'Lasagne wie bei Oma', 'WLAN Gäste'].includes(row.title));

  if (!legacyDetected) return false;

  const exactNames = {
    members: new Set(['Lena', 'Jonas']),
    recurring_items: new Set(['Vollmilch', 'Klopapier', 'Katzenfutter']),
    shopping_items: new Set(['Tomaten', 'Bananen', 'Vollkornbrot', 'Vollmilch', 'Joghurt natur', 'Butter', 'Frischkäse', 'Klopapier', 'Spülmittel', 'Haferflocken']),
    pantry_items: new Set(['Vollmilch', 'Hähnchenbrust', 'Tomaten', 'Hackfleisch', 'Joghurt natur', 'Feldsalat', 'Käseaufschnitt', 'Tiefkühl-Erbsen']),
    notes: new Set(['Packliste Wochenende', 'Lasagne wie bei Oma', 'Maße Regal Flur', 'WLAN Gäste', 'Geschenke Dezember', 'Handwerker']),
    product_catalog: new Set(['Vollmilch', 'Joghurt natur', 'Vollkornbrot', 'Tomaten', 'Spülmittel'])
  };

  for (const [table, names] of Object.entries(exactNames)) {
    t[table] = t[table].filter((row) => !names.has(row.name || row.title));
  }
  t.transactions = t.transactions.filter((row) => ![
    'Gehalt', 'Miete', 'Weitere Einkäufe', 'Wocheneinkauf', 'Unterwegs',
    'Freizeit', 'Mobilität', 'Haushalt', 'Versicherungen', 'Sonstiges'
  ].includes(row.note));
  t.budgets = [];
  t.purchases = t.purchases.filter((row) => row.source !== 'seed');
  t.challenge = [];
  if (t.settings[0]) {
    t.settings[0].savings = 0;
    t.settings[0].updated_at = nowIso();
  }
  backup.exported_at = nowIso();
  return true;
}

function nextId(rows) {
  return rows.reduce((max, row) => Math.max(max, Number(row.id) || 0), 0) + 1;
}

function requireText(value, field) {
  const text = String(value ?? '').trim();
  if (!text) throw Object.assign(new Error(`${field} darf nicht leer sein.`), { status: 400 });
  return text;
}

function routeId(pathname, prefix) {
  if (!pathname.startsWith(prefix)) return null;
  const value = pathname.slice(prefix.length);
  return /^\d+$/.test(value) ? Number(value) : null;
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { throw Object.assign(new Error('Ungültiges JSON.'), { status: 400 }); }
  }
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > 10_000_000) throw Object.assign(new Error('Anfrage zu groß.'), { status: 413 });
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw Object.assign(new Error('Ungültiges JSON.'), { status: 400 }); }
}

function sendJson(res, status, payload) {
  if (typeof res.status === 'function' && typeof res.json === 'function') return res.status(status).json(payload);
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store'
  });
  res.end(body);
}

function decodeJwtPayload(token) {
  try {
    const part = String(token).split('.')[1];
    if (!part) return {};
    const normalized = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
    return JSON.parse(Buffer.from(normalized, 'base64').toString('utf8'));
  } catch {
    return {};
  }
}

function parseReceiptText(text) {
  const lines = String(text ?? '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const pricePattern = /(-?\d{1,4}[.,]\d{2})\s*(?:€|EUR)?$/i;
  let storeName = '';
  let total = 0;
  const items = [];
  for (const line of lines) {
    if (!storeName && !pricePattern.test(line) && line.length <= 60) storeName = line;
    const totalMatch = line.match(/(?:summe|gesamt|total)\D*(-?\d+[.,]\d{2})/i);
    if (totalMatch) total = Math.max(total, Number(totalMatch[1].replace(',', '.')));
    const match = line.match(pricePattern);
    if (!match) continue;
    const name = line.slice(0, match.index).replace(/[.·:_-]+$/, '').trim();
    if (!name || /(?:summe|gesamt|total|bar|karte|mwst|ust)/i.test(name)) continue;
    items.push({ name: name.slice(0, 80), quantity: '1', category: 'Lebensmittel', price: Math.max(0, Number(match[1].replace(',', '.'))) });
  }
  if (!total) total = Number(items.reduce((sum, item) => sum + item.price, 0).toFixed(2));
  return { store_name: storeName.slice(0, 60), total, items: items.slice(0, 100) };
}

function mapOpenFoodFactsCategory(tags = []) {
  const values = Array.isArray(tags) ? tags.map((tag) => String(tag).toLowerCase()) : [];
  const has = (...needles) => values.some((tag) => needles.some((needle) => tag.includes(needle)));
  if (has('dairies', 'milks', 'yogurts', 'cheeses', 'butters')) return 'Kühlregal';
  if (has('breads', 'bakery', 'pastries')) return 'Backwaren';
  if (has('fruits', 'vegetables', 'plant-based-foods')) return 'Obst & Gemüse';
  if (has('frozen-foods', 'frozen')) return 'Tiefkühl';
  if (has('household', 'cleaning-products', 'toilet-paper')) return 'Haushalt';
  return 'Vorrat';
}

async function lookupOpenFoodFacts(barcode) {
  if (!/^\d{6,64}$/.test(barcode)) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);
  try {
    const fields = 'product_name,product_name_de,brands,quantity,categories_tags';
    const response = await fetch(`https://world.openfoodfacts.org/api/v3/product/${encodeURIComponent(barcode)}?fields=${fields}`, {
      headers: { 'user-agent': 'Selfmade-Haushaltsapp/5.1' },
      signal: controller.signal
    });
    if (!response.ok) return null;
    const payload = await response.json();
    const product = payload?.product;
    const name = String(product?.product_name_de || product?.product_name || '').trim();
    if (!name) return null;
    return {
      barcode,
      name: name.slice(0, 80),
      brand: String(product?.brands || '').trim().slice(0, 60),
      category: mapOpenFoodFactsCategory(product?.categories_tags),
      default_quantity: String(product?.quantity || '1').trim().slice(0, 30) || '1',
      last_price: null,
      source: 'openfoodfacts'
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function getState(backup) {
  const t = backup.tables;
  const settings = { ...(t.settings[0] || {}), savings: Number(t.settings[0]?.savings || 0) };
  const month = normalizeMonth(settings.selected_month);
  const members = [...t.members].sort((a, b) => Number(a.id) - Number(b.id));
  const transactions = t.transactions
    .filter((row) => String(row.booked_on || '').slice(0, 7) === month)
    .sort((a, b) => String(b.booked_on).localeCompare(String(a.booked_on)) || Number(b.id) - Number(a.id))
    .map((row) => ({ ...row, amount: Number(row.amount) }));

  const totals = transactions.reduce((acc, item) => {
    acc[item.type] += Number(item.amount);
    return acc;
  }, { income: 0, expense: 0 });

  const spendingByCategory = {};
  for (const item of transactions) if (item.type === 'expense') spendingByCategory[item.category] = (spendingByCategory[item.category] || 0) + Number(item.amount);

  const budgets = [...t.budgets]
    .sort((a, b) => Number(a.sort_order) - Number(b.sort_order) || Number(a.id) - Number(b.id))
    .map((row) => ({ ...row, limit_amount: Number(row.limit_amount), spent: Number((spendingByCategory[row.name] || 0).toFixed(2)) }));

  const shopping = [...t.shopping_items]
    .sort((a, b) => Number(a.sort_order) - Number(b.sort_order) || Number(a.id) - Number(b.id))
    .map((row) => ({ ...row, checked: Boolean(row.checked), price: row.price == null ? null : Number(row.price) }));

  const pantry = [...t.pantry_items]
    .sort((a, b) => Number(b.inbox) - Number(a.inbox) || (a.expiry_date ? 0 : 1) - (b.expiry_date ? 0 : 1) || String(a.expiry_date || '').localeCompare(String(b.expiry_date || '')) || Number(a.id) - Number(b.id))
    .map((row) => {
      const quantityNumber = Number(String(row.quantity).replace(',', '.').match(/-?\d+(?:\.\d+)?/)?.[0] || 0);
      return {
        ...row,
        min_quantity: Number(row.min_quantity || 0),
        price: row.price == null ? null : Number(row.price),
        buy_again: Boolean(row.buy_again),
        inbox: Boolean(row.inbox),
        low_stock: Number(row.min_quantity || 0) > 0 && quantityNumber <= Number(row.min_quantity)
      };
    });

  const notes = t.notes
    .filter((row) => !row.archived)
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || String(b.updated_at).localeCompare(String(a.updated_at)))
    .map((row) => ({ ...row, pinned: Boolean(row.pinned), archived: Boolean(row.archived) }));

  const recurring = [...t.recurring_items]
    .sort((a, b) => String(a.next_due).localeCompare(String(b.next_due)) || Number(a.id) - Number(b.id))
    .map((row) => ({ ...row, enabled: Boolean(row.enabled), due: Boolean(row.enabled) && row.next_due <= isoDate() }));

  const productCatalog = [...t.product_catalog]
    .sort((a, b) => String(a.name).localeCompare(String(b.name), 'de'))
    .map((row) => ({ ...row, last_price: row.last_price == null ? null : Number(row.last_price) }));

  const receipts = [...t.receipts]
    .sort((a, b) => String(b.receipt_date).localeCompare(String(a.receipt_date)) || Number(b.id) - Number(a.id))
    .slice(0, 20)
    .map((row) => ({ ...row, total: Number(row.total), parsed_items: typeof row.parsed_items === 'string' ? JSON.parse(row.parsed_items || '[]') : row.parsed_items || [] }));

  const historyMap = new Map();
  [...t.purchases]
    .sort((a, b) => String(b.purchased_on).localeCompare(String(a.purchased_on)) || Number(b.id) - Number(a.id))
    .forEach((row) => {
      const key = String(row.name).toLowerCase();
      if (!historyMap.has(key)) historyMap.set(key, []);
      historyMap.get(key).push(row);
    });

  const priceHistory = [...historyMap.values()].map((items) => ({
    name: items[0].name,
    category: items[0].category,
    last_price: Number(items[0].price),
    average_price: Number((items.reduce((sum, item) => sum + Number(item.price), 0) / items.length).toFixed(2)),
    purchase_count: items.length,
    last_store: items[0].store_name,
    last_date: items[0].purchased_on
  }));

  const shoppingNames = new Set(shopping.map((item) => String(item.name).toLowerCase()));
  const suggestions = recurring.filter((item) => item.due && !shoppingNames.has(String(item.name).toLowerCase())).map((item) => ({
    type: 'recurring', name: item.name, quantity: item.quantity, category: item.category, reason: 'Wiederkehrend fällig'
  })).concat(pantry.filter((item) => item.buy_again && !shoppingNames.has(String(item.name).toLowerCase())).map((item) => ({
    type: 'pantry', name: item.name, quantity: item.quantity, category: item.category, reason: 'Zum Nachkaufen markiert'
  }))).slice(0, 8);

  const challenge = t.challenge[0] || { id: 1, current_field: 0, completed_fields: 0, total_fields: 0, saved_amount: 0, target_amount: 0 };
  const urgentPantry = pantry.filter((item) => !item.inbox && item.expiry_date && item.expiry_date <= shiftDate(1)).length;

  return {
    settings,
    month,
    summary: {
      income: Number(totals.income.toFixed(2)),
      expense: Number(totals.expense.toFixed(2)),
      remaining: Number((totals.income - totals.expense).toFixed(2)),
      savings: Number(settings.savings)
    },
    budgets,
    transactions,
    shopping,
    pantry,
    notes,
    members,
    recurring,
    product_catalog: productCatalog,
    receipts,
    price_history: priceHistory,
    suggestions,
    challenge: { ...challenge, saved_amount: Number(challenge.saved_amount), target_amount: Number(challenge.target_amount) },
    badges: {
      shopping: shopping.filter((item) => !item.checked).length,
      pantry: urgentPantry,
      notes: notes.filter((item) => item.pinned).length
    }
  };
}

async function mutateBackup(backup, req, url) {
  const { pathname } = url;
  const method = req.method || 'GET';
  const t = backup.tables;
  const result = (payload, status = 200, changed = false) => ({ payload, status, changed });

  if (pathname === '/api/state' && method === 'GET') return result(getState(backup));
  if (pathname === '/api/export' && method === 'GET') return result({ ...clone(backup), exported_at: nowIso() });
  if (pathname === '/api/receipts/parse' && method === 'POST') {
    const body = await readBody(req);
    return result(parseReceiptText(body.ocr_text));
  }

  if (pathname === '/api/import' && method === 'POST') {
    const imported = normalizeBackup(await readBody(req));
    backup.version = imported.version;
    backup.exported_at = nowIso();
    backup.tables = imported.tables;
    return result(getState(backup), 200, true);
  }

  if (pathname === '/api/reset' && method === 'POST') {
    const displayName = t.settings[0]?.display_name;
    const householdName = t.settings[0]?.household_name;
    const reset = normalizeBackup(clone(INITIAL_BACKUP));
    if (reset.tables.settings[0]) {
      if (displayName) reset.tables.settings[0].display_name = displayName;
      if (householdName) reset.tables.settings[0].household_name = householdName;
      reset.tables.settings[0].updated_at = nowIso();
    }
    backup.version = reset.version;
    backup.exported_at = nowIso();
    backup.tables = reset.tables;
    return result(getState(backup), 200, true);
  }

  if (pathname === '/api/settings' && method === 'PATCH') {
    const body = await readBody(req);
    const row = t.settings[0];
    row.display_name = body.display_name === undefined ? row.display_name : requireText(body.display_name, 'Name').slice(0, 40);
    row.household_name = body.household_name === undefined ? row.household_name : requireText(body.household_name, 'Haushalt').slice(0, 60);
    row.theme = ['light', 'dark', 'system'].includes(body.theme) ? body.theme : row.theme;
    row.savings = body.savings === undefined ? row.savings : Math.max(0, asNumber(body.savings));
    row.selected_month = body.selected_month === undefined ? row.selected_month : normalizeMonth(body.selected_month);
    row.updated_at = nowIso();
    return result(getState(backup), 200, true);
  }

  if (pathname === '/api/members' && method === 'POST') {
    const body = await readBody(req);
    const name = requireText(body.name, 'Mitglied').slice(0, 40);
    t.members.push({ id: nextId(t.members), name, avatar: String(body.avatar ?? name[0] ?? '•').trim().slice(0, 2) || '•', role: String(body.role ?? 'Mitglied').trim().slice(0, 40) || 'Mitglied', created_at: nowIso() });
    return result(getState(backup), 201, true);
  }
  const memberId = routeId(pathname, '/api/members/');
  if (memberId && method === 'PATCH') {
    const body = await readBody(req);
    const row = t.members.find((item) => Number(item.id) === memberId);
    if (!row) throw Object.assign(new Error('Mitglied nicht gefunden.'), { status: 404 });
    row.name = body.name === undefined ? row.name : requireText(body.name, 'Mitglied').slice(0, 40);
    row.avatar = body.avatar === undefined ? row.avatar : String(body.avatar).trim().slice(0, 2) || row.name[0];
    row.role = body.role === undefined ? row.role : String(body.role).trim().slice(0, 40) || 'Mitglied';
    return result(getState(backup), 200, true);
  }
  if (memberId && method === 'DELETE') {
    t.transactions.forEach((item) => { if (Number(item.member_id) === memberId) item.member_id = null; });
    t.shopping_items.forEach((item) => { if (Number(item.member_id) === memberId) item.member_id = null; });
    t.members = t.members.filter((item) => Number(item.id) !== memberId);
    return result(getState(backup), 200, true);
  }

  if (pathname === '/api/catalog/lookup' && method === 'GET') {
    const barcode = String(url.searchParams.get('barcode') || '').trim().slice(0, 64);
    if (!barcode) return result({ product: null, source: 'none' });
    const row = t.product_catalog.find((item) => item.barcode === barcode);
    if (row) return result({ product: { ...row, last_price: row.last_price == null ? null : Number(row.last_price), source: 'local' }, source: 'local' });
    const external = await lookupOpenFoodFacts(barcode);
    if (!external) return result({ product: null, source: 'none' });
    t.product_catalog.push({ id: nextId(t.product_catalog), barcode: external.barcode, name: external.name, brand: external.brand, category: external.category, default_quantity: external.default_quantity, last_price: null, updated_at: nowIso() });
    return result({ product: external, source: 'openfoodfacts' }, 200, true);
  }
  if (pathname === '/api/catalog' && method === 'POST') {
    const body = await readBody(req);
    const barcode = requireText(body.barcode, 'Barcode').slice(0, 64);
    let row = t.product_catalog.find((item) => item.barcode === barcode);
    if (!row) {
      row = { id: nextId(t.product_catalog), barcode };
      t.product_catalog.push(row);
    }
    row.name = requireText(body.name, 'Produkt').slice(0, 80);
    row.brand = String(body.brand ?? '').trim().slice(0, 60);
    row.category = String(body.category ?? 'Sonstiges').trim().slice(0, 50) || 'Sonstiges';
    row.default_quantity = String(body.default_quantity ?? '1').trim().slice(0, 30) || '1';
    row.last_price = body.last_price === '' || body.last_price == null ? null : Math.max(0, asNumber(body.last_price));
    row.updated_at = nowIso();
    return result(getState(backup), 201, true);
  }

  if (pathname === '/api/recurring' && method === 'POST') {
    const body = await readBody(req);
    const timestamp = nowIso();
    t.recurring_items.push({
      id: nextId(t.recurring_items), name: requireText(body.name, 'Produkt').slice(0, 80),
      quantity: String(body.quantity ?? '1').trim().slice(0, 30) || '1',
      category: String(body.category ?? 'Sonstiges').trim().slice(0, 50) || 'Sonstiges',
      frequency_days: Math.max(1, Math.min(365, asNumber(body.frequency_days, 7))),
      next_due: /^\d{4}-\d{2}-\d{2}$/.test(body.next_due ?? '') ? body.next_due : isoDate(),
      enabled: body.enabled === false ? 0 : 1, created_at: timestamp, updated_at: timestamp
    });
    return result(getState(backup), 201, true);
  }
  const recurringId = routeId(pathname, '/api/recurring/');
  if (recurringId && method === 'PATCH') {
    const body = await readBody(req);
    const row = t.recurring_items.find((item) => Number(item.id) === recurringId);
    if (!row) throw Object.assign(new Error('Routine nicht gefunden.'), { status: 404 });
    row.name = body.name === undefined ? row.name : requireText(body.name, 'Produkt').slice(0, 80);
    row.quantity = body.quantity === undefined ? row.quantity : String(body.quantity).slice(0, 30);
    row.category = body.category === undefined ? row.category : String(body.category).slice(0, 50);
    row.frequency_days = body.frequency_days === undefined ? row.frequency_days : Math.max(1, Math.min(365, asNumber(body.frequency_days, row.frequency_days)));
    row.next_due = body.next_due === undefined ? row.next_due : (/^\d{4}-\d{2}-\d{2}$/.test(body.next_due ?? '') ? body.next_due : row.next_due);
    row.enabled = body.enabled === undefined ? row.enabled : asBool(body.enabled);
    row.updated_at = nowIso();
    return result(getState(backup), 200, true);
  }
  if (recurringId && method === 'DELETE') {
    t.recurring_items = t.recurring_items.filter((item) => Number(item.id) !== recurringId);
    return result(getState(backup), 200, true);
  }

  if (pathname === '/api/receipts' && method === 'POST') {
    const body = await readBody(req);
    const parsed = parseReceiptText(body.ocr_text);
    const receiptDate = /^\d{4}-\d{2}-\d{2}$/.test(body.receipt_date ?? '') ? body.receipt_date : isoDate();
    const storeName = String(body.store_name ?? parsed.store_name ?? '').trim().slice(0, 60);
    const items = Array.isArray(body.items) && body.items.length ? body.items : parsed.items;
    const total = body.total === '' || body.total == null ? parsed.total : Math.max(0, asNumber(body.total, parsed.total));
    t.receipts.push({ id: nextId(t.receipts), store_name: storeName, receipt_date: receiptDate, total, image_path: '', ocr_text: String(body.ocr_text ?? '').slice(0, 50000), parsed_items: JSON.stringify(items), created_at: nowIso() });
    for (const item of items) {
      const name = String(item.name ?? '').trim();
      if (!name) continue;
      t.purchases.push({ id: nextId(t.purchases), name: name.slice(0, 80), quantity: String(item.quantity ?? '1').slice(0, 30), category: String(item.category ?? 'Lebensmittel').slice(0, 50), price: Math.max(0, asNumber(item.price)), store_name: storeName, purchased_on: receiptDate, source: 'receipt' });
      if (body.transfer_to_pantry) {
        const timestamp = nowIso();
        t.pantry_items.push({ id: nextId(t.pantry_items), name: name.slice(0, 80), quantity: String(item.quantity ?? '1').slice(0, 30), unit: '', category: String(item.category ?? 'Lebensmittel').slice(0, 50), location: 'Vorratsschrank', expiry_date: null, purchase_date: receiptDate, opened_at: null, min_quantity: 0, price: Math.max(0, asNumber(item.price)), note: '', buy_again: 0, inbox: 1, added_at: timestamp, updated_at: timestamp });
      }
    }
    if (body.book_transaction !== false && total > 0) {
      t.transactions.push({ id: nextId(t.transactions), type: 'expense', amount: total, category: String(body.transaction_category ?? 'Lebensmittel').slice(0, 50), note: `Kassenbon ${storeName}`.trim(), booked_on: receiptDate, member_id: null, created_at: nowIso() });
    }
    return result(getState(backup), 201, true);
  }

  if (pathname === '/api/transactions' && method === 'POST') {
    const body = await readBody(req);
    const amount = asNumber(body.amount, NaN);
    if (!Number.isFinite(amount) || amount <= 0) throw Object.assign(new Error('Betrag muss größer als 0 sein.'), { status: 400 });
    t.transactions.push({ id: nextId(t.transactions), type: body.type === 'income' ? 'income' : 'expense', amount, category: requireText(body.category, 'Kategorie').slice(0, 50), note: String(body.note ?? '').trim().slice(0, 160), booked_on: /^\d{4}-\d{2}-\d{2}$/.test(body.booked_on ?? '') ? body.booked_on : isoDate(), member_id: body.member_id ? Number(body.member_id) : null, created_at: nowIso() });
    return result(getState(backup), 201, true);
  }
  const transactionId = routeId(pathname, '/api/transactions/');
  if (transactionId && method === 'DELETE') {
    t.transactions = t.transactions.filter((item) => Number(item.id) !== transactionId);
    return result(getState(backup), 200, true);
  }

  if (pathname === '/api/budgets' && method === 'POST') {
    const body = await readBody(req);
    const maxOrder = t.budgets.reduce((max, item) => Math.max(max, Number(item.sort_order) || 0), 0);
    t.budgets.push({
      id: nextId(t.budgets),
      name: requireText(body.name, 'Budgetname').slice(0, 50),
      icon: String(body.icon ?? 'wallet').slice(0, 30) || 'wallet',
      limit_amount: Math.max(0, asNumber(body.limit_amount)),
      accent: String(body.accent ?? 'blue').slice(0, 20) || 'blue',
      sort_order: maxOrder + 1
    });
    return result(getState(backup), 201, true);
  }

  const budgetId = routeId(pathname, '/api/budgets/');
  if (budgetId && method === 'PATCH') {
    const body = await readBody(req);
    const row = t.budgets.find((item) => Number(item.id) === budgetId);
    if (!row) throw Object.assign(new Error('Budget nicht gefunden.'), { status: 404 });
    row.name = body.name === undefined ? row.name : requireText(body.name, 'Budgetname').slice(0, 50);
    row.limit_amount = body.limit_amount === undefined ? row.limit_amount : Math.max(0, asNumber(body.limit_amount));
    return result(getState(backup), 200, true);
  }
  if (budgetId && method === 'DELETE') {
    t.budgets = t.budgets.filter((item) => Number(item.id) !== budgetId);
    return result(getState(backup), 200, true);
  }

  if (pathname === '/api/shopping' && method === 'POST') {
    const body = await readBody(req);
    const maxOrder = t.shopping_items.reduce((max, item) => Math.max(max, Number(item.sort_order) || 0), 0);
    t.shopping_items.push({ id: nextId(t.shopping_items), name: requireText(body.name, 'Produkt').slice(0, 80), quantity: String(body.quantity ?? '1').trim().slice(0, 30) || '1', category: String(body.category ?? 'Sonstiges').trim().slice(0, 50) || 'Sonstiges', note: String(body.note ?? '').trim().slice(0, 140), price: body.price === '' || body.price == null ? null : Math.max(0, asNumber(body.price)), checked: 0, member_id: body.member_id ? Number(body.member_id) : null, sort_order: maxOrder + 1, created_at: nowIso() });
    return result(getState(backup), 201, true);
  }
  const shoppingId = routeId(pathname, '/api/shopping/');
  if (shoppingId && method === 'PATCH') {
    const body = await readBody(req);
    const row = t.shopping_items.find((item) => Number(item.id) === shoppingId);
    if (!row) throw Object.assign(new Error('Einkaufsartikel nicht gefunden.'), { status: 404 });
    row.name = body.name === undefined ? row.name : requireText(body.name, 'Produkt').slice(0, 80);
    row.quantity = body.quantity === undefined ? row.quantity : String(body.quantity).trim().slice(0, 30) || '1';
    row.category = body.category === undefined ? row.category : String(body.category).trim().slice(0, 50) || 'Sonstiges';
    row.note = body.note === undefined ? row.note : String(body.note).trim().slice(0, 140);
    row.price = body.price === undefined ? row.price : (body.price === '' || body.price == null ? null : Math.max(0, asNumber(body.price)));
    row.checked = body.checked === undefined ? row.checked : asBool(body.checked);
    row.member_id = body.member_id === undefined ? row.member_id : (body.member_id ? Number(body.member_id) : null);
    return result(getState(backup), 200, true);
  }
  if (shoppingId && method === 'DELETE') {
    t.shopping_items = t.shopping_items.filter((item) => Number(item.id) !== shoppingId);
    return result(getState(backup), 200, true);
  }

  if (pathname === '/api/checkout' && method === 'POST') {
    const body = await readBody(req);
    const selections = Array.isArray(body.items) ? body.items : [];
    const selectedIds = selections.map((item) => Number(item.id)).filter(Number.isInteger);
    const checkedRows = selectedIds.length ? t.shopping_items.filter((row) => selectedIds.includes(Number(row.id))) : t.shopping_items.filter((row) => row.checked);
    if (!checkedRows.length) throw Object.assign(new Error('Es sind keine Artikel im Wagen.'), { status: 400 });
    const submittedPrice = new Map(selections.map((item) => [Number(item.id), Math.max(0, asNumber(item.price))]));
    const timestamp = nowIso();
    let total = 0;
    for (const row of checkedRows) {
      const price = submittedPrice.has(Number(row.id)) ? submittedPrice.get(Number(row.id)) : asNumber(row.price);
      total += price;
      t.purchases.push({ id: nextId(t.purchases), name: row.name, quantity: row.quantity, category: row.category, price, store_name: String(body.store_name ?? '').slice(0, 60), purchased_on: isoDate(), source: 'checkout' });
      if (row.category !== 'Haushalt') {
        t.pantry_items.push({ id: nextId(t.pantry_items), name: row.name, quantity: row.quantity, unit: '', category: row.category, location: 'Vorratsschrank', expiry_date: null, purchase_date: isoDate(), opened_at: null, min_quantity: 0, price, note: '', buy_again: 0, inbox: 1, added_at: timestamp, updated_at: timestamp });
      }
    }
    const purchasedIds = new Set(checkedRows.map((row) => Number(row.id)));
    t.shopping_items = t.shopping_items.filter((row) => !purchasedIds.has(Number(row.id)));
    if (total > 0) t.transactions.push({ id: nextId(t.transactions), type: 'expense', amount: Number(total.toFixed(2)), category: 'Lebensmittel', note: 'Einkauf', booked_on: isoDate(), member_id: null, created_at: timestamp });
    return result({ total: Number(total.toFixed(2)), state: getState(backup) }, 200, true);
  }

  if (pathname === '/api/pantry' && method === 'POST') {
    const body = await readBody(req);
    const timestamp = nowIso();
    t.pantry_items.push({ id: nextId(t.pantry_items), name: requireText(body.name, 'Produkt').slice(0, 80), quantity: String(body.quantity ?? '1').trim().slice(0, 30) || '1', unit: String(body.unit ?? '').trim().slice(0, 20), category: String(body.category ?? 'Sonstiges').trim().slice(0, 50) || 'Sonstiges', location: String(body.location ?? 'Vorratsschrank').trim().slice(0, 40) || 'Vorratsschrank', expiry_date: /^\d{4}-\d{2}-\d{2}$/.test(body.expiry_date ?? '') ? body.expiry_date : null, purchase_date: /^\d{4}-\d{2}-\d{2}$/.test(body.purchase_date ?? '') ? body.purchase_date : null, opened_at: /^\d{4}-\d{2}-\d{2}$/.test(body.opened_at ?? '') ? body.opened_at : null, min_quantity: Math.max(0, asNumber(body.min_quantity)), price: body.price === '' || body.price == null ? null : Math.max(0, asNumber(body.price)), note: String(body.note ?? '').trim().slice(0, 140), buy_again: asBool(body.buy_again), inbox: asBool(body.inbox), added_at: timestamp, updated_at: timestamp });
    return result(getState(backup), 201, true);
  }
  const pantryId = routeId(pathname, '/api/pantry/');
  if (pantryId && method === 'PATCH') {
    const body = await readBody(req);
    const row = t.pantry_items.find((item) => Number(item.id) === pantryId);
    if (!row) throw Object.assign(new Error('Vorratsartikel nicht gefunden.'), { status: 404 });
    row.name = body.name === undefined ? row.name : requireText(body.name, 'Produkt').slice(0, 80);
    row.quantity = body.quantity === undefined ? row.quantity : String(body.quantity).trim().slice(0, 30) || '1';
    row.unit = body.unit === undefined ? row.unit : String(body.unit).trim().slice(0, 20);
    row.category = body.category === undefined ? row.category : String(body.category).trim().slice(0, 50) || 'Sonstiges';
    row.location = body.location === undefined ? row.location : String(body.location).trim().slice(0, 40) || 'Vorratsschrank';
    row.expiry_date = body.expiry_date === undefined ? row.expiry_date : (/^\d{4}-\d{2}-\d{2}$/.test(body.expiry_date ?? '') ? body.expiry_date : null);
    row.purchase_date = body.purchase_date === undefined ? row.purchase_date : (/^\d{4}-\d{2}-\d{2}$/.test(body.purchase_date ?? '') ? body.purchase_date : null);
    row.opened_at = body.opened_at === undefined ? row.opened_at : (/^\d{4}-\d{2}-\d{2}$/.test(body.opened_at ?? '') ? body.opened_at : null);
    row.min_quantity = body.min_quantity === undefined ? row.min_quantity : Math.max(0, asNumber(body.min_quantity));
    row.price = body.price === undefined ? row.price : (body.price === '' || body.price == null ? null : Math.max(0, asNumber(body.price)));
    row.note = body.note === undefined ? row.note : String(body.note).trim().slice(0, 140);
    row.buy_again = body.buy_again === undefined ? row.buy_again : asBool(body.buy_again);
    row.inbox = body.inbox === undefined ? row.inbox : asBool(body.inbox);
    row.updated_at = nowIso();
    return result(getState(backup), 200, true);
  }
  if (pantryId && method === 'DELETE') {
    t.pantry_items = t.pantry_items.filter((item) => Number(item.id) !== pantryId);
    return result(getState(backup), 200, true);
  }

  if (pathname === '/api/notes' && method === 'POST') {
    const body = await readBody(req);
    const timestamp = nowIso();
    t.notes.push({ id: nextId(t.notes), title: requireText(body.title, 'Titel').slice(0, 100), content: String(body.content ?? '').trim().slice(0, 5000), accent: ['blue', 'green', 'orange', 'yellow', 'purple', 'red'].includes(body.accent) ? body.accent : 'blue', pinned: asBool(body.pinned), checklist_done: Math.max(0, asNumber(body.checklist_done)), checklist_total: Math.max(0, asNumber(body.checklist_total)), tag: String(body.tag ?? '').trim().slice(0, 40), due_date: /^\d{4}-\d{2}-\d{2}$/.test(body.due_date ?? '') ? body.due_date : null, related_type: String(body.related_type ?? '').trim().slice(0, 20), related_name: String(body.related_name ?? '').trim().slice(0, 80), archived: 0, created_at: timestamp, updated_at: timestamp });
    return result(getState(backup), 201, true);
  }
  const noteId = routeId(pathname, '/api/notes/');
  if (noteId && method === 'PATCH') {
    const body = await readBody(req);
    const row = t.notes.find((item) => Number(item.id) === noteId);
    if (!row) throw Object.assign(new Error('Notiz nicht gefunden.'), { status: 404 });
    row.title = body.title === undefined ? row.title : requireText(body.title, 'Titel').slice(0, 100);
    row.content = body.content === undefined ? row.content : String(body.content).trim().slice(0, 5000);
    row.accent = ['blue', 'green', 'orange', 'yellow', 'purple', 'red'].includes(body.accent) ? body.accent : row.accent;
    row.pinned = body.pinned === undefined ? row.pinned : asBool(body.pinned);
    row.checklist_done = body.checklist_done === undefined ? row.checklist_done : Math.max(0, asNumber(body.checklist_done));
    row.checklist_total = body.checklist_total === undefined ? row.checklist_total : Math.max(0, asNumber(body.checklist_total));
    row.tag = body.tag === undefined ? row.tag : String(body.tag).trim().slice(0, 40);
    row.due_date = body.due_date === undefined ? row.due_date : (/^\d{4}-\d{2}-\d{2}$/.test(body.due_date ?? '') ? body.due_date : null);
    row.related_type = body.related_type === undefined ? row.related_type : String(body.related_type).trim().slice(0, 20);
    row.related_name = body.related_name === undefined ? row.related_name : String(body.related_name).trim().slice(0, 80);
    row.archived = body.archived === undefined ? row.archived : asBool(body.archived);
    row.updated_at = nowIso();
    return result(getState(backup), 200, true);
  }
  if (noteId && method === 'DELETE') {
    t.notes = t.notes.filter((item) => Number(item.id) !== noteId);
    return result(getState(backup), 200, true);
  }

  throw Object.assign(new Error('API-Endpunkt nicht gefunden.'), { status: 404 });
}

function withCloudMeta(payload, snapshot, version, updatedAt) {
  const meta = {
    enabled: true,
    household_id: snapshot.householdId,
    household_name: snapshot.householdName,
    version,
    updated_at: updatedAt
  };
  if (payload?.state && typeof payload.state === 'object') return { ...payload, state: { ...payload.state, cloud: meta } };
  if (payload?.settings && payload?.summary) return { ...payload, cloud: meta };
  return payload;
}

export function createPureVercelHandler(options = {}) {
  const cloud = createSupabaseCloud({
    url: options.supabaseUrl ?? process.env.SUPABASE_URL ?? DEFAULT_SUPABASE_URL,
    publishableKey: options.supabasePublishableKey ?? process.env.SUPABASE_PUBLISHABLE_KEY ?? DEFAULT_SUPABASE_PUBLISHABLE_KEY
  });

  return async function handler(req, res) {
    const url = new URL(req.url || '/api/health', `https://${req.headers.host || 'localhost'}`);
    try {
      if (url.pathname === '/api/cloud/config' && req.method === 'GET') {
        return sendJson(res, 200, { enabled: cloud.enabled, storage: cloud.enabled ? 'supabase' : 'unconfigured' });
      }
      if (url.pathname === '/api/health' && req.method === 'GET') {
        return sendJson(res, cloud.enabled ? 200 : 503, { ok: cloud.enabled, timestamp: nowIso(), storage: cloud.enabled ? 'supabase' : 'unconfigured' });
      }
      if (!cloud.enabled) {
        throw Object.assign(new Error('Supabase ist nicht konfiguriert. Setze SUPABASE_URL und SUPABASE_PUBLISHABLE_KEY in Vercel.'), { status: 503, code: 'supabase_not_configured' });
      }

      if (url.pathname.startsWith('/api/auth/')) {
        if (url.pathname === '/api/auth/signup' && req.method === 'POST') {
          const body = await readBody(req);
          const email = requireText(body.email, 'E-Mail').toLowerCase().slice(0, 254);
          const password = requireText(body.password, 'Passwort');
          if (password.length < 8) throw Object.assign(new Error('Das Passwort muss mindestens 8 Zeichen haben.'), { status: 400 });
          return sendJson(res, 200, await cloud.signUp({ email, password, displayName: String(body.display_name || '').slice(0, 80) }));
        }
        if (url.pathname === '/api/auth/signin' && req.method === 'POST') {
          const body = await readBody(req);
          return sendJson(res, 200, await cloud.signIn({ email: requireText(body.email, 'E-Mail'), password: requireText(body.password, 'Passwort') }));
        }
        if (url.pathname === '/api/auth/refresh' && req.method === 'POST') {
          const body = await readBody(req);
          return sendJson(res, 200, await cloud.refresh(requireText(body.refresh_token, 'Refresh-Token')));
        }
        if (url.pathname === '/api/auth/user' && req.method === 'GET') {
          const token = getBearerToken(req);
          if (!token) throw Object.assign(new Error('Nicht angemeldet.'), { status: 401 });
          return sendJson(res, 200, await cloud.getUser(token));
        }
        if (url.pathname === '/api/auth/signout' && req.method === 'POST') {
          const token = getBearerToken(req);
          if (token) await cloud.signOut(token);
          return sendJson(res, 200, { ok: true });
        }
        throw Object.assign(new Error('Auth-Endpunkt nicht gefunden.'), { status: 404 });
      }

      const token = getBearerToken(req);
      if (!token) throw Object.assign(new Error('Bitte zuerst anmelden.'), { status: 401, code: 'auth_required' });
      if (url.pathname === '/api/cloud/households' && req.method === 'GET') {
        return sendJson(res, 200, { households: await cloud.listHouseholds(token) });
      }

      const claims = decodeJwtPayload(token);
      const displayName = String(claims.user_metadata?.display_name || claims.email?.split('@')?.[0] || 'Selfmade').slice(0, 80);
      const householdName = `${displayName || 'Mein'} Haushalt`.slice(0, 80);
      const initialState = normalizeBackup(clone(INITIAL_BACKUP));
      if (initialState.tables.settings[0]) {
        initialState.tables.settings[0].display_name = displayName;
        initialState.tables.settings[0].household_name = householdName;
        initialState.tables.settings[0].updated_at = nowIso();
      }
      const requestedHousehold = String(req.headers['x-selfmade-household'] || '').trim();
      const snapshot = await cloud.loadOrBootstrap(token, { householdId: requestedHousehold, initialState, displayName, householdName });
      const originalState = JSON.stringify(snapshot.data);
      const backup = normalizeBackup(snapshot.data);
      const cleanedLegacyData = JSON.stringify(backup) !== originalState;
      const operation = await mutateBackup(backup, req, url);
      let version = snapshot.version;
      let updatedAt = snapshot.updatedAt;
      if (operation.changed || cleanedLegacyData) {
        const saved = await cloud.saveState(token, { householdId: snapshot.householdId, expectedVersion: snapshot.version, state: backup });
        version = saved.version;
        updatedAt = saved.updatedAt;
      }
      return sendJson(res, operation.status, withCloudMeta(operation.payload, snapshot, version, updatedAt));
    } catch (error) {
      console.error('[selfmade-vercel]', error);
      return sendJson(res, error.status || 500, { error: error.message || 'Interner Serverfehler.', code: error.code });
    }
  };
}
