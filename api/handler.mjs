import { createVercelApiHandler } from '../server.mjs';

export const config = {
  maxDuration: 30
};

const handle = createVercelApiHandler();

export default async function handler(req, res) {
  const rawPath = Array.isArray(req.query?.path)
    ? req.query.path.join('/')
    : String(req.query?.path || '').replace(/^\/+/, '');

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query || {})) {
    if (key === 'path') continue;
    if (Array.isArray(value)) value.forEach((entry) => query.append(key, String(entry)));
    else if (value !== undefined) query.set(key, String(value));
  }

  req.url = `/api/${rawPath}${query.size ? `?${query.toString()}` : ''}`;
  return handle(req, res);
}
