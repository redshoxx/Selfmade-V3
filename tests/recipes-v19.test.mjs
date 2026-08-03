import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
const api = await readFile(new URL('../vercel-api.mjs', import.meta.url), 'utf8');
const index = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const sw = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');

test('V19 adds a dedicated recipes area and six-tab navigation', () => {
  assert.match(app, /tabs\.push\('recipes'\)/);
  assert.match(app, /renderRecipesAreaV19/);
  assert.match(app, /tab-bar-six-v19/);
  assert.match(css, /grid-template-columns:\s*repeat\(6/);
});

test('recipes support ingredients, structured steps, images, favorites and portions', () => {
  assert.match(app, /openRecipeEditorV19/);
  assert.match(app, /ingredient-editor-row-v19/);
  assert.match(app, /recipe-step-editor-v19/);
  assert.match(app, /scaledIngredientV19/);
  assert.match(api, /ingredients:\s*JSON\.stringify/);
  assert.match(api, /steps:\s*JSON\.stringify/);
});

test('meal planner covers the week and all requested meal types', () => {
  assert.match(app, /Montag bis Sonntag/);
  for (const meal of ['Frühstück', 'Mittagessen', 'Abendessen', 'Snack']) assert.match(app, new RegExp(meal));
  assert.match(api, /\/api\/meal-plan\/copy/);
});

test('recipe shopping flow considers pantry and aggregates missing quantities', () => {
  assert.match(app, /consider_pantry/);
  assert.match(app, /recipe-shopping-list-v19/);
  assert.match(api, /pantryAvailability/);
  assert.match(api, /const aggregated = new Map/);
  assert.match(api, /existing\.quantity/);
});

test('cooking mode includes wake lock, voice, swipe, timers and completion', () => {
  assert.match(app, /navigator\.wakeLock\.request\('screen'\)/);
  assert.match(app, /window\.SpeechRecognition \|\| window\.webkitSpeechRecognition/);
  assert.match(app, /touchstart/);
  assert.match(app, /startCookTimerV19/);
  assert.match(app, /Gericht fertig/);
  assert.match(app, /reduce_pantry/);
});

test('V19 assets force a fresh PWA cache', () => {
  assert.match(index, /app\.js\?v=19/);
  assert.match(index, /styles\.css\?v=19/);
  assert.match(sw, /selfmade-v19-recipes-cooking/);
  assert.match(sw, /version:\s*19/);
});
