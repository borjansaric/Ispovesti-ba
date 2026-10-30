import {test,after} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';
const db=new PGlite(),names=['confessions','comments','votes','private_user_lists','submission_limits','test_spam'];
after(()=>db.close());
test('archive cutover requires approval and a separate live schema; it never deletes rows',async()=>{
 await db.exec('create role anon;create role authenticated;create role service_role bypassrls;create schema community_test;create table community_test.content(id integer);insert into community_test.content values(99);grant usage on schema community_test to service_role;grant select on community_test.content to service_role;');
 for(const name of names)await db.exec(`create table public.${name}(id integer);insert into public.${name} values(1);grant all on public.${name} to public,anon,authenticated,service_role;`);
 const sql=await readFile(new URL('../launch/archive-legacy-after-cutover.sql',import.meta.url),'utf8');
 await assert.rejects(db.exec(sql),/odobrenje/);await db.exec('rollback');
 await db.exec("select set_config('ispovesti.archive_approval','archive-legacy-after-cutover-v1',false)");await assert.rejects(db.exec(sql),/Prvo potvrdi/);await db.exec('rollback');
 await db.exec("select set_config('ispovesti.cutover_verified','live-http-and-admin-verified-v2',false)");await assert.rejects(db.exec(sql),/ne postoji/);await db.exec('rollback');
 await db.exec('create schema community_live');await db.exec(sql);
 for(const name of names)assert.equal((await db.query(`select count(*)::int n from public.${name}`)).rows[0].n,1);
 for(const role of ['anon','authenticated','service_role']){await db.exec('set role '+role);try{for(const name of names)await assert.rejects(db.query('select * from public.'+name),/permission denied/);}finally{await db.exec('reset role');}}
 await db.exec('set role service_role');assert.equal((await db.query('select * from community_test.content')).rows[0].id,99);await db.exec('reset role');
});
