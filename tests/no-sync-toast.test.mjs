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

test('service worker uses network-first core assets and a new cache version', () => {
  assert.match(sw, /selfmade-v16-shopping-redesign/);
  assert.match(sw, /fetch\(event\.request, \{ cache: 'no-store' \}\)/);
  assert.match(sw, /caches\.delete/);
});

test('core frontend assets are cache-busted', () => {
  assert.match(index, /styles\.css\?v=16/);
  assert.match(index, /app\.js\?v=16/);
  assert.match(app, /navigator\.serviceWorker\.register\('\/sw\.js'/);
});
