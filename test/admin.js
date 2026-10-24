import { authClient,request,isPreview,isLocal } from './api.js';
const $=s=>document.querySelector(s);let sb,session,factor,view='reports',offset=0;
const status=t=>$('#admin-status').textContent=t;
const reasons={abuse:'Vrijeđanje ili uznemiravanje',threat:'Prijetnje',spam:'Spam',other:'Ostalo'};
async function gate(){
 const r=await sb.auth.getSession();if(r.error)throw r.error;session=r.data.session;
 $('#login').hidden=!!session;$('#tools').hidden=true;$('#mfa').hidden=true;
 if(!session)return;
 const assurance=await sb.auth.mfa.getAuthenticatorAssuranceLevel();if(assurance.error)throw assurance.error;
 if(assurance.data.currentLevel!=='aal2'){
  const factors=await sb.auth.mfa.listFactors();if(factors.error)throw factors.error;
  factor=factors.data.totp.find(f=>f.status==='verified');
  if(!factor){status('Nalog mora imati uključen TOTP drugi faktor prije administratorskog pristupa.');return;}
  $('#mfa').hidden=false;return;
 }
 await load(true);$('#tools').hidden=false;status('Zaštićen pristup · dvofaktorska potvrda');
}
async function load(reset=false){if(reset){offset=0;$('#admin-content').replaceChildren();}const r=await request('admin_list',{view,offset},session);
 for(const item of r.items){const article=document.createElement('article');article.className='story';const meta=document.createElement('p');meta.className='hint';meta.textContent=item.kind+' · '+item.state+' · '+new Date(item.created_at).toLocaleString('sr-Latn');const p=document.createElement('p');p.className='body-text';p.textContent=item.body;article.append(meta,p);
 for(const report of item.reports){const line=document.createElement('p');line.className='hint';line.textContent=reasons[report.reason]+' · '+new Date(report.created_at).toLocaleString('sr-Latn');article.append(line);}
 if(item.state!=='removed'){const b=document.createElement('button');b.className='action';b.textContent='Ukloni sadržaj i sakrij granu';b.onclick=async()=>{if(!confirm('Ukloniti ovaj sadržaj? Pripadajući komentari i odgovori biće sakriveni.'))return;b.disabled=true;try{await request('admin_remove',{id:item.id},session);await load(true);}catch(e){status(e.message);}finally{b.disabled=false;}};article.append(b);}$('#admin-content').append(article);}
 offset+=r.items.length;$('#admin-more').hidden=r.items.length<50;if(!offset)$('#admin-content').textContent='Nema sadržaja u ovom odjeljku.';
}
$('#login-form').onsubmit=async e=>{e.preventDefault();try{const r=await sb.auth.signInWithPassword({email:$('#email').value,password:$('#password').value});$('#password').value='';if(r.error)throw r.error;await gate();}catch(e){status(e.message);}};
$('#mfa-form').onsubmit=async e=>{e.preventDefault();try{const r=await sb.auth.mfa.challengeAndVerify({factorId:factor.id,code:$('#mfa-code').value});$('#mfa-code').value='';if(r.error)throw r.error;await gate();}catch(e){status(e.message);}};
document.querySelectorAll('[data-admin-view]').forEach(b=>b.onclick=()=>{view=b.dataset.adminView;load(true).catch(e=>status(e.message));});
$('#admin-more').onclick=()=>load().catch(e=>status(e.message));
for(const[id,paused]of[['pause',true],['resume',false]])$('#'+id).onclick=async()=>{try{await request('admin_publisher',{paused},session);status(paused?'Objavljivanje je pauzirano.':'Objavljivanje nastavlja redom, najviše jednom na sat.');}catch(e){status(e.message);}};
$('#logout').onclick=async()=>{await sb.auth.signOut();await gate();};
if(isPreview||isLocal){status('Administracija je zaključana u izolovanom pregledu. Nema veze sa produkcijom.');$('#login').hidden=true;}else{try{sb=authClient(true);gate().catch(e=>status(e.message));}catch(e){status(e.message);}}
