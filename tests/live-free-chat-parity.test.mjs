import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('live chat preparation enables preview-compatible free access and recovery', async () => {
  const migration = await read('../supabase/migrations/20261124175339_live_free_chat_parity.sql');
  const [ui, client, gateway] = await Promise.all([
    read('../chat/ui.mjs'), read('../chat/client.mjs'), read('../chat/gateway.mjs')
  ]);
  assert.match(migration, /free_chat_enabled=true/);
  assert.match(migration, /'free_access'/);
  assert.match(migration, /interval '100 years'/);
  assert.match(migration, /recovery_set/);
  assert.match(ui, /chatRequest\('profile'/);
  assert.match(client, /chat-live-api/);
  assert.match(gateway, /report:\['id','reason','details'\]/);
});
