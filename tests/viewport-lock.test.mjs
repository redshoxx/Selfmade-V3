import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const index = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const sw = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');

test('viewport meta disables user scaling', () => {
  assert.match(index, /minimum-scale=1/);
  assert.match(index, /maximum-scale=1/);
  assert.match(index, /user-scalable=no/);
});

test('iPhone gestures and focus zoom are blocked', () => {
  assert.match(css, /touch-action:\s*pan-y/);
  assert.match(css, /-webkit-text-size-adjust:\s*100%/);
  assert.match(css, /font-size:\s*16px\s*!important/);
  assert.match(app, /gesturestart/);
  assert.match(app, /event\.touches\.length > 1/);
  assert.match(app, /lastViewportTouchEnd/);
  assert.match(app, /event\.ctrlKey \|\| event\.metaKey/);
});

test('version 15 core assets force a fresh PWA cache', () => {
  assert.match(index, /styles\.css\?v=15/);
  assert.match(index, /app\.js\?v=15/);
  assert.match(sw, /selfmade-v15-iphone12-layout/);
  assert.match(sw, /version:\s*15/);
});
