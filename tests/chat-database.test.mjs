import {test,before,after} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {randomUUID} from 'node:crypto';import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();const owner=randomUUID(),alice=randomUUID(),bob=randomUUID(),carol=randomUUID(),sid=randomUUID();let ap,bp,cp;
const adminArgs={_session_id:sid,_aal:'aal1'};
const call=async(uid,action,args={})=>(await db.query('select public.chat_test_dispatch($1,$2,$3::jsonb) r',[uid,action,JSON.stringify(action.startsWith('admin_')?{...args,...adminArgs}:args)])).rows[0].r;
const trial=(uid,plan)=>call(owner,'admin_grant',{target:uid,plan,request_id:randomUUID()});
before(async()=>{
 await db.exec('create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);');
 for(const id of[owner,alice,bob,carol])await db.query('insert into auth.users values($1)',[id]);
 await db.query('insert into auth.sessions values($1,$2,null)',[sid,owner]);
 for(const file of ['supabase/migrations/20261023212548_community_v2.sql','supabase/admin-captcha.sql','supabase/admin-email.sql'])await db.exec(await readFile(new URL('../'+file,import.meta.url),'utf8'));
 await db.query('insert into community_test.admins values($1)',[owner]);
 await db.exec("update community_test.security_settings set admin_auth_method='email'");
 await db.query("insert into community_test.admin_email_sessions(user_id,session_id,challenge_hash,expires_at,verified_until) values($1,$2,$3,clock_timestamp()+interval '1 hour',clock_timestamp()+interval '8 hours')",[owner,sid,'a'.repeat(64)]);
 await db.exec(await readFile(new URL('../chat/prepare-test.sql',import.meta.url),'utf8'));
 ap=await call(alice,'profile');bp=await call(bob,'profile');cp=await call(carol,'profile');
});
after(()=>db.close());
test('chat profile is generated; clients cannot grant themselves packages or paid cosmetics',async()=>{
 assert.match(ap.nickname,/^Anonim-/);assert.notEqual(ap.id,bp.id);assert.notEqual(ap.id,alice);
 const profiles=(await call(owner,'admin_profiles')).items;assert.equal(profiles.length,3);assert.ok(profiles.every(p=>p.user_id===undefined&&p.secret_hash===undefined));
 await assert.rejects(call(alice,'history'),/aktivan paket/);await assert.rejects(call(alice,'admin_grant',{target:ap.id,plan:'30d',request_id:randomUUID()}),/Zabranjena/);
 await assert.rejects(trial(ap.id,'24h'),/isključena/);await call(owner,'admin_test_mode',{enabled:true});
});
test('all three plans have exact duration and server history windows; repeated grant cannot extend twice',async()=>{
 for(const [profile,plan,hours,days] of [[ap,'24h',1,1],[bp,'7d',7,7],[cp,'30d',31,30]]){
  const request_id=randomUUID(),args={target:profile.id,plan,request_id};await call(owner,'admin_grant',args);
  const before=await call(profile===ap?alice:profile===bp?bob:carol,'profile');assert.equal(before.history_hours,hours);assert.ok(Math.abs(Date.parse(before.expires_at)-Date.parse(before.server_now)-days*86400000)<1000);
  assert.equal((await call(owner,'admin_grant',args)).replayed,true);
  assert.equal((await call(profile===ap?alice:profile===bp?bob:carol,'profile')).expires_at,before.expires_at);
  await assert.rejects(call(owner,'admin_grant',{...args,plan:plan==='24h'?'7d':'24h'}),/promijenjen/);
 }
});
test('history is a sliding server window, not client supplied hours; no private message action exists',async()=>{
 for(const h of [0,2,8,32])await db.query("insert into chat_test.messages(user_id,body,created_at,request_id) values($1,$2,clock_timestamp()-make_interval(hours=>$3),$4)",[bob,'Poruka prije '+h+' sati',h,randomUUID()]);
 for(const [uid,count]of [[alice,1],[bob,2],[carol,3]])assert.equal((await call(uid,'history',{history_hours:9999})).items.length,count);
 await assert.rejects(call(alice,'private_message',{target:bp.id,body:'Ne'}),/Nepoznata/);
});
test('send uses idempotency, validates links/length, preserves emojis and rejects spam',async()=>{
 const args={body:'Zdravo svima 🙂',request_id:randomUUID()};const r=await call(alice,'send',args);assert.equal((await call(alice,'send',args)).id,r.id);
 await assert.rejects(call(alice,'send',{...args,body:'Izmjena'}),/promijenjen/);
 await assert.rejects(call(alice,'send',{body:'https://primjer.ba',request_id:randomUUID()}),/Linkovi/);
 await assert.rejects(call(alice,'send',{body:'x'.repeat(1001),request_id:randomUUID()}),/1000/);
 await assert.rejects(call(alice,'send',{body:args.body,request_id:randomUUID()}),/ponavljaš/);
 for(let i=0;i<4;i++)await call(alice,'send',{body:'Različita poruka '+i,request_id:randomUUID()});
 await assert.rejects(call(alice,'send',{body:'Previše brzo',request_id:randomUUID()}),/Prebrzo/);
});
test('blocking filters messages on the server; reports reach the moderator; removal and restore are soft',async()=>{
 const history=await call(alice,'history');const message=history.items.find(m=>m.sender===bp.id);
 await call(alice,'report',{id:message.id,reason:'spam'});await call(alice,'report',{id:message.id,reason:'spam'});
 assert.equal((await call(owner,'admin_messages')).items.find(m=>m.id===message.id).reports.length,1);
 await call(alice,'block',{target:bp.id});assert.ok(!(await call(alice,'history')).items.some(m=>m.sender===bp.id));assert.equal((await call(alice,'profile')).blocked[0].id,bp.id);
 await call(alice,'unblock',{target:bp.id});assert.ok((await call(alice,'history')).items.some(m=>m.sender===bp.id));
 await call(owner,'admin_remove',{id:message.id});assert.ok(!(await call(alice,'history')).items.some(m=>m.id===message.id));
 await call(owner,'admin_restore',{id:message.id});assert.ok((await call(alice,'history')).items.some(m=>m.id===message.id));
 await call(owner,'admin_ban',{target:ap.id,hours:1,reason:'Spam'});await assert.rejects(call(alice,'history'),/blokiran/);await call(owner,'admin_unban',{target:ap.id});
});
test('nickname and avatar purchases are separate and reserved nickname survives renewal inside 15 days',async()=>{
 await call(owner,'admin_nickname',{target:ap.id,nickname:'Zlatni Oblak',request_id:randomUUID()});
 assert.equal((await call(alice,'profile')).avatar,ap.avatar);
 await assert.rejects(call(owner,'admin_nickname',{target:bp.id,nickname:'zlatni oblak',request_id:randomUUID()}),/rezervisan/);
 await call(owner,'admin_avatar',{target:ap.id,avatar:'fox',request_id:randomUUID()});
 await db.query("update chat_test.access set expires_at=clock_timestamp()-interval '1 day' where user_id=$1",[alice]);
 await db.query("update chat_test.nicknames set reserved_until=clock_timestamp()+interval '14 days' where user_id=$1",[alice]);
 await assert.rejects(call(alice,'history'),/aktivan paket/);await assert.rejects(call(alice,'send',{body:'Isteklo',request_id:randomUUID()}),/aktivan paket/);
 assert.equal((await call(alice,'profile')).avatar,'fox');await trial(ap.id,'24h');
 const p=await call(alice,'profile');assert.equal(p.nickname,'Zlatni Oblak');assert.equal(p.avatar,'fox');assert.ok(Math.abs(Date.parse(p.nickname_reserved_until)-Date.parse(p.expires_at)-15*86400000)<1000);
});
test('nickname becomes available after grace period; old owner cannot recover someone else\'s newly reserved name',async()=>{
 await db.query("update chat_test.access set expires_at=clock_timestamp()-interval '16 days' where user_id=$1",[alice]);
 await db.query("update chat_test.nicknames set reserved_until=clock_timestamp()-interval '1 day' where user_id=$1",[alice]);
 await call(owner,'admin_nickname',{target:bp.id,nickname:'Zlatni Oblak',request_id:randomUUID()});await trial(ap.id,'24h');
 assert.equal((await call(alice,'profile')).nickname,ap.nickname);assert.equal((await call(bob,'profile')).nickname,'Zlatni Oblak');
});
test('recovery moves chat rights to a fresh anonymous account and rotates the recovery secret atomically',async()=>{
 await call(alice,'recovery_set',{recovery_hash:'1'.repeat(64)});const fresh=randomUUID();await db.query('insert into auth.users values($1)',[fresh]);
 await assert.rejects(call(fresh,'recover',{recovery_hash:'2'.repeat(64),new_recovery_hash:'3'.repeat(64)}),/važeći/);
 await call(fresh,'recover',{recovery_hash:'1'.repeat(64),new_recovery_hash:'4'.repeat(64)});const p=await call(fresh,'profile');assert.equal(p.id,ap.id);assert.equal(p.avatar,'fox');assert.equal(p.active,true);
 await assert.rejects(call(alice,'history'),/aktivan paket/);
 const other=randomUUID();await db.query('insert into auth.users values($1)',[other]);await assert.rejects(call(other,'recover',{recovery_hash:'1'.repeat(64),new_recovery_hash:'5'.repeat(64)}),/važeći/);
});
test('RLS and grants prevent direct client table/RPC access; unverified admin email proof is rejected',async()=>{
 const tables=(await db.query("select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='chat_test' and c.relkind='r'")).rows;assert.ok(tables.every(t=>t.relrowsecurity));
 for(const role of['anon','authenticated']){await db.exec('set role '+role);try{await assert.rejects(db.query('select * from chat_test.messages'),/permission denied/);await assert.rejects(call(alice,'profile'),/permission denied/);}finally{await db.exec('reset role');}}
 await db.exec("update community_test.admin_email_sessions set verified_until=clock_timestamp()-interval '1 second'");await assert.rejects(call(owner,'admin_messages'),/Potvrdi/);
});
test('SQL rejects every ordinary-user administrative action even with genuine owner session identifiers',async()=>{
 const before=(await db.query('select (select count(*) from chat_test.access) packages,(select count(*) from chat_test.audit) audits')).rows[0];
 for(const action of ['admin_status','admin_profiles','admin_test_mode','admin_grant','admin_nickname','admin_avatar','admin_messages','admin_remove','admin_restore','admin_ban','admin_unban']){
  await assert.rejects(call(bob,action,{target:cp.id,plan:'30d',nickname:'Oteti Nadimak',avatar:'fox',request_id:randomUUID(),enabled:true,id:'1',hours:24}),/Zabranjena/,action);
 }
 assert.deepEqual((await db.query('select (select count(*) from chat_test.access) packages,(select count(*) from chat_test.audit) audits')).rows[0],before);
 const p=await call(bob,'profile',{user_id:carol,p_uid:carol,target:cp.id});assert.equal(p.id,bp.id);
 const history=await call(bob,'history',{history_hours:999999,before:'999999999',server_now:'2000-01-01',user_id:carol});
 assert.ok(history.items.every(m=>Date.parse(m.created_at)>Date.parse(history.history_cutoff)));
 for(const value of [p,...history.items])for(const key of ['user_id','secret_hash','challenge_hash','session_id','email'])assert.equal(value[key],undefined,key);
 for(const role of ['anon','authenticated']){
  await db.exec('set role '+role);
  try{for(const table of ['profiles','access','recovery','blocks','reports','audit','admin_receipts'])await assert.rejects(db.query('select * from chat_test.'+table),/permission denied/,table);}
  finally{await db.exec('reset role');}
 }
});
