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
export async function captchaToken({kind,host,sitekey,action}={}){
 if(!sitekey){
  const c=window.ISPOVESTI_CONFIG;
  const r=await fetch(c.supabaseUrl+'/functions/v1/community-test-api',{method:'POST',headers:{apikey:c.publishableKey,'Content-Type':'application/json'},body:JSON.stringify({action:'captcha_config',args:{}}),cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw new Error('Nije moguće provjeriti sigurnosna podešavanja. Pokušaj ponovo.');
  const settings=await r.json();if(settings.enabled!==true)return undefined;sitekey=settings.sitekey;
 }
 if(!sitekey)throw new Error('Sigurnosna provjera nije podešena.');
 await loadTurnstile();
 return new Promise((resolve,reject)=>{
  const box=document.createElement('div');box.className='captcha-check';(host||document.body).append(box);
  let id,finished=false;
  const end=(token,error)=>{if(finished)return;finished=true;clearTimeout(timer);if(id!==undefined)window.turnstile.remove(id);box.remove();token?resolve(token):reject(new Error(error||'Sigurnosna provjera nije prošla. Pokušaj ponovo.'));};
  const timer=setTimeout(()=>end(null,'Sigurnosna provjera je istekla. Pokušaj ponovo.'),120000);
  try{id=window.turnstile.render(box,{sitekey,action:action||'submit_'+kind,theme:'dark',size:'flexible',appearance:'interaction-only',execution:'execute','response-field':false,callback:token=>end(token),'error-callback':()=>end(),'expired-callback':()=>end(),'timeout-callback':()=>end(),'unsupported-callback':()=>end(null,'Ovaj preglednik ne podržava sigurnosnu provjeru.')});window.turnstile.execute(id);}catch(e){end(null,'Sigurnosna provjera nije dostupna. Pokušaj ponovo.');}
 });
}
