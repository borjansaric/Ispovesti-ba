import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
const owner='00000000-0000-4000-8000-000000000021',bob='00000000-0000-4000-8000-000000000022',anon='00000000-0000-4000-8000-000000000023';
const sid='00000000-0000-4000-8000-000000000024',bobSid='00000000-0000-4000-8000-000000000025';
const code='A'.repeat(43),email='owner@example.invalid';let otpCalls=0,verifyCalls=0,factorDeletes=0,otpOffline=false,handler,cfResult,cfCalls=0,authCreates=0,dispatchCalls=0;const used=new Set(),sqlPayloads=[];
const token=(id=owner,aal='aal2',session_id=sid)=>'e30.'+Buffer.from(JSON.stringify({sub:id,aal,session_id,amr:[{method:'password',timestamp:Math.floor(Date.now()/1000)}]})).toString('base64url')+'.signed';
const sql=async(uid,action,args={})=>(await db.query('select public.community_test_dispatch($1::uuid,$2,$3::jsonb) r',[uid,action,JSON.stringify(args)])).rows[0].r;
const adminArgs=extra=>({_session_id:sid,_aal:'aal2',...extra});
async function security(uid,action,args={}){return(await db.query('select public.community_test_security($1::uuid,$2,$3::jsonb) r',[uid,action,JSON.stringify(args)])).rows[0].r;}
async function send(action,args={},jwt=token()){
 const r=await handler(new Request('https://gateway.invalid',{method:'POST',headers:{Origin:'https://allowed.invalid',...(jwt?{Authorization:'Bearer '+jwt}:{})},body:JSON.stringify({action,args})}));return{status:r.status,body:await r.json()};
}
before(async()=>{
 await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,is_anonymous boolean default false,email_confirmed_at timestamptz default now(),encrypted_password text);create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);");
 await db.exec(await readFile(new URL('../supabase/migrations/20261023212548_community_v2.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/admin-captcha.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/admin-email.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/comments-response.sql',import.meta.url),'utf8'));
 await db.query("insert into auth.users(id,email,is_anonymous) values($1,'bob@example.invalid',false),($2,null,true)",[bob,anon]);
 await db.query('insert into auth.sessions values($1,$2,null),($3,$4,null)',[sid,owner,bobSid,bob]);
 const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(code));
 await db.query("update community_test.security_settings set owner_email=$1,activation_hash=$2,activation_expires_at=clock_timestamp()+interval '1 day'",[email,Buffer.from(hash).toString('hex')]);
 const source=stripTypeScriptTypes(await readFile(new URL('../supabase/functions/community-api/index.ts',import.meta.url),'utf8'));
 vm.runInNewContext(source,{Request,Response,Uint8Array,TextDecoder,TextEncoder,JSON,Set,AbortSignal,SyntaxError,atob,btoa,crypto,
  Deno:{env:{get:k=>({SUPABASE_URL:'https://isolated.invalid',SUPABASE_SERVICE_ROLE_KEY:'local-server-only-key',ALLOWED_ORIGINS:'https://allowed.invalid'})[k]},serve:f=>handler=f},
  fetch:async(url,options)=>{
   if(url==='https://challenges.cloudflare.com/turnstile/v0/siteverify'){
    cfCalls++;if(cfResult instanceof Error)throw cfResult;const payload=JSON.parse(options.body);
    if(used.has(payload.response))return Response.json({success:false,'error-codes':['timeout-or-duplicate']});
    if(cfResult?.success)used.add(payload.response);return Response.json(cfResult||{success:false});
   }
   if(url.endsWith('/auth/v1/user')){
    const jwt=options.headers.Authorization?.slice(7);try{const p=JSON.parse(Buffer.from(jwt.split('.')[1],'base64url').toString());if(![owner,bob,anon].includes(p.sub))throw Error();return Response.json({id:p.sub,is_anonymous:p.sub===anon,email_confirmed_at:p.sub===anon?null:new Date().toISOString()});}catch{return Response.json({error:'invalid'},{status:401});}
   }
   if(url.endsWith('/auth/v1/otp')){otpCalls++;const a=JSON.parse(options.body);assert.equal(a.email,email);assert.equal(a.create_user,false);return Response.json({}, {status:otpOffline?503:200});}
   if(url.endsWith('/auth/v1/verify')){verifyCalls++;const a=JSON.parse(options.body);assert.equal(a.email,email);assert.equal(a.type,'email');return a.token==='654321'?Response.json({user:{id:owner,email,is_anonymous:false,email_confirmed_at:new Date().toISOString()}}):Response.json({error:'invalid'},{status:403});}
   if(url.includes('/auth/v1/admin/users/')&&url.endsWith('/factors/old-totp')){factorDeletes++;assert.equal(options.method,'DELETE');return Response.json({id:'old-totp'});}
   if(url.endsWith('/auth/v1/admin/users/'+owner)){return Response.json({id:owner,factors:factorDeletes?[]:[{id:'old-totp',factor_type:'totp',status:'unverified'}]});}
   if(url.endsWith('/auth/v1/admin/users')){
    authCreates++;const a=JSON.parse(options.body);assert.equal(a.email,email);assert.equal(a.email_confirm,true);assert.ok(a.password.length>=12);
    await db.query('insert into auth.users(id,email,is_anonymous) values($1,$2,false)',[owner,email]);return Response.json({id:owner,email,is_anonymous:false,email_confirmed_at:new Date().toISOString()});
   }
   const name=url.endsWith('/community_test_admin_email')?'community_test_admin_email':url.endsWith('/community_test_security')?'community_test_security':url.endsWith('/community_test_dispatch')?'community_test_dispatch':null;
   if(!name)throw Error('Unexpected external request');
   const a=JSON.parse(options.body);sqlPayloads.push(a);if(name==='community_test_dispatch')dispatchCalls++;
   try{await db.exec('set role service_role');const r=await db.query('select public.'+name+'($1::uuid,$2,$3::jsonb) r',[a.p_uid,a.p_action,JSON.stringify(a.p_args)]);return Response.json(r.rows[0].r);}catch(e){return Response.json({code:e.code,message:e.message},{status:400});}finally{await db.exec('reset role');}
  }
 });
});
after(()=>db.close());
test('activation is owner-bound, secret-protected, single-use and never writes password/code into SQL',async()=>{
 assert.equal((await send('activate_admin',{code:'B'.repeat(43),email,password:'long secure password'},null)).status,403);assert.equal(authCreates,0);
 assert.equal((await send('activate_admin',{code,email:'attacker@example.invalid',password:'long secure password'},null)).status,403);assert.equal(authCreates,0);
 const r=await send('activate_admin',{code,email,password:'long secure password'},null);assert.deepEqual(r,{status:200,body:{success:true}});
 assert.equal((await db.query('select count(*)::int n from community_test.admins')).rows[0].n,1);
 assert.equal((await send('activate_admin',{code,email,password:'long secure password'},null)).status,403);assert.equal(authCreates,1);
 assert.ok(!JSON.stringify(sqlPayloads).includes('long secure password'));assert.ok(!JSON.stringify(sqlPayloads).includes(code));
 await assert.rejects(db.query('insert into community_test.admins values($1)',[bob]),/unique/);
});
test('rollout preserves existing TOTP and switches to email only after verified owner code',async()=>{
 assert.equal((await db.query('select admin_auth_method from community_test.security_settings')).rows[0].admin_auth_method,'totp');
 assert.equal((await send('admin_list',{view:'reports'})).status,200);
});
test('email step cannot be skipped with forged args or a non-owner; password is mandatory',async()=>{
 assert.equal((await send('admin_list',{view:'reports',_aal:'aal2',verified:true},token(owner,'aal1'))).status,403);
 assert.equal((await send('admin_security_get',{},token(owner,'aal1'))).status,403);
 assert.equal((await send('admin_email_begin',{},token(bob,'aal1',bobSid))).status,403);
 assert.equal(otpCalls,0);
 const passwordless='e30.'+Buffer.from(JSON.stringify({sub:owner,aal:'aal1',session_id:sid,amr:[{method:'otp',timestamp:Math.floor(Date.now()/1000)}]})).toString('base64url')+'.signed';
 assert.equal((await send('admin_email_begin',{},passwordless)).status,403);
 assert.equal((await send('admin_session',{},token(owner,'aal1'))).body.admin,true);
});
let challenge;
test('only the owner can send a code; cooldown and hash-only storage are enforced',async()=>{
 const result=await send('admin_email_begin');assert.equal(result.status,200);challenge=result.body.challenge;
 assert.match(challenge,/^[A-Za-z0-9_-]{43}$/);assert.equal(otpCalls,1);
 assert.equal((await send('admin_email_begin')).status,429);assert.equal(otpCalls,1);
 const stored=(await db.query('select * from community_test.admin_email_sessions')).rows[0];assert.notEqual(stored.challenge_hash,challenge);assert.equal(stored.challenge_hash.length,64);
 assert.ok(!JSON.stringify(sqlPayloads).includes(challenge));
});
test('wrong code consumes a persistent attempt; wrong challenge does not call Auth verification',async()=>{
 assert.equal((await send('admin_email_verify',{challenge:'B'.repeat(43),code:'654321'})).status,403);assert.equal(verifyCalls,0);
 assert.equal((await send('admin_email_verify',{challenge,code:'000000'})).status,403);assert.equal(verifyCalls,1);
 assert.equal((await db.query('select attempts from community_test.admin_email_sessions')).rows[0].attempts,1);
 assert.equal((await send('admin_list',{view:'reports'},token(owner,'aal1'))).status,403);assert.equal(factorDeletes,0);
});
test('five incorrect attempts block valid codes; expired challenges and unavailable email fail closed',async()=>{
 await db.exec('update community_test.admin_email_sessions set attempts=5');
 const n=verifyCalls;assert.equal((await send('admin_email_verify',{challenge,code:'654321'})).status,403);assert.equal(verifyCalls,n);
 await db.exec("update community_test.admin_email_sessions set attempts=0,expires_at=clock_timestamp()-interval '1 second'");
 assert.equal((await send('admin_email_verify',{challenge,code:'654321'})).status,403);assert.equal(verifyCalls,n);
 await db.exec("update community_test.admin_email_sessions set issued_at=clock_timestamp()-interval '2 minutes'");
 otpOffline=true;assert.equal((await send('admin_email_begin')).status,503);otpOffline=false;
 assert.equal((await send('admin_email_status')).body.verified,false);
 await db.exec("update community_test.admin_email_sessions set issued_at=clock_timestamp()-interval '2 minutes'");
 challenge=(await send('admin_email_begin')).body.challenge;
});
test('successful email verification retires old TOTP only after code proof, and consumes the challenge',async()=>{
 assert.deepEqual((await send('admin_email_verify',{challenge,code:'654321'})).body,{verified:true});assert.equal(factorDeletes,1);
 assert.equal((await send('admin_email_status')).body.verified,true);
 const n=verifyCalls;assert.equal((await send('admin_email_verify',{challenge,code:'654321'})).status,403);assert.equal(verifyCalls,n);
 assert.ok(!JSON.stringify(sqlPayloads).includes('654321'));
});
test('after successful email code old AAL2-only sessions no longer authorize administration',async()=>{
 assert.equal((await db.query('select admin_auth_method from community_test.security_settings')).rows[0].admin_auth_method,'email');
 const otherSid='00000000-0000-4000-8000-000000000099';await db.query('insert into auth.sessions values($1,$2,null)',[otherSid,owner]);
 assert.equal((await send('admin_list',{view:'reports'},token(owner,'aal2',otherSid))).status,403);
});
test('server proof is session-bound, expires, and cannot survive session revocation or bypass table/RPC ACLs',async()=>{
 assert.equal((await send('admin_list',{view:'reports'},token(anon))).status,403);
 assert.equal((await send('admin_list',{view:'reports'},token(bob,'aal2',bobSid))).status,403);
 assert.equal((await send('admin_list',{view:'reports',_session_id:bobSid},token(owner,'aal1'))).status,200);
 await db.exec("update community_test.admin_email_sessions set verified_until=clock_timestamp()-interval '1 second'");
 assert.equal((await send('admin_list',{view:'reports'})).status,403);
 await db.exec("update community_test.admin_email_sessions set verified_until=clock_timestamp()+interval '1 hour'");
 await db.query("update auth.sessions set not_after=clock_timestamp()-interval '1 second' where id=$1",[sid]);
 assert.equal((await send('admin_security_get')).status,403);await db.query('update auth.sessions set not_after=null where id=$1',[sid]);
 const permissions=(await db.query("select has_table_privilege('authenticated','community_test.admin_email_sessions','SELECT') as table_access,has_function_privilege('authenticated','public.community_test_admin_email(uuid,text,jsonb)','EXECUTE') as rpc_access")).rows[0];assert.deepEqual(permissions,{table_access:false,rpc_access:false});
});
let confession,comment,reply;
test('reports include all content types; removal/restoration preserves independently removed descendants',async()=>{
 confession=(await sql(bob,'submit',{kind:'confession',body:'Ispovijest za stvarnu SQL provjeru administracije.'})).id;
 await db.exec("update community_test.publisher set last_published_at=clock_timestamp()-interval '2 hours';select community_test.publish_one();");
 comment=(await sql(bob,'submit',{kind:'comment',confession_id:confession,body:'Komentar za provjeru.'})).id;
 reply=(await sql(bob,'submit',{kind:'reply',confession_id:confession,parent_id:comment,body:'Odgovor za provjeru.'})).id;
 for(const id of [confession,comment,reply])await sql(bob,'report',{id,reason:'spam'});
 assert.equal((await send('admin_list',{view:'reports'})).body.items.length,3);
 await send('admin_remove',{id:reply});await send('admin_remove',{id:confession});
 assert.equal((await sql(null,'feed')).items.length,0);assert.equal((await send('admin_list',{view:'archive'})).body.items.length,3);
 assert.equal((await send('admin_restore',{id:confession})).body.visible,true);
 assert.equal((await sql(null,'comments',{confession_id:confession,parent_id:comment})).items.length,0);
 await send('admin_restore',{id:reply});assert.equal((await sql(null,'comments',{confession_id:confession,parent_id:comment})).items.length,1);
 assert.equal((await db.query("select count(*)::int n from community_test.audit_log where action='restore'")).rows[0].n,2);
});
test('restoring a queued confession cannot publish it early',async()=>{
 const queued=(await sql(bob,'submit',{kind:'confession',body:'Druga ispovijest i dalje mora čekati u redu.'})).id;
 await send('admin_remove',{id:queued});const restored=await send('admin_restore',{id:queued});assert.equal(restored.body.state,'queued');assert.equal(restored.body.visible,false);
});
const pass=(action='admin_check',extra={})=>({success:true,hostname:'borjansaric.github.io',action,challenge_ts:new Date().toISOString(),...extra});
test('CAPTCHA cannot activate with dummy keys, invalid proof, or a non-admin; valid proof encrypts the secret',async()=>{
 assert.equal((await send('admin_security_set',{enabled:true,sitekey:'1x00000000000000000000AA',secret:'real-private-secret',captcha_token:'t'})).status,400);
 cfResult={success:false};assert.equal((await send('admin_security_set',{enabled:true,sitekey:'real-site-key-123',secret:'real-private-secret',captcha_token:'invalid'})).status,400);
 cfResult=pass();const r=await send('admin_security_set',{enabled:true,sitekey:'real-site-key-123',secret:'real-private-secret',captcha_token:'activate-valid'});assert.equal(r.status,200);assert.equal(r.body.enabled,true);
 const s=(await db.query('select * from community_test.security_settings')).rows[0];assert.ok(s.captcha_secret_ciphertext.startsWith('v1:'));assert.ok(!s.captcha_secret_ciphertext.includes('real-private-secret'));
 assert.ok(!JSON.stringify(sqlPayloads).includes('real-private-secret'));
 const pub=await send('captcha_config',{},null);assert.deepEqual(Object.keys(pub.body).sort(),['enabled','sitekey']);assert.ok(!JSON.stringify(pub).includes('secret'));
 const settings=await send('admin_security_get');assert.equal(settings.body.secret_set,true);assert.ok(!('secret_ciphertext' in settings.body));
});
test('enabled CAPTCHA rejects absent tokens, wrong hostname/action, expiration, provider failure and network failure',async()=>{
 const args={kind:'comment',confession_id:confession,body:'Zaštićeni komentar.'};
 assert.equal((await send('submit',args,token(bob,'aal1',bobSid))).status,400);
 for(const result of [{success:false},pass('submit_comment',{hostname:'evil.invalid'}),pass('submit_reply'),pass('submit_comment',{challenge_ts:new Date(Date.now()-301000).toISOString()})]){
  cfResult=result;const before=dispatchCalls;assert.equal((await send('submit',{...args,captcha_token:crypto.randomUUID()},token(bob,'aal1',bobSid))).status,400);assert.equal(dispatchCalls,before);
 }
 cfResult=new Error('offline');assert.equal((await send('submit',{...args,captcha_token:'network'},token(bob,'aal1',bobSid))).status,503);
});
test('real server path verifies all three submit types and rejects token replay',async()=>{
 for(const kind of ['confession','comment','reply']){
  cfResult=pass('submit_'+kind);const args={kind,body:kind==='confession'?'Nova zaštićena ispovijest koja čeka red.':'Zaštićen probni tekst.',confession_id:kind==='confession'?undefined:confession,parent_id:kind==='reply'?comment:undefined,captcha_token:'valid-'+kind};
  const r=await send('submit',args,token(bob,'aal1',bobSid));assert.equal(r.status,200);assert.equal(r.body.success,true);
  assert.equal((await send('submit',args,token(bob,'aal1',bobSid))).status,400);
  assert.ok(!('captcha_token' in sqlPayloads.at(-1).p_args));
 }
});
test('CAPTCHA can be disabled by owner without provider availability and cannot be bypassed by ordinary users',async()=>{
 cfResult=new Error('offline');assert.equal((await send('admin_security_set',{enabled:false},token(bob,'aal2',bobSid))).status,403);
 assert.equal((await send('admin_security_set',{enabled:false})).status,200);
 const before=cfCalls;assert.equal((await send('submit',{kind:'comment',confession_id:confession,body:'Komentar nakon isključivanja zaštite.'},token(bob,'aal1',bobSid))).status,200);assert.equal(cfCalls,before);
 await db.exec('set role anon');await assert.rejects(security(null,'runtime_config'));await assert.rejects(sql(owner,'admin_session',adminArgs({})));await db.exec('reset role');
});

