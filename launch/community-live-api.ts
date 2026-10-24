// User JWTs are verified by Auth here. Only this gateway can call the private RPCs.
const url=Deno.env.get('SUPABASE_URL')!;
const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const allowed=(Deno.env.get('ALLOWED_ORIGINS')||'https://borjansaric.github.io').split(',');
const publicActions=new Set(['feed','comments','confession','captcha_config','activate_admin','health']);
class HttpError extends Error { status:number; constructor(message:string,status=400){super(message);this.status=status;} }
const fail=(message:string,status=400):never=>{throw new HttpError(message,status);};
async function digest(text:string){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
async function key(){return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',new TextEncoder().encode('ispovesti-turnstile-v1:'+serviceKey)),{name:'AES-GCM'},false,['encrypt','decrypt']);}
async function encrypt(secret:string){const iv=crypto.getRandomValues(new Uint8Array(12));const bytes=await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(),new TextEncoder().encode(secret));return 'v1:'+btoa(String.fromCharCode(...iv))+':'+btoa(String.fromCharCode(...new Uint8Array(bytes)));}
async function decrypt(value:string){const [version,a,b]=String(value||'').split(':');if(version!=='v1'||!a||!b)fail('CAPTCHA ključ treba ponovo podesiti.',503);const bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv:Uint8Array.from(atob(a),x=>x.charCodeAt(0))},await key(),Uint8Array.from(atob(b),x=>x.charCodeAt(0)));return new TextDecoder().decode(bytes);}
async function rpc(name:string,uid:string|null,action:string,args:Record<string,unknown>={}){
 const r=await fetch(url+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:serviceKey,Authorization:'Bearer '+serviceKey,'Content-Type':'application/json'},body:JSON.stringify({p_uid:uid,p_action:action,p_args:args}),signal:AbortSignal.timeout(15000)});
 const d=await r.json();if(!r.ok)fail(d.code==='42501'?d.message:d.code==='28000'?d.message:d.code==='P0001'?d.message:'Radnja nije uspjela. Pokušaj ponovo.',d.code==='42501'?403:d.code==='28000'?401:d.code==='P0001'?400:500);return d;
}
async function verifyCaptcha(secret:string,token:unknown,hostname:string,action:string){
 if(typeof token!=='string'||token.length<1||token.length>2048)fail('Završi sigurnosnu provjeru i pokušaj ponovo.');
 const r=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret,response:token}),signal:AbortSignal.timeout(15000)});
 if(!r.ok)fail('Sigurnosna provjera trenutno nije dostupna. Pokušaj ponovo.',503);
 const d=await r.json();const at=Date.parse(d.challenge_ts);
 if(d.success!==true||d.hostname!==hostname||d.action!==action||!Number.isFinite(at)||Date.now()-at>300000||at>Date.now()+60000)fail('Sigurnosna provjera nije prošla ili je istekla. Pokušaj ponovo.');
}
async function activate(args:Record<string,unknown>){
 const code=String(args.code||''),email=String(args.email||'').trim().toLowerCase(),password=String(args.password||'');
 if(!/^[A-Za-z0-9_-]{43}$/.test(code)||email.length>254||password.length<12||password.length>128)fail('Provjeri aktivacioni kod, e-mail i lozinku od najmanje 12 znakova.');
 const proof={hash:await digest(code),email};await rpc('community_live_security',null,'bootstrap_claim',proof);
 try{
  const r=await fetch(url+'/auth/v1/admin/users',{method:'POST',headers:{apikey:serviceKey,Authorization:'Bearer '+serviceKey,'Content-Type':'application/json'},body:JSON.stringify({email,password,email_confirm:true}),signal:AbortSignal.timeout(15000)});
  let d=await r.json(),account=d.user||d,id=account.id;
  if(!r.ok){
   // Resume only by proving the existing account's password; never reset it here.
   if(!['email_exists','user_already_exists'].includes(d.code))fail('Nalog nije moguće aktivirati. Provjeri da lozinka ima najmanje 12 znakova.');
   const login=await fetch(url+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:serviceKey,'Content-Type':'application/json'},body:JSON.stringify({email,password}),signal:AbortSignal.timeout(15000)});
   d=await login.json();account=d.user;id=account?.id;if(!login.ok||!id)fail('Postojeći nalog zahtijeva njegovu ispravnu lozinku.');
  }
  if(!id||account.email?.toLowerCase()!==email||account.is_anonymous!==false||!account.email_confirmed_at)fail('Nalog nije moguće aktivirati.',503);
  await rpc('community_live_security',null,'bootstrap_finish',{...proof,user_id:id,verified_email:account.email.toLowerCase(),verified_anonymous:account.is_anonymous,verified_confirmed_at:account.email_confirmed_at});return {success:true};
 }catch(e){await rpc('community_live_security',null,'bootstrap_release',proof).catch(()=>{});throw e;}
}
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('origin');
 const began=Date.now(),timings:Record<string,number>={};
 const timed=async<T>(name:string,work:()=>Promise<T>):Promise<T>=>{const at=Date.now();try{return await work();}finally{timings[name]=(timings[name]||0)+Date.now()-at;}};
 const timedRpc=(name:string,uid:string|null,action:string,args:Record<string,unknown>={})=>timed(name==='community_live_dispatch'?'database':name==='community_live_security'?'settings':'admin_database',()=>rpc(name,uid,action,args));
 const headers:Record<string,string>={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','X-Content-Type-Options':'nosniff'};
 if(origin&&allowed.includes(origin)){headers['Access-Control-Allow-Origin']=origin;headers['Timing-Allow-Origin']=origin;headers['Access-Control-Expose-Headers']='Server-Timing';}
 const send=(data:unknown,status=200)=>{headers['Server-Timing']=[...Object.entries(timings).map(([name,ms])=>name+';dur='+ms),'server;dur='+(Date.now()-began)].join(', ');return new Response(JSON.stringify(data),{status,headers});};
 if(origin&&!allowed.includes(origin))return send({error:'Nedozvoljeno porijeklo.'},403);
 if(req.method==='OPTIONS'){headers['Access-Control-Max-Age']='600';return new Response(null,{status:204,headers});}
 if(req.method!=='POST')return send({error:'Nedozvoljen zahtjev.'},405);
 try{
  const reader=req.body?.getReader();if(!reader)return send({error:'Nedostaje zahtjev.'},400);
  let size=0;const chunks:Uint8Array[]=[];while(true){const{done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>32768){await reader.cancel();return send({error:'Zahtjev je prevelik.'},413);}chunks.push(value);}
  const bytes=new Uint8Array(size);let pos=0;for(const c of chunks){bytes.set(c,pos);pos+=c.length;}
  const body=JSON.parse(new TextDecoder().decode(bytes));if(!body||typeof body!=='object'||Array.isArray(body))fail('Neispravan zahtjev.');
  const action=body.action,args=body.args??{};if(typeof action!=='string'||!/^[a-z_]{1,30}$/.test(action))fail('Neispravna radnja.');
  if(!args||typeof args!=='object'||Array.isArray(args))fail('Neispravan zahtjev.');
  if(action==='health'){const c=await timedRpc('community_live_security',null,'public_config');return send({environment:'live',version:'launch1',captcha_enabled:c.enabled});}
  if(action==='captcha_config')return send(await timedRpc('community_live_security',null,'public_config'));
  if(action==='activate_admin')return send({error:'Koristi postojeći administratorski nalog.'},403);
  let uid:string|null=null;
  if(!publicActions.has(action)){
   const token=req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];if(!token)fail('Potrebna je anonimna sesija.',401);
   const response=await timed('auth',()=>fetch(url+'/auth/v1/user',{headers:{apikey:serviceKey,Authorization:'Bearer '+token},signal:AbortSignal.timeout(10000)}));
   if(!response.ok)fail('Sesija je istekla. Osvježi stranicu.',401);
   const user=await response.json();uid=user.id;if(!uid)fail('Neispravna sesija.',401);
   if(action.startsWith('admin_')){
    if(user.is_anonymous!==false||!user.email_confirmed_at)fail('Potreban je administratorski nalog sa dvofaktorskom potvrdom.',403);
    const payload=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
    if(!payload.session_id)fail('Potrebna je administratorska sesija.',403);
    if(action==='admin_email_begin'||action==='admin_email_verify'){
     const passwordProof=Array.isArray(payload.amr)&&payload.amr.some((a:{method:string,timestamp:number})=>a.method==='password'&&Number.isFinite(a.timestamp)&&a.timestamp*1000<=Date.now()+60000&&Date.now()-a.timestamp*1000<600000);
     if(!passwordProof)fail('Prijavi se ponovo lozinkom prije potvrde e-maila.',403);
    }
    args._session_id=payload.session_id;args._aal=payload.aal;
   }
  }
  if(action==='admin_email_status')return send(await timedRpc('community_live_admin_email',uid,'status',{_session_id:args._session_id}));
  if(action==='admin_email_begin'){
   const challenge=btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
   const proof={_session_id:args._session_id,challenge_hash:await digest(challenge)};
   const prepared=await timedRpc('community_live_admin_email',uid,'begin',proof);
   if(prepared.limited)fail('Sačekaj najmanje jednu minutu prije novog koda.',429);
   const r=await fetch(url+'/auth/v1/otp',{method:'POST',headers:{apikey:serviceKey,'Content-Type':'application/json'},body:JSON.stringify({email:prepared.email,create_user:false}),signal:AbortSignal.timeout(15000)});
   if(!r.ok)fail('Kod trenutno nije moguće poslati. Provjeri Supabase podešavanje e-maila ili pokušaj kasnije.',503);
   return send({challenge,expires_in:600});
  }
  if(action==='admin_email_verify'){
   if(typeof args.challenge!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(args.challenge)||typeof args.code!=='string'||!/^\d{6,10}$/.test(args.code))fail('Unesi ispravan kod sa e-maila.');
   const proof={_session_id:args._session_id,challenge_hash:await digest(args.challenge)};
   const attempt=await timedRpc('community_live_admin_email',uid,'attempt',proof);
   if(attempt.denied)fail('Kod je istekao, iskorišten ili je potrošeno pet pokušaja. Zatraži novi kod.',403);
   const r=await fetch(url+'/auth/v1/verify',{method:'POST',headers:{apikey:serviceKey,'Content-Type':'application/json'},body:JSON.stringify({email:attempt.email,token:args.code,type:'email'}),signal:AbortSignal.timeout(15000)});
   const verified=await r.json();
   if(!r.ok||verified.user?.id!==uid||verified.user?.email?.toLowerCase()!==attempt.email||verified.user?.is_anonymous!==false||!verified.user?.email_confirmed_at){await timedRpc('community_live_admin_email',uid,'failed',proof);fail('Kod nije ispravan ili je istekao.',403);}
   // Only after verified e-mail ownership may the server retire this owner's old TOTP factor.
   const ownerResponse=await fetch(url+'/auth/v1/admin/users/'+uid,{headers:{apikey:serviceKey,Authorization:'Bearer '+serviceKey},signal:AbortSignal.timeout(10000)});
   if(!ownerResponse.ok)fail('Potvrda nije dovršena. Pokušaj ponovo.',503);
   const owner=await ownerResponse.json();let relogin=false;
   for(const factor of (owner.factors||owner.user?.factors||[]).filter((f:{factor_type:string})=>f.factor_type==='totp')){
    const removed=await fetch(url+'/auth/v1/admin/users/'+uid+'/factors/'+encodeURIComponent(factor.id),{method:'DELETE',headers:{apikey:serviceKey,Authorization:'Bearer '+serviceKey},signal:AbortSignal.timeout(10000)});
    if(!removed.ok)fail('Stari način potvrde nije uklonjen. Pokušaj ponovo.',503);
    if(factor.status==='verified')relogin=true;
   }
   // Supabase revokes sessions when a verified factor is deleted. Require a fresh password+email login.
   if(relogin)return send({verified:false,relogin:true});
   const result=await timedRpc('community_live_admin_email',uid,'finish',{...proof,verified_uid:verified.user.id,verified_email:verified.user.email.toLowerCase()});
   if(!result.verified)fail('Potvrda nije dovršena. Prijavi se ponovo.',403);
   return send({verified:true});
  }
  if(action==='admin_security_get')return send(await timedRpc('community_live_security',uid,action,{_session_id:args._session_id,_aal:args._aal}));
  if(action==='admin_security_set'){
   const current=await timedRpc('community_live_security',uid,'admin_security_get',{_session_id:args._session_id,_aal:args._aal});
   const runtime=await timedRpc('community_live_security',uid,'runtime_config');
   const sitekey=String(args.sitekey||current.sitekey||'');const secret=typeof args.secret==='string'&&args.secret.trim()?args.secret.trim():null;
   if(secret&&(secret.length<10||secret.length>256))fail('Neispravan tajni ključ.');
   if(/^[123]x0+/.test(sitekey)||(secret&&/^[123]x0+/.test(secret)))fail('Probni Cloudflare ključevi nisu dozvoljeni za stvarnu zaštitu.');
   if(args.enabled===true){
    if(!sitekey||(secret===null&&!runtime.secret_ciphertext))fail('Unesi stvarne Cloudflare ključeve.');
    await verifyCaptcha(secret||await decrypt(runtime.secret_ciphertext),args.captcha_token,runtime.hostname,'admin_check');
   }
   const clean={enabled:args.enabled===true,sitekey,secret_ciphertext:secret?await encrypt(secret):undefined,_session_id:args._session_id,_aal:args._aal};
   return send(await timedRpc('community_live_security',uid,action,clean));
  }
  if(action==='submit'){
   const config=await timedRpc('community_live_security',uid,'runtime_config');
   if(config.enabled===true){
    if(!['confession','comment','reply'].includes(args.kind))fail('Neispravna vrsta sadržaja.');
    if(!config.secret_ciphertext)fail('Sigurnosna provjera nije podešena.',503);
    await timed('turnstile',async()=>verifyCaptcha(await decrypt(config.secret_ciphertext),args.captcha_token,config.hostname,'submit_'+args.kind));
   }
   delete args.captcha_token;
  }
  return send(await timedRpc('community_live_dispatch',uid,action,args));
 }catch(error){if(error instanceof HttpError)return send({error:error.message},error.status);if(error instanceof SyntaxError)return send({error:'Neispravan zahtjev.'},400);return send({error:'Server trenutno nije dostupan. Pokušaj ponovo.'},503);}
});
