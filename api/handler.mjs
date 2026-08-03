import { createV15Handler } from '../server/v15-api.mjs';

export const config = { maxDuration: 30 };
const handle = createV15Handler();

export default async function handler(req, res) {
  const apiPath = Array.isArray(req.query?.path) ? req.query.path.join('/') : String(req.query?.path || '');
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query || {})) {
    if (key === 'path') continue;
    if (Array.isArray(value)) value.forEach((item) => query.append(key, item));
    else if (value != null) query.set(key, value);
  }
  req.url = `/api/${apiPath || 'health'}${query.size ? `?${query}` : ''}`;
  return handle(req, res);
}
