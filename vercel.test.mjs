import test from 'node:test';
import assert from 'node:assert/strict';
import { createVercelApiHandler } from '../server.mjs';

function request(pathname = '/api/health') {
  return {
    method: 'GET',
    url: pathname,
    headers: { host: 'localhost' },
    [Symbol.asyncIterator]: async function* () {}
  };
}

function response() {
  const chunks = [];
  return {
    statusCode: 200,
    headers: {},
    headersSent: false,
    writableEnded: false,
    writeHead(statusCode, headers = {}) {
      this.statusCode = statusCode;
      this.headers = { ...headers };
      this.headersSent = true;
    },
    end(chunk) {
      if (chunk) chunks.push(Buffer.from(chunk));
      this.writableEnded = true;
    },
    json() {
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    }
  };
}

test('Vercel handler reports Supabase cloud health', async () => {
  const handler = createVercelApiHandler({
    supabaseUrl: 'https://example.supabase.co',
    supabasePublishableKey: 'sb_publishable_test'
  });
  const res = response();
  await handler(request('/api/health'), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().storage, 'supabase');
});

test('Vercel handler rejects deployments without Supabase variables', async () => {
  const handler = createVercelApiHandler({ supabaseUrl: '', supabasePublishableKey: '' });
  const res = response();
  await handler(request('/api/health'), res);
  assert.equal(res.statusCode, 503);
  assert.equal(res.json().code, 'supabase_not_configured');
});

test('production Vercel handler starts with embedded publishable configuration', async () => {
  const { createPureVercelHandler } = await import('../vercel-api.mjs');
  const handler = createPureVercelHandler();
  const res = response();
  await handler(request('/api/cloud/config'), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), { enabled: true, storage: 'supabase' });
});
