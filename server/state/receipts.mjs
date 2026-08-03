import { randomUUID } from 'node:crypto';
import { normalizeBackup } from './backup.mjs';
import { conflictResult } from './conflicts.mjs';
import { normalizeReceiptItem, parseReceiptText, receiptFingerprint } from './receipt-parser.mjs';
import { recordBase } from './records.mjs';
import { TABLES, integer, isoDate, nonNegative, nowIso, safeArray, safeJsonArray, statusError, text, validDate, nextId } from './shared.mjs';

export function importReceipt(backupInput, payload) {
  const backup = normalizeBackup(backupInput);
  const t = backup.tables;
  const parsed = parseReceiptText(payload.ocr_text || '');
  const receiptDate = validDate(payload.receipt_date, parsed.receipt_date || isoDate());
  const storeName = text(payload.store_name || parsed.store_name, 80);
  const items = (safeArray(payload.items).length ? payload.items : parsed.items).map(normalizeReceiptItem).filter((item) => item.name).slice(0, 200);
  const total = payload.total === '' || payload.total == null ? parsed.total : nonNegative(payload.total);
  const fingerprint = receiptFingerprint(storeName, receiptDate, total);
  const duplicate = t.receipts.find((row) => (row.fingerprint || receiptFingerprint(row.store_name, row.receipt_date, row.total)) === fingerprint);
  if (duplicate && !payload.allow_duplicate) throw Object.assign(statusError(409, 'Dieser Kassenbon wurde wahrscheinlich bereits importiert.', 'duplicate_receipt'), { duplicate });

  const id = nextId(t.receipts);
  const receipt = {
    id,
    store_name: storeName,
    receipt_date: receiptDate,
    total,
    image_path: text(payload.image_path, 500),
    ocr_text: text(payload.ocr_text, 100000),
    parsed_items: items,
    fingerprint,
    transaction_id: null,
    created_at: nowIso(),
    updated_at: nowIso()
  };
  t.receipts.push(receipt);
  for (const item of items) {
    const effectivePrice = Math.max(0, nonNegative(item.price) + nonNegative(item.deposit) - nonNegative(item.discount));
    t.purchases.push({ id: nextId(t.purchases), receipt_id: id, name: item.name, quantity: item.quantity, category: item.category, price: effectivePrice, store_name: storeName, purchased_on: receiptDate, source: 'receipt', created_at: nowIso() });
    if (payload.transfer_to_pantry && !['Rabatt', 'Pfand'].includes(item.category)) {
      const pantryId = nextId(t.pantry_items);
      t.pantry_items.push(recordBase('pantry', { name: item.name, quantity: item.quantity, category: item.category, purchase_date: receiptDate, price: effectivePrice, inbox: true }, pantryId));
    }
  }
  if (payload.book_transaction !== false && total > 0) {
    const transactionId = nextId(t.transactions);
    const transaction = recordBase('transaction', { type: 'expense', amount: total, category: payload.transaction_category || 'Lebensmittel', note: `Kassenbon ${storeName}`.trim(), booked_on: receiptDate, member_id: payload.member_id || null, receipt_id: id }, transactionId);
    t.transactions.push(transaction);
    receipt.transaction_id = transactionId;
  }
  return { backup, receipt };
}

