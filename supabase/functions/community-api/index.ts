// User JWTs are verified by Auth here. Only this gateway can call the private RPCs.
const url=Deno.env.get('SUPABASE_URL')!;
const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const allowed=(Deno.env.get('ALLOWED_ORIGINS')||'https://borjansaric.github.io').split(',');
const publicActions=new Set(['feed','comments','confession','captcha_config','activate_admin']);
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
 const proof={hash:await digest(code),email};await rpc('community_test_security',null,'bootstrap_claim',proof);
 try{
  const r=await fetch(url+'/auth/v1/admin/users',{method:'POST',headers:{apikey:serviceKey,Authorization:'Bearer '+serviceKey,'Content-Type':'application/json'},body:JSON.stringify({email,password,email_confirm:true}),signal:AbortSignal.timeout(15000)});
  let d=await r.json(),id=d.id||d.user?.id;
  if(!r.ok){
   // Resume only by proving the existing account's password; never reset it here.
   if(!['email_exists','user_already_exists'].includes(d.code))fail('Nalog nije moguće aktivirati. Provjeri da lozinka ima najmanje 12 znakova.');
   const login=await fetch(url+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:serviceKey,'Content-Type':'application/json'},body:JSON.stringify({email,password}),signal:AbortSignal.timeout(15000)});
   d=await login.json();id=d.user?.id;if(!login.ok||!id)fail('Postojeći nalog zahtijeva njegovu ispravnu lozinku.');
  }
  if(!id)fail('Nalog nije moguće aktivirati.',503);
  await rpc('community_test_security',null,'bootstrap_finish',{...proof,user_id:id});return {success:true};
 }catch(e){await rpc('community_test_security',null,'bootstrap_release',proof).catch(()=>{});throw e;}
}
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('origin');
 const headers:Record<string,string>={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','X-Content-Type-Options':'nosniff'};
 if(origin&&allowed.includes(origin))headers['Access-Control-Allow-Origin']=origin;
 const send=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
 if(origin&&!allowed.includes(origin))return send({error:'Nedozvoljeno porijeklo.'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return send({error:'Nedozvoljen zahtjev.'},405);
 try{
  const reader=req.body?.getReader();if(!reader)return send({error:'Nedostaje zahtjev.'},400);
  let size=0;const chunks:Uint8Array[]=[];while(true){const{done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>32768){await reader.cancel();return send({error:'Zahtjev je prevelik.'},413);}chunks.push(value);}
  const bytes=new Uint8Array(size);let pos=0;for(const c of chunks){bytes.set(c,pos);pos+=c.length;}
  const body=JSON.parse(new TextDecoder().decode(bytes));if(!body||typeof body!=='object'||Array.isArray(body))fail('Neispravan zahtjev.');
  const action=body.action,args=body.args??{};if(typeof action!=='string'||!/^[a-z_]{1,30}$/.test(action))fail('Neispravna radnja.');
  if(!args||typeof args!=='object'||Array.isArray(args))fail('Neispravan zahtjev.');
  if(action==='captcha_config')return send(await rpc('community_test_security',null,'public_config'));
  if(action==='activate_admin')return send(await activate(args));
  let uid:string|null=null;
  if(!publicActions.has(action)){
   const token=req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];if(!token)fail('Potrebna je anonimna sesija.',401);
   const response=await fetch(url+'/auth/v1/user',{headers:{apikey:serviceKey,Authorization:'Bearer '+token},signal:AbortSignal.timeout(10000)});
   if(!response.ok)fail('Sesija je istekla. Osvježi stranicu.',401);
   const user=await response.json();uid=user.id;if(!uid)fail('Neispravna sesija.',401);
   if(action.startsWith('admin_')){
    if(user.is_anonymous!==false)fail('Potreban je administratorski nalog sa dvofaktorskom potvrdom.',403);
    const payload=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
    if(!payload.session_id||(action!=='admin_session'&&payload.aal!=='aal2'))fail('Potreban je administratorski nalog sa dvofaktorskom potvrdom.',403);
    args._session_id=payload.session_id;args._aal=payload.aal;
   }
  }
  if(action==='admin_security_get')return send(await rpc('community_test_security',uid,action,{_session_id:args._session_id,_aal:args._aal}));
  if(action==='admin_security_set'){
   const current=await rpc('community_test_security',uid,'admin_security_get',{_session_id:args._session_id,_aal:args._aal});
   const runtime=await rpc('community_test_security',uid,'runtime_config');
   const sitekey=String(args.sitekey||current.sitekey||'');const secret=typeof args.secret==='string'&&args.secret.trim()?args.secret.trim():null;
   if(secret&&(secret.length<10||secret.length>256))fail('Neispravan tajni ključ.');
   if(/^[123]x0+/.test(sitekey)||(secret&&/^[123]x0+/.test(secret)))fail('Probni Cloudflare ključevi nisu dozvoljeni za stvarnu zaštitu.');
   if(args.enabled===true){
    if(!sitekey||(secret===null&&!runtime.secret_ciphertext))fail('Unesi stvarne Cloudflare ključeve.');
    await verifyCaptcha(secret||await decrypt(runtime.secret_ciphertext),args.captcha_token,runtime.hostname,'admin_check');
   }
   const clean={enabled:args.enabled===true,sitekey,secret_ciphertext:secret?await encrypt(secret):undefined,_session_id:args._session_id,_aal:args._aal};
   return send(await rpc('community_test_security',uid,action,clean));
  }
  if(action==='submit'){
   const config=await rpc('community_test_security',uid,'runtime_config');
   if(config.enabled===true){
    if(!['confession','comment','reply'].includes(args.kind))fail('Neispravna vrsta sadržaja.');
    if(!config.secret_ciphertext)fail('Sigurnosna provjera nije podešena.',503);
    await verifyCaptcha(await decrypt(config.secret_ciphertext),args.captcha_token,config.hostname,'submit_'+args.kind);
   }
   delete args.captcha_token;
  }
  return send(await rpc('community_test_dispatch',uid,action,args));
 }catch(error){if(error instanceof HttpError)return send({error:error.message},error.status);if(error instanceof SyntaxError)return send({error:'Neispravan zahtjev.'},400);return send({error:'Server trenutno nije dostupan. Pokušaj ponovo.'},503);}
});
