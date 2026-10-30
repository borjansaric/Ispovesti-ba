import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {createChatPreview} from '../scripts/chat-preview.mjs';

test('archive reads every page in numeric order, preserves snapshots and keeps private access',async()=>{
 const key=randomBytes(32).toString('hex'),stage=await createChatPreview({ownerKey:key});
 await new Promise(r=>stage.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+stage.server.address().port;
 const post=async(path,body,cookie)=>{const r=await fetch(base+path,{method:'POST',headers:{Origin:base,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')}};
 try{
  const user=(await post('/api/chat-session',{})).cookie,profile=(await post('/api/chat',{action:'profile',args:{}},user)).data;
  const owner=(await post('/api/chat-owner-login',{key})).cookie;
  const p=(await stage.db.query('select user_id,generated_nickname,avatar from chat_test.profiles where public_id=$1',[profile.id])).rows[0];
  await stage.db.query("insert into chat_test.messages(user_id,body,request_id) select $1,'Arhivska poruka '||n,gen_random_uuid() from generate_series(1,225) n",[p.user_id]);
  await stage.db.query("update chat_test.profiles set generated_nickname='Promijenjen',avatar='star' where user_id=$1",[p.user_id]);
  const read=async(filters={})=>{const r=await post('/api/admin-archive',{action:'list',filters},owner);assert.equal(r.status,200);return r.data};
  const first=await read();assert.equal(first.items.length,100);assert.equal(first.has_more,true);
  assert.equal(first.items[0].id,'225');assert.equal(first.items.at(-1).id,'126');assert.equal(first.next_before,'126');
  assert.equal(first.items[0].nickname,p.generated_nickname);assert.equal(first.items[0].avatar,p.avatar);
  // A new message after the first page must not duplicate or hide older rows.
  await stage.db.query("insert into chat_test.messages(user_id,body,request_id) values($1,'Nova poruka',gen_random_uuid())",[p.user_id]);
  const second=await read({before:first.next_before}),third=await read({before:second.next_before});
  assert.equal(second.items.length,100);assert.equal(third.items.length,25);assert.equal(third.has_more,false);assert.equal(third.next_before,null);
  const ids=[...first.items,...second.items,...third.items].map(m=>Number(m.id));assert.deepEqual(ids,Array.from({length:225},(_,i)=>225-i));
  const matching=await read({text:'ARHIVSKA',author:profile.id});assert.equal(matching.items.length,100);
  const exact=await read({before:'101'});assert.equal(exact.items.length,100);assert.equal(exact.has_more,false);assert.equal(exact.next_before,null);
  const removed=await post('/api/chat',{action:'admin_remove',args:{id:'100'}},owner);assert.equal(removed.status,200);
  const archive=await read({status:'removed'});assert.equal(archive.items[0].id,'100');assert.equal(archive.items[0].body,'Arhivska poruka 100');assert.equal(archive.items[0].nickname,p.generated_nickname);assert.ok(archive.items[0].decisions.some(d=>d.action==='admin_remove'));
  assert.equal((await post('/api/chat',{action:'admin_restore',args:{id:'100'}},owner)).status,200);
  assert.equal((await read({text:'does not exist'})).has_more,false);
  const context=await post('/api/admin-archive',{action:'context',id:'100'},owner);assert.equal(context.status,200);assert.equal(context.data.items.length,11);assert.ok(context.data.items.some(m=>Number(m.id)===100));
  for(const filters of [{status:'forged'},{before:'invalid'},{from:'2026-10-31',to:'2026-10-01'}])assert.equal((await post('/api/admin-archive',{action:'list',filters},owner)).status,400);
  assert.equal((await post('/api/admin-archive',{action:'list',filters:{before:'126'},p_uid:p.user_id,_aal:'aal2'},user)).status,403);
  assert.equal((await post('/api/chat-owner-logout',{},owner)).status,200);
  for(const action of ['list','context'])assert.equal((await post('/api/admin-archive',{action,id:'100'},owner)).status,403);
 }finally{await stage.close()}
});
