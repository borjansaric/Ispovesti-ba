// PREPARED ONLY. Do not deploy/enable against the shared owner without explicit approval.
import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
import {recoveryHandler} from '../../../admin-recovery/handler.mjs';
const env=(k:string)=>Deno.env.get(k)||'';
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(input:RequestInfo|URL,init?:RequestInit)=>fetch(input,{...init,signal:AbortSignal.timeout(12000)})}};
const db=createClient(env('SUPABASE_URL'),env('SUPABASE_SERVICE_ROLE_KEY'),options);
const check=<T>(r:{data:T,error:unknown})=>{if(r.error)throw Error('Provider operation failed');return r.data;};
async function store(action:string,args:Record<string,unknown>){return check(await db.rpc('community_test_admin_recovery',{p_action:action,p_args:args}));}
const handler=recoveryHandler({
 config:{enabled:env('RECOVERY_ENABLED')==='true'&&env('RECOVERY_ENVIRONMENT')==='test',authResetApproved:env('RECOVERY_AUTH_RESET_APPROVED')==='true',ownerUID:env('RECOVERY_OWNER_UID'),linkURL:env('RECOVERY_LINK_URL')||'https://borjansaric.github.io/Ispovesti-ba/test/admin-recovery.html'},
 store,
 auth:{
  getUser:async(id:string)=>check(await db.auth.admin.getUserById(id)).user,
  updatePassword:async(id:string,password:string)=>{check(await db.auth.admin.updateUserById(id,{password}));},
  revokeAll:async(id:string,email:string,password:string)=>{
   // A short-lived server-only session obtains the JWT required by Auth global sign-out.
   const isolated=createClient(env('SUPABASE_URL'),env('SUPABASE_SERVICE_ROLE_KEY'),options);
   const signed=check(await isolated.auth.signInWithPassword({email,password}));
   if(signed.user?.id!==id||!signed.session?.access_token)throw Error('Owner mismatch');
   const r=await db.auth.admin.signOut(signed.session.access_token,'global');if(r.error)throw Error('Revocation failed');
  }
 },
 captcha:{verify:async(token:unknown)=>{
  if(typeof token!=='string'||token.length<1||token.length>2048)return false;
  // Dedicated secret avoids reading, changing or coupling to existing posting security settings.
  if(!env('RECOVERY_TURNSTILE_SECRET'))return false;
  const r=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:env('RECOVERY_TURNSTILE_SECRET'),response:token}),signal:AbortSignal.timeout(10000)});
  if(!r.ok)return false;const d=await r.json(),age=Date.now()-Date.parse(d.challenge_ts);
  return d.success===true&&d.hostname===new URL(env('RECOVERY_LINK_URL')||'https://borjansaric.github.io').hostname&&d.action==='admin_recovery'&&age>=-60000&&age<=300000;
 }},
 mail:{send:async({to,link,idempotencyKey}:{to:string,link:string,idempotencyKey:string})=>{
  if(!env('RECOVERY_RESEND_API_KEY')||!env('RECOVERY_FROM_EMAIL'))throw Error('Mail not configured');
  const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env('RECOVERY_RESEND_API_KEY'),'Content-Type':'application/json','Idempotency-Key':idempotencyKey},body:JSON.stringify({from:env('RECOVERY_FROM_EMAIL'),to:[to],subject:'Ispovesti.ba — oporavak administratorske lozinke',text:'Link važi 10 minuta i može se iskoristiti jednom.\n\n'+link+'\n\nAko nisi tražio promjenu, zanemari poruku. Poslije promjene potrebna je nova prijava lozinkom i e-mail kodom.'}),signal:AbortSignal.timeout(10000)});
  if(!r.ok)throw Error('Mail delivery failed');
 }}
});
Deno.serve(handler);
