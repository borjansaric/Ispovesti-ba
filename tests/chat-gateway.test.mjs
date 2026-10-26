import {test} from 'node:test';import assert from 'node:assert/strict';import {createChatHandler} from '../chat/gateway.mjs';
const token='x.'+Buffer.from(JSON.stringify({sub:'verified-user',session_id:'verified-session',aal:'aal1'})).toString('base64url')+'.x';
function setup({trials=false,anonymous=true,valid=true,environment='test'}={}){const calls=[];const handler=createChatHandler({supabaseUrl:'https://mock.invalid',serviceKey:'server-secret',allowedOrigins:['https://allowed.invalid'],allowTrials:trials,environment,fetcher:async(url,o)=>{if(url.endsWith('/auth/v1/user'))return Response.json({id:'verified-user',is_anonymous:anonymous},{status:valid?200:401});calls.push(JSON.parse(o.body));return Response.json({success:true});}});const send=(action,args={},headers={})=>handler(new Request('https://api.invalid',{method:'POST',headers:{Origin:'https://allowed.invalid','Content-Type':'application/json',Authorization:'Bearer '+token,...headers},body:JSON.stringify({action,args})}));return {handler,send,calls};}
test('production defaults reject all trial writes even for signed in admins',async()=>{
 const x=setup({anonymous:false});for(const a of ['admin_test_mode','admin_grant','admin_nickname','admin_avatar'])assert.equal((await x.send(a)).status,403);assert.equal(x.calls.length,0);const wrongEnvironment=setup({trials:true,anonymous:false,environment:'production'});assert.equal((await wrongEnvironment.send('admin_grant')).status,403);
});
test('SMS trial codes are hashed, use verified session and are disabled outside test',async()=>{
 const code='TEST-ABCDEF-123456-ABCDEF-123456',x=setup({trials:true});
 assert.equal((await x.send('redeem_code',{code,p_session:'forged',code_hash:'forged',p_uid:'victim'})).status,200);
 assert.equal(x.calls[0].p_session,'verified-session');assert.match(x.calls[0].p_args.code_hash,/^[a-f0-9]{64}$/);assert.equal(x.calls[0].p_args.code,undefined);assert.equal(x.calls[0].p_args.p_uid,undefined);
 for(const action of ['admin_issue_code','redeem_code'])assert.equal((await setup({trials:true,environment:'production',anonymous:false}).send(action,{code})).status,403);
 assert.equal((await setup({trials:true,anonymous:false}).send('redeem_code',{code})).status,403);
 assert.equal((await x.send('redeem_code',{code:'bad'})).status,400);
});
test('verified identity and session replace forged body parameters; anonymous users cannot moderate',async()=>{
 let x=setup({trials:true});assert.equal((await x.send('admin_grant',{_session_id:'forged',_aal:'aal2'})).status,403);
 x=setup({trials:true,anonymous:false});assert.equal((await x.send('admin_grant',{target:'target',plan:'24h',request_id:'id',p_uid:'attacker',_session_id:'forged'})).status,200);
 assert.equal(x.calls[0].p_uid,'verified-user');assert.equal(x.calls[0].p_args._session_id,'verified-session');assert.equal(x.calls[0].p_args._aal,'aal1');assert.equal(x.calls[0].p_args.p_uid,undefined);
});
test('recovery stores only a digest and accepts no body-supplied hash or owner identity',async()=>{
 const x=setup();assert.equal((await x.send('recovery_set',{code:'a'.repeat(64),recovery_hash:'forged',user_id:'other'})).status,200);
 const args=x.calls[0].p_args;assert.match(args.recovery_hash,/^[a-f0-9]{64}$/);assert.notEqual(args.recovery_hash,'a'.repeat(64));assert.equal(args.code,undefined);assert.equal(args.user_id,undefined);
 assert.equal((await x.send('recover',{code:'short',new_code:'b'.repeat(64)})).status,400);
});
test('gateway rejects invalid login, cross origin, unknown private messages and large payload',async()=>{
 let x=setup({valid:false});assert.equal((await x.send('profile')).status,401);
 x=setup();assert.equal((await x.send('profile',{}, {Origin:'https://evil.invalid'})).status,403);assert.equal((await x.send('private_message')).status,400);
 assert.equal((await x.send('send',{body:'a'.repeat(9000)})).status,413);
 assert.equal((await x.send('profile',{}, {Authorization:''})).status,401);
});
test('every administrative action rejects an anonymous token before reaching SQL',async()=>{
 const x=setup({trials:true});
 for(const action of ['admin_status','admin_profiles','admin_test_mode','admin_grant','admin_nickname','admin_avatar','admin_messages','admin_remove','admin_restore','admin_ban','admin_unban']){
  assert.equal((await x.send(action,{p_uid:'owner',_session_id:'owner-session',_aal:'aal2',target:'other',enabled:true})).status,403,action);
 }
 assert.equal(x.calls.length,0);
});
test('Auth rejection cannot be bypassed with forged owner claims or browser identity fields',async()=>{
 const x=setup({trials:true,anonymous:false,valid:false});
 for(const action of ['profile','history','admin_grant','admin_nickname','admin_avatar'])assert.equal((await x.send(action,{p_uid:'owner',user_id:'owner',_session_id:'owner-session',_aal:'aal2'})).status,401);
 assert.equal(x.calls.length,0);
});
test('history and profile discard requested owner, history window, clock and privileged claims',async()=>{
 const x=setup();
 for(const action of ['profile','history']){
  const r=await x.send(action,{p_uid:'victim',user_id:'victim',target:'victim',history_hours:99999,expires_at:'2099-01-01',server_now:'2000-01-01',_session_id:'forged',_aal:'aal2'});
  assert.equal(r.status,200);assert.doesNotMatch(await r.text(),/server-secret/);
  assert.equal(x.calls.at(-1).p_uid,'verified-user');assert.deepEqual(x.calls.at(-1).p_args,{});
 }
});
test('registered ordinary accounts receive SQL authorization denial, never a browser-forged admin session',async()=>{
 let rpc;const handler=createChatHandler({supabaseUrl:'https://mock.invalid',serviceKey:'server-secret',allowedOrigins:[],allowTrials:true,environment:'test',fetcher:async(url,options)=>{
  if(url.endsWith('/auth/v1/user'))return Response.json({id:'ordinary-registered-user',is_anonymous:false});
  rpc=JSON.parse(options.body);return Response.json({code:'42501',message:'Zabranjena administratorska radnja.'},{status:403});
 }});
 for(const action of ['admin_grant','admin_nickname','admin_avatar','admin_profiles','admin_messages']){
  const r=await handler(new Request('https://api.invalid',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({p_uid:'owner',action,args:{p_uid:'owner',_session_id:'owner-session',_aal:'aal2'}})}));
  assert.equal(r.status,403);assert.equal(rpc.p_uid,'ordinary-registered-user');assert.equal(rpc.p_args._session_id,'verified-session');assert.equal(rpc.p_args._aal,'aal1');assert.doesNotMatch(await r.text(),/server-secret/);
 }
});
