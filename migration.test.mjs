import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const fullMigration = new URL('../supabase/migrations/20260803_selfmade_cloud.sql', import.meta.url);
const hotfixMigration = new URL('../supabase/migrations/20260803_fix_bootstrap_household_id_ambiguity.sql', import.meta.url);

test('bootstrap migration uses named constraints instead of ambiguous household_id conflict targets', async () => {
  const sql = await readFile(fullMigration, 'utf8');
  assert.doesNotMatch(sql, /on\s+conflict\s*\(\s*household_id\s*\)/i);
  assert.match(sql, /on\s+conflict\s+on\s+constraint\s+selfmade_household_states_pkey/i);
});

test('hotfix can replace the existing bootstrap RPC safely', async () => {
  const sql = await readFile(hotfixMigration, 'utf8');
  assert.match(sql, /create\s+or\s+replace\s+function\s+public\.selfmade_bootstrap/i);
  assert.match(sql, /on\s+conflict\s+on\s+constraint\s+selfmade_household_states_pkey/i);
  assert.doesNotMatch(sql, /on\s+conflict\s*\(\s*household_id\s*\)/i);
});
