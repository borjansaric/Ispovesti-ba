import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('live reporting and reaction foreign keys have covering indexes', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20261124220000_live_reporting_fk_indexes.sql', import.meta.url), 'utf8');
  assert.match(sql, /chat_live_reports_user_id_idx[\s\S]*on chat_live\.reports\(user_id\)/);
  assert.match(sql, /community_live_reactions_user_id_idx[\s\S]*on community_live\.reactions\(user_id\)/);
});
