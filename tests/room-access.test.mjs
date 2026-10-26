import {test,before,after} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {randomUUID,createHash} from 'node:crypto';import {PGlite} from '@electric-sql/pglite';
import {collectReplies} from '../chat/thread-model.mjs';
const db=new PGlite(),admin=randomUUID(),as=randomUUID(),users=Array.from({length:7},()=>({id:randomUUID(),sid:randomUUID()}));
const hash=n=>createHash('sha256').update('test code '+n).digest('hex');
const call=async(u,action,args={},session=u.sid)=>(await db.query('select public.chat_test_dispatch_v2($1,$2,$3::jsonb,$4) r',[u.id,action,JSON.stringify(args),session])).rows[0].r;
const owner={id:admin,sid:as},issue=(plan,n,id=randomUUID())=>call(owner,'admin_issue_code',{plan,request_id:id,code_hash:hash(n),_session_id:as,_aal:'aal1'});
before(async()=>{
 await db.exec('create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,is_anonymous boolean);create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);');
 for(const u of [owner,...users]){await db.query('insert into auth.users values($1,$2)',[u.id,u!==owner]);await db.query('insert into auth.sessions values($1,$2,null)',[u.sid,u.id]);}
 for(const f of ['supabase/migrations/20261023212548_community_v2.sql','supabase/admin-captcha.sql','supabase/admin-email.sql'])await db.exec(await readFile(new URL('../'+f,import.meta.url),'utf8'));
 await db.query('insert into community_test.admins values($1)',[admin]);await db.exec(await readFile(new URL('../chat/prepare-test.sql',import.meta.url),'utf8'));await db.exec("update community_test.security_settings set admin_auth_method='email';update chat_test.settings set test_grants_enabled=true");
 await db.query("insert into community_test.admin_email_sessions(user_id,session_id,challenge_hash,expires_at,verified_until) values($1,$2,$3,clock_timestamp()+interval '1 hour',clock_timestamp()+interval '8 hours')",[admin,as,'a'.repeat(64)]);
 await db.exec(await readFile(new URL('../chat/room-access.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../chat/room-auth-check.sql',import.meta.url),'utf8'));
});after(()=>db.close());
test('additive migration keeps original dispatcher and private snapshots inaccessible to clients and service role',async()=>{
 assert.ok((await db.query("select to_regprocedure('public.chat_test_dispatch(uuid,text,jsonb)') r")).rows[0].r);
 const snapshots=(await db.query("select tablename from pg_tables where schemaname='chat_test' and tablename like 'snapshot_%'")).rows;assert.ok(snapshots.length>10);
 for(const role of ['anon','authenticated','service_role']){await db.exec('set role '+role);try{await assert.rejects(db.query('select * from chat_test.'+snapshots[0].tablename),/permission denied/);}finally{await db.exec('reset role');}}
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);try{await assert.rejects(call(users[0],'profile'),/permission denied/);}finally{await db.exec('reset role');}}
});
test('only verified admin can issue codes; issuance retries and all plans preserve exact expiry',async()=>{
 await assert.rejects(call(users[0],'admin_issue_code',{plan:'30d',request_id:randomUUID(),code_hash:hash(0),_session_id:as,_aal:'aal2'}),/Zabranjena/);
 for(const [i,plan,hours]of [[0,'24h',24],[1,'7d',168],[2,'30d',720]]){
  const id=randomUUID(),r=await issue(plan,i,id),again=await issue(plan,i,id);assert.equal(again.replayed,true);assert.equal(again.expires_at,r.expires_at);
  const row=(await db.query('select * from chat_test.access_codes where id=$1',[id])).rows[0];assert.ok(Math.abs(Date.parse(row.expires_at)-Date.parse(row.issued_at)-hours*3600000)<1000);
  assert.equal(r.code_hash,undefined);await assert.rejects(issue('24h',99,id),/Promijenjen/);
 }
});
test('redemption uses real session, binds original expiry and random side, never extends on retry',async()=>{
 const u=users[0];await assert.rejects(call(u,'redeem_code',{code_hash:hash(0)},users[1].sid),/Prijava/);
 await assert.rejects(call(owner,'redeem_code',{code_hash:hash(0)}),/anonimni/);
 const r=await call(u,'redeem_code',{code_hash:hash(0)}),again=await call(u,'redeem_code',{code_hash:hash(0)});assert.equal(again.expires_at,r.expires_at);
 const a=await call(u,'profile'),b=await call(u,'profile');assert.equal(a.side,b.side);assert.match(a.side,/^(left|right)$/);assert.equal(a.history_hours,1);assert.equal(a.expires_at,r.expires_at);
 for(const action of ['admin_grant','admin_avatar','admin_nickname','admin_ban'])await assert.rejects(call(u,action,{_session_id:as,_aal:'aal2'}),/Zabranjena/);
});
test('service role redeems with narrow anonymous predicate and no auth.users read privilege',async()=>{
 const u=users[6];await db.exec('set role service_role');try{
  await assert.rejects(db.query('select * from auth.users'),/permission denied/);
  assert.equal((await db.query('select chat_test.is_anonymous_user($1) r',[u.id])).rows[0].r,true);
  assert.equal((await call(u,'redeem_code',{code_hash:hash(999)}))._http_status,403);
 }finally{await db.exec('reset role');}
});
test('device transfer preserves profile and expiry, evicts previous session, caps sharing and bans owner',async()=>{
 const original=await call(users[0],'profile');await call(users[1],'redeem_code',{code_hash:hash(0)});const moved=await call(users[1],'profile');assert.equal(moved.id,original.id);assert.equal(moved.side,original.side);assert.equal(moved.expires_at,original.expires_at);
 await assert.rejects(call(users[0],'history'),/drugoj sesiji/);
 await call(users[2],'redeem_code',{code_hash:hash(0)});await call(users[3],'redeem_code',{code_hash:hash(0)});
 assert.equal((await call(users[4],'redeem_code',{code_hash:hash(0)}))._http_status,429);
 await db.query("insert into chat_test.bans(user_id,permanent,reason) values($1,true,'test')",[users[0].id]);
 await assert.rejects(call(users[3],'history'),/blokiran/);assert.equal((await call(users[3],'redeem_code',{code_hash:hash(0)}))._http_status,403);
});
test('failed code attempts persist and expired purchases cannot reactivate',async()=>{
 for(let i=0;i<20;i++)assert.equal((await call(users[5],'redeem_code',{code_hash:hash(999)}))._http_status,403);
 assert.equal((await call(users[5],'redeem_code',{code_hash:hash(1)}))._http_status,429);
 await db.query("update chat_test.access_codes set expires_at=clock_timestamp()-interval '1 second' where code_hash=$1",[hash(2)]);
 assert.equal((await call(users[6],'redeem_code',{code_hash:hash(2)}))._http_status,403);
});
test('server history limits remain enforced through code access and direct tables stay private',async()=>{
 await call(users[6],'redeem_code',{code_hash:hash(1)});
 for(const h of [0,6,8])await db.query("insert into chat_test.messages(user_id,body,created_at,request_id) values($1,$2,clock_timestamp()-make_interval(hours=>$3),$4)",[users[6].id,'history '+h,h,randomUUID()]);
 assert.equal((await call(users[6],'history',{history_hours:9999})).items.length,2);
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);try{for(const table of ['access_codes','room_sides','code_attempts','comment_favorites'])await assert.rejects(db.query('select * from chat_test.'+table),/permission denied/);}finally{await db.exec('reset role');}}
});
test('flat thread collector includes paginated descendants once and excludes other threads',async()=>{
 const first=Array.from({length:20},(_,i)=>({id:String(i+2),created_at:new Date(i*1000).toISOString(),has_replies:i===0}));
 const fn=async(action,args)=>({items:args.parent_id==='1'?(args.offset?[]:first):args.parent_id==='2'?[{id:'50',created_at:new Date(500).toISOString(),has_replies:false}]:[]});
 const items=await collectReplies(fn,'100','1');assert.equal(items.length,21);assert.equal(items[1].id,'50');assert.equal(new Set(items.map(x=>x.id)).size,21);
});
test('reply counts include visible descendants, hidden branches disappear and hearts stay private',async()=>{
 const insert=async(kind,parent,confession)=>(await db.query("insert into community_test.content(kind,author_id,body,state,published_at,parent_id,confession_id) values($1,$2,'Testni sadržaj za provjeru','published',clock_timestamp(),$3,$4) returning id",[kind,users[6].id,parent,confession])).rows[0].id;
 const confession=await insert('confession',null,null),comment=await insert('comment',null,confession),r1=await insert('reply',comment,confession),r2=await insert('reply',r1,confession);
 assert.equal((await call(users[6],'comment_meta',{ids:[comment]}))[comment].replies,2);
 await call(users[6],'comment_favorite',{id:comment,enabled:true});assert.equal((await call(users[6],'comment_meta',{ids:[comment]}))[comment].favorite,true);assert.equal((await call(users[5],'comment_meta',{ids:[comment]}))[comment].favorite,false);
 await db.query("update community_test.content set state='removed' where id=$1",[r1]);assert.equal((await call(users[6],'comment_meta',{ids:[comment]}))[comment].replies,0);
 await assert.rejects(call(users[6],'comment_favorite',{id:r2,enabled:true}),/nije dostupan/);
});
