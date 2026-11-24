import {authClient,request} from '../api.js?v=20261122-chat-admin2';
import {chatRequest} from './client.mjs?v=20261122-chat-admin1';
const $=selector=>document.querySelector(selector);
const loginPanel=$('#login-panel'),archivePanel=$('#archive-panel'),loginForm=$('#login-form');
const loginStatus=$('#login-status'),archiveStatus=$('#archive-status'),messages=$('#messages'),olderButton=$('#older'),codeForm=$('#email-code-form');
let emailChallenge=null,currentSession=null;
let adminClient,oldestId=null,loaded=0,busy=false;
const node=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const date=value=>value?new Date(value).toLocaleString('sr-Latn-RS',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'}):'';
const reportReasonLabel=reason=>({hate_speech:'Govor mržnje',spam:'Spam',other:'Drugo',abuse:'Uvredljiv sadržaj',threat:'Prijetnja'}[reason]||reason);
function renderMessage(item){
 const card=node('article','message'+(item.removed?' removed':''));
 const head=node('div','message-head');
 head.append(node('strong','',item.generated_nickname||'Anonimni učesnik'),node('time','',date(item.created_at)));
 if(item.removed)head.append(node('span','removed-label','UKLONJENA PORUKA'));
 const body=node('p','message-body',item.body);
 card.append(head,body);
 const reports=Array.isArray(item.reports)?item.reports:[];
 if(reports.length){
  const section=node('section','reports');section.append(node('h3','','Prijave ('+reports.length+')'));
  for(const report of reports){section.append(node('p','report','Razlog: '+reportReasonLabel(report.reason)+' · '+date(report.created_at)));if(report.details)section.append(node('p','report-detail','Dodatni opis: '+report.details));}
  card.append(section);
 }else card.append(node('p','no-reports','Nema prijava.'));
 return card;
}
async function loadArchive(older=false){
 if(busy)return;busy=true;olderButton.disabled=true;archiveStatus.textContent='Učitavam…';
 try{
  const data=await chatRequest('admin_messages',older&&oldestId?{before:oldestId}:{},true);
  const items=Array.isArray(data.items)?data.items:[];
  if(!older)messages.replaceChildren();
  for(const item of items)messages.append(renderMessage(item));
  if(items.length)oldestId=items.at(-1).id;
  loaded+=items.length;
  $('#archive-count').textContent='Prikazano '+loaded+' poruka · najnovije prve';
  olderButton.hidden=items.length<100;
  archiveStatus.textContent=items.length?'':'Nema više poruka za prikaz.';
 }catch(error){
  archiveStatus.textContent=error.message||'Arhiva trenutno nije dostupna.';
  if(!older)olderButton.hidden=true;
 }finally{busy=false;olderButton.disabled=false;}
}
async function verifyAdmin(){
 await chatRequest('admin_status',{},true);
 loginPanel.hidden=true;archivePanel.hidden=false;loaded=0;oldestId=null;
 await loadArchive(false);
}
async function beginEmailVerification(session){
 currentSession=session;
 const state=await request('admin_email_status',{},session);
 if(state.verified){await verifyAdmin();return;}
 const started=await request('admin_email_begin',{},session);
 if(started.limited)throw new Error('Sačekaj najmanje jednu minutu prije novog koda.');
 emailChallenge=started.challenge;
 codeForm.hidden=false;
 loginStatus.textContent='Poslala sam sigurnosni kod na unaprijed podešenu administratorsku e-mail adresu. Unesi ga ovdje.';
}
adminClient=authClient(true);
loginForm.addEventListener('submit',async event=>{
 event.preventDefault();const submit=loginForm.querySelector('button');submit.disabled=true;loginStatus.textContent='Provjeravam prijavu…';
 try{
  const {data,error}=await adminClient.auth.signInWithPassword({email:$('#email').value.trim(),password:$('#password').value});
  if(error)throw error;
  await beginEmailVerification(data.session);
 }catch(error){loginStatus.textContent=error.message||'Prijava nije potvrđena. Provjeri administratorski nalog.';try{await adminClient.auth.signOut();}catch{}}
 finally{submit.disabled=false;}
});
codeForm.addEventListener('submit',async event=>{
 event.preventDefault();const submit=codeForm.querySelector('button');submit.disabled=true;loginStatus.textContent='Provjeravam sigurnosni kod…';
 try{
  if(!currentSession||!emailChallenge)throw new Error('Prijavi se ponovo.');
  const result=await request('admin_email_verify',{challenge:emailChallenge,code:$('#email-code').value.trim()},currentSession);
  if(result.relogin){await adminClient.auth.signOut();codeForm.hidden=true;loginStatus.textContent='Sigurnosna postavka je obnovljena. Prijavi se ponovo lozinkom.';return;}
  if(result.verified!==true)throw new Error('E-mail potvrda nije uspjela.');
  codeForm.hidden=true;emailChallenge=null;await verifyAdmin();
 }catch(error){loginStatus.textContent=error.message||'Kod nije potvrđen. Pokušaj ponovo.';}
 finally{submit.disabled=false;}
});
olderButton.addEventListener('click',()=>loadArchive(true));
$('#sign-out').addEventListener('click',async()=>{
 await adminClient.auth.signOut();archivePanel.hidden=true;loginPanel.hidden=false;messages.replaceChildren();loginForm.reset();codeForm.reset();codeForm.hidden=true;emailChallenge=null;currentSession=null;loginStatus.textContent='Odjavljeni ste.';
});
adminClient.auth.getSession().then(async({data,error})=>{
 if(error||!data.session)return;
 try{await beginEmailVerification(data.session);}catch(error){loginStatus.textContent='Sesija postoji, ali je potrebna nova prijava lozinkom za potvrdu e-maila.';}
});
