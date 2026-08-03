import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createServerApp } from '../server.mjs';

async function withServer(options, fn) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'selfmade-cloud-'));
  const app = await createServerApp({ dbPath: path.join(dir, 'test.sqlite'), ...options });
  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  const { port } = app.server.address();
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await app.close();
    await rm(dir, { recursive: true, force: true });
  }
}

test('cloud config reports local SQLite fallback', async () => {
  await withServer({}, async (base) => {
    const response = await fetch(`${base}/api/cloud/config`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { enabled: false, storage: 'sqlite' });
  });
});

test('configured cloud mode protects app data with authentication', async () => {
  await withServer({
    supabaseUrl: 'https://example.supabase.co',
    supabasePublishableKey: 'sb_publishable_test'
  }, async (base) => {
    const config = await fetch(`${base}/api/cloud/config`).then((response) => response.json());
    assert.equal(config.enabled, true);
    assert.equal(config.storage, 'supabase');

    const response = await fetch(`${base}/api/state`);
    assert.equal(response.status, 401);
    const payload = await response.json();
    assert.match(payload.error, /anmelden/i);
  });
});
