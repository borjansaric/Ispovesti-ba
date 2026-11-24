import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('live CAPTCHA is cleared once at entry and checked server-side on submit', async () => {
  const [api, captcha, edge, migration] = await Promise.all([
    read('../api.js'), read('../captcha.js'), read('../launch/community-live-api.ts'),
    read('../supabase/migrations/20261124175333_live_entry_captcha_clearance.sql')
  ]);
  assert.match(api, /initializeSecurity\(\)/);
  assert.match(api, /ensureCaptchaClearance/);
  assert.match(api, /captcha_init/);
  assert.doesNotMatch(api, /captchaToken\(\{kind:args\.kind/);
  assert.match(captcha, /community-live-api/);
  assert.match(edge, /action==='captcha_init'/);
  assert.match(edge, /'app_entry'/);
  assert.match(edge, /community_live_captcha_clearance/);
  assert.match(migration, /community_live\.captcha_clearance/);
});
