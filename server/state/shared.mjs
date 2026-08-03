export const SNAPSHOT_VERSION = 3;
export const TABLES = [
  'settings', 'members', 'budgets', 'transactions', 'recurring_items',
  'shopping_items', 'pantry_items', 'notes', 'product_catalog',
  'purchases', 'receipts', 'challenge', 'operations', 'sync_conflicts',
  'notification_log'
];

const ENTITY_TABLE = {
  member: 'members',
  budget: 'budgets',
  transaction: 'transactions',
  recurring: 'recurring_items',
  shopping: 'shopping_items',
  pantry: 'pantry_items',
  note: 'notes',
  catalog: 'product_catalog',
  receipt: 'receipts'
};

export const nowIso = () => new Date().toISOString();
export function isoDate(date = new Date()) {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

export function emptyBackup() {
  const tables = Object.fromEntries(TABLES.map((name) => [name, []]));
  tables.settings.push({
    id: 1,
    display_name: '',
    household_name: '',
    theme: 'system',
    savings: 0,
    selected_month: isoDate().slice(0, 7),
    notification_preferences: defaultNotificationPreferences(),
    created_at: nowIso(),
    updated_at: nowIso()
  });
  return { version: SNAPSHOT_VERSION, exported_at: nowIso(), tables };
}

export function defaultNotificationPreferences() {
  return {
    enabled: false,
    expiry_tomorrow: true,
    expired_today: true,
    low_stock: true,
    recurring_due: true,
    note_due: true,
    budget_near: true,
    budget_exceeded: true
  };
}

export function deepClone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

export function safeArray(value) {
  return Array.isArray(value) ? value : [];
}
export function safeJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
  }
  return [];
}
export function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
export function integer(value, fallback = 0) {
  return Math.trunc(number(value, fallback));
}
export function nonNegative(value) {
  return Math.max(0, number(value, 0));
}
export function booleanInt(value) {
  return value ? 1 : 0;
}
export function text(value, max = 200) {
  return String(value ?? '').trim().slice(0, max);
}
export function requiredText(value, label, max = 200) {
  const result = text(value, max);
  if (!result) throw statusError(400, `${label} darf nicht leer sein.`);
  return result;
}
export function validDate(value, fallback = null) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : fallback;
}
export function nextId(rows) {
  return rows.reduce((max, row) => Math.max(max, Number(row.id) || 0), 0) + 1;
}
export function statusError(status, message, code = '') {
  return Object.assign(new Error(message), { status, code });
}
