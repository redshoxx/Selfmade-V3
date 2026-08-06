import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const app = await Promise.all(Array.from({ length: 8 }, (_, index) => read(`src/v21/app/part-${String(index).padStart(3, '0')}`))).then((parts) => parts.join(''));
const styles = await Promise.all(Array.from({ length: 4 }, (_, index) => read(`src/v21/styles/part-${String(index).padStart(3, '0')}`))).then((parts) => parts.join(''));
const index = await read('public/index.html');
const manifest = JSON.parse(await read('public/manifest.webmanifest'));
const assembler = await read('scripts/assemble-assets.mjs');
const serviceWorker = await read('public/sw.js');

const requiredViews = ['today', 'shopping', 'kitchen', 'money', 'more'];
const requiredEndpoints = ['/api/auth/signin', '/api/state', '/api/shopping', '/api/pantry', '/api/recipes', '/api/meal-plan', '/api/transactions', '/api/budgets', '/api/notes', '/api/settings', '/api/checkout'];

test('V21 uses a dedicated frontend instead of legacy fragments', () => {
  assert.match(assembler, /src\/v21\/app/);
  assert.match(assembler, /src\/v21\/styles/);
  assert.doesNotMatch(assembler, /assemble\('src\/app'/);
  assert.doesNotMatch(assembler, /assemble\('src\/styles'/);
});

test('V21 contains the five simple primary areas', () => {
  for (const view of requiredViews) {
    assert.ok(
      app.includes(`'${view}'`) || app.includes(`"${view}"`),
      `Missing primary view ${view}`
    );
  }
  assert.match(app, /Heute/);
  assert.match(app, /Einkauf/);
  assert.match(app, /Küche/);
  assert.match(app, /Geld/);
  assert.match(app, /Mehr/);
});

test('all requested household functions use real API routes', () => {
  for (const endpoint of requiredEndpoints) assert.ok(app.includes(endpoint), `Missing ${endpoint}`);
  assert.match(app, /Spar-Challenge/);
  assert.match(app, /SYSTEM_CHALLENGE_TAG/);
  assert.match(app, /recipe-to-shopping/);
  assert.match(app, /Ladenmodus/);
});

test('new design is responsive, readable and supports dark mode', () => {
  assert.match(styles, /--sidebar-width/);
  assert.match(styles, /\.bottom-nav/);
  assert.match(styles, /@media \(max-width: 820px\)/);
  assert.match(styles, /min-height: 48px/);
  assert.match(styles, /:root\[data-theme="dark"\]/);
  assert.doesNotMatch(styles, /living-canvas/i);
});

test('PWA identity and cache point to V21', () => {
  assert.equal(manifest.id, 'haushaltklar-v21-clean-rebuild');
  assert.equal(manifest.name, 'HaushaltKlar');
  assert.match(index, /v=21\.0\.0/);
  assert.match(serviceWorker, /haushaltklar-v21-clean-rebuild/);
});

test('no Supabase secret is embedded in the new client', () => {
  assert.doesNotMatch(app, /sb_secret_/);
  assert.doesNotMatch(index, /sb_secret_/);
});
