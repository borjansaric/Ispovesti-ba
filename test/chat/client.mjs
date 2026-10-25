import {authClient,isLocal} from '../api.js?v=freechat1';
let localPending;
async function localSession(){
 if(!localPending)localPending=fetch('/api/chat-session',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',credentials:'same-origin'}).then(async r=>{if(!r.ok)throw Error('Anonimna prijava nije dostupna.');}).catch(e=>{localPending=null;throw e;});
 return localPending;
}
export async function chatRequest(action,args={},admin=false){
 const headers={'Content-Type':'application/json'};let url;
 if(isLocal){await localSession();url='/api/chat';}
 else{
  const config=window.ISPOVESTI_CONFIG||{};if(config.chatEnvironment!=='test')throw Error('Probni chat još nije uključen.');
  const sb=authClient(admin);let {data,error}=await sb.auth.getSession();if(error)throw error;
  if(!data.session&&!admin){const signed=await sb.auth.signInAnonymously();if(signed.error)throw signed.error;data=signed.data;}
  if(!data.session)throw Error('Prvo se prijavi kao administrator.');
  headers.Authorization='Bearer '+data.session.access_token;headers.apikey=config.publishableKey;url=config.supabaseUrl+'/functions/v1/chat-test-api';
 }
 const r=await fetch(url,{method:'POST',headers,body:JSON.stringify({action,args}),credentials:'same-origin',signal:AbortSignal.timeout(15000),cache:'no-store'});const d=await r.json();
 if(!r.ok){const e=Error(d.error||'Chat trenutno nije dostupan.');e.status=r.status;throw e;}return d;
}
export const recoveryKey=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
