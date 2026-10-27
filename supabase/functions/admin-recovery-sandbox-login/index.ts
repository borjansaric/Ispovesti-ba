// PREPARED ONLY; isolated Supabase project, no production API deployment.
import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
import {sandboxLogin} from '../../../admin-recovery/sandbox/login-handler.mjs';
import {assertIsolatedProject} from '../../../admin-recovery/sandbox/config.mjs';
const env=(k:string)=>Deno.env.get(k)||'';
const url=env('SUPABASE_URL');assertIsolatedProject(url,env('RECOVERY_SANDBOX_PROJECT_REF'));
if(env('RECOVERY_ISOLATED_APPROVED')!=='true')throw Error('Only the approved isolated Auth project is allowed');
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(input:RequestInfo|URL,init?:RequestInit)=>fetch(input,{...init,signal:AbortSignal.timeout(12000)})}};
const client=()=>createClient(url,env('SUPABASE_SERVICE_ROLE_KEY'),options),db=client();
const check=<T>(r:{data:T,error:unknown})=>{if(r.error)throw Error('Probni servis nije dostupan');return r.data;};
Deno.serve(sandboxLogin({origin:new URL(env('RECOVERY_LINK_URL')).origin,ownerUID:env('RECOVERY_OWNER_UID'),
 rpc:async(kind:string,uid:string,action:string,args:unknown)=>check(await db.rpc(kind==='email'?'recovery_sandbox_admin_email':'recovery_sandbox_login',{p_uid:uid,p_action:action,p_args:args})),
 auth:{getUser:async(token:string)=>check(await db.auth.getUser(token)).user,
 sendOtp:async(email:string)=>{check(await client().auth.signInWithOtp({email,options:{shouldCreateUser:false}}));},
 verifyOtp:async(email:string,token:string)=>{const r=await client().auth.verifyOtp({email,token,type:'email'});return r.error?null:r.data.user;}}
}));
