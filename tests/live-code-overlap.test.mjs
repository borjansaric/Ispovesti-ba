import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const spec=(source,pattern,path)=>{const match=source.match(pattern);assert.ok(match,path+' must declare the shared module import');return match[1];};
const count=(source,pattern)=>[...source.matchAll(pattern)].length;

test('live runtime reuses one API and chat client module instance',async()=>{
 const [app,ui,client,admin,forgot,api]=await Promise.all([
  read('app.js'),read('chat/ui.mjs'),read('chat/client.mjs'),
  read('admin/admin.mjs'),read('admin-recovery/forgot.mjs'),read('api.js')
 ]);
 const apiVersion=spec(app,/from '\.\/api\.js\?v=([^']+)'/,'app.js');
 assert.equal(spec(client,/from '\.\.\/api\.js\?v=([^']+)'/,'chat/client.mjs'),apiVersion);
 assert.equal(spec(admin,/from '\.\.\/api\.js\?v=([^']+)'/,'admin/admin.mjs'),apiVersion);
 assert.equal(spec(forgot,/import\('\.\.\/api\.js\?v=([^']+)'\)/,'admin-recovery/forgot.mjs'),apiVersion);
 const chatVersion=spec(app,/from '\.\/chat\/client\.mjs\?v=([^']+)'/,'app.js');
 assert.equal(spec(ui,/from '\.\/client\.mjs\?v=([^']+)'/,'chat/ui.mjs'),chatVersion);
 assert.equal(spec(admin,/from '\.\.\/chat\/client\.mjs\?v=([^']+)'/,'admin/admin.mjs'),chatVersion);
 assert.match(api,/let client, adminClient, sessionPromise;/);
 assert.match(api,/if \(admin\) return adminClient \|\|=/);
});

test('live CSS has no known dead duplicate selectors or competing chat z-index rules',async()=>{
 const [styles,luxury,chat]=await Promise.all([read('styles.css'),read('luxury.css'),read('chat/chat.css')]);
 assert.equal(count(styles,/\.comment-reaction-wrap>\.comment-reaction-trigger\{/g),1);
 assert.equal(count(styles,/\.site-header>\.partner-banner-placeholder\{/g),1);
 assert.doesNotMatch(luxury,/\.site-header\{background:transparent\}/);
 assert.equal(count(chat,/\.chat-settings\{/g),1);
 assert.match(chat,/\.chat-settings\{[^}]*z-index:100001/);
});

test('legacy chat admin is a script-free redirect and live admin labels live data correctly',async()=>{
 const [legacy,admin]=await Promise.all([read('chat-admin.html'),read('admin/admin.mjs')]);
 assert.match(legacy,/admin\.html\?view=chat/);
 assert.doesNotMatch(legacy,/<script\b|<link\b[^>]*stylesheet/i);
 assert.doesNotMatch(admin,/testna baza|Testni backend/i);
 assert.match(admin,/Izvor: živa baza/);
});
