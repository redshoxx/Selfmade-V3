import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');

test('six-tab navigation remains bounded on iPhone width', () => {
  assert.match(css, /\.tab-bar-six-v19\s*\{[^}]*grid-template-columns:\s*repeat\(6, minmax\(0, 1fr\)\)/s);
  assert.match(css, /\.tab-bar-six-v19 \.tab-button\s*\{[^}]*min-width:\s*0/s);
});

test('recipe cards and planner use responsive minmax grids', () => {
  assert.match(css, /\.recipe-grid-v19\s*\{[^}]*repeat\(2, minmax\(0, 1fr\)\)/s);
  assert.match(css, /\.planner-meals-v19\s*\{[^}]*repeat\(2, minmax\(0,1fr\)\)/s);
  assert.match(css, /@media \(max-width: 359px\)/);
});

test('cooking mode respects viewport and safe areas', () => {
  assert.match(css, /\.cook-mode-v19\s*\{[^}]*position:\s*fixed;[^}]*inset:\s*0;[^}]*height:\s*var\(--app-viewport-height/s);
  assert.match(css, /\.cook-header-v19\s*\{[^}]*var\(--safe-top\)/s);
  assert.match(css, /\.cook-footer-v19\s*\{[^}]*var\(--safe-bottom\)/s);
  assert.match(app, /visualViewport/);
});

test('long recipe and planner content scrolls internally without horizontal overflow patterns', () => {
  assert.match(css, /\.cook-content-v19\s*\{[^}]*overflow-y:\s*auto/s);
  assert.match(css, /\.meal-recipe-list-v19\s*\{[^}]*overflow-y:\s*auto/s);
  assert.match(css, /minmax\(0,1fr\)|minmax\(0, 1fr\)/);
});
