import http from 'node:http';
import { readFile, stat, mkdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { createSupabaseCloud, getBearerToken } from './supabase-cloud.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

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

const nowIso = () => new Date().toISOString();
const normalizeMonth = (value) => /^\d{4}-\d{2}$/.test(value ?? '') ? value : isoDate().slice(0, 7);
const asBool = (value) => value ? 1 : 0;
const asNumber = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

function createDatabase(dbPath) {
  const folder = path.dirname(dbPath);
  if (!existsSync(folder)) {
    throw new Error(`Datenbankordner fehlt: ${folder}`);
  }

  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      display_name TEXT NOT NULL DEFAULT 'Lena',
      household_name TEXT NOT NULL DEFAULT 'Mein Haushalt',
      theme TEXT NOT NULL DEFAULT 'light' CHECK (theme IN ('light','dark','system')),
      savings REAL NOT NULL DEFAULT 1240,
      selected_month TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      icon TEXT NOT NULL,
      limit_amount REAL NOT NULL CHECK (limit_amount >= 0),
      accent TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK (type IN ('income','expense')),
      amount REAL NOT NULL CHECK (amount >= 0),
      category TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      booked_on TEXT NOT NULL,
      member_id INTEGER,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS shopping_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      quantity TEXT NOT NULL DEFAULT '1',
      category TEXT NOT NULL DEFAULT 'Sonstiges',
      note TEXT NOT NULL DEFAULT '',
      price REAL,
      checked INTEGER NOT NULL DEFAULT 0 CHECK (checked IN (0,1)),
      member_id INTEGER,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pantry_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      quantity TEXT NOT NULL DEFAULT '1',
      unit TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'Sonstiges',
      location TEXT NOT NULL DEFAULT 'Vorratsschrank',
      expiry_date TEXT,
      purchase_date TEXT,
      opened_at TEXT,
      min_quantity REAL NOT NULL DEFAULT 0,
      price REAL,
      note TEXT NOT NULL DEFAULT '',
      buy_again INTEGER NOT NULL DEFAULT 0 CHECK (buy_again IN (0,1)),
      inbox INTEGER NOT NULL DEFAULT 0 CHECK (inbox IN (0,1)),
      added_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      accent TEXT NOT NULL DEFAULT 'blue',
      pinned INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0,1)),
      checklist_done INTEGER NOT NULL DEFAULT 0,
      checklist_total INTEGER NOT NULL DEFAULT 0,
      tag TEXT NOT NULL DEFAULT '',
      due_date TEXT,
      related_type TEXT NOT NULL DEFAULT '',
      related_name TEXT NOT NULL DEFAULT '',
      archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      avatar TEXT NOT NULL DEFAULT '•',
      role TEXT NOT NULL DEFAULT 'Mitglied',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recurring_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      quantity TEXT NOT NULL DEFAULT '1',
      category TEXT NOT NULL DEFAULT 'Sonstiges',
      frequency_days INTEGER NOT NULL DEFAULT 7,
      next_due TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS product_catalog (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      barcode TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      brand TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'Sonstiges',
      default_quantity TEXT NOT NULL DEFAULT '1',
      last_price REAL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      quantity TEXT NOT NULL DEFAULT '1',
      category TEXT NOT NULL DEFAULT 'Sonstiges',
      price REAL NOT NULL DEFAULT 0,
      store_name TEXT NOT NULL DEFAULT '',
      purchased_on TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'checkout'
    );

    CREATE TABLE IF NOT EXISTS receipts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      store_name TEXT NOT NULL DEFAULT '',
      receipt_date TEXT NOT NULL,
      total REAL NOT NULL DEFAULT 0,
      image_path TEXT NOT NULL DEFAULT '',
      ocr_text TEXT NOT NULL DEFAULT '',
      parsed_items TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS challenge (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      current_field INTEGER NOT NULL DEFAULT 22,
      completed_fields INTEGER NOT NULL DEFAULT 21,
      total_fields INTEGER NOT NULL DEFAULT 52,
      saved_amount REAL NOT NULL DEFAULT 231,
      target_amount REAL NOT NULL DEFAULT 1378
    );
  `);

  const ensureColumn = (table, column, definition) => {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all().map((row) => row.name);
    if (!columns.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  };
  ensureColumn('settings', 'household_name', "TEXT NOT NULL DEFAULT 'Mein Haushalt'");
  ensureColumn('transactions', 'member_id', 'INTEGER');
  ensureColumn('shopping_items', 'member_id', 'INTEGER');
  ensureColumn('pantry_items', 'unit', "TEXT NOT NULL DEFAULT ''");
  ensureColumn('pantry_items', 'location', "TEXT NOT NULL DEFAULT 'Vorratsschrank'");
  ensureColumn('pantry_items', 'purchase_date', 'TEXT');
  ensureColumn('pantry_items', 'opened_at', 'TEXT');
  ensureColumn('pantry_items', 'min_quantity', 'REAL NOT NULL DEFAULT 0');
  ensureColumn('pantry_items', 'price', 'REAL');
  ensureColumn('pantry_items', 'note', "TEXT NOT NULL DEFAULT ''");
  ensureColumn('notes', 'tag', "TEXT NOT NULL DEFAULT ''");
  ensureColumn('notes', 'due_date', 'TEXT');
  ensureColumn('notes', 'related_type', "TEXT NOT NULL DEFAULT ''");
  ensureColumn('notes', 'related_name', "TEXT NOT NULL DEFAULT ''");
  ensureColumn('notes', 'archived', 'INTEGER NOT NULL DEFAULT 0');

  seedDatabase(db);
  return db;
}

function seedDatabase(db) {
  const count = db.prepare('SELECT COUNT(*) AS count FROM settings').get().count;
  if (count > 0) return;

  const month = isoDate().slice(0, 7);
  const timestamp = nowIso();
  db.prepare(`INSERT INTO settings
    (id, display_name, theme, savings, selected_month, updated_at)
    VALUES (1, ?, 'light', 1240, ?, ?)`)
    .run('Lena', month, timestamp);

  const addBudget = db.prepare(`INSERT INTO budgets
    (name, icon, limit_amount, accent, sort_order) VALUES (?, ?, ?, ?, ?)`);
  [
    ['Lebensmittel', 'cart', 500, 'orange', 1],
    ['Freizeit', 'film', 150, 'red', 2],
    ['Wohnen', 'home', 1200, 'green', 3],
    ['Mobilität', 'car', 120, 'purple', 4],
    ['Haushalt', 'basket', 400, 'blue', 5]
  ].forEach((row) => addBudget.run(...row));

  const addTransaction = db.prepare(`INSERT INTO transactions
    (type, amount, category, note, booked_on, created_at) VALUES (?, ?, ?, ?, ?, ?)`);
  const today = isoDate();
  const yesterday = shiftDate(-1);
  [
    ['income', 2980, 'Einkommen', 'Gehalt', `${month}-01`, timestamp],
    ['expense', 1180, 'Wohnen', 'Miete', `${month}-01`, timestamp],
    ['expense', 377.70, 'Lebensmittel', 'Weitere Einkäufe', yesterday, timestamp],
    ['expense', 28.40, 'Lebensmittel', 'Wocheneinkauf', today, timestamp],
    ['expense', 6.50, 'Lebensmittel', 'Unterwegs', today, timestamp],
    ['expense', 168, 'Freizeit', 'Freizeit', `${month}-02`, timestamp],
    ['expense', 98, 'Mobilität', 'Mobilität', `${month}-02`, timestamp],
    ['expense', 350, 'Haushalt', 'Haushalt', `${month}-02`, timestamp],
    ['expense', 200, 'Versicherung', 'Versicherungen', `${month}-02`, timestamp],
    ['expense', 158.60, 'Sonstiges', 'Sonstiges', `${month}-02`, timestamp]
  ].forEach((row) => addTransaction.run(...row));

  const addShopping = db.prepare(`INSERT INTO shopping_items
    (name, quantity, category, note, price, checked, sort_order, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  [
    ['Tomaten', '500 g', 'Obst & Gemüse', '', 2.49, 0, 1],
    ['Bananen', '6', 'Obst & Gemüse', '', 1.89, 0, 2],
    ['Vollkornbrot', '1', 'Backwaren', 'geschnitten · von Jonas', 2.29, 0, 3],
    ['Vollmilch', '5', 'Kühlregal', '', 1.29, 1, 4],
    ['Joghurt natur', '4', 'Kühlregal', '', 0.79, 1, 5],
    ['Butter', '1', 'Kühlregal', '', 2.29, 1, 6],
    ['Frischkäse', '1', 'Kühlregal', '', 1.79, 0, 7],
    ['Klopapier', '1', 'Haushalt', 'die große Packung', 4.99, 0, 8],
    ['Spülmittel', '1', 'Haushalt', '', 1.99, 0, 9],
    ['Haferflocken', '1', 'Vorrat', '', 1.49, 0, 10]
  ].forEach((row) => addShopping.run(...row, timestamp));

  const addPantry = db.prepare(`INSERT INTO pantry_items
    (name, quantity, category, expiry_date, buy_again, inbox, added_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  [
    ['Vollmilch', '2 Stück', 'Kühlregal', null, 0, 1],
    ['Hähnchenbrust', '1 Stück', 'Kühlregal', null, 0, 1],
    ['Tomaten', '500 g', 'Obst & Gemüse', null, 0, 1],
    ['Hackfleisch', '400 g', 'Kühlregal', shiftDate(-1), 0, 0],
    ['Joghurt natur', '2 Becher', 'Kühlregal', shiftDate(1), 1, 0],
    ['Feldsalat', '1 Beutel', 'Obst & Gemüse', shiftDate(2), 0, 0],
    ['Käseaufschnitt', '1 Packung', 'Kühlregal', shiftDate(4), 0, 0],
    ['Tiefkühl-Erbsen', '2 Beutel', 'Tiefkühl', shiftDate(90), 0, 0]
  ].forEach((row) => addPantry.run(...row, timestamp, timestamp));

  const addNote = db.prepare(`INSERT INTO notes
    (title, content, accent, pinned, checklist_done, checklist_total, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  [
    ['Packliste Wochenende', '', 'blue', 1, 5, 11],
    ['Lasagne wie bei Oma', '500 g Hack, 2 Dosen Tomaten, Béchamel aus 50 g Butter, 50 g Mehl, 500 ml Milch. 45 Minuten bei 180 °C.', 'green', 0, 0, 0],
    ['Maße Regal Flur', 'Nische 78,5 cm breit, 212 cm hoch. Sockelleiste 6 cm.', 'orange', 0, 0, 0],
    ['WLAN Gäste', 'Passwort steht am Kühlschrank.', 'yellow', 0, 0, 0],
    ['Geschenke Dezember', '', 'purple', 0, 1, 5],
    ['Handwerker', 'Heizung entlüften, Termin Mo 10 Uhr.', 'red', 0, 0, 0]
  ].forEach((row) => addNote.run(...row, timestamp, timestamp));

  const addMember = db.prepare(`INSERT INTO members (name, avatar, role, created_at) VALUES (?, ?, ?, ?)`);
  addMember.run('Lena', 'L', 'Organisatorin', timestamp);
  addMember.run('Jonas', 'J', 'Mitglied', timestamp);

  const addRecurring = db.prepare(`INSERT INTO recurring_items
    (name, quantity, category, frequency_days, next_due, enabled, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 1, ?, ?)`);
  [
    ['Vollmilch', '2', 'Kühlregal', 7, today],
    ['Klopapier', '1 Packung', 'Haushalt', 30, shiftDate(5)],
    ['Katzenfutter', '6', 'Haushalt', 10, shiftDate(2)]
  ].forEach((row) => addRecurring.run(...row, timestamp, timestamp));

  const addCatalog = db.prepare(`INSERT INTO product_catalog
    (barcode, name, brand, category, default_quantity, last_price, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`);
  [
    ['9000000000011', 'Vollmilch', 'Beispielmarke', 'Kühlregal', '1 l', 1.29],
    ['9000000000028', 'Joghurt natur', 'Beispielmarke', 'Kühlregal', '4 Becher', 0.79],
    ['9000000000035', 'Vollkornbrot', 'Bäckerei', 'Backwaren', '1', 2.29],
    ['9000000000042', 'Tomaten', 'Regional', 'Obst & Gemüse', '500 g', 2.49],
    ['9000000000059', 'Spülmittel', 'Haushalt', 'Haushalt', '1', 1.99]
  ].forEach((row) => addCatalog.run(...row, timestamp));

  const addPurchase = db.prepare(`INSERT INTO purchases
    (name, quantity, category, price, store_name, purchased_on, source)
    VALUES (?, ?, ?, ?, ?, ?, ?)`);
  [
    ['Vollmilch', '2', 'Kühlregal', 1.29, 'BILLA', shiftDate(-8), 'seed'],
    ['Vollmilch', '2', 'Kühlregal', 1.35, 'SPAR', shiftDate(-15), 'seed'],
    ['Joghurt natur', '4', 'Kühlregal', 0.79, 'BILLA', shiftDate(-7), 'seed'],
    ['Tomaten', '500 g', 'Obst & Gemüse', 2.69, 'Hofer', shiftDate(-10), 'seed']
  ].forEach((row) => addPurchase.run(...row));

  db.prepare(`INSERT INTO challenge
    (id, current_field, completed_fields, total_fields, saved_amount, target_amount)
    VALUES (1, 22, 21, 52, 231, 1378)`).run();
}

function resetDatabase(db) {
  db.exec(`
    DELETE FROM receipts;
    DELETE FROM purchases;
    DELETE FROM product_catalog;
    DELETE FROM recurring_items;
    DELETE FROM members;
    DELETE FROM transactions;
    DELETE FROM budgets;
    DELETE FROM shopping_items;
    DELETE FROM pantry_items;
    DELETE FROM notes;
    DELETE FROM challenge;
    DELETE FROM settings;
    DELETE FROM sqlite_sequence;
  `);
  seedDatabase(db);
}

function serializeSettings(row) {
  return { ...row, savings: Number(row.savings) };
}

function getState(db) {
  const settings = serializeSettings(db.prepare('SELECT * FROM settings WHERE id = 1').get());
  const month = normalizeMonth(settings.selected_month);
  const transactions = db.prepare(`
    SELECT * FROM transactions
    WHERE substr(booked_on, 1, 7) = ?
    ORDER BY booked_on DESC, id DESC
  `).all(month).map((row) => ({ ...row, amount: Number(row.amount) }));

  const totals = transactions.reduce((acc, item) => {
    acc[item.type] += Number(item.amount);
    return acc;
  }, { income: 0, expense: 0 });

  const spendingByCategory = Object.create(null);
  for (const item of transactions) {
    if (item.type === 'expense') {
      spendingByCategory[item.category] = (spendingByCategory[item.category] ?? 0) + Number(item.amount);
    }
  }

  const budgets = db.prepare('SELECT * FROM budgets ORDER BY sort_order, id').all().map((row) => ({
    ...row,
    limit_amount: Number(row.limit_amount),
    spent: Number((spendingByCategory[row.name] ?? 0).toFixed(2))
  }));

  const shopping = db.prepare('SELECT * FROM shopping_items ORDER BY sort_order, id').all().map((row) => ({
    ...row,
    checked: Boolean(row.checked),
    price: row.price == null ? null : Number(row.price)
  }));

  const pantry = db.prepare(`
    SELECT * FROM pantry_items
    ORDER BY inbox DESC,
      CASE WHEN expiry_date IS NULL THEN 1 ELSE 0 END,
      expiry_date ASC,
      id ASC
  `).all().map((row) => {
    const quantityNumber = Number(String(row.quantity).replace(',', '.').match(/-?\d+(?:\.\d+)?/)?.[0] ?? 0);
    return {
      ...row,
      min_quantity: Number(row.min_quantity ?? 0),
      price: row.price == null ? null : Number(row.price),
      buy_again: Boolean(row.buy_again),
      inbox: Boolean(row.inbox),
      low_stock: Number(row.min_quantity ?? 0) > 0 && quantityNumber <= Number(row.min_quantity)
    };
  });

  const notes = db.prepare('SELECT * FROM notes WHERE archived = 0 ORDER BY pinned DESC, updated_at DESC').all().map((row) => ({
    ...row,
    pinned: Boolean(row.pinned),
    archived: Boolean(row.archived)
  }));

  const members = db.prepare('SELECT * FROM members ORDER BY id').all();
  const recurring = db.prepare('SELECT * FROM recurring_items ORDER BY next_due, id').all().map((row) => ({
    ...row,
    enabled: Boolean(row.enabled),
    due: row.enabled && row.next_due <= isoDate()
  }));
  const productCatalog = db.prepare('SELECT * FROM product_catalog ORDER BY name').all().map((row) => ({
    ...row,
    last_price: row.last_price == null ? null : Number(row.last_price)
  }));
  const receipts = db.prepare('SELECT * FROM receipts ORDER BY receipt_date DESC, id DESC LIMIT 20').all().map((row) => ({
    ...row,
    total: Number(row.total),
    parsed_items: JSON.parse(row.parsed_items || '[]')
  }));
  const purchaseRows = db.prepare('SELECT * FROM purchases ORDER BY purchased_on DESC, id DESC').all();
  const historyMap = new Map();
  for (const row of purchaseRows) {
    const key = row.name.toLowerCase();
    if (!historyMap.has(key)) historyMap.set(key, []);
    historyMap.get(key).push(row);
  }
  const priceHistory = [...historyMap.values()].map((items) => ({
    name: items[0].name,
    category: items[0].category,
    last_price: Number(items[0].price),
    average_price: Number((items.reduce((sum, item) => sum + Number(item.price), 0) / items.length).toFixed(2)),
    purchase_count: items.length,
    last_store: items[0].store_name,
    last_date: items[0].purchased_on
  }));
  const shoppingNames = new Set(shopping.map((item) => item.name.toLowerCase()));
  const suggestions = recurring.filter((item) => item.due && !shoppingNames.has(item.name.toLowerCase())).map((item) => ({
    type: 'recurring', name: item.name, quantity: item.quantity, category: item.category, reason: 'Wiederkehrend fällig'
  })).concat(
    pantry.filter((item) => item.buy_again && !shoppingNames.has(item.name.toLowerCase())).map((item) => ({
      type: 'pantry', name: item.name, quantity: item.quantity, category: item.category, reason: 'Zum Nachkaufen markiert'
    }))
  ).slice(0, 8);

  const challenge = db.prepare('SELECT * FROM challenge WHERE id = 1').get();
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
    challenge: {
      ...challenge,
      saved_amount: Number(challenge.saved_amount),
      target_amount: Number(challenge.target_amount)
    },
    badges: {
      shopping: shopping.filter((item) => !item.checked).length,
      pantry: urgentPantry,
      notes: notes.filter((item) => item.pinned).length
    }
  };
}

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store'
  });
  res.end(body);
}

