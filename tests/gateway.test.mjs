import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';
const source=stripTypeScriptTypes(await readFile(new URL('../supabase/functions/community-api/index.ts',import.meta.url),'utf8'));
function gateway(auth={id:'verified-user',is_anonymous:true},claims={}){
 let handler,calls=[];
 const sandbox={Request,Response,Uint8Array,TextDecoder,JSON,Set,Record:undefined,AbortSignal,SyntaxError,atob,
  Deno:{env:{get:k=>({SUPABASE_URL:'https://isolated.invalid',SUPABASE_SERVICE_ROLE_KEY:'server-only-key',ALLOWED_ORIGINS:'https://allowed.invalid'})[k]},serve:f=>handler=f},
  fetch:async(url,opts)=>{calls.push({url,opts});return url.endsWith('/auth/v1/user')?Response.json(auth,{status:auth.id?200:401}):Response.json({success:true});},
 };
 vm.runInNewContext(source,sandbox);
 const token='e30.'+Buffer.from(JSON.stringify(claims)).toString('base64url')+'.signed';
 return{calls,token,send:(body,authorization,origin='https://allowed.invalid',method='POST')=>handler(new Request('https://gateway.invalid',{method,headers:{Origin:origin,...(authorization?{Authorization:authorization}:{})},...(method==='POST'?{body:typeof body==='string'?body:JSON.stringify(body)}:{})}))};
}
test('gateway: rejects disallowed origins, non-POST, invalid JSON and oversized bodies',async()=>{
 const g=gateway();assert.equal((await g.send({action:'feed'},null,'https://evil.invalid')).status,403);
 assert.equal((await g.send(null,null,'https://allowed.invalid','GET')).status,405);
 assert.equal((await g.send('{bad')).status,400);
 assert.equal((await g.send('x'.repeat(33000))).status,413);
 assert.equal(g.calls.length,0);
});
test('gateway: anonymous public reads do not create Auth users; no-store responses',async()=>{
 const g=gateway();const r=await g.send({action:'feed'});assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');
 assert.equal(g.calls.length,1);assert.equal(JSON.parse(g.calls[0].opts.body).p_uid,null);
});
test('gateway: no arbitrary voter key or body user ID can replace verified identity',async()=>{
 const g=gateway();assert.equal((await g.send({action:'vote',args:{id:'1',value:1,user_id:'victim',voter_key:'forged'}})).status,401);
 assert.equal((await g.send({action:'vote',p_uid:'victim',args:{id:'1',value:1,user_id:'victim',voter_key:'forged'}},'Bearer '+g.token)).status,200);
 const sent=JSON.parse(g.calls.at(-1).opts.body);assert.equal(sent.p_uid,'verified-user');
});
test('gateway: rejects invalid auth tokens and anonymous admin attempts',async()=>{
 const invalid=gateway({});assert.equal((await invalid.send({action:'vote'},'Bearer wrong')).status,401);
 const g=gateway();assert.equal((await g.send({action:'admin_list'},'Bearer '+g.token)).status,403);
 assert.equal(g.calls.length,1);
});
test('gateway: admin requires AAL2 and a server-verified session ID; body cannot override',async()=>{
 const low=gateway({id:'admin',is_anonymous:false},{aal:'aal1',session_id:'real-session'});
 assert.equal((await low.send({action:'admin_list'},'Bearer '+low.token)).status,403);
 const g=gateway({id:'admin',is_anonymous:false},{aal:'aal2',session_id:'real-session'});
 assert.equal((await g.send({action:'admin_list',args:{_session_id:'forged'}},'Bearer '+g.token)).status,200);
 const payload=JSON.parse(g.calls.at(-1).opts.body);assert.equal(payload.p_args._session_id,'real-session');
});
