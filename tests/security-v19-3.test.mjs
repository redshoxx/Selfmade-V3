import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const index = await read('public/index.html');
const robots = await read('public/robots.txt');
const tdm = JSON.parse(await read('public/.well-known/tdmrep.json'));
const vercel = JSON.parse(await read('vercel.json'));
const license = await read('LICENSE');
const app = await read('public/app.js');
const sw = await read('public/sw.js');

test('V20 retains copyright, cloning, AI and TDM reservations', () => {
  assert.match(license, /PROPRIETARY LICENSE/);
  assert.match(license, /create a clone/i);
  assert.match(license, /machine learning/i);
  assert.match(index, /tdm-reservation" content="1/);
  assert.match(index, /noindex, nofollow, nosnippet/);
});

test('all crawlers and named AI bots are blocked', () => {
  assert.match(robots, /User-agent: \*/);
  assert.match(robots, /GPTBot[\s\S]*Disallow: \//);
  assert.match(robots, /ClaudeBot[\s\S]*Disallow: \//);
  assert.match(robots, /Google-Extended[\s\S]*Disallow: \//);
});

test('machine-readable TDM reservation covers the whole origin', () => {
  assert.deepEqual(tdm, [{ location: '/', 'tdm-reservation': 1 }]);
});

test('Vercel emits restrictive security, anti-framing and no-AI headers', () => {
  const global = vercel.headers.find((entry) => entry.source === '/(.*)');
  const headers = Object.fromEntries(global.headers.map(({ key, value }) => [key.toLowerCase(), value]));
  assert.match(headers['content-security-policy'], /frame-ancestors 'none'/);
  assert.equal(headers['x-frame-options'], 'DENY');
  assert.match(headers['x-robots-tag'], /noindex/);
  assert.equal(headers['tdm-reservation'], '1');
  assert.equal(headers['x-ai-training'], 'prohibited');
});

test('rights information is visible inside settings and V20 backups are marked confidential', () => {
  assert.match(app, /Rechte & Datenschutz/);
  assert.match(app, /KI-\/TDM-Schutz/);
  assert.match(app, /version: '20\.0\.0'/);
  assert.match(app, /nicht für Weitergabe, KI-Training oder Text- und Data-Mining/);
  assert.match(sw, /haushaltklar-v20-living-canvas/);
});
