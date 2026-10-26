import {test,before,after} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {randomUUID} from 'node:crypto';import {PGlite} from '@electric-sql/pglite';
const db=new PGlite(),alice=randomUUID(),bob=randomUUID();let confession,comment,reply;const sql=await readFile(new URL('../supabase/one-vote-change-test.sql',import.meta.url),'utf8');
const call=async(uid,action,args)=>(await db.query('select public.community_test_dispatch($1,$2,$3::jsonb) r',[uid,action,JSON.stringify(args)])).rows[0].r;
before(async()=>{
 await db.exec('create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create table auth.sessions(id uuid,user_id uuid,not_after timestamptz);');for(const u of [alice,bob])await db.query('insert into auth.users values($1)',[u]);
 await db.exec(await readFile(new URL('../supabase/migrations/20261023212548_community_v2.sql',import.meta.url),'utf8'));
 for(const f of ['admin-captcha.sql','admin-email.sql','comments-response.sql','submission-latency.sql'])await db.exec(await readFile(new URL('../supabase/'+f,import.meta.url),'utf8'));
 confession=(await db.query("insert into community_test.content(kind,author_id,body,state,published_at) values('confession',$1,'Testna ispovijest za pravilo jednog glasa.','published',now()) returning id",[alice])).rows[0].id;
 comment=(await db.query("insert into community_test.content(kind,author_id,body,state,confession_id) values('comment',$1,'Komentar','published',$2) returning id",[alice,confession])).rows[0].id;
 reply=(await db.query("insert into community_test.content(kind,author_id,body,state,confession_id,parent_id) values('reply',$1,'Odgovor','published',$2,$3) returning id",[alice,confession,comment])).rows[0].id;
 await db.query("insert into community_test.votes(content_id,user_id,value,first_voted_at) values($1,$2,1,clock_timestamp()-interval '1 day')",[confession,bob]);
 await db.exec(sql);
});after(()=>db.close());
test('one change for each content type; same-vote retries never spend the change or expose early totals',async()=>{
 for(const id of [confession,comment,reply]){
  let r=await call(alice,'vote',{id,value:1});assert.equal(r.my_vote,1);assert.equal(r.can_change,true);assert.equal(r.likes,undefined);
  const before=(await db.query('select first_voted_at from community_test.votes where user_id=$1 and content_id=$2',[alice,id])).rows[0].first_voted_at;
  r=await call(alice,'vote',{id,value:1});assert.equal(r.can_change,true);
  r=await call(alice,'vote',{id,value:-1});assert.equal(r.my_vote,-1);assert.equal(r.can_change,false);assert.equal(r.likes,undefined);
  r=await call(alice,'vote',{id,value:1});assert.equal(r.my_vote,-1);assert.equal(r.can_change,false);
  assert.deepEqual((await db.query('select first_voted_at from community_test.votes where user_id=$1 and content_id=$2',[alice,id])).rows[0].first_voted_at,before);
  const cards=await call(alice,'cards',{ids:[String(id)]});assert.equal(cards[id].vote.can_change,false);assert.equal(cards[id].vote.likes,undefined);
 }
});
test('existing expired votes and their totals are preserved; nonvoters cannot see totals',async()=>{
 const original=(await db.query('select * from community_test.votes_before_one_change_20261026')).rows[0];assert.equal(original.value,1);
 const r=await call(bob,'vote',{id:confession,value:-1});assert.equal(r.my_vote,1);assert.equal(r.can_change,false);assert.equal(r.likes,1);assert.equal(r.dislikes,1);
 assert.equal((await call(bob,'vote_status',{id:reply})).likes,undefined);
});
test('concurrent opposite requests cannot flip back twice',async()=>{
 const [a,b]=await Promise.all([call(bob,'vote',{id:comment,value:1}),call(bob,'vote',{id:comment,value:-1})]);assert.equal(a.my_vote,1);assert.equal(b.my_vote,-1);assert.equal((await call(bob,'vote',{id:comment,value:1})).my_vote,-1);
});
test('direct client table privileges remain denied and saved votes remain private',async()=>{
 for(const role of ['anon','authenticated','service_role']){await db.exec('set role '+role);try{await assert.rejects(db.query('select * from community_test.votes_before_one_change_20261026'),/permission denied/);}finally{await db.exec('reset role');}}
});
