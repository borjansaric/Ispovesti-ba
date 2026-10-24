import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
const alice='00000000-0000-0000-0000-000000000001',bob='00000000-0000-0000-0000-000000000002',admin='00000000-0000-0000-0000-000000000003';
const call=async(uid,action,args={})=>(await db.query('select public.community_dispatch($1::uuid,$2,$3::jsonb) r',[uid,action,JSON.stringify(action.startsWith('admin_')?{...args,_session_id:'00000000-0000-0000-0000-000000000004'}:args)])).rows[0].r;
let confession,comment,reply;
before(async()=>{
 await db.exec('create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);');
 await db.query('insert into auth.users values ($1),($2),($3)',[alice,bob,admin]);
 await db.query("insert into auth.sessions values('00000000-0000-0000-0000-000000000004',$1,null)",[admin]);
 await db.exec(await readFile(new URL('../supabase/migrations/20261023212548_community_v2.sql',import.meta.url),'utf8'));
});
after(()=>db.close());
test('confessions queue privately; no immediate public publishing',async()=>{
 confession=(await call(alice,'submit',{kind:'confession',body:'Ovo je prva izolovana ispovijest. 🙂'})).id;
 assert.deepEqual((await call(null,'feed')).items,[]);
 const q=await db.query('select state from community_private.content where id=$1',[confession]);assert.equal(q.rows[0].state,'queued');
 assert.equal((await db.query('select community_private.publish_one() id')).rows[0].id,null);
});
test('FIFO publishes at most one per hour, no catch-up burst',async()=>{
 await call(bob,'submit',{kind:'confession',body:'Ovo je druga izolovana ispovijest.'});
 await db.exec("update community_private.publisher set last_published_at=clock_timestamp()-interval '2 hours'");
 assert.equal(String((await db.query('select community_private.publish_one() id')).rows[0].id),confession);
 assert.equal((await db.query('select community_private.publish_one() id')).rows[0].id,null);
 assert.equal((await call(null,'feed')).items.length,1);
});
test('duplicate warns and permits explicitly repeated submission',async()=>{
 const a={kind:'confession',body:'Ovo je prva izolovana ispovijest. 🙂'};
 assert.equal((await call(alice,'submit',a)).duplicate,true);
 assert.equal((await call(alice,'submit',{...a,allow_duplicate:true})).success,true);
});
test('server validates character limits, links, nickname and forged identity',async()=>{
 for(const a of [{body:'a'.repeat(14)},{body:'a'.repeat(5001)},{body:'Pogledajte https://primjer.ba'},{body:'Pogledajte primjer.ba/test'},{body:'Pogledajte primjer.ba!'},{body:'Dovoljno dug tekst.',nickname:'www.test.ba'},{body:'Dovoljno dug tekst.',nickname:'a'.repeat(41)}]){
  await assert.rejects(call(bob,'submit',{kind:'confession',...a}));
 }
 await assert.rejects(call(null,'submit',{kind:'confession',body:'Dovoljno dug tekst.',user_id:alice}));
});
test('comments, replies, emoji and newlines; length and cross-confession parent check',async()=>{
 comment=(await call(alice,'submit',{kind:'comment',confession_id:confession,body:'Komentar\n🙂'})).id;
 reply=(await call(bob,'submit',{kind:'reply',confession_id:confession,parent_id:comment,body:'Odgovor 🙂'})).id;
 await assert.rejects(call(bob,'submit',{kind:'comment',confession_id:confession,body:'x'.repeat(1001)}));
 await assert.rejects(call(bob,'submit',{kind:'reply',confession_id:confession,parent_id:confession,body:'x'}));
 const r=await call(null,'comments',{confession_id:confession});assert.equal(r.items.length,1);assert.equal(r.items[0].has_replies,true);
});
test('comment totals only returned to people who commented on this confession',async()=>{
 assert.equal((await call(alice,'context',{id:confession})).comment_count,2);
 assert.equal((await call(admin,'context',{id:confession})).comment_count,null);
});
test('votes: hidden totals, change within ten minutes, immutable first timestamp, no unvote',async()=>{
 assert.deepEqual(await call(bob,'vote_status',{id:confession}),{my_vote:null});
 assert.deepEqual(await call(alice,'vote',{id:confession,value:1}),{my_vote:1});
 const first=(await db.query('select first_voted_at from community_private.votes where content_id=$1',[confession])).rows[0].first_voted_at;
 assert.deepEqual(await call(alice,'vote',{id:confession,value:-1}),{my_vote:-1});
 const second=(await db.query('select first_voted_at from community_private.votes where content_id=$1',[confession])).rows[0].first_voted_at;
 assert.equal(String(first),String(second));
 await assert.rejects(call(alice,'vote',{id:confession,value:0}));
 await db.query("update community_private.votes set first_voted_at=clock_timestamp()-interval '10 minutes' where content_id=$1",[confession]);
 const r=await call(alice,'vote',{id:confession,value:1});assert.deepEqual(r,{my_vote:-1,likes:0,dislikes:1});
 assert.deepEqual(await call(bob,'vote_status',{id:confession}),{my_vote:null});
});
test('identical voting rules apply to comments and replies',async()=>{
 for(const id of[comment,reply]){
  assert.deepEqual(await call(alice,'vote',{id,value:1}),{my_vote:1});
  await db.query("update community_private.votes set first_voted_at=clock_timestamp()-interval '11 minutes' where content_id=$1",[id]);
  assert.deepEqual(await call(alice,'vote',{id,value:-1}),{my_vote:1,likes:1,dislikes:0});
 }
});
test('private lists cannot be accessed via body-supplied user identity; history derived from ownership',async()=>{
 await call(alice,'favorite',{id:confession,enabled:true});
 assert.equal((await call(alice,'list',{list:'favorites'})).items.length,1);
 assert.equal((await call(bob,'list',{list:'favorites',user_id:alice})).items.length,0);
 assert.equal((await call(alice,'list',{list:'my_comments'})).items[0].id,comment);
 await assert.rejects(call(bob,'list',{list:'forged'}));
 await call(alice,'favorite',{id:confession,enabled:false});assert.equal((await call(alice,'list',{list:'favorites'})).items.length,0);
});
test('server caps recently read at 100 and refreshes ordering',async()=>{
 await db.query("insert into community_private.content(kind,author_id,body,state,published_at) select 'confession',$1,'Testna ispovijest broj '||n,'published',clock_timestamp() from generate_series(1,102) n",[admin]);
 const ids=(await db.query("select id::text id from community_private.content where author_id=$1 order by id",[admin])).rows;
 for(const{id}of ids)await call(alice,'read',{id});
 assert.equal((await db.query("select count(*)::int n from community_private.lists where user_id=$1 and kind='recently_read'",[alice])).rows[0].n,100);
 const r=await call(alice,'list',{list:'recently_read'});assert.equal(r.items[0].id,ids.at(-1).id);
});
test('reports deduplicate per account; reasons validated; admin access denied to regular users',async()=>{
 await call(alice,'report',{id:comment,reason:'spam'});await call(alice,'report',{id:comment,reason:'other'});
 assert.equal((await db.query('select count(*)::int n from community_private.reports')).rows[0].n,1);
 await assert.rejects(call(bob,'report',{id:comment,reason:'custom text'}));
 await assert.rejects(call(alice,'admin_list',{view:'reports',admin:true}));
 await db.query('insert into community_private.admins values($1)',[admin]);
 assert.equal((await call(admin,'admin_list',{view:'reports'})).items[0].id,comment);
});
test('soft removal hides full descendant tree and archives content',async()=>{
 await call(admin,'admin_remove',{id:comment});
 assert.equal((await call(null,'comments',{confession_id:confession})).items.length,0);
 await assert.rejects(call(bob,'vote_status',{id:reply}));
 assert.equal((await call(admin,'admin_list',{view:'archive'})).items[0].body,'Komentar\n🙂');
 await call(admin,'admin_remove',{id:confession});
 await assert.rejects(call(null,'confession',{id:confession}));
 assert.equal((await db.query('select count(*)::int n from community_private.audit_log')).rows[0].n,2);
});
test('all private tables have RLS, no direct client privileges, gateway cannot be called directly',async()=>{
 const r=await db.query("select relname,relrowsecurity from pg_class c join pg_namespace n on c.relnamespace=n.oid where n.nspname='community_private' and c.relkind='r'");assert.ok(r.rows.every(x=>x.relrowsecurity));
 await db.exec('set role authenticated');
 await assert.rejects(db.query('select * from community_private.content'));
 await assert.rejects(call(alice,'feed'));
 await db.exec('reset role');
 const f=await db.query("select prosecdef from pg_proc p join pg_namespace n on p.pronamespace=n.oid where n.nspname='community_private'");assert.ok(f.rows.every(x=>!x.prosecdef));
});
test('service role can dispatch and reads only the requested public fields',async()=>{
 await db.exec('set role service_role');const r=await call(null,'feed');assert.ok(r.items.length);
 assert.ok(r.items.every(x=>!('rank'in x)&&!('author_id'in x)&&!('state'in x)));
 await db.exec('reset role');
});
test('rate limiting is enforced transactionally in SQL',async()=>{
 await db.query("delete from community_private.rate_limits where user_id=$1 and action='reports'",[bob]);
 const id=(await db.query("select id from community_private.content where state='published' and kind='confession' limit 1")).rows[0].id;
 for(let i=0;i<20;i++)await call(bob,'report',{id:String(id),reason:'spam'});
 await assert.rejects(call(bob,'report',{id:String(id),reason:'spam'}),/Previše/);
});
test('public feed ordering and 20 item pagination exclude all queued confessions',async()=>{
 const old=(await call(null,'feed',{sort:'oldest'})).items;
 const next=(await call(null,'feed',{sort:'oldest',offset:20})).items;
 assert.equal(old.length,20);assert.equal(next.length,20);assert.ok(!next.some(x=>old.some(y=>y.id===x.id)));
 const news=(await call(null,'feed',{sort:'new'})).items;
 assert.ok(Date.parse(news[0].published_at)>=Date.parse(news.at(-1).published_at));
 const id=next[0].id;await call(bob,'vote',{id,value:-1});
 assert.equal((await call(null,'feed',{sort:'popular'})).items[0].id,id);
});
test('comments paginate by 20 top-level items, oldest first',async()=>{
 const id=(await call(null,'feed')).items[0].id;
 await db.query("insert into community_private.content(kind,author_id,body,state,confession_id,published_at) select 'comment',$1,'Testni komentar '||n,'published',$2,clock_timestamp() from generate_series(1,23) n",[admin,id]);
 const first=(await call(null,'comments',{confession_id:id})).items,second=(await call(null,'comments',{confession_id:id,offset:20})).items;
 assert.equal(first.length,20);assert.equal(second.length,3);assert.equal(first[0].body,'Testni komentar 1');
});
test('batched card state preserves per-user privacy and ten minute vote gating',async()=>{
 const id=(await call(null,'feed')).items[0].id;
 const batch=await call(alice,'cards',{ids:[id]});assert.ok(batch[id]);assert.deepEqual(batch[id].vote,{my_vote:null});assert.equal(batch[id].context.comment_count,null);
 await assert.rejects(call(alice,'cards',{ids:Array(21).fill(id)}));
});
test('publisher pause prevents publication; resume does not bypass interval',async()=>{
 await call(admin,'admin_publisher',{paused:true});
 await db.exec("update community_private.publisher set last_published_at=clock_timestamp()-interval '2 hours'");
 assert.equal((await db.query('select community_private.publish_one() id')).rows[0].id,null);
 await call(admin,'admin_publisher',{paused:false});assert.ok((await db.query('select community_private.publish_one() id')).rows[0].id);
 assert.equal((await db.query('select community_private.publish_one() id')).rows[0].id,null);
});
test('revoked admin session denied even with membership; service role can validate active session',async()=>{
 await db.exec('set role service_role');await call(admin,'admin_list',{view:'archive'});await db.exec('reset role');
 await db.exec('delete from auth.sessions');await assert.rejects(call(admin,'admin_list',{view:'archive'}),/sesija/);
});
test('server trims Unicode whitespace before length validation and duplicate detection',async()=>{
 for(const space of['\n','\t','\u00a0','\u2003','\ufeff']){
  await assert.rejects(call(bob,'submit',{kind:'confession',body:space.repeat(20)}),/dužine/);
 }
 const id=(await call(null,'feed')).items[0].id;
 const r=await call(bob,'submit',{kind:'comment',confession_id:id,body:'\n\t Koristan komentar sa novim redom.\n🙂 \u00a0',nickname:'\u2003 Ime \ufeff'});
 const saved=(await db.query('select body,nickname from community_private.content where id=$1',[r.id])).rows[0];
 assert.equal(saved.body,'Koristan komentar sa novim redom.\n🙂');assert.equal(saved.nickname,'Ime');
 const duplicate=await call(bob,'submit',{kind:'comment',confession_id:id,body:'Koristan komentar sa novim redom.\n🙂'});assert.equal(duplicate.duplicate,true);
});
