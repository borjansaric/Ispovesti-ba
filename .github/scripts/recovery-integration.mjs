import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {recoveryHandler} from '../../admin-recovery/handler.mjs';
import {sandboxLogin} from '../../admin-recovery/sandbox/login-handler.mjs';

const base=process.env.API_URL, anon=process.env.ANON_KEY, service=process.env.SERVICE_ROLE_KEY, dburl=process.env.DB_URL;
assert.match(base,/^http:\/\/(localhost|127\.0\.0\.1):\d+$/); assert.match(dburl,/^postgres(?:ql)?:\/\/postgres:[^@]+@(localhost|127\.0\.0\.1):\d+\/postgres$/);
const email='recovery-probe@example.test', oldPassword='Local-probe-Old-Password-729!', newPassword='Local-probe-New-Password-441!';
async function api(path,{body,token=service,key=service,method='POST'}={}){const r=await fetch(base+path,{method,headers:{apikey:key,authorization:'Bearer '+token,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})}); const t=await r.text();if(!r.ok) throw Error(path+' failed '+r.status);return t?JSON.parse(t):{};}
const user=await api('/auth/v1/admin/users',{body:{email,password:oldPassword,email_confirm:true}});assert.ok(user.id);
function sql(query){return execFileSync('psql',[dburl,'-X','-v','ON_ERROR_STOP=1','-q','-c',query],{stdio:['ignore','pipe','pipe']}).toString()}
const setup=readFileSync('admin-recovery/sandbox/prepare-isolated.sql','utf8');
execFileSync('psql',[dburl,'-X','-v','ON_ERROR_STOP=1','-q'],{input:`select set_config('ispovesti.sandbox_approval','isolated-admin-recovery-v1',false),set_config('ispovesti.sandbox_owner_uid','${user.id}',false);\n${setup}`,stdio:['pipe','pipe','pipe']});
await new Promise(r=>setTimeout(r,1500));
const rpc=(name,args)=>api('/rest/v1/rpc/'+name,{body:args});
const store=(action,args)=>rpc('recovery_sandbox_admin_recovery',{p_action:action,p_args:args});
const passwordLogin=pass=>api('/auth/v1/token?grant_type=password',{body:{email,password:pass},key:anon,token:anon});
const getUser=async id=>api('/auth/v1/admin/users/'+id,{method:'GET'});
const auth={getUser,updatePassword:async(id,password)=>api('/auth/v1/admin/users/'+id,{method:'PUT',body:{password}}),revokeAll:async(id,e,password)=>{const s=await passwordLogin(password);assert.equal(s.user.id,id);await api('/auth/v1/logout?scope=global',{token:s.access_token,key:anon,body:{}})}};
let sent=[], captchaPass=true, failMail=false, failUpdate=false;
const handler=recoveryHandler({config:{enabled:true,authResetApproved:true,ownerUID:user.id,linkURL:'https://probe.invalid/test/admin-recovery.html'},store,auth:{...auth,updatePassword:async(...args)=>{if(failUpdate)throw Error('simulated provider failure');return auth.updatePassword(...args)}},mail:{send:async m=>{if(failMail)throw Error('simulated mail failure');sent.push(m)}},captcha:{verify:async()=>captchaPass},delay:async()=>{}});
const origin='https://probe.invalid'; const req=(action,other={})=>handler(new Request(origin+'/api',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({action,...other})}));
const count=()=>sent.length, token=()=>new URL(sent.at(-1).link).hash.slice(7);
const resetLimit=()=>sql("update recovery_sandbox.admin_recovery set issued_at=clock_timestamp()-interval '61 seconds'");
const session=await passwordLogin(oldPassword); const sessionId=JSON.parse(Buffer.from(session.access_token.split('.')[1],'base64url')).session_id;
captchaPass=false;assert.equal((await req('request',{email,captcha_token:'x'})).status,400);assert.equal(count(),0);captchaPass=true;
let a=await req('request',{email:'unknown@example.test',captcha_token:'x'});assert.equal(a.status,200);assert.equal(count(),0);
a=await req('request',{email,captcha_token:'x'});assert.equal(a.status,200);assert.equal(count(),1);let expired=token();
await req('request',{email,captcha_token:'x'});assert.equal(count(),1,'cooldown');
sql("update recovery_sandbox.admin_recovery set expires_at=clock_timestamp()-interval '1 second',issued_at=clock_timestamp()-interval '61 seconds'");
assert.equal((await req('complete',{token:expired,password:newPassword})).status,400,'expired token');
await req('request',{email,captcha_token:'x'});assert.equal(count(),2);const good=token();
const result=await req('complete',{token:good,password:newPassword});assert.equal(result.status,200);assert.equal((await result.json()).success,true);
assert.equal((await req('complete',{token:good,password:newPassword})).status,400,'single use');
await assert.rejects(passwordLogin(oldPassword));const fresh=await passwordLogin(newPassword);assert.equal(fresh.user.id,user.id);
await assert.rejects(rpc('recovery_sandbox_login',{p_uid:user.id,p_action:'session',p_args:{_session_id:sessionId}}));
const freshId=JSON.parse(Buffer.from(fresh.access_token.split('.')[1],'base64url')).session_id;
await assert.rejects(rpc('recovery_sandbox_login',{p_uid:user.id,p_action:'panel',p_args:{_session_id:freshId}}));
const login=sandboxLogin({origin,ownerUID:user.id,rpc:(kind,uid,action,args)=>rpc(kind==='email'?'recovery_sandbox_admin_email':'recovery_sandbox_login',{p_uid:uid,p_action:action,p_args:args}),auth:{getUser:async jwt=>api('/auth/v1/user',{method:'GET',token:jwt,key:anon}),sendOtp:async e=>api('/auth/v1/otp',{key:anon,token:anon,body:{email:e,create_user:false}}),verifyOtp:async(e,code)=>{try{return (await api('/auth/v1/verify',{key:anon,token:anon,body:{email:e,token:code,type:'email'}})).user}catch{return null}}}});
const loginReq=(action,args)=>login(new Request(origin+'/login',{method:'POST',headers:{origin,authorization:'Bearer '+fresh.access_token,'content-type':'application/json'},body:JSON.stringify({action,args})}));
let begin=await loginReq('begin',{});assert.equal(begin.status,200);const challenge=(await begin.json()).challenge;
let m=await (await fetch('http://127.0.0.1:54324/api/v1/messages')).json();const msg=m.messages.find(x=>x.Subject==='Local OTP');assert.ok(msg,'OTP message');const full=await (await fetch('http://127.0.0.1:54324/api/v1/message/'+msg.ID)).json();const code=(full.Text||full.HTML).match(/\b\d{6}\b/)?.[0];assert.ok(code,'OTP code');
let verify=await loginReq('verify',{challenge,code});assert.equal(verify.status,200);assert.equal((await verify.json()).verified,true);
// Three recovery requests per hour, in addition to the per-minute cooldown.
resetLimit();await req('request',{email,captcha_token:'x'});assert.equal(count(),3);resetLimit();await req('request',{email,captcha_token:'x'});assert.equal(count(),3,'hourly limit');
// Provider failure returns the same generic response and fails closed on an interrupted update.
sql("update recovery_sandbox.admin_recovery set hour_start=clock_timestamp()-interval '2 hours',issued_at=clock_timestamp()-interval '61 seconds'");failMail=true;a=await req('request',{email,captcha_token:'x'});assert.equal(a.status,200);assert.equal(count(),3);failMail=false;resetLimit();await req('request',{email,captcha_token:'x'});let failToken=token();failUpdate=true;assert.equal((await req('complete',{token:failToken,password:oldPassword})).status,503);assert.equal((await req('complete',{token:failToken,password:oldPassword})).status,400);await assert.rejects(rpc('recovery_sandbox_login',{p_uid:user.id,p_action:'session',p_args:{_session_id:freshId}}));
console.log('PASS: local real Auth + custom recovery handler and SQL; expiry; single use; old session rejection; new password and OTP; captcha gate; cooldown and hourly limit; simulated provider failures. Mail and CAPTCHA adapters simulated.');
