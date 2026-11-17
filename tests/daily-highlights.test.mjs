import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql=readFileSync(new URL('../supabase/migrations/20261117153719_daily_highlights_test.sql',import.meta.url),'utf8');
const api=readFileSync(new URL('../test/api.js',import.meta.url),'utf8');
const app=readFileSync(new URL('../test/app.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../test/index.html',import.meta.url),'utf8');

test('daily highlights SQL is isolated to community_test and calculates live total likes per local day',()=>{
 assert.match(sql,/community_test\.content/);
 assert.match(sql,/community_test\.votes/);
 assert.match(sql,/v\.value=1/);
 assert.match(sql,/Europe\/Sarajevo/);
 assert.match(sql,/row_number\(\) over\s*\(\s*partition by local_day/i);
 assert.match(sql,/limit 7/i);
 assert.doesNotMatch(sql,/community_live\./);
});

test('test client exposes daily_highlights as a public read action through the test API',()=>{
 assert.match(api,/daily_highlights/);
 assert.match(html,/id="daily-confessions"/);
 assert.match(html,/id="daily-comments"/);
 assert.match(app,/request\('daily_highlights'/);
 assert.match(app,/currentView\.startsWith\('daily_'\)/);
});
