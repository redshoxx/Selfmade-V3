import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const styles = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
const index = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const sw = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');

test('shopping page uses a native add sheet instead of an expanded form', () => {
  assert.match(app, /openShoppingAddSheetV17/);
  assert.match(app, /Produkt hinzufügen/);
  assert.match(app, /shopping-sheet-search-v17/);
  assert.doesNotMatch(app, /renderShoppingV17[\s\S]{0,1600}shopping-quick-form-v16/);
});

test('shopping list supports compact and list views', () => {
  assert.match(app, /shoppingViewV17/);
  assert.match(app, /data-view="compact"/);
  assert.match(app, /data-view="list"/);
  assert.match(app, /toggle-shopping-group-v17/);
  assert.match(styles, /\.shopping-view-toggle-v17/);
  assert.match(styles, /\.shopping-row-v17\.compact/);
  assert.match(styles, /\.shopping-row-v17\.list/);
});

test('store mode uses compact cards and price bottom sheet', () => {
  assert.match(app, /renderStoreModeV17/);
  assert.match(app, /openStorePriceSheetV17/);
  assert.match(app, /store-price-button-v17/);
  assert.match(app, /store-footer-v17/);
  assert.match(styles, /\.store-item-v17/);
  assert.match(styles, /\.store-price-sheet-v17/);
});

test('version 19 preserves the V17 shopping UI with a fresh performance cache', () => {
  assert.match(index, /app\.js\?v=19\.3/);
  assert.match(index, /styles\.css\?v=19\.3/);
  assert.match(sw, /haushaltklar-v19-3-protection/);
  assert.match(sw, /version:\s*19\.3/);
});
