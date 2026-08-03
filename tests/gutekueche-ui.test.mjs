import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');const css=await readFile(new URL('../public/styles.css',import.meta.url),'utf8');const api=await readFile(new URL('../vercel-api.mjs',import.meta.url),'utf8');
test('recipe area exposes a single GuteKueche link import with review editor',()=>{assert.match(app,/import-gutekueche-v191/);assert.match(app,/openRecipeEditorV19\(response\.recipe\)/);assert.match(app,/Originalbild wird nicht übernommen/);assert.match(css,/\.gutekueche-import-v191/);});
test('server preview endpoint is authenticated and non-mutating',()=>{assert.match(api,/\/api\/recipes\/import\/gutekueche\/preview/);assert.match(api,/await cloud\.getUser\(token\)/);assert.match(api,/fetchGuteKuecheRecipe/);});
