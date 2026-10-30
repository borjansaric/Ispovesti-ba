import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
import {recoveryHandler} from '../admin-recovery/handler.mjs';
const url=Deno.env.get('SUPABASE_URL')||'',serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const origin='https://borjansaric.github.io',linkURL=origin+'/Ispovesti-ba/admin-recovery.html';
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(input:RequestInfo|URL,init?:RequestInit)=>fetch(input,{...init,signal:AbortSignal.timeout(12000)})}};
const db=createClient(url,serviceKey,options),client=()=>createClient(url,serviceKey,options);
const check=<T>(r:{data:T,error:unknown})=>{if(r.error)throw Error('Servis nije dostupan');return r.data;};
async function decrypt(value:string){const[v,a,b]=value.split(':');if(v!=='v1'||!a||!b)throw Error('Nema ključa');const k=await crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',new TextEncoder().encode('ispovesti-turnstile-v1:'+serviceKey)),{name:'AES-GCM'},false,['decrypt']);return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:Uint8Array.from(atob(a),x=>x.charCodeAt(0))},k,Uint8Array.from(atob(b),x=>x.charCodeAt(0))));}
Deno.serve(async(req:Request)=>{
 if(req.headers.get('origin')!==origin)return new Response('{}',{status:403});
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin'};
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return new Response('{}',{status:405,headers});
 try{
  const c=check(await db.rpc('community_live_recovery_settings',{p_action:'runtime'}));
  return recoveryHandler({config:{environment:'live',enabled:c.enabled,authResetApproved:true,ownerUID:c.owner_uid,linkURL},
   store:async(action:string,args:unknown)=>check(await db.rpc('community_live_admin_recovery',{p_action:action,p_args:args})),
   auth:{getUser:async(id:string)=>check(await db.auth.admin.getUserById(id)).user,
    updatePassword:async(id:string,password:string)=>{check(await db.auth.admin.updateUserById(id,{password}));},
    revokeAll:async(id:string,email:string,password:string)=>{const signed=check(await client().auth.signInWithPassword({email,password}));if(signed.user?.id!==id||!signed.session)throw Error('Pogrešan nalog');check(await db.auth.admin.signOut(signed.session.access_token,'global'));}},
   captcha:{verify:async(token:unknown)=>{if(typeof token!=='string'||token.length<1||token.length>2048||!c.captcha_secret_ciphertext)return false;const r=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:await decrypt(c.captcha_secret_ciphertext),response:token}),signal:AbortSignal.timeout(10000)});if(!r.ok)return false;const d=await r.json(),age=Date.now()-Date.parse(d.challenge_ts);return d.success===true&&d.hostname===c.hostname&&d.action==='admin_recovery'&&age>=-60000&&age<=300000;}},
   mail:{send:async({to,link,idempotencyKey}:{to:string,link:string,idempotencyKey:string})=>{const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+await decrypt(c.mail_key_ciphertext),'Content-Type':'application/json','Idempotency-Key':idempotencyKey},body:JSON.stringify({from:c.sender,to:[to],subject:'Ispovesti.ba — oporavak lozinke',text:'Link važi 10 minuta i može se koristiti jednom.\n\n'+link+'\n\nAko nisi tražio promjenu, zanemari poruku.'}),signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('Slanje nije uspjelo');}}
  })(req);
 }catch{return new Response(JSON.stringify({error:'Oporavak trenutno nije dostupan.'}),{status:503,headers})}
});
