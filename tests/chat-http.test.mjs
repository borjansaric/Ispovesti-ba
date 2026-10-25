import {test,before,after} from 'node:test';import assert from 'node:assert/strict';import {randomBytes,randomUUID} from 'node:crypto';import {readFile} from 'node:fs/promises';import {createChatPreview} from '../scripts/chat-preview.mjs';
let stage,base,ownerCookie,aliceCookie,bobCookie,profile;const key=randomBytes(32).toString('hex');
async function post(path,body={},cookie){const r=await fetch(base+path,{method:'POST',headers:{Origin:base,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')};}
const chat=(cookie,action,args={})=>post('/api/chat',{action,args},cookie);
before(async()=>{stage=await createChatPreview({ownerKey:key});await new Promise(r=>stage.server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+stage.server.address().port;});after(()=>stage.close());
test('new UI preserves original CSS and hides the inactive banner; secrets/server files are not served',async()=>{
 const html=await(await fetch(base+'/')).text();assert.match(html,/id="open-chat"/);assert.match(html,/id="banner-slot"[^>]*hidden/);
 for(const file of ['original.css','styles.css'])assert.equal(await(await fetch(base+'/'+file)).text(),await readFile(new URL('../'+file,import.meta.url),'utf8'));
 for(const path of ['/chat/prepare-test.sql','/chat/gateway.mjs','/.local-stage/owner-key','/scripts/chat-preview.mjs'])assert.equal((await fetch(base+path)).status,404);
 assert.doesNotMatch(await(await fetch(base+'/config.js')).text(),new RegExp(key));
});
test('anonymous visitors get no trial privileges and owner login requires the private preview capability',async()=>{
 aliceCookie=(await post('/api/chat-session')).cookie;bobCookie=(await post('/api/chat-session')).cookie;assert.notEqual(aliceCookie,bobCookie);
 profile=(await chat(aliceCookie,'profile')).data;await chat(bobCookie,'profile');
 assert.equal((await chat(aliceCookie,'history')).status,403);assert.equal((await chat(aliceCookie,'admin_test_mode',{enabled:true})).status,403);
 assert.equal((await post('/api/chat-owner-login',{key:'wrong'})).status,403);
 const signed=await post('/api/chat-owner-login',{key});assert.equal(signed.status,200);ownerCookie=signed.cookie;assert.match(ownerCookie,/ispovesti_chat_preview_admin=/);assert.equal((await chat(aliceCookie,'profile')).data.id,profile.id);
 assert.equal((await chat(ownerCookie,'admin_status')).status,200);await chat(ownerCookie,'admin_test_mode',{enabled:true});
});
test('two browser sessions see one common live room; trial rights are granted on the server',async()=>{
 const bp=(await chat(bobCookie,'profile')).data;
 for(const target of [profile.id,bp.id])assert.equal((await chat(ownerCookie,'admin_grant',{target,plan:'24h',request_id:randomUUID()})).status,200);
 const sent=await chat(aliceCookie,'send',{body:'Poruka kroz stvarni lokalni server 🙂',request_id:randomUUID()});assert.equal(sent.status,200);
 const view=await chat(bobCookie,'history');assert.equal(view.status,200);assert.equal(view.data.items[0].id,sent.data.id);assert.equal(view.data.items[0].sender,profile.id);assert.equal(view.data.items[0].user_id,undefined);
});
test('free base site submits without any advertising tokens; legacy local regression API remains intact',async()=>{
 const cookie=(await post('/api/local-session')).cookie;const r=await post('/api/community',{action:'submit',args:{kind:'confession',body:'Osnovni sajt je besplatan i nema reklamnih prava.',request_id:randomUUID()}},cookie);assert.equal(r.status,200);assert.equal(r.data.success,true);
});
