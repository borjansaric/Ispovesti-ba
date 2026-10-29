import {test} from 'node:test';import assert from 'node:assert/strict';import {randomBytes} from 'node:crypto';import {createChatPreview} from '../scripts/chat-preview.mjs';
test('isolated community moderation is owner-only and removes and restores content',async()=>{
 const key=randomBytes(32).toString('hex'),stage=await createChatPreview({ownerKey:key});await new Promise(r=>stage.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+stage.server.address().port;
 async function post(path,body,cookie){const r=await fetch(base+path,{method:'POST',headers:{Origin:base,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')}}
 try{const user=(await post('/api/chat-session',{})).cookie,owner=(await post('/api/chat-owner-login',{key})).cookie;const list={action:'admin_list',args:{view:'published',offset:0}};
 assert.equal((await post('/api/admin-community',{...list,p_uid:'admin',_aal:'aal2'},user)).status,403);const r=await post('/api/admin-community',list,owner);assert.equal(r.status,200);const item=r.data.items[0];assert.ok(item);
 assert.equal((await post('/api/admin-community',{action:'admin_remove',args:{id:item.id}},owner)).status,200);const archive=await post('/api/admin-community',{action:'admin_list',args:{view:'archive'}},owner);assert.ok(archive.data.items.some(x=>x.id===item.id));
 assert.equal((await post('/api/admin-community',{action:'admin_restore',args:{id:item.id}},owner)).status,200);assert.ok((await post('/api/admin-community',list,owner)).data.items.some(x=>x.id===item.id));
 assert.equal((await post('/api/admin-community',{action:'admin_publisher',args:{paused:true}},owner)).status,200);assert.equal((await post('/api/admin-community',{action:'admin_publisher',args:{paused:false}},owner)).status,200);
 }finally{await stage.close()}
});
