import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('iPhone-12-Tabbar bleibt kompakt und verwendet die Safe-Area nur einmal', async () => {
  const css = await read('public/styles.css');
  assert.match(css, /--iphone-tab-content-height:\s*49px/);
  assert.match(css, /\.tab-bar\s*\{[\s\S]*?margin:\s*0;/);
  assert.match(css, /min-height:\s*calc\(var\(--iphone-tab-content-height\) \+ var\(--safe-bottom\)\)/);
});

test('Scanner-Vorschau übernimmt niemals das Hochformat-Seitenverhältnis der Kamera', async () => {
  const css = await read('public/styles.css');
  assert.match(css, /\.dialog:has\(\.scanner-panel\) \.scanner-panel\s*\{[\s\S]*?height:\s*clamp\(220px, 34svh, 286px\)/);
  assert.match(css, /\.dialog:has\(\.scanner-panel\) \.scanner-panel video\s*\{[\s\S]*?height:\s*100%;[\s\S]*?min-height:\s*0;/);
  assert.match(css, /\.dialog:has\(\.scanner-panel\) \.scanner-frame\s*\{[\s\S]*?height:\s*108px/);
});

test('Formulare bleiben auf dem iPhone 12 zweispaltig und kompakt', async () => {
  const css = await read('public/styles.css');
  assert.match(css, /\.form-row\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 359px\)/);
  assert.match(css, /\.dialog-actions:has\(\.btn-danger\)[\s\S]*?flex-wrap:\s*nowrap/);
});

test('Scannerbibliothek ist fest versioniert und nicht mehr auf einen fehlenden lokalen Pfad angewiesen', async () => {
  const index = await read('public/index.html');
  const app = await read('public/app.js');
  assert.doesNotMatch(index, /\/vendor\/zxing-browser\.min\.js/);
  assert.match(index, /https:\/\/unpkg\.com\/@zxing\/browser@0\.2\.1/);
  assert.match(app, /cdn\.jsdelivr\.net\/npm\/@zxing\/browser@0\.2\.1/);
});

test('Cloud-Synchronisierung erzeugt keine Erfolgsbenachrichtigung', async () => {
  const app = await read('public/app.js');
  assert.match(app, /supabase-synchronisierung abgeschlossen/);
  assert.match(app, /silentCloudMessages\.some/);
});
