import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createServerApp } from '../server.mjs';
import { createPureVercelHandler } from '../vercel-api.mjs';

function token(payload = {}) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode(payload)}.`;
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
}

async function withFakeSupabase(fn) {
  let state = null;
  let version = 0;
  const householdId = '11111111-1111-4111-8111-111111111111';
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const send = (status, payload) => {
      const body = JSON.stringify(payload);
      res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) });
      res.end(body);
    };

    if (url.pathname === '/rest/v1/selfmade_household_states') {
      if (!state) return send(200, []);
      return send(200, [{ household_id: householdId, version, data: state, updated_at: new Date().toISOString() }]);
    }
    if (url.pathname === '/rest/v1/selfmade_households') {
      return send(200, [{ id: householdId, name: 'Wolfis Haushalt', owner_id: 'user-1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }]);
    }
    if (url.pathname === '/rest/v1/rpc/selfmade_bootstrap') {
      const body = await readBody(req);
      state = body.p_initial_state;
      version = 1;
      return send(200, [{ household_id: householdId, household_name: 'Wolfis Haushalt', state_version: version, state_data: state, state_updated_at: new Date().toISOString() }]);
    }
    if (url.pathname === '/rest/v1/rpc/selfmade_update_state') {
      const body = await readBody(req);
      if (Number(body.p_expected_version) !== version) return send(400, { code: '40001', message: 'version_conflict' });
      state = body.p_state;
      version += 1;
      return send(200, [{ state_version: version, state_updated_at: new Date().toISOString() }]);
    }
    return send(404, { message: 'not found' });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    await fn({ url: `http://127.0.0.1:${port}`, getState: () => state, getVersion: () => version });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function withPureVercelApp(options, fn) {
  const handler = createPureVercelHandler(options);
  const server = http.createServer((req, res) => handler(req, res));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try { await fn(`http://127.0.0.1:${port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

async function withApp(options, fn) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'selfmade-cloud-integration-'));
  const app = await createServerApp({ dbPath: path.join(dir, 'test.sqlite'), ...options });
  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  const { port } = app.server.address();
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await app.close();
    await rm(dir, { recursive: true, force: true });
  }
}

test('Supabase snapshot bridge bootstraps and persists API mutations', async () => {
  await withFakeSupabase(async (fake) => {
    await withApp({ supabaseUrl: fake.url, supabasePublishableKey: 'sb_publishable_test' }, async (base) => {
      const accessToken = token({ email: 'wolfi@example.at', user_metadata: { display_name: 'Wolfi' } });
      const headers = { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' };

      const initialResponse = await fetch(`${base}/api/state`, { headers });
      assert.equal(initialResponse.status, 200);
      const initial = await initialResponse.json();
      assert.equal(initial.settings.display_name, 'Wolfi');
      assert.equal(initial.cloud.version, 1);

      const createdResponse = await fetch(`${base}/api/shopping`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: 'Olivenöl', quantity: '1', category: 'Vorrat' })
      });
      assert.equal(createdResponse.status, 201);
      const created = await createdResponse.json();
      assert.ok(created.shopping.some((item) => item.name === 'Olivenöl'));
      assert.equal(created.cloud.version, 2);

      const reloaded = await fetch(`${base}/api/state`, { headers }).then((response) => response.json());
      assert.ok(reloaded.shopping.some((item) => item.name === 'Olivenöl'));
      assert.equal(fake.getVersion(), 2);
      assert.equal(fake.getState().version, 3);
    });
  });
});

test('V19 recipe, meal-plan and cooking completion persist through Supabase snapshots', async () => {
  await withFakeSupabase(async (fake) => {
    await withPureVercelApp({ supabaseUrl: fake.url, supabasePublishableKey: 'sb_publishable_test' }, async (base) => {
      const accessToken = token({ email: 'koch@example.at', user_metadata: { display_name: 'Koch' } });
      const headers = { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' };
      await fetch(`${base}/api/state`, { headers });

      const createdResponse = await fetch(`${base}/api/recipes`, {
        method: 'POST', headers,
        body: JSON.stringify({
          name: 'Pasta', servings: 2, category: 'Hauptgericht', difficulty: 'Einfach',
          ingredients: [{ name: 'Nudeln', amount: 200, unit: 'g', category: 'Vorrat' }, { name: 'Tomaten', amount: 300, unit: 'g', category: 'Obst & Gemüse' }],
          steps: [{ title: 'Kochen', text: 'Die Nudeln 10 Minuten kochen.', ingredients: ['Nudeln'] }]
        })
      });
      assert.equal(createdResponse.status, 201);
      const created = await createdResponse.json();
      const recipe = created.recipes.find((item) => item.name === 'Pasta');
      assert.ok(recipe);
      assert.equal(recipe.ingredients.length, 2);

      const planResponse = await fetch(`${base}/api/meal-plan`, {
        method: 'POST', headers,
        body: JSON.stringify({ recipe_id: recipe.id, plan_date: '2026-08-04', meal_type: 'Abendessen', servings: 3 })
      });
      assert.equal(planResponse.status, 201);
      const planned = await planResponse.json();
      assert.equal(planned.meal_plan[0].recipe_id, recipe.id);

      const shoppingResponse = await fetch(`${base}/api/recipes/${recipe.id}/shopping`, {
        method: 'POST', headers,
        body: JSON.stringify({ servings: 2, consider_pantry: true })
      });
      assert.equal(shoppingResponse.status, 200);
      const shopping = await shoppingResponse.json();
      assert.equal(shopping.added_count, 2);
      assert.ok(shopping.state.shopping.some((item) => item.name === 'Nudeln'));

      const completeResponse = await fetch(`${base}/api/recipes/${recipe.id}/complete`, {
        method: 'POST', headers,
        body: JSON.stringify({ rating: 5, actual_minutes: 18, servings: 2, cook_note: 'Sehr gut', reduce_pantry: true })
      });
      assert.equal(completeResponse.status, 200);
      const completed = await completeResponse.json();
      assert.equal(completed.history.rating, 5);
      assert.equal(completed.state.cooking_history.length, 1);
      assert.equal(fake.getState().tables.recipes.length, 1);
    });
  });
});
