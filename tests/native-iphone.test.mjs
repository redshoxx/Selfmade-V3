import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const index = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const manifest = JSON.parse(await readFile(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'));

test('homescreen mode is configured as a standalone app', () => {
  assert.equal(manifest.display, 'standalone');
  assert.deepEqual(manifest.display_override, ['standalone', 'fullscreen']);
  assert.equal(manifest.id, 'selfmade-household-app');
  assert.match(index, /apple-mobile-web-app-capable" content="yes/);
  assert.match(index, /format-detection/);
  assert.match(index, /display-mode: standalone/);
});

test('safe areas and visual viewport protect iPhone layout', () => {
  assert.match(css, /safe-area-inset-top/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /--app-viewport-height/);
  assert.match(css, /keyboard-open \.tab-bar/);
  assert.match(app, /window\.visualViewport/);
  assert.match(app, /syncNativeViewport/);
  assert.match(app, /scrollIntoView/);
});

test('forms have native touch sizing, validation and submission protection', () => {
  assert.match(css, /min-height:\s*52px/);
  assert.match(css, /\.form-grid\.was-validated/);
  assert.match(css, /data-submitting="true"/);
  assert.match(app, /beginFormSubmission/);
  assert.match(app, /form\.checkValidity\(\)/);
  assert.match(app, /form\.reportValidity\(\)/);
  assert.match(app, /enterkeyhint/);
  assert.match(app, /inputmode/);
});
