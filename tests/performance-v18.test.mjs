import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
const sw = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
const index = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const vercel = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
const cloud = await readFile(new URL('../supabase-cloud.mjs', import.meta.url), 'utf8');
const handler = await readFile(new URL('../api/handler.mjs', import.meta.url), 'utf8');

test('scanner library is loaded only when requested', () => {
  assert.doesNotMatch(index, /zxing-browser-library/);
  assert.match(app, /ensureZxingLibraryV15/);
  assert.match(app, /unpkg\.com\/@zxing\/browser/);
});

test('cloud polling uses a lightweight version endpoint and adaptive scheduling', () => {
  assert.match(app, /\/api\/state\/version/);
  assert.doesNotMatch(app, /setInterval\(cloudBackgroundRefresh/);
  assert.match(app, /cloudSyncDelayV18/);
  assert.match(app, /document\.hidden/);
  assert.match(app, /refresh = async function refreshV18/);
});

test('duplicate state requests and duplicate renders are suppressed', () => {
  assert.match(app, /pendingStateRequestV18/);
  assert.match(app, /lastRenderSignatureV18/);
  assert.match(app, /data === lastRenderDataV18/);
  assert.match(app, /requestIdleCallback\(write/);
});

test('large lists use rendering containment', () => {
  assert.match(css, /content-visibility:\s*auto/);
  assert.match(css, /contain:\s*layout style paint/);
  assert.match(css, /contain-intrinsic-size/);
});

test('service worker serves versioned assets cache-first and navigation network-first', () => {
  assert.match(sw, /selfmade-v18-performance/);
  assert.match(sw, /cacheFirstWithRefresh/);
  assert.match(sw, /navigationNetworkFirst/);
  assert.match(sw, /version:\s*18/);
});

test('versioned assets have immutable browser caching', () => {
  const serialized = JSON.stringify(vercel);
  assert.match(serialized, /max-age=31536000, immutable/);
  assert.match(index, /modulepreload/);
  assert.match(index, /app\.js\?v=18/);
});

test('Supabase bridge provides metadata-only state checks without redundant household lookup', () => {
  assert.match(cloud, /loadStateMeta/);
  assert.match(cloud, /select=household_id,version,updated_at/);
  assert.match(cloud, /stateHouseholdName/);
  assert.doesNotMatch(cloud, /const households = await listHouseholds\(token\)/);
  assert.match(handler, /\/api\/state\/version/);
  assert.match(handler, /loadStateMeta/);
});
