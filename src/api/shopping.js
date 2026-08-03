import { operation } from './operations.js';
export const saveShoppingItem = (record, payload) => operation({ entity: 'shopping', action: record ? 'update' : 'create', recordId: record?.id, baseUpdatedAt: record?.updated_at, payload });
export const deleteShoppingItem = record => operation({ entity: 'shopping', action: 'delete', recordId: record.id, baseUpdatedAt: record.updated_at, payload: {} });
export const checkoutShopping = payload => operation({ entity: 'checkout', action: 'complete', payload });
