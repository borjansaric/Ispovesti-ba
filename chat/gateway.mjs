// No payment endpoint. Trial actions require server configuration AND verified admin SQL checks.
const allowedActions=new Set(['profile','history','send','block','unblock','report','recovery_set','recover','admin_status','admin_profiles','admin_test_mode','admin_grant','admin_nickname','admin_avatar','admin_messages','admin_remove','admin_restore','admin_ban','admin_unban','admin_issue_code','redeem_code','comment_meta','comment_favorite']);
const trialActions=new Set(['admin_test_mode','admin_grant','admin_nickname','admin_avatar','admin_issue_code','redeem_code']);
const keys={admin_issue_code:['plan','request_id'],comment_meta:['ids'],comment_favorite:['id','enabled'],profile:[],history:['before'],send:['body','request_id'],block:['target'],unblock:['target'],report:['id','reason'],admin_status:[],admin_profiles:[],admin_test_mode:['enabled'],admin_grant:['target','plan','request_id'],admin_nickname:['target','nickname','request_id'],admin_avatar:['target','avatar','request_id'],admin_messages:['before'],admin_remove:['id'],admin_restore:['id'],admin_ban:['target','hours','reason'],admin_unban:['target']};
const hash=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),x=>x.toString(16).padStart(2,'0')).join('');
export function createChatHandler({supabaseUrl,serviceKey,allowedOrigins,allowTrials=false,environment='production',fetcher=fetch}){
 return async request=>{
  const origin=request.headers.get('origin');const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'};
  if(origin&&allowedOrigins.includes(origin))Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'});
  const send=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
  if(origin&&!allowedOrigins.includes(origin))return send({error:'Nedozvoljeno porijeklo.'},403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='POST')return send({error:'Nedozvoljen zahtjev.'},405);
  try{
   if(!request.headers.get('content-type')?.startsWith('application/json'))return send({error:'Očekivan je JSON.'},415);
   const reader=request.body?.getReader();if(!reader)return send({error:'Nedostaje zahtjev.'},400);
   const chunks=[];let length=0;for(;;){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>8192){await reader.cancel();return send({error:'Zahtjev je prevelik.'},413);}chunks.push(value);}
   const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
   const body=JSON.parse(new TextDecoder().decode(bytes));
   if(!allowedActions.has(body?.action)||!body.args||typeof body.args!=='object'||Array.isArray(body.args))return send({error:'Nepoznata radnja.'},400);
   if(trialActions.has(body.action)&&!(allowTrials&&environment==='test'))return send({error:'Probna prava nisu dostupna na ovom serveru.'},403);
   const authorization=request.headers.get('authorization');if(!authorization?.startsWith('Bearer '))return send({error:'Potrebna je anonimna prijava.'},401);
   const auth=await fetcher(supabaseUrl+'/auth/v1/user',{headers:{apikey:serviceKey,Authorization:authorization},signal:AbortSignal.timeout(12000)});
   if(!auth.ok)return send({error:'Prijava je istekla.'},401);
   const user=await auth.json();if(!user.id)return send({error:'Neispravna prijava.'},401);
   let tokenClaims={};try{const encoded=authorization.slice(7).split('.')[1];tokenClaims=JSON.parse(atob(encoded.replaceAll('-','+').replaceAll('_','/')));}catch{}
   const args={};for(const key of keys[body.action]||[])if(body.args[key]!==undefined)args[key]=body.args[key];
   if(body.action.startsWith('admin_')){
    if(user.is_anonymous!==false)return send({error:'Administratorska prijava je potrebna.'},403);
    let claims;try{const encoded=authorization.slice(7).split('.')[1];claims=JSON.parse(atob(encoded.replaceAll('-','+').replaceAll('_','/')));}catch{return send({error:'Neispravna administratorska sesija.'},403);}
    args._session_id=claims.session_id;args._aal=claims.aal;
   }
   if(['admin_issue_code','redeem_code'].includes(body.action)){
    if(body.action==='redeem_code'&&user.is_anonymous!==true)return send({error:'Kod je samo za anonimni chat pristup.'},403);
    const code=body.args.code?.trim().toUpperCase();if(typeof code!=='string'||!/^TEST-(?:[A-F0-9]{6}-){3}[A-F0-9]{6}$/.test(code))return send({error:'Unesi važeći probni pristupni kod.'},400);
    args.code_hash=await hash(code);
   }
   if(['recovery_set','recover'].includes(body.action)){
    if(user.is_anonymous!==true)return send({error:'Oporavak je samo za anonimni chat nalog.'},403);
    const code=body.args.code,newCode=body.args.new_code;
    if(typeof code!=='string'||!/^[a-f0-9]{64}$/.test(code)||(body.action==='recover'&&(typeof newCode!=='string'||!/^[a-f0-9]{64}$/.test(newCode))))return send({error:'Neispravan ključ za oporavak.'},400);
    args.recovery_hash=await hash(code);if(newCode)args.new_recovery_hash=await hash(newCode);
   }
   const response=await fetcher(supabaseUrl+'/rest/v1/rpc/chat_test_dispatch_v2',{method:'POST',headers:{apikey:serviceKey,Authorization:'Bearer '+serviceKey,'Content-Type':'application/json'},body:JSON.stringify({p_uid:user.id,p_action:body.action,p_args:args,p_session:tokenClaims.session_id||null}),signal:AbortSignal.timeout(12000)});
   const result=await response.json();if(!response.ok){const safe=['42501','28000','P0001'].includes(result.code);return send({error:safe?result.message:'Chat trenutno nije dostupan.'},result.code==='42501'?403:result.code==='28000'?401:400);}
   if(result._http_status){const {_http_status,...safe}=result;return send(safe,_http_status);}
   return send(result);
  }catch{return send({error:'Chat trenutno nije dostupan. Pokušaj ponovo.'},400);}
 };
}
