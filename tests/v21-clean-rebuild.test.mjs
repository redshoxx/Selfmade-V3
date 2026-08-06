import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const joinParts = async (directory) => {
  const names = (await readdir(new URL(directory, root)))
    .filter((name) => name.startsWith('part-'))
    .sort();
  return Promise.all(names.map((name) => read(`${directory}${name}`))).then((parts) => parts.join(''));
};

const app = await joinParts('src/v21/app/');
const styles = await joinParts('src/v21/styles/');
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
    assert.ok(app.includes(`'${view}'`) || app.includes(`"${view}"`), `Missing primary view ${view}`);
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

test('V21.1 repairs shopping interactions and search focus', () => {
  assert.match(app, /shopping-quick-form/);
  assert.match(app, /add-suggestion/);
  assert.match(app, /v211CaptureFocus/);
  assert.match(app, /setSelectionRange/);
  assert.match(styles, /\.shopping-quick-card/);
  assert.match(styles, /\.simple-shopping-list/);
});

test('V21.1 weekly planner supports navigation and full meal management', () => {
  assert.match(app, /week-prev/);
  assert.match(app, /week-next/);
  assert.match(app, /copy-previous-week/);
  assert.match(app, /edit-meal/);
  assert.match(app, /delete-meal/);
  assert.match(app, /\/api\/meal-plan\/copy/);
  assert.match(app, /method: id \? 'PATCH' : 'POST'/);
  assert.match(styles, /\.planner-days/);
  assert.match(styles, /\.planner-slot/);
});

test('V21.1 handles expired sessions and asynchronous failures visibly', () => {
  assert.match(app, /v211ClearSession/);
  assert.match(app, /Sitzung ist abgelaufen/);
  assert.match(app, /unhandledrejection/);
});

test('new design is responsive, readable and supports dark mode', () => {
  assert.match(styles, /--sidebar-width/);
  assert.match(styles, /\.bottom-nav/);
  assert.match(styles, /@media \(max-width: 820px\)/);
  assert.match(styles, /min-height: 48px/);
  assert.match(styles, /:root\[data-theme="dark"\]/);
  assert.doesNotMatch(styles, /living-canvas/i);
});

test('PWA identity is preserved while cache points to V21.1', () => {
  assert.equal(manifest.version, '21.1.0');
  assert.equal(manifest.id, 'haushaltklar-v21-clean-rebuild');
  assert.equal(manifest.name, 'HaushaltKlar');
  assert.match(index, /v=21\.1\.0/);
  assert.match(serviceWorker, /haushaltklar-v21-1-interaction-fix/);
  assert.match(serviceWorker, /v=21\.1\.0/);
});

test('no Supabase secret is embedded in the client', () => {
  assert.doesNotMatch(app, /sb_secret_/);
  assert.doesNotMatch(index, /sb_secret_/);
});
