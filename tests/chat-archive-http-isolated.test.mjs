import {test} from 'node:test';import assert from 'node:assert/strict';import {randomBytes,randomUUID} from 'node:crypto';import {createChatPreview} from '../scripts/chat-preview.mjs';
test('isolated chat archive is available only to the verified local administrator',async()=>{
 const key=randomBytes(32).toString('hex'),stage=await createChatPreview({ownerKey:key});await new Promise(r=>stage.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+stage.server.address().port;
 async function post(path,body,cookie){const r=await fetch(base+path,{method:'POST',headers:{Origin:base,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')}}
 try{
  const user=(await post('/api/chat-session',{})).cookie;const profile=(await post('/api/chat',{action:'profile',args:{}},user)).data;
  const owner=(await post('/api/chat-owner-login',{key})).cookie;
  assert.equal((await post('/api/admin-archive',{action:'list',p_uid:'admin',_session_id:'forged'},user)).status,403);
  assert.equal((await post('/api/chat',{action:'admin_test_mode',args:{enabled:true}},owner)).status,200);
  assert.equal((await post('/api/chat',{action:'admin_grant',args:{target:profile.id,plan:'24h',request_id:randomUUID()}},owner)).status,200);
  const sent=await post('/api/chat',{action:'send',args:{body:'Poruka za arhivu',request_id:randomUUID()}},user);assert.equal(sent.status,200);
  const archive=await post('/api/admin-archive',{action:'list',filters:{text:'arhivu'}},owner);assert.equal(archive.status,200);assert.equal(archive.data.items[0].body,'Poruka za arhivu');assert.ok(archive.data.items[0].avatar);
  const context=await post('/api/admin-archive',{action:'context',id:sent.data.id},owner);assert.equal(context.status,200);assert.equal(context.data.items[0].body,'Poruka za arhivu');
 }finally{await stage.close()}
});
