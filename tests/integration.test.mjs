import { test,before,after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import { PGlite } from '@electric-sql/pglite';
const db=new PGlite();
const alice='00000000-0000-0000-0000-000000000011',bob='00000000-0000-0000-0000-000000000012';
let handle,confession;
before(async()=>{
 await db.exec('create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,is_anonymous boolean default false,email_confirmed_at timestamptz default now());create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);');
 await db.query('insert into auth.users values($1),($2)',[alice,bob]);
 await db.exec(await readFile(new URL('../supabase/migrations/20261023212548_community_v2.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/admin-captcha.sql',import.meta.url),'utf8'));
 const code=stripTypeScriptTypes(await readFile(new URL('../supabase/functions/community-api/index.ts',import.meta.url),'utf8'));
 const sandbox={Request,Response,Uint8Array,TextDecoder,TextEncoder,crypto,btoa,JSON,Set,AbortSignal,SyntaxError,atob,
 Deno:{env:{get:key=>({SUPABASE_URL:'https://local.invalid',SUPABASE_SERVICE_ROLE_KEY:'local-test-key',ALLOWED_ORIGINS:'https://preview.invalid'})[key]},serve:fn=>handle=fn},
 fetch:async(url,options)=>{
  if(url.endsWith('/auth/v1/user')){
   const token=options.headers.Authorization;
   const id=token==='Bearer alice-test-token'?alice:token==='Bearer bob-test-token'?bob:null;
   return Response.json(id?{id,is_anonymous:true}:{error:'invalid'},{status:id?200:401});
  }
  assert.ok(['https://local.invalid/rest/v1/rpc/community_test_dispatch','https://local.invalid/rest/v1/rpc/community_test_security'].includes(url));const rpcName=url.endsWith('community_test_security')?'community_test_security':'community_test_dispatch';
  const args=JSON.parse(options.body);
  try{
   await db.exec('set role service_role');
   const r=await db.query('select public.'+rpcName+'($1::uuid,$2,$3::jsonb) as response',[args.p_uid,args.p_action,JSON.stringify(args.p_args)]);
   return Response.json(r.rows[0].response);
  }catch(e){return Response.json({code:e.code,message:e.message},{status:400});}
  finally{await db.exec('reset role');}
 }};
 vm.runInNewContext(code,sandbox);
});
after(()=>db.close());
async function request(user,action,args={}){
 const response=await handle(new Request('https://gateway.invalid',{method:'POST',headers:{Origin:'https://preview.invalid',...(user?{Authorization:'Bearer '+user+'-test-token'}:{})},body:JSON.stringify({action,args})}));
 return {status:response.status,body:await response.json()};
}
test('integrated gateway + PostgreSQL: submission stays queued and public feed does not leak it',async()=>{
 const r=await request('alice','submit',{kind:'confession',body:'Izolovani integracioni test bez produkcionog upisa.'});
 assert.equal(r.status,200);assert.equal(r.body.success,true);confession=r.body.id;
 assert.deepEqual((await request(null,'feed')).body.items,[]);
 await db.exec("update community_test.publisher set last_published_at=clock_timestamp()-interval '2 hours';select community_test.publish_one();");
 const feed=await request(null,'feed');assert.equal(feed.body.items[0].id,confession);assert.equal('author_id' in feed.body.items[0],false);
});
test('integrated gateway + PostgreSQL: forged identity cannot read another user private list',async()=>{
 assert.equal((await request('alice','favorite',{id:confession,enabled:true})).status,200);
 const mine=await request('alice','list',{list:'favorites'});assert.equal(mine.body.items.length,1);
 const stolen=await request('bob','list',{list:'favorites',user_id:alice,p_uid:alice,visitor_key:alice});assert.deepEqual(stolen.body.items,[]);
 assert.equal((await request(null,'list',{list:'favorites',user_id:alice})).status,401);
});
test('integrated gateway + PostgreSQL: no early vote totals; locked vote cannot change through API',async()=>{
 const early=await request('alice','vote',{id:confession,value:1,voter_key:'forged'});assert.deepEqual(early.body,{my_vote:1});
 assert.deepEqual((await request('bob','vote_status',{id:confession})).body,{my_vote:null});
 await db.query("update community_test.votes set first_voted_at=clock_timestamp()-interval '10 minutes' where user_id=$1",[alice]);
 const locked=await request('alice','vote',{id:confession,value:-1});assert.deepEqual(locked.body,{my_vote:1,likes:1,dislikes:0});
 assert.deepEqual((await request('bob','vote_status',{id:confession})).body,{my_vote:null});
});
test('integrated gateway + PostgreSQL: validation errors reach UI without leaking database details',async()=>{
 const r=await request('bob','submit',{kind:'comment',confession_id:confession,body:'Pogledaj primjer.ba!'});assert.equal(r.status,400);assert.match(r.body.error,/Linkovi/);
 const wrong=await request('bob','vote',{id:'not-an-id',value:1});assert.equal(wrong.status,500);assert.equal(wrong.body.error,'Radnja nije uspjela. Pokušaj ponovo.');
});
test('gateway rejects null and primitive JSON bodies as invalid requests',async()=>{
 for(const body of['null','[]','17','"text"']){
  const r=await handle(new Request('https://gateway.invalid',{method:'POST',headers:{Origin:'https://preview.invalid'},body}));assert.equal(r.status,400);
 }
});