export function updateReceipt(backup, recordId, payload, baseUpdatedAt = '') {
  const id = integer(recordId, NaN);
  const row = backup.tables.receipts.find((item) => Number(item.id) === id);
  if (!row) throw statusError(404, 'Kassenbon nicht gefunden.');
  if (baseUpdatedAt && row.updated_at && row.updated_at !== baseUpdatedAt) return conflictResult(backup, { id: randomUUID(), entity: 'receipt', record_id: id, payload }, row);
  row.store_name = payload.store_name === undefined ? row.store_name : text(payload.store_name, 80);
  row.receipt_date = payload.receipt_date === undefined ? row.receipt_date : validDate(payload.receipt_date, row.receipt_date);
  row.total = payload.total === undefined ? row.total : nonNegative(payload.total);
  row.image_path = payload.image_path === undefined ? row.image_path : text(payload.image_path, 500);
  row.ocr_text = payload.ocr_text === undefined ? row.ocr_text : text(payload.ocr_text, 100000);
  row.parsed_items = payload.items === undefined ? safeJsonArray(row.parsed_items).map(normalizeReceiptItem) : safeArray(payload.items).map(normalizeReceiptItem).filter((item) => item.name);
  row.fingerprint = receiptFingerprint(row.store_name, row.receipt_date, row.total);
  row.updated_at = nowIso();

  backup.tables.purchases = backup.tables.purchases.filter((item) => Number(item.receipt_id) !== id);
  for (const item of row.parsed_items) {
    const effectivePrice = Math.max(0, nonNegative(item.price) + nonNegative(item.deposit) - nonNegative(item.discount));
    backup.tables.purchases.push({
      id: nextId(backup.tables.purchases),
      receipt_id: id,
      name: item.name,
      quantity: item.quantity,
      category: item.category,
      price: effectivePrice,
      store_name: row.store_name,
      purchased_on: row.receipt_date,
      source: 'receipt',
      created_at: nowIso()
    });
  }
  const linkedTransaction = backup.tables.transactions.find((item) => Number(item.id) === Number(row.transaction_id));
  if (linkedTransaction) {
    linkedTransaction.amount = row.total;
    linkedTransaction.booked_on = row.receipt_date;
    linkedTransaction.note = `Kassenbon ${row.store_name}`.trim();
    linkedTransaction.updated_at = nowIso();
  }
  return row;
}
export function deleteReceipt(backup, recordId) {
  const id = integer(recordId, NaN);
  const index = backup.tables.receipts.findIndex((item) => Number(item.id) === id);
  if (index < 0) throw statusError(404, 'Kassenbon nicht gefunden.');
  const [row] = backup.tables.receipts.splice(index, 1);
  backup.tables.purchases = backup.tables.purchases.filter((item) => Number(item.receipt_id) !== id);
  for (const transaction of backup.tables.transactions) if (Number(transaction.receipt_id) === id) transaction.receipt_id = null;
  return row;
}

export function checkout(backupInput, payload) {
  const backup = normalizeBackup(backupInput);
  const selected = safeArray(payload.items);
  const ids = selected.map((item) => integer(item.id, NaN)).filter(Number.isInteger);
  const rows = backup.tables.shopping_items.filter((row) => ids.length ? ids.includes(Number(row.id)) : Boolean(row.checked));
  if (!rows.length) throw statusError(400, 'Es sind keine Artikel im Wagen.');
  const priceById = new Map(selected.map((item) => [integer(item.id), nonNegative(item.price)]));
  let total = 0;
  for (const row of rows) {
    const price = priceById.has(Number(row.id)) ? priceById.get(Number(row.id)) : nonNegative(row.price);
    total += price;
    backup.tables.purchases.push({ id: nextId(backup.tables.purchases), name: row.name, quantity: row.quantity, category: row.category, price, store_name: text(payload.store_name, 80), purchased_on: isoDate(), source: 'checkout', created_at: nowIso() });
    if (row.category !== 'Haushalt') backup.tables.pantry_items.push(recordBase('pantry', { name: row.name, quantity: row.quantity, category: row.category, price, purchase_date: isoDate(), inbox: true }, nextId(backup.tables.pantry_items)));
  }
  if (payload.book_transaction !== false && total > 0) backup.tables.transactions.push(recordBase('transaction', { type: 'expense', amount: total, category: payload.transaction_category || 'Lebensmittel', note: text(payload.note || `Einkauf ${payload.store_name || ''}`, 160), booked_on: isoDate(), member_id: payload.member_id || null }, nextId(backup.tables.transactions)));
  const removed = new Set(rows.map((row) => Number(row.id)));
  backup.tables.shopping_items = backup.tables.shopping_items.filter((row) => !removed.has(Number(row.id)));
  return { backup, total: Number(total.toFixed(2)), count: rows.length };
}

export function validateBackupForImport(input) {
  const serialized = JSON.stringify(input);
  if (serialized.length > 5_000_000) throw statusError(413, 'Backup ist größer als 5 MB.');
  const backup = normalizeBackup(input);
  for (const table of TABLES) {
    if (backup.tables[table].length > 10000) throw statusError(400, `Zu viele Einträge in ${table}.`);
  }
  return backup;
}
