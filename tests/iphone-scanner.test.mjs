import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const appSource = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const indexSource = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');

test('iPhone installation banner is removed completely', () => {
  assert.equal(appSource.includes('iosInstallTip'), false);
  assert.equal(appSource.includes('Als iPhone-App verwenden'), false);
});

test('barcode scanner includes Safari camera and photo fallbacks', () => {
  assert.match(appSource, /navigator\.mediaDevices\.getUserMedia/);
  assert.match(appSource, /BrowserMultiFormatReader/);
  assert.match(appSource, /id="barcode-photo"/);
  assert.match(appSource, /capture="environment"/);
  assert.match(appSource, /playsinline/);
  assert.doesNotMatch(indexSource, /zxing-browser-library/);
  assert.match(appSource, /https:\/\/unpkg\.com\/@zxing\/browser@0\.2\.1/);
});
