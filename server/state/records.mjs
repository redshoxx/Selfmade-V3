import { randomUUID } from 'node:crypto';
import { booleanInt, integer, isoDate, nonNegative, nowIso, requiredText, safeArray, statusError, text, validDate } from './shared.mjs';

export function recordBase(entity, payload, id) {
  const timestamp = nowIso();
  const common = { id, created_at: timestamp, updated_at: timestamp };
  switch (entity) {
    case 'member': return { ...common, name: requiredText(payload.name, 'Mitglied', 40), avatar: text(payload.avatar || payload.name?.[0] || '•', 2) || '•', role: text(payload.role || 'Mitglied', 40) || 'Mitglied' };
    case 'budget': return { ...common, name: requiredText(payload.name, 'Budgetname', 50), limit_amount: nonNegative(payload.limit_amount), icon: text(payload.icon || 'wallet', 30), accent: text(payload.accent || 'blue', 20), sort_order: integer(payload.sort_order, 999) };
    case 'transaction': {
      const amount = nonNegative(payload.amount);
      if (amount <= 0) throw statusError(400, 'Betrag muss größer als 0 sein.');
      return { ...common, type: payload.type === 'income' ? 'income' : 'expense', amount, category: requiredText(payload.category, 'Kategorie', 50), note: text(payload.note, 160), booked_on: validDate(payload.booked_on, isoDate()), member_id: payload.member_id ? integer(payload.member_id) : null, receipt_id: payload.receipt_id ? integer(payload.receipt_id) : null };
    }
    case 'recurring': return { ...common, name: requiredText(payload.name, 'Produkt', 80), quantity: text(payload.quantity || '1', 30) || '1', category: text(payload.category || 'Sonstiges', 50), frequency_days: Math.max(1, Math.min(365, integer(payload.frequency_days, 7))), next_due: validDate(payload.next_due, isoDate()), enabled: booleanInt(payload.enabled !== false) };
    case 'shopping': return { ...common, name: requiredText(payload.name, 'Produkt', 80), quantity: text(payload.quantity || '1', 30) || '1', category: text(payload.category || 'Sonstiges', 50), note: text(payload.note, 140), price: payload.price === '' || payload.price == null ? null : nonNegative(payload.price), checked: booleanInt(payload.checked), member_id: payload.member_id ? integer(payload.member_id) : null, sort_order: integer(payload.sort_order, 999), client_id: text(payload.client_id, 80) };
    case 'pantry': return { ...common, name: requiredText(payload.name, 'Produkt', 80), quantity: text(payload.quantity || '1', 30) || '1', unit: text(payload.unit, 20), category: text(payload.category || 'Vorrat', 50), location: text(payload.location || 'Vorratsschrank', 50), expiry_date: validDate(payload.expiry_date), purchase_date: validDate(payload.purchase_date), opened_at: validDate(payload.opened_at), min_quantity: nonNegative(payload.min_quantity), price: payload.price === '' || payload.price == null ? null : nonNegative(payload.price), note: text(payload.note, 140), buy_again: booleanInt(payload.buy_again), inbox: booleanInt(payload.inbox), client_id: text(payload.client_id, 80) };
    case 'note': return { ...common, title: requiredText(payload.title, 'Titel', 100), content: text(payload.content, 10000), tag: text(payload.tag, 40), due_date: validDate(payload.due_date), related_type: text(payload.related_type, 30), related_name: text(payload.related_name, 80), accent: text(payload.accent || 'blue', 20), pinned: booleanInt(payload.pinned), archived: booleanInt(payload.archived), checklist: safeArray(payload.checklist).map((item, index) => ({ id: String(item.id || randomUUID()), text: text(item.text, 300), done: Boolean(item.done), sort_order: integer(item.sort_order, index) })).filter((item) => item.text) };
    case 'catalog': return { ...common, barcode: requiredText(payload.barcode, 'Barcode', 64), name: requiredText(payload.name, 'Produkt', 80), brand: text(payload.brand, 60), category: text(payload.category || 'Sonstiges', 50), default_quantity: text(payload.default_quantity || '1', 30), last_price: payload.last_price == null || payload.last_price === '' ? null : nonNegative(payload.last_price) };
    default: throw statusError(400, 'Unbekannter Datentyp.');
  }
}

export function patchRecord(entity, row, payload) {
  const merged = recordBase(entity, { ...row, ...payload }, row.id);
  return { ...row, ...merged, id: row.id, created_at: row.created_at || merged.created_at, updated_at: nowIso() };
}
