import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {randomUUID} from 'node:crypto';import {PGlite} from '@electric-sql/pglite';
test('archive snapshots preserve original identity and enforce administrator access',async()=>{const db=new PGlite();try{
 await db.exec('create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);');
 const owner=randomUUID(),user=randomUUID(),sid=randomUUID();for(const id of [owner,user])await db.query('insert into auth.users values($1)',[id]);await db.query('insert into auth.sessions values($1,$2,null)',[sid,owner]);
 for(const file of ['supabase/migrations/20261023212548_community_v2.sql','supabase/admin-captcha.sql','supabase/admin-email.sql'])await db.exec(await readFile(new URL('../'+file,import.meta.url),'utf8'));
 await db.query('insert into community_test.admins values($1)',[owner]);await db.exec("update community_test.security_settings set admin_auth_method='email'");await db.query("insert into community_test.admin_email_sessions(user_id,session_id,challenge_hash,expires_at,verified_until) values($1,$2,$3,clock_timestamp()+interval '1 hour',clock_timestamp()+interval '8 hours')",[owner,sid,'a'.repeat(64)]);
 await db.exec(await readFile(new URL('../chat/prepare-test.sql',import.meta.url),'utf8'));
 await db.query("select public.chat_test_dispatch($1,'profile','{}')",[user]);await db.exec(await readFile(new URL('../admin-prep/chat-archive-isolated.sql',import.meta.url),'utf8'));
 await db.query("update chat_test.profiles set generated_nickname='Anonim-Prije',avatar='moon' where user_id=$1",[user]);
 await db.query("insert into chat_test.messages(user_id,body,request_id) values($1,'Probna poruka',$2)",[user,randomUUID()]);await db.query("update chat_test.profiles set generated_nickname='Anonim-Poslije',avatar='fox' where user_id=$1",[user]);
 const list=async(uid)=>db.query("select public.admin_archive_probe_list($1,$2,'aal1',null,'probna','all') result",[uid,sid]);const m=(await list(owner)).rows[0].result.items[0];assert.equal(m.nickname,'Anonim-Prije');assert.equal(m.avatar,'moon');await assert.rejects(list(user));
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);try{await assert.rejects(db.query('select * from admin_archive_probe.snapshots'));await assert.rejects(list(owner))}finally{await db.exec('reset role')}}
 }finally{await db.close()}});
