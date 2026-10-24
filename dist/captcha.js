// Optional real Turnstile integration. Enable Auth CAPTCHA protection on staging first.
export async function captchaToken() {
 const sitekey=window.ISPOVESTI_CONFIG?.turnstileSiteKey;
 if(!sitekey)return undefined;
 if(!window.turnstile)await new Promise((resolve,reject)=>{
  const s=document.createElement('script');s.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';s.async=true;s.onload=resolve;s.onerror=()=>reject(new Error('Sigurnosna provjera nije dostupna. Pokušaj kasnije.'));document.head.append(s);
 });
 return new Promise((resolve,reject)=>{
  const dialog=document.createElement('dialog'),title=document.createElement('h2'),box=document.createElement('div'),cancel=document.createElement('button');
  title.textContent='Kratka sigurnosna provjera';cancel.textContent='Odustani';cancel.className='action';dialog.append(title,box,cancel);document.body.append(dialog);dialog.showModal();
  let id,settled=false;
  function end(token){if(settled)return;settled=true;if(id!==undefined)window.turnstile.remove(id);dialog.close();dialog.remove();token?resolve(token):reject(new Error('Sigurnosna provjera nije završena.'));}
  cancel.onclick=()=>end();dialog.addEventListener('cancel',e=>{e.preventDefault();end();});
  id=window.turnstile.render(box,{sitekey,callback:token=>end(token),'error-callback':()=>end(),'expired-callback':()=>end()});
 });
}
