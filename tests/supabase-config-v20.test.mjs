import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const publicConfig = await read('supabase-public-config.mjs');
const envExample = await read('.env.example');
const handler = await read('api/handler.mjs');

const projectRef = 'dpqhoesiniberglymdtb';
const projectUrl = `https://${projectRef}.supabase.co`;

test('V20 points public Supabase traffic at the new project', () => {
  assert.match(publicConfig, new RegExp(projectUrl.replaceAll('.', '\\.')));
  assert.match(publicConfig, /sb_publishable_v6WZrBJRxMlC_AwANUKGgQ_MfScF5Ry/);
  assert.match(publicConfig, new RegExp(`${projectRef}\\.supabase\\.co/auth/v1/\\.well-known/jwks\\.json`));
  assert.match(envExample, new RegExp(`SUPABASE_URL=${projectUrl.replaceAll('.', '\\.')}`));
});

test('secret Supabase credentials are never embedded in repository configuration', () => {
  assert.doesNotMatch(publicConfig, /sb_secret_/);
  assert.doesNotMatch(envExample, /SUPABASE_SECRET_KEY=sb_secret_/);
  assert.doesNotMatch(handler, /sb_secret_/);
});

test('Vercel handler still prefers environment overrides', () => {
  assert.match(handler, /process\.env\.SUPABASE_URL \?\? DEFAULT_SUPABASE_URL/);
  assert.match(handler, /process\.env\.SUPABASE_PUBLISHABLE_KEY \?\? DEFAULT_SUPABASE_PUBLISHABLE_KEY/);
});
