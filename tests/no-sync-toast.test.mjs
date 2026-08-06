import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const sw = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
const index = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');

test('cloud refresh does not emit a visible sync toast', () => {
  assert.doesNotMatch(app, /toast\(['"]Cloud-Daten aktualisiert/i);
  assert.match(app, /supabase-synchronisierung abgeschlossen/);
  assert.match(app, /if \(silentCloudMessages\.some\(\(text\) => normalizedMessage\.includes\(text\)\)\) return/);
});

test('service worker uses fast cached assets and a fresh V20 cache version', () => {
  assert.match(sw, /haushaltklar-v20-living-canvas/);
  assert.match(sw, /cacheFirstWithRefresh/);
  assert.match(sw, /navigationNetworkFirst/);
  assert.match(sw, /caches\.delete/);
});

test('core frontend assets are cache-busted for V20', () => {
  assert.match(index, /styles\.css\?v=20/);
  assert.match(index, /app\.js\?v=20/);
  assert.match(app, /navigator\.serviceWorker\.register\('\/sw\.js'/);
});
