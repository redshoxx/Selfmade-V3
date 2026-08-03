import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  applyOperation,
  checkout,
  emptyBackup,
  getState,
  normalizeBackup,
  parseReceiptText,
  validateBackupForImport
} from '../server/state-engine.mjs';

const op = (entity, action, payload = {}, recordId = `local-${randomUUID()}`, base = '') => ({
  id: randomUUID(), entity, action, record_id: recordId, payload,
  base_updated_at: base, created_at: new Date().toISOString()
});

function apply(backup, operation) { return applyOperation(backup, operation).backup; }

test('V14-Daten bleiben bei der Normalisierung erhalten', () => {
  const v14 = emptyBackup();
  v14.version = 3;
  v14.tables.transactions.push({ id: 1, type: 'income', amount: 1500, category: 'Gehalt', note: '', booked_on: '2026-08-01', created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z' });
  const migrated = normalizeBackup(v14);
  assert.equal(migrated.version, 3);
  assert.equal(migrated.tables.transactions[0].amount, 1500);
  assert.ok(Array.isArray(migrated.tables.operations));
  assert.ok(Array.isArray(migrated.tables.sync_conflicts));
});

test('Einnahme und Ausgabe erstellen, bearbeiten und löschen', () => {
  let backup = emptyBackup();
  backup.tables.settings[0].selected_month = '2026-08';
  backup = apply(backup, op('transaction', 'create', { type: 'income', amount: 2000, category: 'Gehalt', booked_on: '2026-08-01' }));
  backup = apply(backup, op('transaction', 'create', { type: 'expense', amount: 120, category: 'Lebensmittel', note: 'Wocheneinkauf', booked_on: '2026-08-02' }));
  let state = getState(backup);
  assert.equal(state.summary.income, 2000);
  assert.equal(state.summary.expense, 120);
  const expense = backup.tables.transactions.find(row => row.type === 'expense');
  backup = apply(backup, op('transaction', 'update', { amount: 95, note: 'Korrigiert' }, expense.id, expense.updated_at));
  state = getState(backup);
  assert.equal(state.summary.expense, 95);
  assert.equal(state.transactions.find(row => row.id === expense.id).note, 'Korrigiert');
  const current = backup.tables.transactions.find(row => row.id === expense.id);
  backup = apply(backup, op('transaction', 'delete', {}, current.id, current.updated_at));
  assert.equal(getState(backup).summary.expense, 0);
});

test('Budgets und Monatswechsel werden korrekt berechnet', () => {
  let backup = emptyBackup();
  backup.tables.settings[0].selected_month = '2026-08';
  backup = apply(backup, op('budget', 'create', { name: 'Lebensmittel', limit_amount: 300 }));
  backup = apply(backup, op('transaction', 'create', { type: 'expense', amount: 75, category: 'Lebensmittel', booked_on: '2026-08-10' }));
  backup = apply(backup, op('transaction', 'create', { type: 'expense', amount: 25, category: 'Lebensmittel', booked_on: '2026-09-01' }));
  assert.equal(getState(backup).budgets[0].spent, 75);
  backup.tables.settings[0].selected_month = '2026-09';
  assert.equal(getState(backup).budgets[0].spent, 25);
});

test('Einkaufsartikel können erstellt, geändert, abgehakt und ausgecheckt werden', () => {
  let backup = emptyBackup();
  const created = applyOperation(backup, op('shopping', 'create', { name: 'Milch', quantity: '2', category: 'Kühlregal' }));
  backup = created.backup;
  const id = created.result.id;
  let row = backup.tables.shopping_items.find(item => item.id === id);
  backup = apply(backup, op('shopping', 'update', { quantity: '3', checked: true }, id, row.updated_at));
  row = backup.tables.shopping_items.find(item => item.id === id);
  assert.equal(row.quantity, '3');
  assert.equal(Boolean(row.checked), true);
  const result = checkout(backup, { items: [{ id, price: 4.5 }], book_transaction: true });
  assert.equal(result.count, 1);
  assert.equal(result.total, 4.5);
  assert.equal(result.backup.tables.shopping_items.length, 0);
  assert.equal(result.backup.tables.pantry_items.length, 1);
  assert.equal(result.backup.tables.transactions.length, 1);
});

test('Checkout als Operation verändert den Snapshot und wird nicht doppelt ausgeführt', () => {
  let backup = emptyBackup();
  backup = apply(backup, op('shopping', 'create', { name: 'Brot', checked: true }));
  const id = backup.tables.shopping_items[0].id;
  const operation = op('checkout', 'complete', { items: [{ id, price: 3.2 }], book_transaction: true }, null);
  const first = applyOperation(backup, operation);
  assert.equal(first.backup.tables.shopping_items.length, 0);
  assert.equal(first.backup.tables.transactions.length, 1);
  const second = applyOperation(first.backup, operation);
  assert.equal(second.duplicate, true);
  assert.equal(second.backup.tables.transactions.length, 1);
});

test('Vorrat unterstützt Ablaufdatum, Mindestbestand, Bearbeiten und Löschen', () => {
  let backup = emptyBackup();
  const created = applyOperation(backup, op('pantry', 'create', { name: 'Reis', quantity: '1', min_quantity: 2, expiry_date: '2026-08-04' }));
  backup = created.backup;
  let state = getState(backup);
  assert.equal(state.pantry[0].low_stock, true);
  const row = backup.tables.pantry_items[0];
  backup = apply(backup, op('pantry', 'update', { quantity: '5', buy_again: false }, row.id, row.updated_at));
  assert.equal(getState(backup).pantry[0].low_stock, false);
  const updated = backup.tables.pantry_items[0];
  backup = apply(backup, op('pantry', 'delete', {}, updated.id, updated.updated_at));
  assert.equal(backup.tables.pantry_items.length, 0);
});

test('Spar-Challenge ist vollständig und erhöht den Sparbetrag', () => {
  let backup = emptyBackup();
  backup = apply(backup, op('challenge', 'create', { total_fields: 2, target_amount: 100 }, 1));
  backup = apply(backup, op('challenge', 'complete', {}, 1));
  let state = getState(backup);
  assert.equal(state.challenge.completed_fields, 1);
  assert.equal(state.challenge.saved_amount, 50);
  assert.equal(state.summary.savings, 50);
  backup = apply(backup, op('challenge', 'complete', {}, 1));
  state = getState(backup);
  assert.equal(state.challenge.status, 'completed');
  assert.equal(state.challenge.progress_percent, 100);
  assert.equal(state.summary.savings, 100);
  assert.equal(state.challenge.history.length, 2);
});

test('Bontext extrahiert Geschäft, Datum, Summe und Positionen', () => {
  const parsed = parseReceiptText('SPAR MARKT\n03.08.2026\nMilch 1,49\nPfand 0,25\nGESAMT 1,74');
  assert.equal(parsed.store_name, 'SPAR MARKT');
  assert.equal(parsed.receipt_date, '2026-08-03');
  assert.equal(parsed.total, 1.74);
  assert.ok(parsed.items.some(item => item.name.includes('Milch')));
});

test('Bonimport speichert nur den Storage-Pfad, aktualisiert Preisverlauf und erkennt Duplikate', () => {
  let backup = emptyBackup();
  const payload = { store_name: 'Markt', receipt_date: '2026-08-03', total: 5, image_path: 'household/receipt.jpg', items: [{ name: 'Apfel', quantity: '1 kg', price: 5, category: 'Obst & Gemüse' }], book_transaction: true };
  const first = applyOperation(backup, op('receipt', 'create', payload));
  backup = first.backup;
  assert.equal(first.result.image_path, 'household/receipt.jpg');
  assert.equal(getState(backup).price_history[0].last_price, 5);
  assert.equal(backup.tables.transactions[0].receipt_id, first.result.id);
  assert.throws(() => applyOperation(backup, op('receipt', 'create', payload)), /bereits importiert/i);
});

test('Gespeicherter Kassenbon kann bearbeitet werden und erneuert Preisverlauf sowie Buchung', () => {
  let backup = emptyBackup();
  const created = applyOperation(backup, op('receipt', 'create', {
    store_name: 'Alter Markt', receipt_date: '2026-08-01', total: 4,
    image_path: 'household/old.jpg',
    items: [{ name: 'Milch', quantity: '1', price: 4, category: 'Kühlregal' }],
    book_transaction: true
  }));
  backup = created.backup;
  const receipt = created.result;
  const updated = applyOperation(backup, op('receipt', 'update', {
    store_name: 'Neuer Markt', receipt_date: '2026-08-02', total: 6,
    image_path: 'household/new.jpg',
    items: [{ name: 'Milch', quantity: '2', price: 6, category: 'Kühlregal' }]
  }, receipt.id, receipt.updated_at));
  const state = getState(updated.backup);
  assert.equal(state.receipts[0].store_name, 'Neuer Markt');
  assert.equal(state.receipts[0].image_path, 'household/new.jpg');
  assert.equal(state.price_history[0].last_price, 6);
  assert.equal(updated.backup.tables.transactions[0].amount, 6);
  assert.equal(updated.backup.tables.transactions[0].booked_on, '2026-08-02');
});

test('Unabhängige Operationen bleiben erhalten; gleicher Datensatz erzeugt Konflikt', () => {
  let backup = emptyBackup();
  backup = apply(backup, op('note', 'create', { title: 'Notiz A' }));
  backup = apply(backup, op('shopping', 'create', { name: 'Produkt B' }));
  assert.equal(backup.tables.notes.length, 1);
  assert.equal(backup.tables.shopping_items.length, 1);
  const note = backup.tables.notes[0];
  backup = apply(backup, op('note', 'update', { content: 'Cloud' }, note.id, note.updated_at));
  assert.throws(() => applyOperation(backup, op('note', 'update', { content: 'Lokal' }, note.id, '2000-01-01T00:00:00.000Z')), error => error.status === 409 && error.code === 'record_conflict');
});

test('Backup-Import weist manipulierte oder zu große Daten ab', () => {
  assert.throws(() => validateBackupForImport({ nope: true }), /Ungültiger Datenstand/);
  const backup = emptyBackup();
  backup.tables.notes = Array.from({ length: 10001 }, (_, id) => ({ id, title: 'x' }));
  assert.throws(() => validateBackupForImport(backup), /Zu viele Einträge/);
});
