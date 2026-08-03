import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createServerApp } from '../server.mjs';

async function withServer(fn) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'selfmade-'));
  const app = await createServerApp({ dbPath: path.join(dir, 'test.sqlite') });
  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  const address = app.server.address();
  const base = `http://127.0.0.1:${address.port}`;
  try {
    await fn(base);
  } finally {
    await app.close();
    await rm(dir, { recursive: true, force: true });
  }
}

async function request(base, route, options = {}) {
  const response = await fetch(`${base}${route}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers ?? {}) }
  });
  const payload = await response.json();
  assert.equal(response.ok, true, payload.error);
  return payload;
}

test('initial state contains all five app areas', async () => {
  await withServer(async (base) => {
    const state = await request(base, '/api/state');
    assert.equal(state.settings.display_name, '');
    assert.equal(state.summary.remaining, 0);
    assert.equal(state.budgets.length, 0);
    assert.equal(state.shopping.length, 0);
    assert.equal(state.pantry.length, 0);
    assert.equal(state.notes.length, 0);
    assert.equal(state.members.length, 0);
    assert.equal(state.product_catalog.length, 0);
  });
});

test('shopping item can be created and updated', async () => {
  await withServer(async (base) => {
    let state = await request(base, '/api/shopping', {
      method: 'POST',
      body: JSON.stringify({ name: 'Olivenöl', quantity: '1', category: 'Vorrat' })
    });
    const item = state.shopping.find((entry) => entry.name === 'Olivenöl');
    assert.ok(item);

    state = await request(base, `/api/shopping/${item.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ checked: true, price: 6.49 })
    });
    assert.equal(state.shopping.find((entry) => entry.id === item.id).checked, true);
  });
});

test('checkout books expense and moves food to pantry inbox', async () => {
  await withServer(async (base) => {
    let before = await request(base, '/api/shopping', {
      method: 'POST',
      body: JSON.stringify({ name: 'Testprodukt', quantity: '1', category: 'Lebensmittel', price: 2.5 })
    });
    const created = before.shopping.find((item) => item.name === 'Testprodukt');
    before = await request(base, `/api/shopping/${created.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ checked: true })
    });
    const selected = before.shopping.filter((item) => item.checked);
    const beforeExpense = before.summary.expense;
    const beforeInbox = before.pantry.filter((item) => item.inbox).length;

    const result = await request(base, '/api/checkout', {
      method: 'POST',
      body: JSON.stringify({ items: selected.map((item) => ({ id: item.id, price: item.price })) })
    });

    assert.ok(result.total > 0);
    assert.ok(result.state.summary.expense > beforeExpense);
    assert.ok(result.state.pantry.filter((item) => item.inbox).length > beforeInbox);
    assert.equal(result.state.shopping.some((item) => selected.some((selectedItem) => selectedItem.id === item.id)), false);
  });
});

test('settings persist theme and display name', async () => {
  await withServer(async (base) => {
    const state = await request(base, '/api/settings', {
      method: 'PATCH',
      body: JSON.stringify({ display_name: 'Wolfi', theme: 'dark' })
    });
    assert.equal(state.settings.display_name, 'Wolfi');
    assert.equal(state.settings.theme, 'dark');
  });
});

test('barcode catalog lookup and create work', async () => {
  await withServer(async (base) => {
    const state = await request(base, '/api/catalog', {
      method: 'POST',
      body: JSON.stringify({
        barcode: '1234567890123',
        name: 'Testprodukt',
        brand: '',
        category: 'Vorrat',
        default_quantity: '1',
        last_price: 7.49
      })
    });
    assert.ok(state.product_catalog.some((item) => item.barcode === '1234567890123'));

    const lookup = await request(base, '/api/catalog/lookup?barcode=1234567890123');
    assert.equal(lookup.product.name, 'Testprodukt');
  });
});

test('receipt text is parsed and imported as transaction', async () => {
  await withServer(async (base) => {
    const parsed = await request(base, '/api/receipts/parse', {
      method: 'POST',
      body: JSON.stringify({ ocr_text: 'BILLA\nVollmilch 1,29\nTomaten 2,49\nGesamt 3,78' })
    });
    assert.equal(parsed.items.length, 2);
    assert.equal(parsed.total, 3.78);

    const before = await request(base, '/api/state');
    const state = await request(base, '/api/receipts', {
      method: 'POST',
      body: JSON.stringify({
        store_name: 'BILLA',
        receipt_date: '2026-08-03',
        total: 3.78,
        items: parsed.items,
        book_transaction: true,
        transfer_to_pantry: true
      })
    });
    assert.equal(state.receipts.length, 1);
    assert.ok(state.summary.expense > before.summary.expense);
    assert.ok(state.pantry.filter((item) => item.inbox).length > before.pantry.filter((item) => item.inbox).length);
  });
});

test('recurring items and export endpoint work', async () => {
  await withServer(async (base) => {
    const state = await request(base, '/api/recurring', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Müllbeutel',
        quantity: '1 Rolle',
        category: 'Haushalt',
        frequency_days: 30,
        next_due: '2026-08-03'
      })
    });
    assert.ok(state.recurring.some((item) => item.name === 'Müllbeutel'));

    const exported = await request(base, '/api/export');
    assert.equal(exported.version, 3);
    assert.ok(Array.isArray(exported.tables.product_catalog));
  });
});

test('household members can be created and assigned', async () => {
  await withServer(async (base) => {
    let state = await request(base, '/api/members', {
      method: 'POST',
      body: JSON.stringify({ name: 'Wolfi', avatar: 'W', role: 'Mitglied' })
    });
    const member = state.members.find((item) => item.name === 'Wolfi');
    assert.ok(member);

    state = await request(base, '/api/shopping', {
      method: 'POST',
      body: JSON.stringify({ name: 'Kaffee', quantity: '1', category: 'Vorrat', member_id: member.id })
    });
    assert.equal(state.shopping.find((item) => item.name === 'Kaffee').member_id, member.id);
  });
});

test('enhanced pantry and note metadata persist', async () => {
  await withServer(async (base) => {
    let state = await request(base, '/api/pantry', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Reis', quantity: '1', unit: 'kg', category: 'Vorrat',
        location: 'Vorratsschrank', min_quantity: 1, price: 2.49,
        purchase_date: '2026-08-03', note: 'Basmati'
      })
    });
    const pantry = state.pantry.find((item) => item.name === 'Reis');
    assert.equal(pantry.unit, 'kg');
    assert.equal(pantry.low_stock, true);

    state = await request(base, '/api/notes', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Rezept', content: 'Reis kochen', tag: 'Kochen',
        due_date: '2026-08-04', related_type: 'Vorrat', related_name: 'Reis'
      })
    });
    const note = state.notes.find((item) => item.title === 'Rezept');
    assert.equal(note.tag, 'Kochen');
    assert.equal(note.related_name, 'Reis');
  });
});

test('backup export and import restore data', async () => {
  await withServer(async (base) => {
    await request(base, '/api/settings', { method: 'PATCH', body: JSON.stringify({ display_name: 'Testkonto' }) });
    const backup = await request(base, '/api/export');
    await request(base, '/api/shopping', {
      method: 'POST',
      body: JSON.stringify({ name: 'Nur temporär', quantity: '1', category: 'Sonstiges' })
    });
    const restored = await request(base, '/api/import', {
      method: 'POST',
      body: JSON.stringify(backup)
    });
    assert.equal(restored.shopping.some((item) => item.name === 'Nur temporär'), false);
    assert.equal(restored.settings.display_name, 'Testkonto');
  });
});
