import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('branch-based GitHub Pages excludes backend and development sources', async () => {
  const config = await read('../_config.yml');
  const lines = config.split('\n');
  assert.ok(!lines.includes('  - test'), 'the separate test path must remain available');
  for (const entry of ['launch','supabase','tests','scripts','docs','chat/gateway.mjs','live/chat-index.ts','live/recovery-index.ts','admin-recovery/handler.mjs','admin-recovery/sandbox','admin-recovery/reset-template.html','admin-prep/*.sql','admin-prep/telemetry-local.mjs','admin-prep/banner-local.mjs','AGENTS.md','AGENTS.html','PROJECT_RULES.md','PROJECT_RULES.html','PRODUCTION_PREP.md','PRODUCTION_PREP.html']) {
    assert.ok(lines.includes('  - ' + entry), entry);
  }
});

test('production chat client contains only the live endpoint and no trial generator', async () => {
  const client = await read('../chat/client.mjs');
  assert.doesNotMatch(client, /chat-test-api|trialCode|TEST-/);
  assert.match(client, /chat-live-api/);
  assert.match(client, /environment!=='live'/);
});

test('custom preflight validates the allowlist without competing for the Pages deployment', async () => {
  const workflow = await read('../.github/workflows/static.yml');
  assert.match(workflow, /Verify production backend before publishing/);
  assert.match(workflow, /Build reviewed static allowlist/);
  assert.doesNotMatch(workflow, /actions\/deploy-pages|upload-pages-artifact/);
});

test('robots excludes the separate test site from indexing', async () => {
  const robots = await read('../robots.txt');
  assert.match(robots, /Disallow: \/Ispovesti-ba\/test\//);
});
