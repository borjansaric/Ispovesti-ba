import {test} from 'node:test';import assert from 'node:assert/strict';import {randomBytes} from 'node:crypto';import {createChatPreview} from '../scripts/chat-preview.mjs';
test('advertiser bookings require verified owner and prevent duplicate slots',async()=>{
 const key=randomBytes(32).toString('hex'),stage=await createChatPreview({ownerKey:key});await new Promise(r=>stage.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+stage.server.address().port;
 async function post(path,body,cookie){const r=await fetch(base+path,{method:'POST',headers:{Origin:base,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')}}
 try{const user=(await post('/api/chat-session',{})).cookie,owner=(await post('/api/chat-owner-login',{key})).cookie;const create={action:'create',name:'Probni oglašivač',month:'2026-11',slot:0,price_fening:10000};
 assert.equal((await post('/api/admin-advertising',create,user)).status,403);assert.equal((await post('/api/admin-advertising',create,owner)).status,200);assert.equal((await post('/api/admin-advertising',create,owner)).status,409);
 const rows=await post('/api/admin-advertising',{action:'list',month:'2026-11'},owner);assert.equal(rows.status,200);assert.equal(rows.data.items.length,1);assert.equal(rows.data.items[0].price_fening,10000);assert.equal(rows.data.items[0].payment_status,'unpaid');
 assert.equal((await post('/api/admin-advertising',{action:'payment',id:rows.data.items[0].id,status:'paid'},owner)).status,200);assert.equal((await post('/api/admin-advertising',{action:'list',month:'2026-11'},owner)).data.items[0].payment_status,'paid');
 }finally{await stage.close()}
});
