import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const read = file => readFile(path.join(root, file), 'utf8');

test('Version 15 ist in Paket, Manifest, Service Worker und Assets gesetzt', async () => {
  const pkg = JSON.parse(await read('package.json'));
  const manifest = JSON.parse(await read('public/manifest.webmanifest'));
  const sw = await read('public/sw.js');
  const html = await read('public/index.html');
  assert.equal(pkg.version, '15.0.0');
  assert.equal(manifest.version, '15.0.0');
  assert.match(sw, /selfmade-v15-stability-smart-receipt/);
  assert.match(html, /app\.js\?v=15/);
});

test('Kernfunktionen enthalten keine externe CDN-Abhängigkeit', async () => {
  const html = await read('public/index.html');
  const sw = await read('public/sw.js');
  const scanner = await read('src/features/barcode/scanner.js');
  for (const source of [html, sw, scanner]) assert.doesNotMatch(source, /unpkg|jsdelivr|cdnjs/i);
  assert.match(html, /\/vendor\/zxing-browser\.min\.js/);
  assert.match(sw, /\/vendor\/zxing-browser\.min\.js/);
  const pkg = JSON.parse(await read('package.json'));
  assert.equal(pkg.dependencies['@zxing/browser'], '0.2.1');
});

test('V15 verwendet normale Module statt part-Dateien', async () => {
  const entries = await readdir(path.join(root, 'src'), { recursive: true });
  assert.equal(entries.some(name => /part-\d+/.test(name)), false);
  const app = await read('src/app.js');
  assert.match(app, /^import/m);
});

test('iPhone-12-Formulare und Dialoge sind gegen Überlauf und Tastatur abgesichert', async () => {
  const css = await read('src/styles/app.css');
  const html = await read('public/index.html');
  assert.match(html, /maximum-scale=1/);
  assert.match(html, /viewport-fit=cover/);
  assert.match(css, /min-height:\s*52px/);
  assert.match(css, /font-size:\s*16px/);
  assert.match(css, /env\(safe-area-inset-bottom(?:,0px)?\)/);
  assert.match(css, /overflow-x:\s*hidden/);
  assert.match(css, /@media\s*\(max-width:\s*390px\)/);
  assert.match(css, /keyboard-open/);
});

test('Scanner ist begrenzt, beendet Streams und verhindert Mehrfachstarts', async () => {
  const scanner = await read('src/features/barcode/scanner.js');
  const css = await read('src/styles/app.css');
  assert.match(scanner, /starting=false/);
  assert.match(scanner, /getTracks\(\)\.forEach\(t=>t\.stop\(\)\)/);
  assert.match(scanner, /lastCode/);
  assert.match(css, /\.scanner video/);
  assert.match(css, /max-height/);
});

test('Service Worker aktualisiert offene Formulare nicht aggressiv', async () => {
  const sw = await read('public/sw.js');
  const app = await read('src/app.js');
  assert.doesNotMatch(sw, /skipWaiting\(\).*install/s);
  assert.match(sw, /SKIP_WAITING/);
  assert.match(app, /Neue Version verfügbar/);
  assert.match(app, /isDialogDirty|dialog.*dirty/i);
});

test('Cloud-Erfolgstoasts sind dauerhaft unterdrückt', async () => {
  const toast = await read('src/components/toast.js');
  assert.match(toast, /Cloud-Daten|synchronisiert/i);
  assert.match(toast, /return/);
});

test('Bonbilder werden als Blob in IndexedDB vorgemerkt und nicht als Data-URL gespeichert', async () => {
  const editor = await read('src/features/receipts/editor.js');
  const sync = await read('src/offline/sync.js');
  assert.match(editor, /put\('blobs'/);
  assert.match(editor, /blobKey/);
  assert.doesNotMatch(editor, /readAsDataURL/);
  assert.match(sync, /uploadReceiptImage/);
  assert.match(sync, /del\('blobs'/);
});

test('Gespeicherte Kassenbons besitzen Bearbeiten-, Löschen- und Schließen-Aktionen', async () => {
  const editor = await read('src/features/receipts/editor.js');
  const detail = await read('src/features/receipts/detail.js');
  assert.match(detail, /data-edit/);
  assert.match(detail, /startReceiptEdit/);
  assert.match(editor, /action:wasEditing\?'update':'create'/);
  assert.match(detail, /data-delete/);
  assert.match(detail, /data-close/);
});

test('CI, Migration und Sicherheitsheader sind vorhanden', async () => {
  assert.ok((await stat(path.join(root, '.github/workflows/ci.yml'))).size > 100);
  assert.ok((await stat(path.join(root, 'supabase/migrations/20260803_v15_receipt_storage.sql'))).size > 100);
  const vercel = await read('vercel.json');
  assert.match(vercel, /Content-Security-Policy/);
  assert.match(vercel, /X-Content-Type-Options/);
  assert.doesNotMatch(vercel, /service[_-]?role/i);
});
