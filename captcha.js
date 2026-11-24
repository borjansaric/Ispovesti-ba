let scriptPromise;
async function loadTurnstile(){
 if(window.turnstile)return;
 if(!scriptPromise)scriptPromise=new Promise((resolve,reject)=>{
  const s=document.createElement('script');s.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';s.async=true;s.defer=true;
  const timer=setTimeout(()=>{s.remove();reject(new Error('Sigurnosna provjera se nije učitala. Pokušaj ponovo.'));},15000);
  s.onload=()=>{clearTimeout(timer);resolve();};s.onerror=()=>{clearTimeout(timer);s.remove();reject(new Error('Sigurnosna provjera nije dostupna. Pokušaj ponovo.'));};document.head.append(s);
 }).catch(e=>{scriptPromise=null;throw e;});
 await scriptPromise;
}
// Cache only public configuration briefly. The server always reads the authoritative settings.
let settingsPromise, settingsAt=0;
async function settings(){
 if(!settingsPromise||Date.now()-settingsAt>60000){
  settingsAt=Date.now();
  settingsPromise=(async()=>{
   const c=window.ISPOVESTI_CONFIG;
   const r=await fetch(c.supabaseUrl+'/functions/v1/community-live-api?forceFunctionRegion=eu-central-1',{method:'POST',headers:{apikey:c.publishableKey,'Content-Type':'application/json'},body:JSON.stringify({action:'captcha_config',args:{}}),cache:'no-store',signal:AbortSignal.timeout(15000)});
   if(!r.ok)throw new Error('Nije moguće provjeriti sigurnosna podešavanja. Pokušaj ponovo.');
   return r.json();
  })().catch(e=>{settingsPromise=null;throw e;});
 }
 return settingsPromise;
}
function challenge({kind,host,sitekey,action}={}){
 let id,box,token,at=0,pending,resolve,reject,timer,consumed=false,disposed=false;
 const cleanup=()=>{clearTimeout(timer);if(id!==undefined)window.turnstile?.remove(id);id=undefined;box?.remove();box=null;};
 const fail=message=>{cleanup();token=null;at=0;const no=reject;pending=null;resolve=null;reject=null;no?.(new Error(message||'Sigurnosna provjera nije prošla. Pokušaj ponovo.'));};
 const start=()=>{
  if(disposed)return Promise.reject(new Error('Obrazac je zatvoren.'));
  if(token&&!consumed&&Date.now()-at<240000)return Promise.resolve(token);
  if(pending)return pending;
  cleanup();token=null;consumed=false;
  pending=new Promise((yes,no)=>{resolve=yes;reject=no;});
  // A background failure must not produce an unhandled rejection or clear the visitor's text.
  pending.catch(()=>{});
  const attempt=pending;
  (async()=>{
   const c=sitekey?{enabled:true,sitekey}:await settings();
   if(disposed)return;
   if(c.enabled!==true){const yes=resolve;pending=null;resolve=null;reject=null;yes(undefined);return;}
   if(!c.sitekey)throw new Error('Sigurnosna provjera nije podešena.');
   await loadTurnstile();if(disposed)return;
   box=document.createElement('div');box.className='captcha-check';(host||document.body).append(box);
   timer=setTimeout(()=>fail('Sigurnosna provjera je istekla. Pokušaj ponovo.'),120000);
   id=window.turnstile.render(box,{sitekey:c.sitekey,action:action||'submit_'+kind,theme:'dark',size:'flexible',appearance:'interaction-only',execution:'execute','response-field':false,
    callback:value=>{token=value;at=Date.now();clearTimeout(timer);const yes=resolve;pending=null;resolve=null;reject=null;yes?.(value);},
    'error-callback':()=>fail(),'expired-callback':()=>fail('Sigurnosna provjera je istekla. Pokušaj ponovo.'),'timeout-callback':()=>fail(),'unsupported-callback':()=>fail('Ovaj preglednik ne podržava sigurnosnu provjeru.')});
   window.turnstile.execute(id);
  })().catch(e=>fail(e.message));
  return attempt;
 };
 return {prepare:()=>{void start().catch(()=>{});},take:async()=>{const value=await start();if(value){if(consumed)throw new Error('Slanje je već u toku.');consumed=true;token=null;cleanup();}return value;},dispose:()=>{disposed=true;fail('Obrazac je zatvoren.');}};
}
const forms=new WeakMap();
export function prepareCaptcha({kind,host}={}){
 if(!host||!kind)return;
 let entry=forms.get(host);
 if(!entry||entry.kind!==kind){entry?.control.dispose();entry={kind,control:challenge({kind,host})};forms.set(host,entry);}
 entry.control.prepare();
}
export async function captchaToken(options={}){
 const entry=options.host&&forms.get(options.host);
 if(entry&&entry.kind===options.kind&&!options.sitekey&&!options.action)return entry.control.take();
 const control=challenge(options);try{return await control.take();}finally{control.dispose();}
}
export function releaseCaptcha(host){const entry=forms.get(host);entry?.control.dispose();forms.delete(host);}
