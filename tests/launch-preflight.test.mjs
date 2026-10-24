import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {checkLiveReady} from '../scripts/check-live-ready.mjs';
const config={mode:'live',supabaseUrl:'https://isolated.invalid',publishableKey:'sb_publishable_example'};
function mock({environment='live',enabled=true,adminStatus=401}={}){return async(url,options)=>{assert.ok(url.includes('/community-live-api?'));const action=JSON.parse(options.body).action;return action==='health'?Response.json({environment,version:'launch1'}):action==='captcha_config'?Response.json({enabled}):action==='feed'?Response.json({items:[]}):Response.json({error:'denied'},{status:adminStatus});};}
test('deployment guard accepts ready live API and refuses test API or missing admin protection',async()=>{
 assert.equal((await checkLiveReady(config,{fetcher:mock(),initial:true})).ready,true);
 await assert.rejects(checkLiveReady(config,{fetcher:mock({environment:'test'})}),/nije spreman/);
 await assert.rejects(checkLiveReady(config,{fetcher:mock({adminStatus:200})}),/administratorske zaštite/);
 await assert.rejects(checkLiveReady(config,{fetcher:mock({enabled:false}),initial:true}),/zaštite/);
 assert.equal((await checkLiveReady(config,{fetcher:mock({enabled:false})})).ready,true);
});
test('root artifacts target live API and isolated sessions; original test source and design remain intact',async()=>{
 const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
 const api=await read('api.js'),captcha=await read('captcha.js'),index=await read('index.html'),admin=await read('admin.html');
 assert.ok(api.includes('community-live-api'));assert.ok(captcha.includes('community-live-api'));assert.ok(!api.includes('community-test-api'));
 assert.ok(api.includes('ispovesti-live-user-session'));assert.ok(api.includes('ispovesti-live-admin-session'));
 assert.ok((await read('dist/api.js')).includes('community-test-api'));assert.ok(index.includes('class="preview" hidden'));assert.ok(index.includes('index,follow'));
 assert.ok(admin.includes('postavke odnose na glavni sajt'));assert.ok(admin.includes('noindex,nofollow'));
 assert.equal(await read('original.css'),await read('dist/original.css'));assert.equal(await read('styles.css'),await read('dist/styles.css'));
 for(const file of ['index.html','admin.html']){for(const match of(await read(file)).matchAll(/(?:src|href)="([^"?#]+)(?:\?[^"#]*)?"/g)){const target=match[1];if(!target.startsWith('.')&&!target.startsWith('http'))await read(target);}}
});
