import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('live chat report UI only sends reasons accepted by live SQL', async () => {
  const [ui, sql] = await Promise.all([read('../chat/ui.mjs'), read('../live/chat-core.sql')]);
  assert.doesNotMatch(ui, /prompt\(/);
  for (const reason of ['abuse', 'threat', 'spam', 'other']) {
    assert.ok(ui.includes("'" + reason + "'"), 'Missing live report reason: ' + reason);
    assert.ok(sql.includes("'" + reason + "'"), 'Live SQL does not accept reason: ' + reason);
  }
  assert.match(sql, /reason text not null check\(reason in \('abuse','threat','spam','other'\)\)/i);
});
