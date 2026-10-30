import {test} from 'node:test';import assert from 'node:assert/strict';import {randomBytes,randomUUID} from 'node:crypto';import {createChatPreview} from '../scripts/chat-preview.mjs';
test('owner joins with a separate anonymous chat identity and no admin ability on that identity',async()=>{
 const key=randomBytes(32).toString('hex'),stage=await createChatPreview({ownerKey:key});await new Promise(r=>stage.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+stage.server.address().port;
 async function post(path,body,cookie){const r=await fetch(base+path,{method:'POST',headers:{Origin:base,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')}}
 try{const user=(await post('/api/chat-session',{})).cookie,owner=(await post('/api/chat-owner-login',{key})).cookie;assert.equal((await post('/api/owner-anonymous-chat',{},user)).status,403);
 const entry=await post('/api/owner-anonymous-chat',{},owner);assert.equal(entry.status,200);const anon=entry.cookie;const p=await post('/api/chat',{action:'profile',args:{}},anon);assert.equal(p.status,200);assert.match(p.data.nickname,/^Anonim-/);assert.equal(p.data.active,true);assert.equal(p.data.admin,undefined);
 const sent=await post('/api/chat',{action:'send',args:{body:'Probna anonimna poruka',request_id:randomUUID()}},anon);assert.equal(sent.status,200);assert.equal((await post('/api/chat',{action:'admin_status',args:{}},anon)).status,403);assert.equal((await post('/api/chat',{action:'admin_status',args:{}},owner)).status,200);
 }finally{await stage.close()}
});
