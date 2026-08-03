import { operation } from './operations.js';
export const saveNote = (record, payload) => operation({ entity: 'note', action: record ? 'update' : 'create', recordId: record?.id, baseUpdatedAt: record?.updated_at, payload });
export const deleteNote = record => operation({ entity: 'note', action: 'delete', recordId: record.id, baseUpdatedAt: record.updated_at, payload: {} });
