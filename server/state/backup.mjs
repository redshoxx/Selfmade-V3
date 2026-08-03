import { randomUUID } from 'node:crypto';
import { TABLES, SNAPSHOT_VERSION, deepClone, defaultNotificationPreferences, emptyBackup, integer, isoDate, nonNegative, nowIso, safeArray, safeJsonArray, statusError } from './shared.mjs';
import { normalizeReceiptItem, receiptFingerprint } from './receipt-parser.mjs';

export function normalizeBackup(input) {
  if (!input || typeof input !== 'object' || !input.tables || typeof input.tables !== 'object') {
    throw statusError(400, 'Ungültiger Datenstand.');
  }
  const sourceVersion = Number(input.version || SNAPSHOT_VERSION);
  if (![3, 4, 15].includes(sourceVersion)) throw statusError(400, 'Nicht unterstützte Backup-Version.');
  const backup = { version: SNAPSHOT_VERSION, exported_at: input.exported_at || nowIso(), tables: {} };
  for (const table of TABLES) backup.tables[table] = Array.isArray(input.tables[table]) ? deepClone(input.tables[table]) : [];
  if (!backup.tables.settings.length) backup.tables.settings = emptyBackup().tables.settings;
  normalizeSettings(backup.tables.settings[0]);
  normalizeChallenge(backup);
  normalizeNotes(backup);
  normalizeReceipts(backup);
  backup.tables.operations = backup.tables.operations.slice(-500);
  backup.tables.sync_conflicts = backup.tables.sync_conflicts.slice(-100);
  backup.tables.notification_log = backup.tables.notification_log.slice(-500);
  return backup;
}

export function normalizeSettings(row) {
  row.id = Number(row.id || 1);
  row.display_name = String(row.display_name || '').slice(0, 80);
  row.household_name = String(row.household_name || '').slice(0, 80);
  row.theme = ['light', 'dark', 'system'].includes(row.theme) ? row.theme : 'system';
  row.savings = nonNegative(row.savings);
  row.selected_month = /^\d{4}-\d{2}$/.test(row.selected_month || '') ? row.selected_month : isoDate().slice(0, 7);
  row.notification_preferences = {
    ...defaultNotificationPreferences(),
    ...(typeof row.notification_preferences === 'object' ? row.notification_preferences : {})
  };
  row.updated_at ||= nowIso();
}

function normalizeChallenge(backup) {
  const rows = backup.tables.challenge;
  if (!rows.length) return;
  const row = rows[0];
  row.id = Number(row.id || 1);
  row.status = ['active', 'completed', 'paused'].includes(row.status) ? row.status : 'active';
  row.total_fields = Math.max(1, integer(row.total_fields, 1));
  row.target_amount = nonNegative(row.target_amount);
  row.completed_fields = Math.max(0, Math.min(row.total_fields, integer(row.completed_fields, 0)));
  row.saved_amount = nonNegative(row.saved_amount);
  row.history = safeArray(row.history);
  row.current_field = Math.min(row.total_fields, row.completed_fields + 1);
  row.updated_at ||= nowIso();
}

function normalizeNotes(backup) {
  for (const note of backup.tables.notes) {
    note.archived = Boolean(note.archived);
    note.pinned = Boolean(note.pinned);
    note.checklist = safeArray(note.checklist).map((item, index) => ({
      id: String(item?.id || randomUUID()),
      text: String(item?.text || '').slice(0, 300),
      done: Boolean(item?.done),
      sort_order: Number.isFinite(Number(item?.sort_order)) ? Number(item.sort_order) : index
    })).filter((item) => item.text);
    if (!note.checklist.length && Number(note.checklist_total || 0) > 0) {
      const total = Math.min(100, integer(note.checklist_total, 0));
      const done = Math.min(total, integer(note.checklist_done, 0));
      note.checklist = Array.from({ length: total }, (_, index) => ({
        id: randomUUID(), text: `Punkt ${index + 1}`, done: index < done, sort_order: index
      }));
    }
    note.updated_at ||= note.created_at || nowIso();
  }
}

function normalizeReceipts(backup) {
  for (const receipt of backup.tables.receipts) {
    receipt.total = nonNegative(receipt.total);
    receipt.image_path = String(receipt.image_path || '').slice(0, 500);
    receipt.parsed_items = safeJsonArray(receipt.parsed_items).map(normalizeReceiptItem);
    receipt.updated_at ||= receipt.created_at || nowIso();
    receipt.fingerprint ||= receiptFingerprint(receipt.store_name, receipt.receipt_date, receipt.total);
  }
}
