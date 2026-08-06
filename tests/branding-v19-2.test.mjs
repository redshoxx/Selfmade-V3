import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const index = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
const manifest = JSON.parse(await readFile(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'));
const icon = await readFile(new URL('../public/icon.svg', import.meta.url), 'utf8');

test('V20 uses the professional HaushaltKlar brand consistently', () => {
  assert.equal(manifest.name, 'HaushaltKlar');
  assert.equal(manifest.short_name, 'HaushaltKlar');
  assert.equal(manifest.id, 'haushaltklar-household-app');
  assert.match(index, /<title>HaushaltKlar<\/title>/);
  assert.match(index, /apple-mobile-web-app-title" content="HaushaltKlar/);
  assert.match(app, /APP_BRAND_V192 = 'HaushaltKlar'/);
  assert.match(app, /version: '20\.0\.0'/);
});

test('V20 boot screen is branded and contains no fake status data', () => {
  assert.match(index, /boot-screen-v20/);
  assert.match(index, /Dein Alltag\. Klar organisiert\./);
  assert.match(index, /Neue V20 Erfahrung/);
  assert.match(css, /\.boot-mark-v20/);
  assert.doesNotMatch(index, /5G|battery|21:28|9:41/);
});

test('V20 navigation is compact and six-tab safe', () => {
  assert.match(css, /\.v20-tab-bar/);
  assert.match(css, /grid-template-columns:repeat\(6/);
  assert.match(css, /height:61px/);
  assert.match(css, /border-radius:22px/);
  assert.match(css, /\.v20-tab\.active/);
  assert.match(css, /safe-bottom/);
});

test('V20 dashboard uses actual household data and no sample cards', () => {
  assert.match(app, /renderDashboardV20/);
  assert.match(app, /data\?\.summary\?\.remaining/);
  assert.match(app, /v20TodayMeal/);
  assert.match(app, /data\?\.notes/);
  assert.doesNotMatch(app, /Guten Morgen, Lisa/);
});

test('app icon contains a house and checkmark vector', () => {
  assert.match(icon, /M258 485 512 278l254 207/);
  assert.match(icon, /m410 608 72 72 143-151/);
  assert.match(icon, /linearGradient id="brand"/);
});
