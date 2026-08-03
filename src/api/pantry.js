import { operation } from './operations.js';
export const savePantryItem = (record, payload) => operation({ entity: 'pantry', action: record ? 'update' : 'create', recordId: record?.id, baseUpdatedAt: record?.updated_at, payload });
export const deletePantryItem = record => operation({ entity: 'pantry', action: 'delete', recordId: record.id, baseUpdatedAt: record.updated_at, payload: {} });
