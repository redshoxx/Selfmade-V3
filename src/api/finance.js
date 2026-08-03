import { operation } from './operations.js';
export const createTransaction = payload => operation({ entity: 'transaction', action: 'create', payload });
export const updateTransaction = (record, payload) => operation({ entity: 'transaction', action: 'update', recordId: record.id, baseUpdatedAt: record.updated_at, payload });
export const deleteTransaction = record => operation({ entity: 'transaction', action: 'delete', recordId: record.id, baseUpdatedAt: record.updated_at, payload: {} });
export const saveBudget = (record, payload) => operation({ entity: 'budget', action: record ? 'update' : 'create', recordId: record?.id, baseUpdatedAt: record?.updated_at, payload });
