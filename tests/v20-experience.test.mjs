import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const app = await read('public/app.js');
const css = await read('public/styles.css');
const index = await read('public/index.html');
const sw = await read('public/sw.js');
const manifest = JSON.parse(await read('public/manifest.webmanifest'));
const packageJson = JSON.parse(await read('package.json'));

test('V20 exposes the new adaptive Living Canvas experience', () => {
  assert.equal(packageJson.version, '20.0.0');
  assert.match(app, /HAUSHALTKLAR_V20/);
  assert.match(app, /experience: 'Living Canvas'/);
  assert.match(app, /v20Profiles/);
  assert.match(app, /comfort:[\s\S]*balanced:[\s\S]*compact:/);
  assert.match(css, /Living Canvas Designsystem/);
  assert.match(css, /data-v20-profile="comfort"/);
  assert.match(css, /data-v20-profile="compact"/);
});

test('V20 replaces the start dashboard with contextual daily priorities', () => {
  assert.match(app, /renderDashboardV20/);
  assert.match(app, /v20FocusCard/);
  assert.match(app, /v20TodayMeal/);
  assert.match(app, /Lebensmittel retten/);
  assert.match(app, /Einkauf vorbereiten/);
  assert.match(app, /Alles im grünen Bereich/);
  assert.match(css, /\.v20-focus-card/);
  assert.match(css, /\.v20-activity-strip/);
});

test('V20 provides universal quick actions for core workflows', () => {
  assert.match(app, /openV20QuickActions/);
  for (const target of ['shopping', 'note', 'money', 'recipe', 'scan', 'receipt']) {
    assert.match(app, new RegExp(`data-target="${target}"`));
  }
  assert.match(app, /open-shopping-add-v17/);
  assert.match(app, /add-note/);
  assert.match(app, /add-transaction/);
  assert.match(app, /add-recipe-v19/);
  assert.match(css, /\.v20-quick-grid/);
});

test('V20 navigation keeps all six major areas accessible', () => {
  assert.match(app, /tabBarV20/);
  for (const label of ['Heute', 'Finanzen', 'Einkauf', 'Vorrat', 'Küche', 'Notizen']) {
    assert.match(app, new RegExp(label));
  }
  assert.match(css, /\.v20-tab-bar/);
  assert.match(css, /grid-template-columns:repeat\(6/);
});

test('V20 keeps contextual actions visible in the relevant areas', () => {
  assert.match(app, /headerV20Context/);
  assert.match(app, /data-action="month-prev"/);
  assert.match(app, /data-action="month-next"/);
  assert.match(app, /data-action="start-store"/);
  assert.match(app, /data-action="add-pantry"/);
  assert.match(app, /data-action="add-recipe-v19"/);
  assert.match(app, /data-action="add-note"/);
  assert.match(css, /\.v20-context-actions/);
  assert.match(css, /\.v20-month-switcher/);
});

test('V20 ships a new launch screen and PWA identity', () => {
  assert.match(index, /boot-screen-v20/);
  assert.match(index, /Neue V20 Erfahrung/);
  assert.match(index, /app\.js\?v=20/);
  assert.match(index, /styles\.css\?v=20/);
  assert.match(css, /\.boot-screen-v20/);
  assert.match(sw, /haushaltklar-v20-living-canvas/);
  assert.equal(manifest.name, 'HaushaltKlar');
  assert.equal(manifest.theme_color, '#166D63');
  assert.ok(manifest.shortcuts.some((shortcut) => shortcut.short_name === 'Heute'));
});
