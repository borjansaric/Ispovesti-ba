import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('production CAPTCHA public settings use the live community endpoint', async () => {
  const source = await readFile(new URL('../captcha.js', import.meta.url), 'utf8');
  assert.match(source, /community-live-api\?forceFunctionRegion=eu-central-1/);
  assert.doesNotMatch(source, /community-test-api/);
});
