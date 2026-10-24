import { test,before,after } from 'node:test';
import assert from 'node:assert/strict';
import { createLocalPreview } from '../scripts/local-preview.mjs';
let stage,base,aliceCookie,bobCookie,confession,comment;
before(async()=>{stage=await createLocalPreview();await new Promise(resolve=>stage.server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+stage.server.address().port;});
after(()=>stage.close());
async function session(){const r=await fetch(base+'/api/local-session',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:'{}'});assert.equal(r.status,200);return r.headers.get('set-cookie');}
async function api(cookie,action,args={}){const r=await fetch(base+'/api/community',{method:'POST',headers:{'Content-Type':'application/json',Origin:base,...(cookie?{Cookie:cookie}:{})},body:JSON.stringify({action,args})});return{status:r.status,body:await r.json()};}
test('HTTP stage serves original stylesheet and local-only config; server source and SQL stay private',async()=>{
 const index=await(await fetch(base+'/')).text();assert.match(index,/original.css/);assert.match(index,/<h1>Ispovesti.ba<\/h1>/);assert.doesNotMatch(index,/class="brand-icon"/);
 const config=await(await fetch(base+'/config.js')).text();assert.match(config,/mode:'local'/);assert.match(config,/supabaseUrl:''/);assert.match(config,/publishableKey:''/);
 const css=await(await fetch(base+'/original.css')).text();assert.match(css,/--bg:#111/);
 assert.equal((await fetch(base+'/supabase/migrations/20261023212548_community_v2.sql')).status,404);
 assert.equal((await fetch(base+'/scripts/local-preview.mjs')).status,404);
});
test('HTTP stage issues unguessable HttpOnly sessions; clients cannot supply their own identity',async()=>{
 aliceCookie=await session();bobCookie=await session();assert.notEqual(aliceCookie,bobCookie);assert.match(aliceCookie,/HttpOnly/);assert.match(aliceCookie,/SameSite=Strict/);
 const feed=await api(null,'feed');confession=feed.body.items[0].id;
 assert.equal((await api(null,'favorite',{id:confession,enabled:true})).status,401);
 assert.equal((await api('ispovesti_local_session=forged','list',{list:'favorites'})).status,401);
 assert.equal((await api(aliceCookie,'favorite',{id:confession,enabled:true})).status,200);
 assert.equal((await api(aliceCookie,'list',{list:'favorites'})).body.items.length,1);
 assert.deepEqual((await api(bobCookie,'list',{list:'favorites',visitor_key:'alice',user_id:'alice'})).body.items,[]);
});
test('HTTP stage: published comments, collapsed reply API and comment-count ownership use SQL',async()=>{
 const r=await api(aliceCookie,'submit',{kind:'comment',confession_id:confession,body:'Stvarni lokalni HTTP komentar. 🙂\nDrugi red.'});assert.equal(r.status,200);comment=r.body.id;
 assert.equal((await api(aliceCookie,'context',{id:confession})).body.comment_count,3);
 assert.equal((await api(bobCookie,'context',{id:confession})).body.comment_count,null);
 const rows=(await api(null,'comments',{confession_id:confession})).body.items;assert.equal(rows.at(-1).body,'Stvarni lokalni HTTP komentar. 🙂\nDrugi red.');
 const reply=await api(bobCookie,'submit',{kind:'reply',confession_id:confession,parent_id:comment,body:'Odgovor kroz HTTP.'});assert.equal(reply.status,200);
 assert.equal((await api(null,'comments',{confession_id:confession,parent_id:comment})).body.items[0].body,'Odgovor kroz HTTP.');
});
test('HTTP stage: queue stays private and ten-minute vote lock is enforced by real local database',async()=>{
 const sent=await api(aliceCookie,'submit',{kind:'confession',body:'Nova ispovijest čeka red i ne pojavljuje se odmah.'});assert.equal(sent.status,200);
 assert.ok(!(await api(null,'feed')).body.items.some(c=>c.id===sent.body.id));
 assert.deepEqual((await api(aliceCookie,'vote',{id:comment,value:1})).body,{my_vote:1});
 assert.deepEqual((await api(bobCookie,'vote_status',{id:comment})).body,{my_vote:null});
 await stage.db.query("update community_test.votes set first_voted_at=clock_timestamp()-interval '11 minutes' where content_id=$1",[comment]);
 assert.deepEqual((await api(aliceCookie,'vote',{id:comment,value:-1})).body,{my_vote:1,likes:1,dislikes:0});
});
test('HTTP stage rejects cross-origin writes, oversized bodies, custom report reasons and anonymous admins',async()=>{
 const cross=await fetch(base+'/api/local-session',{method:'POST',headers:{Origin:'https://untrusted.invalid','Content-Type':'application/json'},body:'{}'});assert.equal(cross.status,403);
 const large=await fetch(base+'/api/community',{method:'POST',headers:{Origin:base,'Content-Type':'application/json',Cookie:aliceCookie},body:'x'.repeat(33000)});assert.equal(large.status,413);
 const invalid=await api(aliceCookie,'report',{id:confession,reason:'custom explanation'});assert.equal(invalid.status,400);assert.equal(invalid.body.error,'Neispravan razlog prijave.');
 assert.equal((await api(aliceCookie,'admin_list',{view:'reports'})).status,403);
});
