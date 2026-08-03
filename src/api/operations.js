import { api } from './client.js';
import { enqueue } from '../offline/queue.js';
import { applyOptimistic } from '../offline/optimistic.js';
import { store, setState } from '../store.js';
import { flushQueue } from '../offline/sync.js';

const active = new Map();
function operationKey(spec) {
  return `${spec.entity}:${spec.action}:${spec.recordId ?? 'new'}:${JSON.stringify(spec.payload || {})}`;
}
export function operation(spec) {
  const key = operationKey(spec);
  if (active.has(key)) return active.get(key);
  const task = (async () => {
    document.dispatchEvent(new CustomEvent('selfmade-operation-start', { detail: { key } }));
    const op = await enqueue(spec);
    if (store.state) setState(applyOptimistic(store.state, op));
    if (navigator.onLine) await flushQueue(api);
    return op;
  })().finally(() => {
    active.delete(key);
    document.dispatchEvent(new CustomEvent('selfmade-operation-end', { detail: { key } }));
  });
  active.set(key, task);
  return task;
}
