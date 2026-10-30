// Server-only login probe: no content, moderation or owner-activation operations.
import {hashToken} from '../handler.mjs';
const random=()=>btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
export function sandboxLogin({origin,ownerUID,resolveOwner,auth,rpc}){return async req=>{
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};
 const send=(d,status=200)=>new Response(JSON.stringify(d),{status,headers});
 if(req.headers.get('origin')!==origin)return send({error:'Nedozvoljeno porijeklo.'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});if(req.method!=='POST')return send({error:'Nedozvoljen metod.'},405);
 try{
  const token=req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];if(!token)return send({error:'Prijavi se probnim nalogom.'},401);
  const user=await auth.getUser(token);const expectedOwner=resolveOwner?await resolveOwner():ownerUID;if(!expectedOwner||!user||user.id!==expectedOwner||user.is_anonymous!==false||!user.email_confirmed_at)return send({error:'Probni administratorski nalog je potreban.'},403);
  const claims=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
  if(typeof claims.session_id!=='string'||!/^[0-9a-f-]{36}$/i.test(claims.session_id))return send({error:'Nedostaje provjerena sesija.'},403);
  const proof={_session_id:claims.session_id};await rpc('login',user.id,'session',proof);
  const reader=req.body?.getReader();if(!reader)return send({error:'Neispravan zahtjev.'},400);let size=0,parts=[];while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096){await reader.cancel();return send({error:'Prevelik zahtjev.'},413);}parts.push(value);}const bytes=new Uint8Array(size);let offset=0;for(const p of parts){bytes.set(p,offset);offset+=p.length;}
  const body=JSON.parse(new TextDecoder().decode(bytes));if(!body||typeof body!=='object'||Array.isArray(body))return send({error:'Neispravan zahtjev.'},400);
  if(body.action==='status')return send(await rpc('email',user.id,'status',proof));
  if(!['begin','verify'].includes(body.action))return send({error:'Nedozvoljena radnja.'},400);
  if(!Array.isArray(claims.amr)||!claims.amr.some(a=>a.method==='password'&&Number.isFinite(a.timestamp)&&a.timestamp*1000<=Date.now()+60000&&Date.now()-a.timestamp*1000<600000))return send({error:'Ponovo se prijavi probnom lozinkom.'},403);
  if(body.action==='begin'){
   const challenge=random();const prepared=await rpc('email',user.id,'begin',{...proof,challenge_hash:await hashToken(challenge)});if(prepared.limited)return send({error:'Sačekaj jednu minutu prije novog koda.'},429);
   await auth.sendOtp(prepared.email);return send({challenge});
  }
  const args=body.args||{};if(typeof args.challenge!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(args.challenge)||typeof args.code!=='string'||!/^\d{6,10}$/.test(args.code))return send({error:'Neispravan kod.'},400);
  const verifiedProof={...proof,challenge_hash:await hashToken(args.challenge)};
  const attempt=await rpc('email',user.id,'attempt',verifiedProof);if(attempt.denied)return send({error:'Kod je istekao ili je iskorišten.'},403);
  const verified=await auth.verifyOtp(attempt.email,args.code);
  if(verified?.id!==user.id||verified?.email?.toLowerCase()!==attempt.email||verified?.is_anonymous!==false||!verified?.email_confirmed_at){await rpc('email',user.id,'failed',verifiedProof);return send({error:'Kod nije ispravan.'},403);}
  const finished=await rpc('email',user.id,'finish',{...verifiedProof,verified_uid:verified.id,verified_email:verified.email.toLowerCase()});if(!finished.verified)return send({error:'Potvrda nije dovršena.'},403);
  return send(await rpc('login',user.id,'panel',proof));
 }catch(e){if(e instanceof SyntaxError)return send({error:'Neispravan zahtjev.'},400);return send({error:'Probna sesija ili servis nisu dostupni. Prijavi se ponovo.'},403);}
};}
