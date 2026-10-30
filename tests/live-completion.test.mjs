import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {PGlite} from '@electric-sql/pglite';
import {recoveryHandler} from '../admin-recovery/handler.mjs';
import {createChatHandler} from '../chat/gateway.mjs';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const db=new PGlite(),owner='00000000-0000-4000-8000-000000000401',sid='00000000-0000-4000-8000-000000000402',user='00000000-0000-4000-8000-000000000403',us='00000000-0000-4000-8000-000000000404',other='00000000-0000-4000-8000-000000000405',os='00000000-0000-4000-8000-000000000406';
const call=(uid,action,args={},session=us)=>db.query('select public.chat_live_dispatch_v2($1,$2,$3::jsonb,$4) r',[uid,action,JSON.stringify(args),session]).then(r=>r.rows[0].r);
const proof={_session_id:sid,_aal:'aal1'};
before(async()=>{
 await db.exec('create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,is_anonymous boolean,email_confirmed_at timestamptz,encrypted_password text);create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);');
 for(const f of ['supabase/migrations/20261023212548_community_v2.sql','supabase/admin-captcha.sql','supabase/admin-email.sql','supabase/comments-response.sql','supabase/submission-latency.sql'])await db.exec(await read(f));
 await db.query("insert into auth.users values($1,'owner@example.invalid',false,now(),'unchanged'),($2,null,true,null,null),($3,null,true,null,null)",[owner,user,other]);
 await db.query('insert into auth.sessions values($1,$2,null),($3,$4,null),($5,$6,null)',[sid,owner,us,user,os,other]);
 await db.query('insert into community_test.admins values($1)',[owner]);
 await db.exec("update community_test.security_settings set owner_email='owner@example.invalid',admin_auth_method='email',captcha_enabled=true,captcha_sitekey='real-widget',captcha_secret_ciphertext='fixture-encrypted';select set_config('ispovesti.launch_approval','production-launch-v1',false);");
 await db.exec(await read('launch/prepare-live.sql'));
 for(const f of ['chat-core','chat-room','chat-auth','chat-archive','owner-chat','admin-recovery','recovery-settings'])await db.exec(await read('live/'+f+'.sql'));
 await db.query("insert into community_live.admin_email_sessions(user_id,session_id,challenge_hash,expires_at,verified_until) values($1,$2,$3,now()+interval '10 minutes',now()+interval '8 hours')",[owner,sid,'a'.repeat(64)]);
});
after(()=>db.close());
test('live room forbids trial rights at SQL boundary and requires a real live session',async()=>{
 for(const action of ['admin_test_mode','admin_grant','admin_issue_code','redeem_code','recover'])await assert.rejects(call(owner,action,proof,sid),/Probne radnje/);
 await assert.rejects(call(user,'profile',{},sid),/Prijava/);
 await assert.rejects(db.exec('update chat_live.settings set test_grants_enabled=true'),/check constraint/);
 for(const role of ['anon','authenticated'])assert.equal((await db.query("select has_function_privilege($1,'public.chat_live_dispatch_v2(uuid,text,jsonb,text)','execute') yes",[role])).rows[0].yes,false);
});
test('owner can open one anonymous chat session; another owner session is not trusted from browser data',async()=>{
 await assert.rejects(db.query('select public.chat_live_owner_access($1,$2,$3,$4)',[other,os,user,us]),/Zabranjena/);
 await db.query('select public.chat_live_owner_access($1,$2,$3,$4)',[owner,sid,user,us]);
 assert.equal((await call(user,'profile')).active,true);
 await assert.rejects(call(user,'history',{},os),/Prijava/);
 await db.query('select public.chat_live_owner_access($1,$2,$3,$4)',[owner,sid,other,os]);
 await assert.rejects(call(user,'profile'),/Pristup je aktiviran/);
 await db.query('select public.chat_live_owner_access($1,$2,$3,$4)',[owner,sid,user,us]);
});
test('live message archive preserves profiles, reads every page, moderates and rejects unverified access',async()=>{
 await db.query("insert into chat_live.messages(user_id,body,request_id) select $1,'Message '||n,gen_random_uuid() from generate_series(1,205) n",[user]);
 const saved=(await db.query('select nickname,avatar,author_public_id from admin_archive_live.snapshots limit 1')).rows[0];
 await db.query("update chat_live.profiles set generated_nickname='New name',avatar='star' where user_id=$1",[user]);
 const archive=args=>db.query('select public.chat_live_admin_archive($1,$2,$3) r',[owner,sid,args]).then(r=>r.rows[0].r);
 const a=await archive({action:'list',filters:{}}),b=await archive({action:'list',filters:{before:a.next_before}}),c=await archive({action:'list',filters:{before:b.next_before}});
 assert.equal(a.items.length,100);assert.equal(b.items.length,100);assert.equal(c.items.length,5);assert.equal(c.has_more,false);
 assert.equal(new Set([...a.items,...b.items,...c.items].map(x=>x.id)).size,205);
 assert.equal(a.items[0].nickname,saved.nickname);assert.equal(a.items[0].avatar,saved.avatar);
 await call(owner,'admin_remove',{...proof,id:'205'},sid);
 assert.equal((await archive({action:'list',filters:{status:'removed'}})).items[0].id,'205');
 await call(owner,'admin_restore',{...proof,id:'205'},sid);
 assert.equal((await db.query('select count(*) n from chat_live.messages')).rows[0].n,205);
 await assert.rejects(db.query('select public.chat_live_admin_archive($1,$2,$3)',[other,os,{action:'list',filters:{}}]),/Zabranjena/);
 const context=await archive({action:'context',id:'101'});assert.equal(context.items.length,11);assert.ok(context.items.every(x=>typeof x.id==='string'));
});
test('mail configuration stays service-only, hides ciphertext, validates owner proof and starts disabled',async()=>{
 const config=(action,args={})=>db.query('select public.community_live_recovery_settings($1,$2) r',[action,args]).then(r=>r.rows[0].r);
 await assert.rejects(config('get',{_uid:other,_session_id:os}),/Zabranjena/);
 const initial=await config('get',{_uid:owner,_session_id:sid});assert.equal(initial.enabled,false);assert.equal(initial.mail_configured,false);
 await config('set',{_uid:owner,_session_id:sid,enabled:true,sender:'onboarding@resend.dev',mail_key_ciphertext:'v1:server-only:encrypted'});
 const c=await config('get',{_uid:owner,_session_id:sid});assert.equal(c.enabled,true);assert.ok(!JSON.stringify(c).includes('encrypted'));
 for(const role of ['anon','authenticated'])assert.equal((await db.query("select has_function_privilege($1,'public.community_live_recovery_settings(text,jsonb)','execute') yes",[role])).rows[0].yes,false);
 assert.equal((await db.query('select encrypted_password p from auth.users where id=$1',[owner])).rows[0].p,'unchanged');
});
test('recovery accepts only its explicit live path and still rejects arbitrary destinations',()=>{
 const make=linkURL=>recoveryHandler({config:{environment:'live',enabled:false,linkURL}});
 assert.doesNotThrow(()=>make('https://borjansaric.github.io/Ispovesti-ba/admin-recovery.html'));
 assert.throws(()=>make('https://borjansaric.github.io/elsewhere/admin-recovery.html'));
});
test('live gateway routes archive using verified identity and rejects all trial grants',async()=>{
 const jwt='e30.'+Buffer.from(JSON.stringify({session_id:sid,aal:'aal1'})).toString('base64url')+'.x';let params;
 const handler=createChatHandler({supabaseUrl:'https://fixture.invalid',serviceKey:'server',allowedOrigins:['https://site.invalid'],environment:'production',rpcName:'chat_live_dispatch_v2',archivePrefix:'chat_live_admin_archive',fetcher:async(url,options)=>{
  if(url.endsWith('/auth/v1/user'))return Response.json({id:owner,is_anonymous:false});
  assert.ok(url.endsWith('/rpc/chat_live_admin_archive'));params=JSON.parse(options.body);return Response.json({items:[]});
 }});
 const send=(action,args)=>handler(new Request('https://api.invalid',{method:'POST',headers:{Origin:'https://site.invalid','Content-Type':'application/json',Authorization:'Bearer '+jwt},body:JSON.stringify({action,args})}));
 assert.equal((await send('admin_archive',{filters:{},p_uid:other,_session_id:os})).status,200);assert.equal(params.p_uid,owner);assert.equal(params.p_session,sid);
 assert.equal((await send('admin_grant',{target:other,plan:'30d'})).status,403);
});
test('production allowlist ships live chat/admin/recovery without server code, secrets or trial generator',async()=>{
 execFileSync(process.execPath,['scripts/build-production-review.mjs'],{cwd:new URL('../',import.meta.url),stdio:'pipe'});
 const walk=async dir=>{for(const e of await readdir(dir,{withFileTypes:true})){if(e.name==='test')continue;const p=new URL(e.name+(e.isDirectory()?'/':''),dir);if(e.isDirectory()){await walk(p);continue;}assert.ok(!/\.(sql|ts)$/.test(e.name));if(/\.(mjs|js|html)$/.test(e.name)){const s=await readFile(p,'utf8');assert.doesNotMatch(s,/SUPABASE_SERVICE_ROLE_KEY|Deno\.env\.get|export const trialCode=|chat-test-api|admin-recovery-test-api/);}}};await walk(new URL('../.production-review/',import.meta.url));
 assert.match(await read('.production-review/chat-admin.html'),/live\/chat-admin.mjs/);
 assert.match(await read('.production-review/index.html'),/chat\/ui.mjs/);
});
