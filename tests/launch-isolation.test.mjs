import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite(),owner='00000000-0000-4000-8000-000000000101',visitor='00000000-0000-4000-8000-000000000102',sid='00000000-0000-4000-8000-000000000103';
const call=async(env,uid,action,args={})=>(await db.query(`select public.community_${env}_dispatch($1::uuid,$2,$3::jsonb) r`,[uid,action,JSON.stringify(args)])).rows[0].r;
const email=async(env,action,args)=>(await db.query(`select public.community_${env}_admin_email($1::uuid,$2,$3::jsonb) r`,[owner,action,JSON.stringify(args)])).rows[0].r;
let migration,testStory,liveStory,testBefore,handler,rpcNames=[];
before(async()=>{
 await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,is_anonymous boolean,email_confirmed_at timestamptz,encrypted_password text);create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);");
 for(const f of ['migrations/20261023212548_community_v2.sql','admin-captcha.sql','admin-email.sql','comments-response.sql','submission-latency.sql'])await db.exec(await readFile(new URL('../supabase/'+f,import.meta.url),'utf8'));
 await db.query("insert into auth.users values($1,'owner@example.invalid',false,now(),'unchanged-password-hash'),($2,null,true,null,null)",[owner,visitor]);await db.query('insert into auth.sessions values($1,$2,null)',[sid,owner]);
 await db.query('insert into community_test.admins values($1)',[owner]);
 await db.exec("update community_test.security_settings set owner_email='owner@example.invalid',admin_auth_method='email',captcha_enabled=true,captcha_sitekey='configured-widget',captcha_secret_ciphertext='encrypted-fixture',captcha_hostname='borjansaric.github.io';");
 testStory=(await call('test',visitor,'submit',{kind:'confession',body:'Probna ispovijest mora ostati samo u testnom okruženju.'})).id;
 await db.query("update community_test.content set state='published',published_at=clock_timestamp() where id=$1",[testStory]);
 await email('test','begin',{_session_id:sid,challenge_hash:'c'.repeat(64)});await email('test','attempt',{_session_id:sid,challenge_hash:'c'.repeat(64)});await email('test','finish',{_session_id:sid,challenge_hash:'c'.repeat(64),verified_uid:owner,verified_email:'owner@example.invalid'});
 testBefore=(await db.query('select jsonb_agg(to_jsonb(c) order by id) r from community_test.content c')).rows[0].r;
 migration=await readFile(new URL('../launch/prepare-live.sql',import.meta.url),'utf8');
});
after(()=>db.close());
test('production preparation requires approval and does not partly create tables when denied',async()=>{
 await assert.rejects(db.exec(migration),/odobrenje/);await db.exec('rollback;');assert.equal((await db.query("select to_regnamespace('community_live') n")).rows[0].n,null);
});
test('production begins empty, keeps the same owner and encrypted settings, and leaves all test content unchanged',async()=>{
 await db.exec("select set_config('ispovesti.launch_approval','production-launch-v1',false)");await db.exec(migration);
 assert.equal((await call('live',null,'feed')).items.length,0);
 assert.deepEqual((await db.query('select jsonb_agg(to_jsonb(c) order by id) r from community_test.content c')).rows[0].r,testBefore);
 const row=(await db.query('select user_id from community_live.admins')).rows[0];assert.equal(row.user_id,owner);
 const settings=(await db.query('select * from community_live.security_settings')).rows[0];assert.equal(settings.captcha_enabled,true);assert.equal(settings.captcha_secret_ciphertext,'encrypted-fixture');assert.equal(settings.admin_auth_method,'email');assert.equal(settings.activation_hash,null);
 assert.equal((await db.query('select paused from community_live.publisher')).rows[0].paused,true);
 assert.equal((await db.query('select count(*)::int n from community_live.admin_email_sessions')).rows[0].n,0);
 assert.equal((await db.query('select encrypted_password from auth.users where id=$1',[owner])).rows[0].encrypted_password,'unchanged-password-hash');
});
test('test email proof cannot authorize production administration; a fresh production proof is required',async()=>{
 const args={_session_id:sid,_aal:'aal1',view:'published'};
 await assert.rejects(call('live',owner,'admin_list',args),/Potvrdi pristup/);
 await assert.rejects(call('live',visitor,'admin_list',args),/Zabranjena/);
 await email('live','begin',{_session_id:sid,challenge_hash:'d'.repeat(64)});await email('live','attempt',{_session_id:sid,challenge_hash:'d'.repeat(64)});await email('live','finish',{_session_id:sid,challenge_hash:'d'.repeat(64),verified_uid:owner,verified_email:'owner@example.invalid'});
 assert.equal((await call('live',owner,'admin_list',args)).items.length,0);
});
test('new live submissions, votes, favorites and moderation cannot change the test environment',async()=>{
 liveStory=(await call('live',visitor,'submit',{kind:'confession',body:'Zvanična ispovijest pripada samo zvaničnom okruženju.'})).id;
 assert.equal((await call('live',null,'feed')).items.length,0);
 await db.query("update community_live.content set state='published',published_at=clock_timestamp() where id=$1",[liveStory]);
 await call('live',visitor,'vote',{id:liveStory,value:1});await call('live',visitor,'favorite',{id:liveStory,enabled:true});
 assert.equal((await call('test',visitor,'vote_status',{id:testStory})).my_vote,null);assert.equal((await call('test',visitor,'list',{list:'favorites'})).items.length,0);
 await call('live',owner,'admin_remove',{id:liveStory,_session_id:sid,_aal:'aal1'});
 assert.equal((await call('live',null,'feed')).items.length,0);assert.equal((await call('test',null,'feed')).items.length,1);
 assert.deepEqual((await db.query('select jsonb_agg(to_jsonb(c) order by id) r from community_test.content c')).rows[0].r,testBefore);
});
test('direct public access to live tables and RPCs remains forbidden',async()=>{
 for(const role of ['anon','authenticated']){
  await db.exec('set role '+role);try{await assert.rejects(db.query('select * from community_live.content'),/permission denied/);await assert.rejects(call('live',owner,'admin_list',{_session_id:sid,_aal:'aal2',view:'archive'}),/permission denied|Zabranjeno/);}finally{await db.exec('reset role');}
 }
});
test('live gateway calls live RPCs only and exposes no new activation or anonymous admin access',async()=>{
 const source=stripTypeScriptTypes(await readFile(new URL('../launch/community-live-api.ts',import.meta.url),'utf8'));
 vm.runInNewContext(source,{Request,Response,Uint8Array,TextDecoder,TextEncoder,JSON,Set,AbortSignal,SyntaxError,atob,btoa,crypto,
  Deno:{env:{get:k=>({SUPABASE_URL:'https://isolated.invalid',SUPABASE_SERVICE_ROLE_KEY:'server-only',ALLOWED_ORIGINS:'https://allowed.invalid'})[k]},serve:f=>handler=f},
  fetch:async(url,options)=>{
   if(url.endsWith('/auth/v1/user'))return Response.json({id:visitor,is_anonymous:true});
   const name=url.split('/').at(-1);rpcNames.push(name);assert.ok(name.startsWith('community_live_'));
   if(name==='community_live_security')return Response.json({enabled:true,sitekey:'configured-widget'});
   return Response.json({items:[]});
  }});
 const send=(action,token)=>handler(new Request('https://gateway.invalid',{method:'POST',headers:{Origin:'https://allowed.invalid',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify({action,args:{}})}));
 assert.deepEqual(await(await send('health')).json(),{environment:'live',version:'launch1',captcha_enabled:true});
 assert.equal((await send('feed')).status,200);assert.equal((await send('activate_admin')).status,403);
 assert.equal((await send('admin_list')).status,401);assert.equal((await send('admin_list','regular-user')).status,403);assert.ok(rpcNames.includes('community_live_dispatch'));
});
test('initial setup cannot be rerun over an existing live environment',async()=>{
 const before=(await db.query('select jsonb_agg(to_jsonb(c) order by id) r from community_live.content c')).rows[0].r;
 await assert.rejects(db.exec(migration),/već postoji/);await db.exec('rollback');
 assert.deepEqual((await db.query('select jsonb_agg(to_jsonb(c) order by id) r from community_live.content c')).rows[0].r,before);
});
