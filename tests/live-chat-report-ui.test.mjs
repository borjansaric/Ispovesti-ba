import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('live chat report contract matches the locked preview UI', async () => {
  const [ui, gateway, migration] = await Promise.all([
    read('../chat/ui.mjs'),
    read('../chat/gateway.mjs'),
    read('../supabase/migrations/20261124173000_chat_live_report_parity.sql')
  ]);

  assert.match(ui, /sendReport\('hate_speech'\)/);
  assert.match(ui, /sendReport\('spam'\)/);
  assert.match(ui, /sendReport\('other',detail\.value\)/);
  assert.match(ui, /detail\.maxLength=500/);
  assert.match(gateway, /report:\['id','reason','details'\]/);
  assert.match(migration, /reason in \('hate_speech','spam','other'\)/);
  assert.match(migration, /char_length\(details\)<=500/);
});
