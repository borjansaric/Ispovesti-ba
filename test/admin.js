import {authClient,request,isPreview,isLocal} from './api.js?v=admin1';
import {captchaToken} from './captcha.js?v=admin1';
const $=s=>document.querySelector(s);let sb,session,factor,view='reports',offset=0,security;
const status=t=>$('#admin-status').textContent=t;
const reasons={abuse:'Vrijeđanje ili uznemiravanje',threat:'Prijetnje',spam:'Spam',other:'Ostalo'};
const kinds={confession:'Ispovijest',comment:'Komentar',reply:'Odgovor'};
function clearMfa(){for(const id of ['totp-secret','mfa-code'])$('#'+id).value='';$('#totp-qr').removeAttribute('src');$('#totp-open').removeAttribute('href');$('#enroll').hidden=true;}
async function gate(){
 const r=await sb.auth.getSession();if(r.error)throw r.error;session=r.data.session;
 $('#activation').hidden=true;$('#login').hidden=!!session;$('#logout').hidden=!session;$('#tools').hidden=true;$('#mfa').hidden=true;clearMfa();
 if(!session){status('Prijavi se svojim administratorskim nalogom.');return;}
 // The server validates membership and the active Auth session before any MFA enrollment UI.
 await request('admin_session',{},session);
 const assurance=await sb.auth.mfa.getAuthenticatorAssuranceLevel();if(assurance.error)throw assurance.error;
 if(assurance.data.currentLevel!=='aal2'){
  const factors=await sb.auth.mfa.listFactors();if(factors.error)throw factors.error;
  factor=factors.data.totp.find(f=>f.status==='verified');
  if(!factor){
   for(const pending of factors.data.totp.filter(f=>f.status==='unverified')){const removed=await sb.auth.mfa.unenroll({factorId:pending.id});if(removed.error)throw removed.error;}
   const enrolled=await sb.auth.mfa.enroll({factorType:'totp',friendlyName:'Ispovesti.ba administrator'});if(enrolled.error)throw enrolled.error;
   factor=enrolled.data;const qr=factor.totp.qr_code;$('#totp-qr').src=qr.startsWith('data:')?qr:'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(qr);
   $('#totp-secret').value=factor.totp.secret;if(factor.totp.uri.startsWith('otpauth://totp/'))$('#totp-open').href=factor.totp.uri;$('#enroll').hidden=false;
   status('Završi potvrdu da bi otvorio administratorski panel.');
  }else status('Unesi kod iz aplikacije za autentifikaciju.');
  $('#mfa').hidden=false;return;
 }
 await load(true);await loadSecurity();$('#tools').hidden=false;status('Zaštićen pristup · dvofaktorska potvrda');
}
async function load(reset=false){
 if(reset){offset=0;$('#admin-content').replaceChildren();}
 const r=await request('admin_list',{view,offset},session);
 for(const item of r.items){
  const article=document.createElement('article');article.className='story';const meta=document.createElement('p');meta.className='hint';
  meta.textContent=(kinds[item.kind]||item.kind)+' · '+(item.state==='removed'?'Uklonjeno':item.state==='queued'?'Čeka red':item.publicly_visible?'Objavljeno':'Sakriveno kroz roditeljsku granu')+' · '+new Date(item.created_at).toLocaleString('sr-Latn');
  const p=document.createElement('p');p.className='body-text';p.textContent=item.body;article.append(meta,p);
  for(const report of item.reports){const line=document.createElement('p');line.className='hint';line.textContent=(reasons[report.reason]||report.reason)+' · '+new Date(report.created_at).toLocaleString('sr-Latn');article.append(line);}
  const b=document.createElement('button');b.className='action';const restore=item.state==='removed';
  b.textContent=restore?'Vrati sadržaj':'Ukloni sadržaj i sakrij granu';
  b.onclick=async()=>{if(!confirm(restore?'Vratiti ovaj sadržaj? Uklonjeni roditeljski sadržaj mora se vratiti zasebno.':'Ukloniti ovaj sadržaj? Pripadajuća grana će biti sakrivena.'))return;b.disabled=true;try{const result=await request(restore?'admin_restore':'admin_remove',{id:item.id},session);await load(true);if(restore&&result.visible===false)status(result.state==='queued'?'Ispovijest je vraćena u red čekanja.':'Sadržaj je vraćen, ali ostaje sakriven dok je roditeljska grana uklonjena.');}catch(e){status(e.message);}finally{b.disabled=false;}};
  article.append(b);$('#admin-content').append(article);
 }
 offset+=r.items.length;$('#admin-more').hidden=r.items.length<50;if(!offset)$('#admin-content').textContent='Nema sadržaja u ovom odjeljku.';
}
async function loadSecurity(){security=await request('admin_security_get',{},session);$('#captcha-sitekey').value=security.sitekey;$('#captcha-secret').value='';$('#security-status').textContent=security.enabled?'CAPTCHA zaštita je uključena za slanje ispovijesti, komentara i odgovora.':'CAPTCHA zaštita je isključena.';}
$('#login-form').onsubmit=async e=>{e.preventDefault();const b=e.submitter;b.disabled=true;try{const r=await sb.auth.signInWithPassword({email:$('#email').value,password:$('#password').value});$('#password').value='';if(r.error)throw r.error;await gate();}catch(e){status(e.message);}finally{b.disabled=false;}};
$('#activation-form').onsubmit=async e=>{e.preventDefault();const b=e.submitter;b.disabled=true;const email=$('#activation-email').value.trim(),password=$('#activation-password').value;try{if(password!==$('#activation-confirm').value)throw new Error('Lozinke se ne podudaraju.');await request('activate_admin',{code:$('#activation-code').value,email,password});$('#activation-code').value='';const r=await sb.auth.signInWithPassword({email,password});if(r.error)throw r.error;await gate();}catch(e){status(e.message);}finally{$('#activation-password').value='';$('#activation-confirm').value='';b.disabled=false;}};
$('#mfa-form').onsubmit=async e=>{e.preventDefault();const b=e.submitter;b.disabled=true;try{const r=await sb.auth.mfa.challengeAndVerify({factorId:factor.id,code:$('#mfa-code').value});$('#mfa-code').value='';if(r.error)throw r.error;clearMfa();await gate();}catch(e){status(e.message);}finally{b.disabled=false;}};
$('#show-activation').onclick=()=>{$('#login').hidden=true;$('#activation').hidden=false;};
$('#totp-copy').onclick=async()=>{try{await navigator.clipboard.writeText($('#totp-secret').value);status('Ključ je kopiran. Dodaj ga u aplikaciju za autentifikaciju.');}catch{const field=$('#totp-secret');field.type='text';field.select();status('Kopiraj prikazani ključ u aplikaciju za autentifikaciju.');}};
document.querySelectorAll('[data-admin-view]').forEach(b=>b.onclick=()=>{view=b.dataset.adminView;load(true).catch(e=>status(e.message));});
$('#admin-more').onclick=()=>load().catch(e=>status(e.message));
for(const[id,paused]of[['pause',true],['resume',false]])$('#'+id).onclick=async()=>{try{await request('admin_publisher',{paused},session);status(paused?'Objavljivanje je pauzirano.':'Objavljivanje nastavlja redom, najviše jednom na sat.');}catch(e){status(e.message);}};
async function saveSecurity(enabled){const enable=$('#captcha-enable'),disable=$('#captcha-disable');enable.disabled=disable.disabled=true;try{const sitekey=$('#captcha-sitekey').value.trim();const token=enabled?await captchaToken({sitekey,action:'admin_check',host:$('#captcha-host')}):undefined;await request('admin_security_set',{enabled,sitekey,secret:$('#captcha-secret').value,captcha_token:token},session);await loadSecurity();}catch(e){$('#security-status').textContent=e.message;}finally{$('#captcha-secret').value='';enable.disabled=disable.disabled=false;}}
$('#security-form').onsubmit=e=>{e.preventDefault();saveSecurity(true);};$('#captcha-disable').onclick=()=>saveSecurity(false);
$('#logout').onclick=async()=>{await sb.auth.signOut({scope:'local'});$('#admin-content').replaceChildren();$('#captcha-secret').value='';clearMfa();await gate();};
if(isPreview||isLocal){status('Administracija je zaključana u lokalnom pregledu.');$('#login').hidden=true;}else{
 try{sb=authClient(true);const activation=new URLSearchParams(location.hash.slice(1)).get('activate');if(activation){history.replaceState(null,'',location.pathname+location.search);$('#activation-code').value=activation;$('#activation').hidden=false;$('#login').hidden=true;status('Prvi put aktiviraj svoj administratorski nalog.');}else gate().catch(e=>status(e.message));}catch(e){status(e.message);}
}