test('gateway has no extra access to the shared Auth user table',async()=>{await db.exec('set role service_role');try{await assert.rejects(db.query('select id,email,is_anonymous,email_confirmed_at from auth.users'),/permission denied/);await assert.rejects(db.query('select encrypted_password from auth.users'),/permission denied/);}finally{await db.exec('reset role');}});

test('successful submission returns the committed safe comment and private caller context in one response',async()=>{
 const args={kind:'comment',confession_id:confession,body:'  Potvrđen komentar. 🙂\nDrugi red.  ',nickname:'  Nadimak  '};
 const result=await sql(owner,'submit',args);
 assert.equal(result.success,true);assert.equal(result.item.id,result.id);assert.equal(result.item.body,args.body.trim());assert.equal(result.item.nickname,'Nadimak');
 assert.deepEqual(Object.keys(result.item).sort(),['body','created_at','has_replies','id','nickname','parent_id']);
 const row=(await db.query('select body,nickname,created_at from community_test.content where id=$1',[result.id])).rows[0];
 assert.equal(result.item.body,row.body);assert.equal(Date.parse(result.item.created_at),new Date(row.created_at).getTime());
 assert.deepEqual(result.context,await sql(owner,'context',{id:confession}));assert.ok(result.context.comment_count>0);
 const duplicate=await sql(owner,'submit',args);assert.deepEqual(duplicate,{duplicate:true});
});
test('reply receipt is correctly nested and includes no identities or premature vote totals',async()=>{
 const result=await sql(owner,'submit',{kind:'reply',confession_id:confession,parent_id:comment,body:'Odgovor koji je odmah spreman za prikaz.'});
 assert.equal(result.success,true);assert.equal(result.item.parent_id,comment);assert.equal(result.item.has_replies,false);
 for(const key of ['author_id','user_id','state','likes','dislikes','removed_at'])assert.equal(key in result.item,false);
 assert.deepEqual(result.context,await sql(owner,'context',{id:confession}));
});
test('queued confession receipt cannot be mistaken for an immediately published comment',async()=>{
 const result=await sql(owner,'submit',{kind:'confession',body:'Ova nova ispovijest i dalje čeka svoj red za objavljivanje.'});
 assert.equal(result.success,true);assert.equal('item' in result,false);assert.equal('context' in result,false);
 assert.ok(!(await sql(null,'feed')).items.some(i=>i.id===result.id));
});
