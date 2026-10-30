// Direct text creatives only: no third-party embeds, tracking or impression claims.
const config=window.ISPOVESTI_CONFIG||{},box=document.querySelector('#banner-slot');let pending=false;
async function refresh(){
 if(config.mode!=='live'||!box||document.hidden||document.body.classList.contains('chat-open')||pending)return;
 pending=true;
 try{const r=await fetch(config.supabaseUrl+'/functions/v1/community-live-api',{method:'POST',headers:{apikey:config.publishableKey,'Content-Type':'application/json'},body:JSON.stringify({action:'banner_current',args:{}}),cache:'no-store',signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error();const {item}=await r.json();box.replaceChildren();box.classList.remove('direct-sponsor');if(item){const url=new URL(item.destination);if(url.protocol!=='https:'||url.username||url.password)throw Error();const a=document.createElement('a');a.href=url.href;a.rel='sponsored noopener noreferrer';a.target='_blank';a.textContent='Sponzor: '+item.caption;box.append(a);box.classList.add('direct-sponsor');box.setAttribute('aria-label','Sponzorisani sadržaj')}else{box.textContent='Prostor za reklamu';box.setAttribute('aria-label','Prostor za reklamu')}}
 catch{box.classList.remove('direct-sponsor');box.textContent='Prostor za reklamu';box.setAttribute('aria-label','Prostor za reklamu')}
 finally{pending=false}
}
void refresh();const timer=setInterval(refresh,60000);document.addEventListener('visibilitychange',refresh);window.addEventListener('pagehide',()=>clearInterval(timer));
