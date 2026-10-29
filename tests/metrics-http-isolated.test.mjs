import {test} from 'node:test';import assert from 'node:assert/strict';import {randomBytes,randomUUID} from 'node:crypto';import {createChatPreview} from '../scripts/chat-preview.mjs';
test('isolated metrics collect test events and only the owner may read statistics',async()=>{
 const key=randomBytes(32).toString('hex'),stage=await createChatPreview({ownerKey:key});await new Promise(r=>stage.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+stage.server.address().port;
 async function post(path,body,cookie){const r=await fetch(base+path,{method:'POST',headers:{Origin:base,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')}}
 try{const visitor=randomUUID(),user=(await post('/api/chat-session',{})).cookie,owner=(await post('/api/chat-owner-login',{key})).cookie;
 for(const type of ['visit','view','heartbeat'])assert.equal((await post('/api/local-metrics',{section:'site',type,visitor})).status,200);
 assert.equal((await post('/api/local-metrics',{section:'chat',type:'visit',visitor})).status,200);
 assert.equal((await post('/api/admin-metrics',{},user)).status,403);const r=await post('/api/admin-metrics',{},owner);assert.equal(r.status,200);assert.equal(r.data.site.visits,1);assert.equal(r.data.site.views,1);assert.equal(r.data.site.estimatedUnique.day,1);assert.equal(r.data.site.activeEstimate,1);assert.equal(r.data.chat.visits,1);assert.equal(r.data.temporary,true);
 assert.equal((await post('/api/local-metrics',{section:'site',type:'message',visitor})).status,400);
 }finally{await stage.close()}
});
