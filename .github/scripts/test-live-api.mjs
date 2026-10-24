import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const box={window:{}};vm.runInNewContext(await readFile('test/config.js','utf8'),box);
const cfg=box.window.ISPOVESTI_CONFIG;
assert.equal(cfg.mode,'live-test');
const headers={apikey:cfg.publishableKey,'Content-Type':'application/json',Origin:'https://borjansaric.github.io'};
async function call(action,args={},token,expected=200){
 const r=await fetch(cfg.supabaseUrl+'/functions/v1/community-test-api',{method:'POST',headers:{...headers,...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify({action,args}),signal:AbortSignal.timeout(25000)});
 const d=await r.json();assert.equal(r.status,expected,`API ${action}: HTTP ${r.status}; ${d.error||'unexpected status'}`);return d;
}
async function anonymous(){
 const r=await fetch(cfg.supabaseUrl+'/auth/v1/signup',{method:'POST',headers,body:'{}',signal:AbortSignal.timeout(25000)});
 const d=await r.json();assert.equal(r.status,200,`Anonymous Auth HTTP ${r.status}: ${d.msg||d.message||d.error_description||'failed'}`);
 assert.equal(d.user?.is_anonymous,true);assert.ok(d.access_token);return d.access_token;
}
try{
 const feed=await call('feed');assert.ok(feed.items.length>=4);const id=String(feed.items[0].id);
 await call('favorite',{id,enabled:true},undefined,401);
 await call('vote',{id,value:1},'invalid-token',401);
 const a=await anonymous(),b=await anonymous();console.log('PASS: real anonymous Auth sessions and invalid-token rejection');
 const body='Automatska probna ispovijest za provjeru reda '+Date.now()+'.';
 const q=await call('submit',{kind:'confession',body},a);assert.ok(q.success);
 assert.ok(!(await call('feed')).items.some(x=>String(x.id)===String(q.id)));
 assert.equal((await call('submit',{kind:'confession',body},a)).duplicate,true);
 console.log('PASS: confession stays queued; duplicate warning works');
 const c=await call('submit',{kind:'comment',body:'Probni komentar automatske provjere.',confession_id:id},a);
 const reply=await call('submit',{kind:'reply',body:'Probni odgovor automatske provjere.',confession_id:id,parent_id:c.id},a);
 assert.ok((await call('comments',{confession_id:id})).items.some(x=>String(x.id)===String(c.id)));
 assert.ok((await call('comments',{confession_id:id,parent_id:c.id})).items.some(x=>String(x.id)===String(reply.id)));
 assert.ok((await call('context',{id},a)).comment_count>=1);assert.equal((await call('context',{id},b)).comment_count,null);
 console.log('PASS: comments, nested replies and per-user comment-count visibility');
 await call('favorite',{id,enabled:true},a);assert.ok((await call('list',{list:'favorites'},a)).items.some(x=>String(x.id)===id));
 assert.equal((await call('list',{list:'favorites',user_id:'forged-owner'},b)).items.length,0);
 assert.ok((await call('list',{list:'my_comments'},a)).items.length>=2);
 console.log('PASS: favorites, own history and isolation between two real users');
 for(const target of [id,c.id,reply.id]){
  const v=await call('vote',{id:target,value:1},a);assert.equal(v.my_vote,1);assert.equal(v.likes,undefined);
  const changed=await call('vote',{id:target,value:-1},a);assert.equal(changed.my_vote,-1);assert.equal(changed.dislikes,undefined);
  assert.equal((await call('vote_status',{id:target},b)).likes,undefined);
 }
 await call('report',{id,reason:'spam'},a);await call('report',{id,reason:'spam'},a);
 await call('admin_queue',{},a,403);
 const rpc=await fetch(cfg.supabaseUrl+'/rest/v1/rpc/community_test_dispatch',{method:'POST',headers,body:JSON.stringify({p_uid:null,p_action:'feed',p_args:{}}),signal:AbortSignal.timeout(25000)});
 assert.ok([401,403,404].includes(rpc.status),'Direct RPC must reject public client');
 console.log('PASS: voting and hidden early totals for all types, reports, admin denial and closed direct RPC');
 console.log('LIVE_SMOKE_SUCCESS');
}catch(e){console.error('LIVE_SMOKE_FAILED:',e.message);process.exitCode=1;}
