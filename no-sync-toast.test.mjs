import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const appPath = new URL('../public/app.js', import.meta.url);
const swPath = new URL('../public/sw.js', import.meta.url);
const indexPath = new URL('../public/index.html', import.meta.url);

test('cloud refresh does not emit a visible sync toast', async () => {
  const source = await readFile(appPath, 'utf8');
  const refreshStart = source.indexOf('async function cloudBackgroundRefresh()');
  const refreshEnd = source.indexOf('\nfunction applyTheme()', refreshStart);
  const refreshBlock = source.slice(refreshStart, refreshEnd);
  assert.ok(refreshStart > -1 && refreshEnd > refreshStart);
  assert.equal(/toast\s*\(/.test(refreshBlock), false);
  assert.match(source, /silentCloudMessages/);
  assert.match(source, /cloud-daten aktualisiert/);
});

test('service worker uses network-first core assets and a new cache version', async () => {
  const source = await readFile(swPath, 'utf8');
  assert.match(source, /selfmade-v13-zoom-lock/);
  assert.match(source, /cache:\s*'no-store'/);
  assert.match(source, /SELFMADE_UPDATED/);
});

test('core frontend assets are cache-busted', async () => {
  const source = await readFile(indexPath, 'utf8');
  assert.match(source, /styles\.css\?v=13/);
  assert.match(source, /app\.js\?v=13/);
  assert.match(source, /manifest\.webmanifest\?v=13/);
});
