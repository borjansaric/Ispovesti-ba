import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('live community reports accept the preview reasons and optional details', async () => {
  const [app, admin, migration] = await Promise.all([
    read('../app.js'),
    read('../admin/admin.mjs'),
    read('../supabase/migrations/20261124175342_live_community_report_parity.sql')
  ]);
  assert.match(app, /sendReport\('hate_speech'\)/);
  assert.match(app, /sendReport\('other',detail\.value\)/);
  assert.match(app, /detail\.maxLength=500/);
  assert.match(migration, /'hate_speech'/);
  assert.match(migration, /reason,details/);
  assert.match(migration, /char_length\(details\) <= 500/);
  assert.match(migration, /r\.user_id::text reporter_id,r\.details/);
  assert.match(admin, /if\(item\.details\)c\.append/);
});
