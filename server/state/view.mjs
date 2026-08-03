import { normalizeBackup } from './backup.mjs';
import { normalizeReceiptItem } from './receipt-parser.mjs';
import { integer, isoDate, nonNegative, number, safeArray, safeJsonArray, text, validDate } from './shared.mjs';

function monthOf(settings) {
  return /^\d{4}-\d{2}$/.test(settings.selected_month || '') ? settings.selected_month : isoDate().slice(0, 7);
}

export function getState(backupInput, cloud = {}) {
  const backup = normalizeBackup(backupInput);
  const t = backup.tables;
  const settings = { ...t.settings[0] };
  const month = monthOf(settings);
  const transactions = t.transactions
    .filter((row) => String(row.booked_on || '').slice(0, 7) === month)
    .sort((a, b) => String(b.booked_on || '').localeCompare(String(a.booked_on || '')) || Number(b.id) - Number(a.id))
    .map((row) => ({ ...row, amount: nonNegative(row.amount) }));
  const totals = transactions.reduce((acc, row) => {
    acc[row.type === 'income' ? 'income' : 'expense'] += nonNegative(row.amount);
    return acc;
  }, { income: 0, expense: 0 });
  const categorySpend = {};
  for (const row of transactions) if (row.type !== 'income') categorySpend[row.category] = (categorySpend[row.category] || 0) + nonNegative(row.amount);
  const budgets = t.budgets
    .slice().sort((a, b) => number(a.sort_order) - number(b.sort_order) || number(a.id) - number(b.id))
    .map((row) => ({ ...row, limit_amount: nonNegative(row.limit_amount), spent: Number((categorySpend[row.name] || 0).toFixed(2)) }));
  const shopping = t.shopping_items
    .slice().sort((a, b) => number(a.sort_order) - number(b.sort_order) || number(a.id) - number(b.id))
    .map((row) => ({ ...row, checked: Boolean(row.checked), price: row.price == null ? null : nonNegative(row.price) }));
  const pantry = t.pantry_items
    .slice().sort((a, b) => Number(Boolean(b.inbox)) - Number(Boolean(a.inbox)) || String(a.expiry_date || '9999').localeCompare(String(b.expiry_date || '9999')))
    .map((row) => {
      const current = number(String(row.quantity || '').replace(',', '.').match(/-?\d+(?:\.\d+)?/)?.[0], 0);
      return { ...row, min_quantity: nonNegative(row.min_quantity), price: row.price == null ? null : nonNegative(row.price), buy_again: Boolean(row.buy_again), inbox: Boolean(row.inbox), low_stock: nonNegative(row.min_quantity) > 0 && current <= nonNegative(row.min_quantity) };
    });
  const allNotes = t.notes.slice().sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
  const notes = allNotes.filter((row) => !row.archived).map(noteView);
  const archivedNotes = allNotes.filter((row) => row.archived).map(noteView);
  const recurring = t.recurring_items.slice().sort((a, b) => String(a.next_due || '').localeCompare(String(b.next_due || ''))).map((row) => ({ ...row, enabled: Boolean(row.enabled), due: Boolean(row.enabled) && String(row.next_due || '') <= isoDate() }));
  const receipts = t.receipts.slice().sort((a, b) => String(b.receipt_date || '').localeCompare(String(a.receipt_date || '')) || Number(b.id) - Number(a.id)).slice(0, 100).map((row) => ({ ...row, total: nonNegative(row.total), parsed_items: safeJsonArray(row.parsed_items).map(normalizeReceiptItem) }));
  const priceHistory = buildPriceHistory(t.purchases);
  const shoppingNames = new Set(shopping.map((row) => String(row.name).toLocaleLowerCase('de-AT')));
  const suggestions = [
    ...recurring.filter((row) => row.due && !shoppingNames.has(String(row.name).toLocaleLowerCase('de-AT'))).map((row) => ({ type: 'recurring', name: row.name, quantity: row.quantity, category: row.category, reason: 'Wiederkehrend fällig' })),
    ...pantry.filter((row) => (row.buy_again || row.low_stock) && !shoppingNames.has(String(row.name).toLocaleLowerCase('de-AT'))).map((row) => ({ type: 'pantry', name: row.name, quantity: row.quantity, category: row.category, reason: row.low_stock ? 'Mindestbestand erreicht' : 'Zum Nachkaufen markiert' }))
  ].slice(0, 12);
  const challenge = challengeView(t.challenge[0]);
  const conflicts = t.sync_conflicts.filter((row) => row.status !== 'resolved').slice(-50);
  return {
    version: 15,
    month,
    settings,
    members: t.members.slice().sort((a, b) => number(a.id) - number(b.id)),
    budgets,
    transactions,
    shopping,
    pantry,
    notes,
    archived_notes: archivedNotes,
    recurring,
    product_catalog: t.product_catalog.slice(),
    receipts,
    price_history: priceHistory,
    challenge,
    suggestions,
    conflicts,
    badges: {
      shopping: shopping.filter((row) => !row.checked).length,
      pantry: pantry.filter((row) => !row.inbox && (row.low_stock || expiryDays(row.expiry_date) <= 1)).length,
      conflicts: conflicts.length
    },
    summary: {
      income: Number(totals.income.toFixed(2)),
      expense: Number(totals.expense.toFixed(2)),
      remaining: Number((totals.income - totals.expense).toFixed(2)),
      savings: nonNegative(settings.savings)
    },
    cloud
  };
}

function noteView(row) {
  const checklist = safeArray(row.checklist);
  return { ...row, pinned: Boolean(row.pinned), archived: Boolean(row.archived), checklist, checklist_done: checklist.filter((item) => item.done).length, checklist_total: checklist.length };
}
function challengeView(row) {
  if (!row) return { active: false, status: 'none', total_fields: 0, completed_fields: 0, current_field: 0, target_amount: 0, saved_amount: 0, progress_percent: 0, history: [] };
  const total = Math.max(1, integer(row.total_fields, 1));
  const completed = Math.min(total, integer(row.completed_fields, 0));
  return { ...row, active: row.status === 'active', total_fields: total, completed_fields: completed, current_field: Math.min(total, completed + 1), target_amount: nonNegative(row.target_amount), saved_amount: nonNegative(row.saved_amount), progress_percent: Math.round(completed / total * 100), history: safeArray(row.history) };
}
function buildPriceHistory(rows) {
  const groups = new Map();
  rows.slice().sort((a, b) => String(b.purchased_on || '').localeCompare(String(a.purchased_on || '')) || Number(b.id) - Number(a.id)).forEach((row) => {
    const key = text(row.name, 80).toLocaleLowerCase('de-AT');
    if (!key) return;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  });
  return [...groups.values()].map((items) => ({
    name: items[0].name,
    category: items[0].category,
    last_price: nonNegative(items[0].price),
    average_price: Number((items.reduce((sum, row) => sum + nonNegative(row.price), 0) / items.length).toFixed(2)),
    purchase_count: items.length,
    last_store: items[0].store_name || '',
    last_date: items[0].purchased_on || ''
  }));
}
function expiryDays(date) {
  if (!validDate(date)) return 99999;
  const today = new Date(`${isoDate()}T12:00:00`);
  const target = new Date(`${date}T12:00:00`);
  return Math.round((target - today) / 86400000);
}