function empty(res, status = 204) {
  res.writeHead(status);
  res.end();
}

async function parseBody(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > 10_000_000) throw Object.assign(new Error('Anfrage zu groß.'), { status: 413 });
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw Object.assign(new Error('Ungültiges JSON.'), { status: 400 });
  }
}

const routeId = (pathname, prefix) => {
  if (!pathname.startsWith(prefix)) return null;
  const value = pathname.slice(prefix.length);
  return /^\d+$/.test(value) ? Number(value) : null;
};

function requireText(value, field) {
  const text = String(value ?? '').trim();
  if (!text) throw Object.assign(new Error(`${field} darf nicht leer sein.`), { status: 400 });
  return text;
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

function decodeImageDataUrl(value) {
  const match = String(value ?? '').match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
  if (!match) return null;
  return { mime: match[1], buffer: Buffer.from(match[2], 'base64') };
}

const BACKUP_TABLES = [
  'settings', 'members', 'budgets', 'transactions', 'recurring_items',
  'shopping_items', 'pantry_items', 'notes', 'product_catalog',
  'purchases', 'receipts', 'challenge'
];

function exportDatabase(db) {
  const tables = {};
  for (const table of BACKUP_TABLES) tables[table] = db.prepare(`SELECT * FROM ${table}`).all();
  return { version: 3, exported_at: nowIso(), tables };
}

function importDatabase(db, backup) {
  if (!backup || Number(backup.version) !== 3 || typeof backup.tables !== 'object') {
    throw Object.assign(new Error('Ungültiges oder nicht unterstütztes Backup.'), { status: 400 });
  }
  const deletionOrder = ['receipts', 'purchases', 'product_catalog', 'shopping_items', 'pantry_items', 'notes', 'recurring_items', 'transactions', 'budgets', 'members', 'challenge', 'settings'];
  db.exec('BEGIN');
  try {
    for (const table of deletionOrder) db.exec(`DELETE FROM ${table}`);
    for (const table of BACKUP_TABLES) {
      const rows = Array.isArray(backup.tables[table]) ? backup.tables[table] : [];
      const existingColumns = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((row) => row.name));
      for (const row of rows) {
        const columns = Object.keys(row).filter((column) => existingColumns.has(column));
        if (!columns.length) continue;
        const placeholders = columns.map(() => '?').join(',');
        db.prepare(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${placeholders})`).run(...columns.map((column) => row[column]));
      }
    }
    if (!db.prepare('SELECT 1 FROM settings WHERE id = 1').get()) throw new Error('Backup enthält keine Einstellungen.');
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw Object.assign(error, { status: error.status ?? 400 });
  }
}

class CaptureResponse {
  constructor() {
    this.statusCode = 200;
    this.headers = {};
    this.chunks = [];
    this.ended = false;
  }
  writeHead(statusCode, headers = {}) {
    this.statusCode = statusCode;
    this.headers = { ...this.headers, ...headers };
    return this;
  }
  setHeader(name, value) { this.headers[String(name).toLowerCase()] = value; }
  getHeader(name) { return this.headers[String(name).toLowerCase()]; }
  write(chunk) { if (chunk != null) this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))); return true; }
  end(chunk) { if (chunk != null) this.write(chunk); this.ended = true; }
  bodyBuffer() { return Buffer.concat(this.chunks); }
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

function stableBackupString(backup) {
  const tables = {};
  for (const table of Object.keys(backup?.tables || {}).sort()) {
    const rows = Array.isArray(backup.tables[table]) ? backup.tables[table] : [];
    tables[table] = rows
      .map((row) => Object.fromEntries(Object.keys(row || {}).sort().map((key) => [key, row[key]])))
      .sort((a, b) => {
        if (a.id != null && b.id != null) return Number(a.id) - Number(b.id);
        return JSON.stringify(a).localeCompare(JSON.stringify(b));
      });
  }
  return JSON.stringify({ version: Number(backup?.version || 0), tables });
}

function cloudPayloadWithMeta(payload, cloudMeta) {
  if (!payload || typeof payload !== 'object') return payload;
  if (payload.state && typeof payload.state === 'object') {
    return { ...payload, state: { ...payload.state, cloud: cloudMeta } };
  }
  if (payload.settings && payload.summary) return { ...payload, cloud: cloudMeta };
  return payload;
}

function sendCaptured(res, captured, cloudMeta) {
  const contentType = String(captured.headers['content-type'] || captured.headers['Content-Type'] || '');
  const original = captured.bodyBuffer();
  let body = original;
  if (contentType.includes('application/json') && original.length) {
    try {
      const parsed = JSON.parse(original.toString('utf8'));
      body = Buffer.from(JSON.stringify(cloudPayloadWithMeta(parsed, cloudMeta)));
    } catch {}
  }
  const headers = { ...captured.headers, 'x-selfmade-storage': 'supabase' };
  delete headers['content-length'];
  delete headers['Content-Length'];
  headers['content-length'] = body.length;
  res.writeHead(captured.statusCode, headers);
  res.end(body);
}

async function handleSupabaseApi(req, res, db, url, cloud) {
  const pathname = url.pathname;
  const method = req.method ?? 'GET';

  if (pathname === '/api/cloud/config' && method === 'GET') {
    return json(res, 200, { enabled: cloud.enabled, storage: cloud.enabled ? 'supabase' : 'sqlite' });
  }

  if (pathname === '/api/health' && method === 'GET') {
    return json(res, 200, { ok: true, timestamp: nowIso(), storage: cloud.enabled ? 'supabase' : 'sqlite' });
  }

  if (pathname.startsWith('/api/auth/')) {
    if (!cloud.enabled) throw Object.assign(new Error('Supabase ist noch nicht konfiguriert.'), { status: 503 });
    if (pathname === '/api/auth/signup' && method === 'POST') {
      const body = await parseBody(req);
      const email = requireText(body.email, 'E-Mail').toLowerCase().slice(0, 254);
      const password = requireText(body.password, 'Passwort');
      if (password.length < 8) throw Object.assign(new Error('Das Passwort muss mindestens 8 Zeichen haben.'), { status: 400 });
      const payload = await cloud.signUp({ email, password, displayName: String(body.display_name || '').slice(0, 80) });
      return json(res, 200, payload);
    }
    if (pathname === '/api/auth/signin' && method === 'POST') {
      const body = await parseBody(req);
      const payload = await cloud.signIn({ email: requireText(body.email, 'E-Mail'), password: requireText(body.password, 'Passwort') });
      return json(res, 200, payload);
    }
    if (pathname === '/api/auth/refresh' && method === 'POST') {
      const body = await parseBody(req);
      const payload = await cloud.refresh(requireText(body.refresh_token, 'Refresh-Token'));
      return json(res, 200, payload);
    }
    if (pathname === '/api/auth/user' && method === 'GET') {
      const token = getBearerToken(req);
      if (!token) throw Object.assign(new Error('Nicht angemeldet.'), { status: 401 });
      return json(res, 200, await cloud.getUser(token));
    }
    if (pathname === '/api/auth/signout' && method === 'POST') {
      const token = getBearerToken(req);
      if (token) await cloud.signOut(token);
      return json(res, 200, { ok: true });
    }
    return json(res, 404, { error: 'Auth-Endpunkt nicht gefunden.' });
  }

  if (!cloud.enabled) return handleApi(req, res, db, url);

  const token = getBearerToken(req);
  if (!token) throw Object.assign(new Error('Bitte zuerst anmelden.'), { status: 401, code: 'auth_required' });

  if (pathname === '/api/cloud/households' && method === 'GET') {
    return json(res, 200, { households: await cloud.listHouseholds(token) });
  }

  const seedState = getState(db);
  const seedBackup = exportDatabase(db);
  const claims = decodeJwtPayload(token);
  const cloudDisplayName = String(claims.user_metadata?.display_name || claims.email?.split('@')?.[0] || seedState.settings.display_name).slice(0, 80);
  const cloudHouseholdName = `${cloudDisplayName || 'Mein'} Haushalt`.slice(0, 80);
  if (Array.isArray(seedBackup.tables?.settings) && seedBackup.tables.settings[0]) {
    seedBackup.tables.settings[0].display_name = cloudDisplayName;
    seedBackup.tables.settings[0].household_name = cloudHouseholdName;
  }
  const requestedHousehold = String(req.headers['x-selfmade-household'] || '').trim();
  const snapshot = await cloud.loadOrBootstrap(token, {
    householdId: requestedHousehold,
    initialState: seedBackup,
    displayName: cloudDisplayName,
    householdName: cloudHouseholdName
  });

  const memoryDb = createDatabase(':memory:');
  try {
    importDatabase(memoryDb, snapshot.data);
    const before = stableBackupString(exportDatabase(memoryDb));
    const captured = new CaptureResponse();
    await handleApi(req, captured, memoryDb, url);
    const afterBackup = exportDatabase(memoryDb);
    const after = stableBackupString(afterBackup);
    let version = snapshot.version;
    let updatedAt = snapshot.updatedAt;
    if (after !== before) {
      const saved = await cloud.saveState(token, {
        householdId: snapshot.householdId,
        expectedVersion: snapshot.version,
        state: afterBackup
      });
      version = saved.version;
      updatedAt = saved.updatedAt;
    }
    return sendCaptured(res, captured, {
      enabled: true,
      household_id: snapshot.householdId,
      household_name: snapshot.householdName,
      version,
      updated_at: updatedAt
    });
  } finally {
    try { memoryDb.close(); } catch {}
  }
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
      headers: { 'user-agent': 'Selfmade-Haushaltsapp/3.0 (local PWA barcode lookup)' },
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

async function handleApi(req, res, db, url) {
  const { pathname } = url;
  const method = req.method ?? 'GET';

  if (pathname === '/api/health' && method === 'GET') {
    return json(res, 200, { ok: true, timestamp: nowIso() });
  }

  if (pathname === '/api/state' && method === 'GET') {
    return json(res, 200, getState(db));
  }

  if (pathname === '/api/members' && method === 'POST') {
    const body = await parseBody(req);
    const name = requireText(body.name, 'Mitglied').slice(0, 40);
    const avatar = String(body.avatar ?? name[0] ?? '•').trim().slice(0, 2) || '•';
    const role = String(body.role ?? 'Mitglied').trim().slice(0, 40) || 'Mitglied';
    db.prepare(`INSERT INTO members (name, avatar, role, created_at) VALUES (?, ?, ?, ?)`).run(name, avatar, role, nowIso());
    return json(res, 201, getState(db));
  }

  const memberId = routeId(pathname, '/api/members/');
  if (memberId && method === 'PATCH') {
    const body = await parseBody(req);
    const row = db.prepare('SELECT * FROM members WHERE id = ?').get(memberId);
    if (!row) throw Object.assign(new Error('Mitglied nicht gefunden.'), { status: 404 });
    const name = body.name === undefined ? row.name : requireText(body.name, 'Mitglied').slice(0, 40);
    const avatar = body.avatar === undefined ? row.avatar : String(body.avatar).trim().slice(0, 2) || name[0];
    const role = body.role === undefined ? row.role : String(body.role).trim().slice(0, 40) || 'Mitglied';
    db.prepare('UPDATE members SET name = ?, avatar = ?, role = ? WHERE id = ?').run(name, avatar, role, memberId);
    return json(res, 200, getState(db));
  }
  if (memberId && method === 'DELETE') {
    db.prepare('UPDATE transactions SET member_id = NULL WHERE member_id = ?').run(memberId);
    db.prepare('UPDATE shopping_items SET member_id = NULL WHERE member_id = ?').run(memberId);
    db.prepare('DELETE FROM members WHERE id = ?').run(memberId);
    return json(res, 200, getState(db));
  }

  if (pathname === '/api/catalog/lookup' && method === 'GET') {
    const barcode = String(url.searchParams.get('barcode') ?? '').trim().slice(0, 64);
    if (!barcode) return json(res, 200, { product: null, source: 'none' });
    const row = db.prepare('SELECT * FROM product_catalog WHERE barcode = ?').get(barcode);
    if (row) {
      return json(res, 200, {
        product: { ...row, last_price: row.last_price == null ? null : Number(row.last_price), source: 'local' },
        source: 'local'
      });
    }
    const external = await lookupOpenFoodFacts(barcode);
    if (!external) return json(res, 200, { product: null, source: 'none' });
    db.prepare(`INSERT INTO product_catalog (barcode, name, brand, category, default_quantity, last_price, updated_at)
      VALUES (?, ?, ?, ?, ?, NULL, ?)
      ON CONFLICT(barcode) DO UPDATE SET name = excluded.name, brand = excluded.brand, category = excluded.category, default_quantity = excluded.default_quantity, updated_at = excluded.updated_at`)
      .run(external.barcode, external.name, external.brand, external.category, external.default_quantity, nowIso());
    return json(res, 200, { product: external, source: 'openfoodfacts' });
  }

  if (pathname === '/api/catalog' && method === 'POST') {
    const body = await parseBody(req);
    const barcode = requireText(body.barcode, 'Barcode').slice(0, 64);
    const name = requireText(body.name, 'Produkt').slice(0, 80);
    const brand = String(body.brand ?? '').trim().slice(0, 60);
    const category = String(body.category ?? 'Sonstiges').trim().slice(0, 50) || 'Sonstiges';
    const quantity = String(body.default_quantity ?? '1').trim().slice(0, 30) || '1';
    const price = body.last_price === '' || body.last_price == null ? null : Math.max(0, asNumber(body.last_price));
    db.prepare(`INSERT INTO product_catalog (barcode, name, brand, category, default_quantity, last_price, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(barcode) DO UPDATE SET name = excluded.name, brand = excluded.brand, category = excluded.category, default_quantity = excluded.default_quantity, last_price = excluded.last_price, updated_at = excluded.updated_at`)
      .run(barcode, name, brand, category, quantity, price, nowIso());
    return json(res, 201, getState(db));
  }

  if (pathname === '/api/recurring' && method === 'POST') {
    const body = await parseBody(req);
    const name = requireText(body.name, 'Produkt').slice(0, 80);
    const quantity = String(body.quantity ?? '1').trim().slice(0, 30) || '1';
    const category = String(body.category ?? 'Sonstiges').trim().slice(0, 50) || 'Sonstiges';
    const frequency = Math.max(1, Math.min(365, asNumber(body.frequency_days, 7)));
    const nextDue = /^\d{4}-\d{2}-\d{2}$/.test(body.next_due ?? '') ? body.next_due : isoDate();
    const timestamp = nowIso();
    db.prepare(`INSERT INTO recurring_items (name, quantity, category, frequency_days, next_due, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(name, quantity, category, frequency, nextDue, body.enabled === false ? 0 : 1, timestamp, timestamp);
    return json(res, 201, getState(db));
  }

  const recurringId = routeId(pathname, '/api/recurring/');
  if (recurringId && method === 'PATCH') {
    const body = await parseBody(req);
    const row = db.prepare('SELECT * FROM recurring_items WHERE id = ?').get(recurringId);
    if (!row) throw Object.assign(new Error('Routine nicht gefunden.'), { status: 404 });
    db.prepare(`UPDATE recurring_items SET name = ?, quantity = ?, category = ?, frequency_days = ?, next_due = ?, enabled = ?, updated_at = ? WHERE id = ?`)
      .run(
        body.name === undefined ? row.name : requireText(body.name, 'Produkt').slice(0, 80),
        body.quantity === undefined ? row.quantity : String(body.quantity).slice(0, 30),
        body.category === undefined ? row.category : String(body.category).slice(0, 50),
        body.frequency_days === undefined ? row.frequency_days : Math.max(1, Math.min(365, asNumber(body.frequency_days, row.frequency_days))),
        body.next_due === undefined ? row.next_due : (/^\d{4}-\d{2}-\d{2}$/.test(body.next_due ?? '') ? body.next_due : row.next_due),
        body.enabled === undefined ? row.enabled : asBool(body.enabled),
        nowIso(), recurringId
      );
    return json(res, 200, getState(db));
  }

  if (recurringId && method === 'DELETE') {
    db.prepare('DELETE FROM recurring_items WHERE id = ?').run(recurringId);
    return json(res, 200, getState(db));
  }

  if (pathname === '/api/receipts/parse' && method === 'POST') {
    const body = await parseBody(req);
    return json(res, 200, parseReceiptText(body.ocr_text));
  }

  if (pathname === '/api/receipts' && method === 'POST') {
    const body = await parseBody(req);
    const parsed = parseReceiptText(body.ocr_text);
    const receiptDate = /^\d{4}-\d{2}-\d{2}$/.test(body.receipt_date ?? '') ? body.receipt_date : isoDate();
    const storeName = String(body.store_name ?? parsed.store_name ?? '').trim().slice(0, 60);
    const items = Array.isArray(body.items) && body.items.length ? body.items : parsed.items;
    const total = body.total === '' || body.total == null ? parsed.total : Math.max(0, asNumber(body.total, parsed.total));
    let imagePath = '';
    const decoded = decodeImageDataUrl(body.image_data_url);
    if (decoded && decoded.buffer.length <= 8_000_000) {
      const ext = decoded.mime === 'image/png' ? 'png' : decoded.mime === 'image/webp' ? 'webp' : 'jpg';
      const folder = path.join(PUBLIC_DIR, 'receipts');
      await mkdir(folder, { recursive: true });
      const filename = `receipt-${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;
      await writeFile(path.join(folder, filename), decoded.buffer);
      imagePath = `/receipts/${filename}`;
    }
    db.exec('BEGIN');
    try {
      db.prepare(`INSERT INTO receipts (store_name, receipt_date, total, image_path, ocr_text, parsed_items, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(storeName, receiptDate, total, imagePath, String(body.ocr_text ?? '').slice(0, 50000), JSON.stringify(items), nowIso());
      for (const item of items) {
        const name = String(item.name ?? '').trim();
        if (!name) continue;
        db.prepare(`INSERT INTO purchases (name, quantity, category, price, store_name, purchased_on, source) VALUES (?, ?, ?, ?, ?, ?, 'receipt')`)
          .run(name.slice(0, 80), String(item.quantity ?? '1').slice(0, 30), String(item.category ?? 'Lebensmittel').slice(0, 50), Math.max(0, asNumber(item.price)), storeName, receiptDate);
        if (body.transfer_to_pantry) {
          const timestamp = nowIso();
          db.prepare(`INSERT INTO pantry_items (name, quantity, category, expiry_date, buy_again, inbox, added_at, updated_at) VALUES (?, ?, ?, NULL, 0, 1, ?, ?)`)
            .run(name.slice(0, 80), String(item.quantity ?? '1').slice(0, 30), String(item.category ?? 'Lebensmittel').slice(0, 50), timestamp, timestamp);
        }
      }
      if (body.book_transaction !== false && total > 0) {
        db.prepare(`INSERT INTO transactions (type, amount, category, note, booked_on, created_at) VALUES ('expense', ?, ?, ?, ?, ?)`)
          .run(total, String(body.transaction_category ?? 'Lebensmittel').slice(0, 50), `Kassenbon ${storeName}`.trim(), receiptDate, nowIso());
      }
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    return json(res, 201, getState(db));
  }

  if (pathname === '/api/export' && method === 'GET') {
    return json(res, 200, exportDatabase(db));
  }

  if (pathname === '/api/import' && method === 'POST') {
    const body = await parseBody(req);
    importDatabase(db, body);
    return json(res, 200, getState(db));
  }

  if (pathname === '/api/settings' && method === 'PATCH') {
    const body = await parseBody(req);
    const current = db.prepare('SELECT * FROM settings WHERE id = 1').get();
    const name = body.display_name === undefined ? current.display_name : requireText(body.display_name, 'Name').slice(0, 40);
    const householdName = body.household_name === undefined ? current.household_name : requireText(body.household_name, 'Haushalt').slice(0, 60);
    const theme = ['light', 'dark', 'system'].includes(body.theme) ? body.theme : current.theme;
    const savings = body.savings === undefined ? current.savings : Math.max(0, asNumber(body.savings));
    const selectedMonth = body.selected_month === undefined ? current.selected_month : normalizeMonth(body.selected_month);
    db.prepare(`UPDATE settings SET display_name = ?, household_name = ?, theme = ?, savings = ?, selected_month = ?, updated_at = ? WHERE id = 1`)
      .run(name, householdName, theme, savings, selectedMonth, nowIso());
    return json(res, 200, getState(db));
  }

  if (pathname === '/api/transactions' && method === 'POST') {
    const body = await parseBody(req);
    const type = body.type === 'income' ? 'income' : 'expense';
    const amount = asNumber(body.amount, NaN);
    if (!Number.isFinite(amount) || amount <= 0) throw Object.assign(new Error('Betrag muss größer als 0 sein.'), { status: 400 });
    const category = requireText(body.category, 'Kategorie').slice(0, 50);
    const note = String(body.note ?? '').trim().slice(0, 160);
    const bookedOn = /^\d{4}-\d{2}-\d{2}$/.test(body.booked_on ?? '') ? body.booked_on : isoDate();
    const memberId = body.member_id ? Number(body.member_id) : null;
    db.prepare(`INSERT INTO transactions (type, amount, category, note, booked_on, member_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(type, amount, category, note, bookedOn, memberId, nowIso());
    return json(res, 201, getState(db));
  }

  const transactionId = routeId(pathname, '/api/transactions/');
  if (transactionId && method === 'DELETE') {
    db.prepare('DELETE FROM transactions WHERE id = ?').run(transactionId);
    return json(res, 200, getState(db));
  }

  const budgetId = routeId(pathname, '/api/budgets/');
  if (budgetId && method === 'PATCH') {
    const body = await parseBody(req);
    const row = db.prepare('SELECT * FROM budgets WHERE id = ?').get(budgetId);
    if (!row) throw Object.assign(new Error('Budget nicht gefunden.'), { status: 404 });
    const limit = body.limit_amount === undefined ? row.limit_amount : Math.max(0, asNumber(body.limit_amount));
    db.prepare('UPDATE budgets SET limit_amount = ? WHERE id = ?').run(limit, budgetId);
    return json(res, 200, getState(db));
  }

  if (pathname === '/api/shopping' && method === 'POST') {
    const body = await parseBody(req);
    const name = requireText(body.name, 'Produkt').slice(0, 80);
    const quantity = String(body.quantity ?? '1').trim().slice(0, 30) || '1';
    const category = String(body.category ?? 'Sonstiges').trim().slice(0, 50) || 'Sonstiges';
    const note = String(body.note ?? '').trim().slice(0, 140);
    const price = body.price === '' || body.price == null ? null : Math.max(0, asNumber(body.price));
    const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS value FROM shopping_items').get().value;
    const memberId = body.member_id ? Number(body.member_id) : null;
    db.prepare(`INSERT INTO shopping_items (name, quantity, category, note, price, checked, member_id, sort_order, created_at)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)`)
      .run(name, quantity, category, note, price, memberId, maxOrder + 1, nowIso());
    return json(res, 201, getState(db));
  }

  const shoppingId = routeId(pathname, '/api/shopping/');
  if (shoppingId && method === 'PATCH') {
    const body = await parseBody(req);
    const row = db.prepare('SELECT * FROM shopping_items WHERE id = ?').get(shoppingId);
    if (!row) throw Object.assign(new Error('Einkaufsartikel nicht gefunden.'), { status: 404 });
    const name = body.name === undefined ? row.name : requireText(body.name, 'Produkt').slice(0, 80);
    const quantity = body.quantity === undefined ? row.quantity : String(body.quantity).trim().slice(0, 30) || '1';
    const category = body.category === undefined ? row.category : String(body.category).trim().slice(0, 50) || 'Sonstiges';
    const note = body.note === undefined ? row.note : String(body.note).trim().slice(0, 140);
    const price = body.price === undefined ? row.price : (body.price === '' || body.price == null ? null : Math.max(0, asNumber(body.price)));
    const checked = body.checked === undefined ? row.checked : asBool(body.checked);
    const memberId = body.member_id === undefined ? row.member_id : (body.member_id ? Number(body.member_id) : null);
    db.prepare(`UPDATE shopping_items SET name = ?, quantity = ?, category = ?, note = ?, price = ?, checked = ?, member_id = ? WHERE id = ?`)
      .run(name, quantity, category, note, price, checked, memberId, shoppingId);
    return json(res, 200, getState(db));
  }

  if (shoppingId && method === 'DELETE') {
    db.prepare('DELETE FROM shopping_items WHERE id = ?').run(shoppingId);
    return json(res, 200, getState(db));
  }

  if (pathname === '/api/checkout' && method === 'POST') {
    const body = await parseBody(req);
    const selections = Array.isArray(body.items) ? body.items : [];
    const selectedIds = selections.map((item) => Number(item.id)).filter(Number.isInteger);
    const checkedRows = selectedIds.length
      ? db.prepare(`SELECT * FROM shopping_items WHERE id IN (${selectedIds.map(() => '?').join(',')})`).all(...selectedIds)
      : db.prepare('SELECT * FROM shopping_items WHERE checked = 1').all();

    if (!checkedRows.length) throw Object.assign(new Error('Es sind keine Artikel im Wagen.'), { status: 400 });

    const submittedPrice = new Map(selections.map((item) => [Number(item.id), Math.max(0, asNumber(item.price))]));
    const timestamp = nowIso();
    const addPantry = db.prepare(`INSERT INTO pantry_items
      (name, quantity, category, expiry_date, buy_again, inbox, added_at, updated_at)
      VALUES (?, ?, ?, NULL, 0, 1, ?, ?)`);

    let total = 0;
    db.exec('BEGIN');
    try {
      for (const row of checkedRows) {
        const price = submittedPrice.has(row.id) ? submittedPrice.get(row.id) : asNumber(row.price);
        total += price;
        db.prepare(`INSERT INTO purchases (name, quantity, category, price, store_name, purchased_on, source) VALUES (?, ?, ?, ?, ?, ?, 'checkout')`)
          .run(row.name, row.quantity, row.category, price, String(body.store_name ?? '').slice(0, 60), isoDate());
        if (row.category !== 'Haushalt') {
          addPantry.run(row.name, row.quantity, row.category, timestamp, timestamp);
        }
        db.prepare('DELETE FROM shopping_items WHERE id = ?').run(row.id);
      }
      if (total > 0) {
        db.prepare(`INSERT INTO transactions (type, amount, category, note, booked_on, created_at)
          VALUES ('expense', ?, 'Lebensmittel', 'Wocheneinkauf', ?, ?)`)
          .run(Number(total.toFixed(2)), isoDate(), timestamp);
      }
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }

    return json(res, 200, { total: Number(total.toFixed(2)), state: getState(db) });
  }

  if (pathname === '/api/pantry' && method === 'POST') {
    const body = await parseBody(req);
    const name = requireText(body.name, 'Produkt').slice(0, 80);
    const quantity = String(body.quantity ?? '1').trim().slice(0, 30) || '1';
    const unit = String(body.unit ?? '').trim().slice(0, 20);
    const category = String(body.category ?? 'Sonstiges').trim().slice(0, 50) || 'Sonstiges';
    const location = String(body.location ?? 'Vorratsschrank').trim().slice(0, 40) || 'Vorratsschrank';
    const expiry = /^\d{4}-\d{2}-\d{2}$/.test(body.expiry_date ?? '') ? body.expiry_date : null;
    const purchaseDate = /^\d{4}-\d{2}-\d{2}$/.test(body.purchase_date ?? '') ? body.purchase_date : null;
    const openedAt = /^\d{4}-\d{2}-\d{2}$/.test(body.opened_at ?? '') ? body.opened_at : null;
    const minQuantity = Math.max(0, asNumber(body.min_quantity));
    const price = body.price === '' || body.price == null ? null : Math.max(0, asNumber(body.price));
    const note = String(body.note ?? '').trim().slice(0, 140);
    const timestamp = nowIso();
    db.prepare(`INSERT INTO pantry_items
      (name, quantity, unit, category, location, expiry_date, purchase_date, opened_at, min_quantity, price, note, buy_again, inbox, added_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(name, quantity, unit, category, location, expiry, purchaseDate, openedAt, minQuantity, price, note, asBool(body.buy_again), asBool(body.inbox), timestamp, timestamp);
    return json(res, 201, getState(db));
  }

  const pantryId = routeId(pathname, '/api/pantry/');
  if (pantryId && method === 'PATCH') {
    const body = await parseBody(req);
    const row = db.prepare('SELECT * FROM pantry_items WHERE id = ?').get(pantryId);
    if (!row) throw Object.assign(new Error('Vorratsartikel nicht gefunden.'), { status: 404 });
    const name = body.name === undefined ? row.name : requireText(body.name, 'Produkt').slice(0, 80);
    const quantity = body.quantity === undefined ? row.quantity : String(body.quantity).trim().slice(0, 30) || '1';
    const unit = body.unit === undefined ? row.unit : String(body.unit).trim().slice(0, 20);
    const category = body.category === undefined ? row.category : String(body.category).trim().slice(0, 50) || 'Sonstiges';
    const location = body.location === undefined ? row.location : String(body.location).trim().slice(0, 40) || 'Vorratsschrank';
    const expiry = body.expiry_date === undefined ? row.expiry_date : (/^\d{4}-\d{2}-\d{2}$/.test(body.expiry_date ?? '') ? body.expiry_date : null);
    const purchaseDate = body.purchase_date === undefined ? row.purchase_date : (/^\d{4}-\d{2}-\d{2}$/.test(body.purchase_date ?? '') ? body.purchase_date : null);
    const openedAt = body.opened_at === undefined ? row.opened_at : (/^\d{4}-\d{2}-\d{2}$/.test(body.opened_at ?? '') ? body.opened_at : null);
    const minQuantity = body.min_quantity === undefined ? row.min_quantity : Math.max(0, asNumber(body.min_quantity));
    const price = body.price === undefined ? row.price : (body.price === '' || body.price == null ? null : Math.max(0, asNumber(body.price)));
    const note = body.note === undefined ? row.note : String(body.note).trim().slice(0, 140);
    const buyAgain = body.buy_again === undefined ? row.buy_again : asBool(body.buy_again);
    const inbox = body.inbox === undefined ? row.inbox : asBool(body.inbox);
    db.prepare(`UPDATE pantry_items
      SET name = ?, quantity = ?, unit = ?, category = ?, location = ?, expiry_date = ?, purchase_date = ?, opened_at = ?, min_quantity = ?, price = ?, note = ?, buy_again = ?, inbox = ?, updated_at = ?
      WHERE id = ?`)
      .run(name, quantity, unit, category, location, expiry, purchaseDate, openedAt, minQuantity, price, note, buyAgain, inbox, nowIso(), pantryId);
    return json(res, 200, getState(db));
  }

  if (pantryId && method === 'DELETE') {
    db.prepare('DELETE FROM pantry_items WHERE id = ?').run(pantryId);
    return json(res, 200, getState(db));
  }

  if (pathname === '/api/notes' && method === 'POST') {
    const body = await parseBody(req);
    const title = requireText(body.title, 'Titel').slice(0, 100);
    const content = String(body.content ?? '').trim().slice(0, 5000);
    const accent = ['blue', 'green', 'orange', 'yellow', 'purple', 'red'].includes(body.accent) ? body.accent : 'blue';
    const tag = String(body.tag ?? '').trim().slice(0, 40);
    const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(body.due_date ?? '') ? body.due_date : null;
    const relatedType = String(body.related_type ?? '').trim().slice(0, 20);
    const relatedName = String(body.related_name ?? '').trim().slice(0, 80);
    const timestamp = nowIso();
    db.prepare(`INSERT INTO notes
      (title, content, accent, pinned, checklist_done, checklist_total, tag, due_date, related_type, related_name, archived, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`)
      .run(title, content, accent, asBool(body.pinned), Math.max(0, asNumber(body.checklist_done)), Math.max(0, asNumber(body.checklist_total)), tag, dueDate, relatedType, relatedName, timestamp, timestamp);
    return json(res, 201, getState(db));
  }

  const noteId = routeId(pathname, '/api/notes/');
  if (noteId && method === 'PATCH') {
    const body = await parseBody(req);
    const row = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId);
    if (!row) throw Object.assign(new Error('Notiz nicht gefunden.'), { status: 404 });
    const title = body.title === undefined ? row.title : requireText(body.title, 'Titel').slice(0, 100);
    const content = body.content === undefined ? row.content : String(body.content).trim().slice(0, 5000);
    const accent = ['blue', 'green', 'orange', 'yellow', 'purple', 'red'].includes(body.accent) ? body.accent : row.accent;
    const pinned = body.pinned === undefined ? row.pinned : asBool(body.pinned);
    const checklistDone = body.checklist_done === undefined ? row.checklist_done : Math.max(0, asNumber(body.checklist_done));
    const checklistTotal = body.checklist_total === undefined ? row.checklist_total : Math.max(0, asNumber(body.checklist_total));
    const tag = body.tag === undefined ? row.tag : String(body.tag).trim().slice(0, 40);
    const dueDate = body.due_date === undefined ? row.due_date : (/^\d{4}-\d{2}-\d{2}$/.test(body.due_date ?? '') ? body.due_date : null);
    const relatedType = body.related_type === undefined ? row.related_type : String(body.related_type).trim().slice(0, 20);
    const relatedName = body.related_name === undefined ? row.related_name : String(body.related_name).trim().slice(0, 80);
    const archived = body.archived === undefined ? row.archived : asBool(body.archived);
    db.prepare(`UPDATE notes
      SET title = ?, content = ?, accent = ?, pinned = ?, checklist_done = ?, checklist_total = ?, tag = ?, due_date = ?, related_type = ?, related_name = ?, archived = ?, updated_at = ?
      WHERE id = ?`)
      .run(title, content, accent, pinned, checklistDone, checklistTotal, tag, dueDate, relatedType, relatedName, archived, nowIso(), noteId);
    return json(res, 200, getState(db));
  }

  if (noteId && method === 'DELETE') {
    db.prepare('DELETE FROM notes WHERE id = ?').run(noteId);
    return json(res, 200, getState(db));
  }

  if (pathname === '/api/reset' && method === 'POST') {
    resetDatabase(db);
    return json(res, 200, getState(db));
  }

  return json(res, 404, { error: 'API-Endpunkt nicht gefunden.' });
}

async function serveStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';
  const target = path.normalize(path.join(PUBLIC_DIR, pathname));
  if (!target.startsWith(PUBLIC_DIR)) return json(res, 403, { error: 'Zugriff verweigert.' });

  try {
    const fileStat = await stat(target);
    if (!fileStat.isFile()) throw new Error('not a file');
    const content = await readFile(target);
    const ext = path.extname(target).toLowerCase();
    res.writeHead(200, {
      'content-type': MIME[ext] ?? 'application/octet-stream',
      'content-length': content.length,
      'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=3600'
    });
    if (req.method === 'HEAD') res.end();
    else res.end(content);
  } catch {
    if (!path.extname(pathname)) {
      const index = await readFile(path.join(PUBLIC_DIR, 'index.html'));
      res.writeHead(200, { 'content-type': MIME['.html'], 'content-length': index.length, 'cache-control': 'no-cache' });
      res.end(index);
      return;
    }
    json(res, 404, { error: 'Datei nicht gefunden.' });
  }
}


let vercelSeedDatabase;

/**
 * Creates a request handler for Vercel Functions.
 *
 * Vercel's filesystem is ephemeral, so production data is always read from
 * and written to Supabase. An in-memory SQLite database is used only as a
 * short-lived compatibility layer for the existing transaction logic.
 */
export function createVercelApiHandler(options = {}) {
  const cloud = createSupabaseCloud({
    url: options.supabaseUrl ?? process.env.SUPABASE_URL,
    publishableKey: options.supabasePublishableKey ?? process.env.SUPABASE_PUBLISHABLE_KEY
  });

  if (!vercelSeedDatabase) vercelSeedDatabase = createDatabase(':memory:');

  return async function vercelApiHandler(req, res) {
    const url = new URL(req.url ?? '/api/health', `https://${req.headers.host ?? 'localhost'}`);
    try {
      if (!cloud.enabled) {
        throw Object.assign(new Error(
          'Supabase ist für dieses Vercel-Deployment nicht konfiguriert. Setze SUPABASE_URL und SUPABASE_PUBLISHABLE_KEY.'
        ), { status: 503, code: 'supabase_not_configured' });
      }
      if (!url.pathname.startsWith('/api/')) {
        return json(res, 404, { error: 'API-Endpunkt nicht gefunden.' });
      }
      await handleSupabaseApi(req, res, vercelSeedDatabase, url, cloud);
    } catch (error) {
      if ((error.status ?? 500) >= 500 && error.code !== 'supabase_not_configured') console.error(error);
      if (!res.headersSent) {
        json(res, error.status ?? 500, {
          error: error.message ?? 'Interner Serverfehler.',
          code: error.code
        });
      } else if (!res.writableEnded) {
        res.end();
      }
    }
  };
}

export async function createServerApp(options = {}) {
  const dbPath = path.resolve(options.dbPath ?? process.env.DATABASE_PATH ?? path.join(__dirname, 'data', 'selfmade.sqlite'));
  await mkdir(path.dirname(dbPath), { recursive: true });
  const db = createDatabase(dbPath);
  const cloud = createSupabaseCloud({
    url: options.supabaseUrl ?? process.env.SUPABASE_URL,
    publishableKey: options.supabasePublishableKey ?? process.env.SUPABASE_PUBLISHABLE_KEY
  });

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    try {
      if (url.pathname.startsWith('/api/')) await handleSupabaseApi(req, res, db, url, cloud);
      else await serveStatic(req, res, url);
    } catch (error) {
      if ((error.status ?? 500) >= 500) console.error(error);
      json(res, error.status ?? 500, { error: error.message ?? 'Interner Serverfehler.', code: error.code });
    }
  });

  return {
    server,
    db,
    dbPath,
    close: () => new Promise((resolve, reject) => {
      server.close((error) => {
        try { db.close(); } catch {}
        if (error) reject(error); else resolve();
      });
    })
  };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  const host = process.env.HOST ?? '127.0.0.1';
  const port = Number(process.env.PORT ?? 4173);
  const app = await createServerApp();
  app.server.listen(port, host, () => {
    console.log(`Selfmade läuft auf http://${host}:${port}`);
    console.log(`SQLite: ${app.dbPath}`);
  });

  const shutdown = async () => {
    await app.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
