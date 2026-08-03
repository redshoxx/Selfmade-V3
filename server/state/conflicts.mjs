import { randomUUID } from 'node:crypto';
import { deepClone, nowIso, statusError } from './shared.mjs';

export function conflictResult(backup, operation, cloudRecord) {
  const conflict = {
    id: randomUUID(),
    operation_id: operation.id,
    entity: operation.entity,
    record_id: operation.record_id,
    local_record: operation.payload,
    cloud_record: deepClone(cloudRecord),
    created_at: nowIso(),
    status: 'open'
  };
  backup.tables.sync_conflicts.push(conflict);
  throw Object.assign(statusError(409, 'Dieser Datensatz wurde auf einem anderen Gerät geändert.', 'record_conflict'), { conflict, backup });
}
