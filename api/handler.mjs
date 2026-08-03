import { createPureVercelHandler } from '../vercel-api.mjs';

export const config = {
  maxDuration: 30
};

const handle = createPureVercelHandler();

export default async function handler(req, res) {
  const pathValue = Array.isArray(req.query?.path)
    ? req.query.path.join('/')
    : String(req.query?.path || '').replace(/^\/+/, '');

  let apiPath = pathValue;
  if (!apiPath) {
    const original = String(req.headers['x-vercel-original-url'] || req.headers['x-original-url'] || '');
    const match = original.match(/^\/api\/(.+?)(?:\?|$)/);
    if (match) apiPath = match[1];
  }

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query || {})) {
    if (key === 'path') continue;
    if (Array.isArray(value)) value.forEach((entry) => query.append(key, String(entry)));
    else if (value !== undefined) query.set(key, String(value));
  }

  req.url = `/api/${apiPath || 'health'}${query.size ? `?${query.toString()}` : ''}`;
  return handle(req, res);
}
