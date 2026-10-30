// Server only. Dependencies are injected so the exact saga is tested without real credentials.
export const genericMessage='Ako je e-mail administratorski i zahtjev dozvoljen, stići će link za oporavak. Provjeri i neželjenu poštu.';
export const invalidMessage='Link nije ispravan, istekao je ili je već iskorišten. Zatraži novi.';
export async function hashToken(token){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),b=>b.toString(16).padStart(2,'0')).join('');}
function randomToken(){return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
export function recoveryHandler({config,store,auth,mail,captcha,delay=()=>new Promise(r=>setTimeout(r,250))}){
 const target=new URL(config.linkURL);
 if(target.protocol!=='https:'||(!target.pathname.endsWith('/test/admin-recovery.html')&&!(config.environment==='live'&&target.pathname==='/Ispovesti-ba/admin-recovery.html'))||target.search||target.hash||target.username||target.password)throw Error('Recovery requires a fixed test HTTPS URL');
 const allowed=target.origin;
 return async req=>{
  const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Pragma':'no-cache','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Vary':'Origin'};
  if(req.headers.get('origin')===allowed){headers['Access-Control-Allow-Origin']=allowed;headers['Access-Control-Allow-Headers']='apikey,content-type';headers['Access-Control-Allow-Methods']='POST,OPTIONS';}
  const send=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
  if(req.headers.get('origin')!==allowed)return send({error:'Nedozvoljeno porijeklo.'},403);
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(req.method!=='POST')return send({error:'Nedozvoljen zahtjev.'},405);
  if(!config.enabled||!config.authResetApproved)return send({error:config.environment==='live'?'Oporavak još nije povezan s e-mail servisom.':'Probni oporavak još nije aktiviran.'},503);
  try{
   const reader=req.body?.getReader();if(!reader)return send({error:'Neispravan zahtjev.'},400);
   let size=0,chunks=[];while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096){await reader.cancel();return send({error:'Zahtjev je prevelik.'},413);}chunks.push(value);}
   const all=new Uint8Array(size);let off=0;for(const c of chunks){all.set(c,off);off+=c.length;}const body=JSON.parse(new TextDecoder().decode(all));
   if(!body||typeof body!=='object'||Array.isArray(body))return send({error:'Neispravan zahtjev.'},400);
   if(body.action==='request'){
    if(typeof body.email!=='string'||body.email.length>254)return send({error:'Unesi ispravan e-mail.'},400);
    // Mandatory independent Turnstile check, even if posting CAPTCHA is disabled.
    if(!await captcha.verify(body.captcha_token))return send({error:'Sigurnosna provjera nije prošla.'},400);
    const token=randomToken(),token_hash=await hashToken(token);
    try{const prepared=await store('issue',{email:body.email.trim().toLowerCase(),token_hash});
    if(!prepared.denied){
     const user=await auth.getUser(prepared.user_id);
     if(user.id===config.ownerUID&&user.id===prepared.user_id&&user.email?.toLowerCase()===prepared.email&&user.email_confirmed_at&&user.is_anonymous===false){
      const link=new URL(target);link.hash='token='+token;
      await mail.send({to:prepared.email,link:link.href,idempotencyKey:'admin-recovery/'+token_hash});
     }
    }
    }catch{/* Do not reveal whether an account/provider exists through request responses. */}
    await delay();return send({message:genericMessage});
   }
   if(body.action!=='complete')return send({error:'Neispravna radnja.'},400);
   if(typeof body.token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(body.token))return send({error:invalidMessage},400);
   if(typeof body.password!=='string'||body.password.length<12||body.password.length>128)return send({error:'Lozinka mora imati od 12 do 128 znakova.'},400);
   const token_hash=await hashToken(body.token),claim=await store('consume',{token_hash});
   if(claim.denied)return send({error:invalidMessage},400);
   const user=await auth.getUser(claim.user_id);
   if(user.id!==config.ownerUID||user.id!==claim.user_id||user.is_anonymous!==false||!user.email_confirmed_at||user.email?.toLowerCase()!==claim.email)throw Error('Owner mismatch');
   // Once consumed, never retry the password operation automatically. Partial failures stay blocked.
   await auth.updatePassword(user.id,body.password);
   await auth.revokeAll(user.id,claim.email,body.password);
   const finished=await store('finish',{token_hash});if(!finished.success)throw Error('Recovery incomplete');
   // No Auth session/JWT is returned or stored by the browser. A fresh password + email OTP login is required.
   return send({success:true,message:'Lozinka je promijenjena. Prijavi se novom lozinkom i novim kodom sa e-maila.'});
  }catch(e){if(e instanceof SyntaxError)return send({error:'Neispravan zahtjev.'},400);return send({error:'Oporavak nije dovršen. Ne ponavljaj promjenu automatski; potrebna je provjera stanja.'},503);}
 };
}
