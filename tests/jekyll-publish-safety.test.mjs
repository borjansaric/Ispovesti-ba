import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('branch-based GitHub Pages excludes backend and development sources', async () => {
  const config = await read('../_config.yml');
  const lines = config.split('\n');
  for (const entry of ['launch','supabase','tests','scripts','chat/gateway.mjs','live/chat-index.ts','live/recovery-index.ts','admin-recovery/handler.mjs','PRODUCTION_PREP.md']) {
    assert.ok(lines.includes('  - ' + entry), entry);
  }
});

test('production chat client contains only the live endpoint and no trial generator', async () => {
  const client = await read('../chat/client.mjs');
  assert.doesNotMatch(client, /chat-test-api|trialCode|TEST-/);
  assert.match(client, /chat-live-api/);
  assert.match(client, /environment!=='live'/);
});

test('robots excludes the separate test site from indexing', async () => {
  const robots = await read('../robots.txt');
  assert.match(robots, /Disallow: \/Ispovesti-ba\/test\//);
});
