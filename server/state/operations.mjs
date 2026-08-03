import { randomUUID } from 'node:crypto';
import { normalizeBackup, normalizeSettings } from './backup.mjs';
import { conflictResult } from './conflicts.mjs';
import { patchRecord, recordBase } from './records.mjs';
import { checkout, deleteReceipt, importReceipt, updateReceipt } from './receipts.mjs';
import { integer, nextId, nonNegative, nowIso, safeArray, statusError, text } from './shared.mjs';

const ENTITY_TABLE = { member:'members', budget:'budgets', transaction:'transactions', recurring:'recurring_items', shopping:'shopping_items', pantry:'pantry_items', note:'notes', catalog:'product_catalog', receipt:'receipts' };

export function applyOperation(backupInput, operationInput) {
  let backup = normalizeBackup(backupInput);
  const operation = normalizeOperation(operationInput);
  let t = backup.tables;
  if (t.operations.some((row) => row.id === operation.id)) {
    return { backup, duplicate: true, id_map: null, result: null };
  }
  let result = null;
  let idMap = null;

  if (operation.entity === 'checkout') {
    if (operation.action !== 'complete') throw statusError(400, 'Ungültige Checkout-Aktion.');
    const completed = checkout(backup, operation.payload);
    backup = completed.backup;
    t = backup.tables;
    result = { total: completed.total, count: completed.count };
  } else if (operation.entity === 'settings') {
    const row = t.settings[0];
    if (operation.action !== 'update') throw statusError(400, 'Einstellungen können nur geändert werden.');
    if (operation.base_updated_at && row.updated_at && operation.base_updated_at !== row.updated_at) return conflictResult(backup, operation, row);
    normalizeSettings(Object.assign(row, operation.payload, { updated_at: nowIso() }));
    result = row;
  } else if (operation.entity === 'challenge') {
    result = applyChallengeOperation(backup, operation);
  } else if (operation.entity === 'receipt') {
    if (operation.action === 'create') {
      const imported = importReceipt(backup, operation.payload);
      backup = imported.backup;
      t = backup.tables;
      result = imported.receipt;
    }
    else if (operation.action === 'update') result = updateReceipt(backup, operation.record_id, operation.payload, operation.base_updated_at);
    else if (operation.action === 'delete') result = deleteReceipt(backup, operation.record_id);
    else throw statusError(400, 'Ungültige Bon-Aktion.');
  } else {
    const tableName = ENTITY_TABLE[operation.entity];
    if (!tableName) throw statusError(400, 'Unbekannter Datentyp.');
    const rows = t[tableName];
    if (operation.action === 'create') {
      const id = nextId(rows);
      const row = recordBase(operation.entity, operation.payload, id);
      rows.push(row);
      result = row;
      if (operation.record_id && String(operation.record_id).startsWith('local-')) idMap = { from: operation.record_id, to: id };
    } else {
      const id = integer(operation.record_id, NaN);
      if (!Number.isInteger(id)) throw statusError(400, 'Ungültige Datensatz-ID.');
      const index = rows.findIndex((row) => Number(row.id) === id);
      if (index < 0) throw statusError(404, 'Datensatz nicht gefunden.');
      const row = rows[index];
      if (operation.base_updated_at && row.updated_at && operation.base_updated_at !== row.updated_at) return conflictResult(backup, operation, row);
      if (operation.action === 'update') {
        rows[index] = patchRecord(operation.entity, row, operation.payload);
        result = rows[index];
      } else if (operation.action === 'delete') {
        rows.splice(index, 1);
        result = row;
      } else throw statusError(400, 'Ungültige Aktion.');
    }
  }

  t.operations.push({ id: operation.id, entity: operation.entity, action: operation.action, record_id: result?.id ?? operation.record_id ?? null, applied_at: nowIso() });
  t.operations = t.operations.slice(-500);
  backup.exported_at = nowIso();
  return { backup, duplicate: false, id_map: idMap, result };
}

function normalizeOperation(input) {
  const id = String(input?.id || '').trim();
  if (!/^[0-9a-f-]{20,80}$/i.test(id)) throw statusError(400, 'Ungültige Operations-ID.');
  const action = ['create', 'update', 'delete', 'complete', 'reset', 'resolve'].includes(input.action) ? input.action : '';
  if (!action) throw statusError(400, 'Ungültige Aktion.');
  return { id, entity: text(input.entity, 40), action, record_id: input.record_id ?? null, base_updated_at: text(input.base_updated_at, 50), payload: input.payload && typeof input.payload === 'object' ? input.payload : {}, created_at: input.created_at || nowIso() };
}

function applyChallengeOperation(backup, operation) {
  const settings = backup.tables.settings[0];
  let row = backup.tables.challenge[0];
  if (operation.action === 'create') {
    const totalFields = Math.max(1, Math.min(365, integer(operation.payload.total_fields, 52)));
    const target = nonNegative(operation.payload.target_amount);
    row = { id: 1, status: 'active', total_fields: totalFields, target_amount: target, completed_fields: 0, current_field: 1, saved_amount: 0, history: [], created_at: nowIso(), updated_at: nowIso() };
    backup.tables.challenge = [row];
    return row;
  }
  if (!row) throw statusError(404, 'Keine aktive Spar-Challenge vorhanden.');
  if (operation.action === 'complete') {
    if (row.status === 'completed') throw statusError(400, 'Die Challenge ist bereits abgeschlossen.');
    const remainingFields = Math.max(1, row.total_fields - row.completed_fields);
    const remainingAmount = Math.max(0, row.target_amount - row.saved_amount);
    const amount = operation.payload.amount === undefined ? Number((remainingAmount / remainingFields).toFixed(2)) : nonNegative(operation.payload.amount);
    row.completed_fields = Math.min(row.total_fields, row.completed_fields + 1);
    row.saved_amount = Number((nonNegative(row.saved_amount) + amount).toFixed(2));
    row.current_field = Math.min(row.total_fields, row.completed_fields + 1);
    row.history = [...safeArray(row.history), { id: randomUUID(), field: row.completed_fields, amount, completed_at: nowIso() }];
    settings.savings = Number((nonNegative(settings.savings) + amount).toFixed(2));
    settings.updated_at = nowIso();
    if (row.completed_fields >= row.total_fields) row.status = 'completed';
    row.updated_at = nowIso();
    return row;
  }
  if (operation.action === 'reset') {
    backup.tables.challenge = [];
    return null;
  }
  if (operation.action === 'update') {
    row.total_fields = Math.max(row.completed_fields || 0, Math.min(365, integer(operation.payload.total_fields, row.total_fields)));
    row.target_amount = nonNegative(operation.payload.target_amount ?? row.target_amount);
    row.updated_at = nowIso();
    return row;
  }
  throw statusError(400, 'Ungültige Challenge-Aktion.');
}
