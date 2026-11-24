import {chatRequest} from './chat/client.mjs?v=20261124-module-singleton1';
import {collectReplies,replyCounterText} from './chat/thread-model.mjs?v=progressive11';
import { request, authClient, isPreview, isLocal, prepareSubmission, initializeSecurity } from './api.js?v=20261124-module-singleton1';
import { listPendingSubmissions, savePendingSubmission, deletePendingSubmission } from './submission-store.mjs';
const $ = s => document.querySelector(s);

/* Text-size controls: affect confession/comment body copy only. */
(() => {
 const KEY='ispovesti:font-size-level-v2';
 const LEVELS=[1,1.1,1.2,1.3,1.4];
 const BASE='data-isp-font-base';
 let level=0;
 try{
  const saved=Number.parseInt(localStorage.getItem(KEY)||'0',10);
  if(Number.isInteger(saved)&&saved>=0&&saved<LEVELS.length)level=saved;
 }catch{}
 // Clean up inline sizes left by the previous, overly broad implementation.
 document.querySelectorAll('body ['+BASE+']').forEach(el=>{
  el.style.removeProperty('font-size');
  el.removeAttribute(BASE);
 });
 function remember(el){
  if(!(el instanceof Element)||!el.matches('.body-text')||el.hasAttribute(BASE))return;
  const size=Number.parseFloat(getComputedStyle(el).fontSize);
  if(Number.isFinite(size))el.setAttribute(BASE,String(size));
 }
 function scan(root=document.body){
  if(root instanceof Element)remember(root);
  root?.querySelectorAll?.('.body-text').forEach(remember);
 }
 function apply(){
  scan();
  const factor=LEVELS[level];
  document.querySelectorAll('body .body-text').forEach(el=>{
   const base=Number.parseFloat(el.getAttribute(BASE));
   if(Number.isFinite(base))el.style.setProperty('font-size',(base*factor)+'px','important');
  });
  try{localStorage.setItem(KEY,String(level));}catch{}
  document.documentElement.setAttribute('data-isp-font-level',String(level));
  const plus=document.getElementById('font-increase');
  const minus=document.getElementById('font-decrease');
  if(plus)plus.title='Povećaj tekst ispovijesti i komentara · trenutno '+Math.round(factor*100)+'%';
  if(minus)minus.title='Smanji tekst ispovijesti i komentara · trenutno '+Math.round(factor*100)+'%';
 }
 function change(delta){
  const next=Math.max(0,Math.min(LEVELS.length-1,level+delta));
  if(next===level)return;
  level=next;
  apply();
 }
 document.getElementById('font-increase')?.addEventListener('click',()=>change(1));
 document.getElementById('font-decrease')?.addEventListener('click',()=>change(-1));
 apply();
 const observer=new MutationObserver(records=>{
  let added=false;
  for(const record of records){
   if(record.type!=='childList')continue;
   for(const item of record.addedNodes){
    if(item instanceof Element){scan(item);added=true;}
    else if(item.nodeType===Node.TEXT_NODE&&item.parentElement?.matches('.body-text')){remember(item.parentElement);added=true;}
   }
  }
  if(added)apply();
 });
 observer.observe(document.body,{childList:true,subtree:true});
})();
const feed = $('#feed'), dialog = $('#dialog');
const dailyTabs={confession:$('#daily-confessions'),comment:$('#daily-comments')};
let currentView='new',offset=0,generation=0,busy=false,hasMoreFeed=true;
let detailGeneration=0;
const feedSorts=new Set(['new','popular','likes','dislikes','comments','random']);
let randomFeedSeed=crypto.randomUUID();
// One batched state request per group of 20 cards, rather than 40 separate requests.
const stateListeners=new Set();let stateTimer;
function watchState(id,type,element,render){
 try{const saved=JSON.parse(localStorage.getItem('ispovesti:card-state:'+String(id))||'null');if(saved&&Date.now()-Number(saved.savedAt||0)<604800000&&saved[type])render(saved[type]);}catch{}
 stateListeners.add({id,type,element,render});clearTimeout(stateTimer);stateTimer=setTimeout(refreshStates,30);
}
async function refreshStates(){
 for(const entry of stateListeners)if(!entry.element.isConnected)stateListeners.delete(entry);
 const entries=[...stateListeners],ids=[...new Set(entries.map(e=>e.id))];
 for(let i=0;i<ids.length;i+=20){
  try{
   const result=await request('cards',{ids:ids.slice(i,i+20)});
   for(const id of ids){const data=result[id];if(data)try{localStorage.setItem('ispovesti:card-state:'+String(id),JSON.stringify({vote:data.vote||null,context:data.context||null,savedAt:Date.now()}));}catch{}}
   for(const e of entries){const data=result[e.id]?.[e.type];if(data)e.render(data);}
  }catch{}
 }
}
setInterval(()=>{if(!document.hidden)refreshStates();},60000);
setInterval(()=>{if(!document.hidden&&currentView.startsWith('daily_'))load(true);},60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&currentView.startsWith('daily_'))load(true);});
const node=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const button=(text,fn,cls='action')=>{const b=node('button',cls,text);b.type='button';b.addEventListener('click',()=>Promise.resolve(fn(b)).catch(err=>toast(err.message)));return b;};
const date=v=>v?new Date(v).toLocaleString('sr-Latn-RS',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'';
const FEED_STATE_KEY='ispovesti:feed-state:v1';
let feedStateSaveTimer;
function persistFeedState(){
 if(new URLSearchParams(location.search).has('ispovest'))return;
 try{sessionStorage.setItem(FEED_STATE_KEY,JSON.stringify({view:currentView,offset,scrollY:window.scrollY,seed:currentView==='random'?randomFeedSeed:null}));}catch{}
}
window.addEventListener('scroll',()=>{clearTimeout(feedStateSaveTimer);feedStateSaveTimer=setTimeout(persistFeedState,120);},{passive:true});
window.addEventListener('pagehide',persistFeedState);

const dailyDayLabel=value=>{const d=new Date(String(value)+'T12:00:00');return Number.isNaN(d.getTime())?String(value):d.toLocaleDateString('sr-Latn-RS',{weekday:'long',day:'numeric',month:'long',year:'numeric'});};
function toast(text){$('#toast').textContent=text;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').textContent='',6500);}

const pendingPanel=node('section','panel pending-submissions');
pendingPanel.hidden=true;
$('#feed').before(pendingPanel);
let pendingResume=null;
async function refreshPendingSubmissions(){
 try{
  const records=await listPendingSubmissions();
  pendingPanel.replaceChildren();
  if(!records.length){pendingPanel.hidden=true;return;}
  pendingPanel.hidden=false;
  pendingPanel.append(node('h2','','Nedovršena slanja'),node('p','pending-submissions-note','Ova slanja su sačuvana samo u ovom pregledaču. Nastavi ih sa istim ID-jem zahtjeva ili ih odbaci.'));
  const list=node('div','pending-submission-list');
  for(const record of records){
   const row=node('article','pending-submission');
   const label=record.kind==='confession'?'Ispovest':record.kind==='reply'?'Odgovor':'Komentar';
   const body=String(record.payload?.body||'');
   row.append(node('strong','',label),node('p','pending-submission-text',body.length>150?body.slice(0,150)+'…':body));
   const actions=node('div','pending-submission-actions');
   actions.append(button('Nastavi slanje',()=>resumePendingSubmission(record),'action pending-resume'));
   actions.append(button('Odbaci',async()=>{
    if(!confirm('Odbaciti sačuvano slanje? Tekst i ID zahtjeva biće uklonjeni sa ovog uređaja.'))return;
    await deletePendingSubmission(record.requestId);
    await refreshPendingSubmissions();
   },'text-button pending-discard'));
   row.append(actions);list.append(row);
  }
  pendingPanel.append(list);
 }catch(error){
  pendingPanel.hidden=false;
  pendingPanel.replaceChildren(node('strong','','Lokalna evidencija slanja nije dostupna.'),node('p','pending-submissions-note',error.message||'Provjeri podršku pregledača za IndexedDB.'));
 }
}
async function resumePendingSubmission(record){
 pendingResume=record;
 if(record.kind==='confession'){
  modal('Nastavi slanje ispovesti',contentForm('confession',{},()=>{},null,record));
  return;
 }
 const confessionId=String(record.payload?.confession_id||'');
 if(!/^\d+$/.test(confessionId)){pendingResume=null;toast('Nedostaje podatak o ispovesti za nastavak slanja.');return;}
 const url=new URL(location.href);url.search='';url.hash='';url.searchParams.set('ispovest',confessionId);
 if(url.href!==location.href)history.pushState({ispovestiDetail:true},'',url);
 await openDirectConfession(confessionId);
 if(!document.querySelector('#feed .direct-story')){pendingResume=null;toast('Ispovest trenutno nije dostupna. Sačuvano slanje nije obrisano.');return;}
 if(record.kind==='reply'){
  const parentId=String(record.payload?.parent_id||'');
  if(!/^\d+$/.test(parentId)){pendingResume=null;toast('Nedostaje komentar na koji je odgovor bio namijenjen.');return;}
  let parent=null;
  for(let attempt=0;attempt<60&&!parent;attempt++){
   parent=document.querySelector('#feed .comment[data-comment-id="'+parentId+'"]');
   if(!parent)await new Promise(resolve=>setTimeout(resolve,100));
  }
  const trigger=parent?.querySelector('.reply-toggle');
  if(!trigger){pendingResume=null;toast('Glavni komentar nije prikazan. Sačuvani odgovor je i dalje dostupan u nedovršenim slanjima.');return;}
  trigger.click();
 }
 if(pendingResume===record){pendingResume=null;toast('Nije pronađeno odgovarajuće polje za nastavak. Slanje je sačuvano.');}
}


function modal(title,content){$('#dialog-title').textContent=title;$('#dialog-body').replaceChildren(content);if(!dialog.open)dialog.showModal();}

const menuToggle=$('#menu-toggle'),sideMenu=$('#side-menu'),menuOverlay=$('#menu-overlay');
let menuCloseTimer=null;
function closeMenu(){setMenu(false);}
function setMenu(open){
 clearTimeout(menuCloseTimer);
 if(open){
  sideMenu.hidden=false;menuOverlay.hidden=false;
  requestAnimationFrame(()=>document.body.classList.add('menu-open'));
 }else{
  document.body.classList.remove('menu-open');
  menuCloseTimer=setTimeout(()=>{sideMenu.hidden=true;menuOverlay.hidden=true;},300);
 }
 menuToggle.setAttribute('aria-expanded',String(open));menuToggle.setAttribute('aria-label',open?'Zatvori meni':'Otvori meni');menuToggle.textContent=open?'‹‹‹':'›››';
 for(const el of document.querySelectorAll('.site-header,main,footer'))el.inert=open;
 if(open){const allConfessionsLink=sideMenu.querySelector('.nav-button[data-view="new"]');
  if(allConfessionsLink){allConfessionsLink.classList.add('menu-open-focus');allConfessionsLink.focus();};requestAnimationFrame(()=>window.dispatchEvent(new Event('ispovesti:layout-visible')));}else{sideMenu.querySelector('.nav-button[data-view="new"]')?.classList.remove('menu-open-focus');menuToggle.blur();}
}
menuToggle.onclick=()=>{const open=!document.body.classList.contains('menu-open');setMenu(open);};
menuOverlay.onclick=()=>{closeMenu();};
// Open menu on a rightward horizontal finger swipe from anywhere on the page.
let menuSwipeStart=null;
function startMenuSwipe(touch){
 if(!document.body.classList.contains('menu-open'))menuSwipeStart={x:touch.clientX,y:touch.clientY};
 else menuSwipeStart=null;
}
function resetMenuSwipe(){menuSwipeStart=null;}
document.addEventListener('touchstart',event=>{
 if(event.touches.length===1)startMenuSwipe(event.touches[0]);
 else resetMenuSwipe();
},{passive:true,capture:true});
document.addEventListener('touchmove',event=>{
 if(!menuSwipeStart||event.touches.length!==1)return;
 const touch=event.touches[0],dx=touch.clientX-menuSwipeStart.x,dy=touch.clientY-menuSwipeStart.y;
 if(dx>65&&dx>Math.abs(dy)*1.2){
  resetMenuSwipe();
  setMenu(true);
 }else if(Math.abs(dy)>Math.abs(dx)*1.2){
  resetMenuSwipe();
 }
},{passive:true,capture:true});
document.addEventListener('touchend',resetMenuSwipe,{passive:true,capture:true});
document.addEventListener('touchcancel',resetMenuSwipe,{passive:true,capture:true});
document.addEventListener('keydown',event=>{
 if(sideMenu.hidden||dialog.open)return;
 if(event.key==='Escape'){closeMenu();}
 if(event.key==='Tab'){
  const items=[menuToggle,...sideMenu.querySelectorAll('button:not(:disabled),input,textarea,select,a[href]')];
  const first=items[0],last=items.at(-1);
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
 }
});
$('#close-dialog').onclick=()=>dialog.close();
$('#write').onclick=()=>modal('Ispovest',contentForm('confession',{},()=>{}));
$('#sidebar-compose-open').onclick=()=>{closeMenu();modal('Ispovest',contentForm('confession',{},()=>{}));};
$('#quick-compose').onclick=()=>modal('Ispovest',contentForm('confession',{},()=>{}));
$('#privacy').onclick=()=>modal('Tvoja privatnost',node('p','', 'Ne tražimo e-mail, lozinku ni pravo ime. Anonimna sesija čuva se u tvom pregledaču. Za zbirnu statistiku povratka koristi se nasumični identifikator pregledača: analitička baza čuva samo njegov zaštićeni hash i datum posjete, bez povezivanja s anonimnom sesijom, IP adresom, putanjom stranice ili tekstom. Identifikator važi samo u istom pregledaču i na istom uređaju; brisanje podataka sajta resetuje ga. Analitički zapisi se automatski brišu nakon 180 dana. Tehnički podaci koje obrađuju hosting i sigurnosni sistemi ne znače apsolutnu anonimnost. U tekst ne upisuj podatke po kojima se ti ili drugi mogu prepoznati.'));
$('#footer-privacy').onclick=()=>$('#privacy').click();
$('#rules').onclick=()=>modal('Pravila zajednice',node('p','', 'Piši bez vređanja, uznemiravanja, pretnji i spama. Slike i linkovi nisu dozvoljeni. Objavljeni tekst ne možeš naknadno uređivati ili brisati. Administrator može ukloniti neprikladan sadržaj. Čitanje, objavljivanje ispovesti, komentari, odgovori i glasanje su besplatni. Ispovesti čekaju red i objavljuje se najviše jedna na sat.'));
if(isLocal)$('#preview').textContent='Lokalni test · bez veze sa živim sajtom';
else if(window.ISPOVESTI_CONFIG?.mode==='live-test')$('#preview').textContent='TEST · prava baza, odvojeni probni podaci';
else if(!isPreview)$('#preview').hidden=true;
function metadata(item){const div=node('div','story-meta');const author=String(item.nickname||'').trim();if(author)div.append(node('span','author',author));const t=node('time','',date(item.published_at||item.created_at));t.dateTime=item.published_at||item.created_at||'';div.append(t);return div;}
function contentForm(kind,extra,done,onBack,resumeRecord=null){
 const form=node('form',kind==='confession'?'form':'form discussion-form'),label=node('label','',kind==='confession'?'Ispovest':'Tvoje reči'),text=node('textarea');
 const matchesPending=record=>record?.kind===kind&&String(record.payload?.confession_id||'')===String(extra.confession_id||'')&&String(record.payload?.parent_id||'')===String(extra.parent_id||'');
 const restored=resumeRecord||(pendingResume&&matchesPending(pendingResume)?pendingResume:null);
 if(restored&&pendingResume===restored)pendingResume=null;
 text.addEventListener('focus',()=>prepareSubmission(kind,form));
 text.addEventListener('input',()=>{prepareSubmission(kind,form);if(kind==='confession'){text.style.height='auto';text.style.height=Math.max(30,text.scrollHeight)+'px';}});
 text.required=true;text.maxLength=kind==='confession'?5000:1000;text.classList.toggle('discussion-textarea',kind!=='confession');
 text.placeholder=kind==='confession'?'Napiši ono što želiš da podeliš...':kind==='comment'?'':'Napiši odgovor...';label.append(text);
 const nickLabel=node('label','','Ime autora'),nick=node('input');nick.maxLength=40;nick.autocomplete='off';nickLabel.append(nick);
 const status=node('p','hint'),send=node('button',kind==='confession'?'primary send-confession':'primary',kind==='confession'?'':'Pošalji');send.type='submit';
 const sendPrefix=kind==='confession'?node('span','send-prefix','Pošalji'):null;if(kind==='confession')send.append(sendPrefix,node('span','send-rest','ispovest'));
 const identityRow=node('div','identity-row');identityRow.append(nickLabel,send);
 const row=node('div','row'),back=onBack?button('← Nazad',()=>onBack(),'discussion-back'):null;if(back)row.append(back);
 form.append(label,identityRow,...(back?[row]:[]),status);
 if(kind==='confession'){const syncUnderline=()=>{if(!form.isConnected||!form.getClientRects().length)return;const left=text.getBoundingClientRect().left,right=sendPrefix.getBoundingClientRect().right,width=right-left;if(width>0&&Math.abs(text.getBoundingClientRect().width-width)>0.5)text.style.width=`${width}px`;};requestAnimationFrame(syncUnderline);window.addEventListener('resize',syncUnderline,{passive:true});window.addEventListener('ispovesti:layout-visible',syncUnderline);}
 let allowDuplicate=Boolean(restored?.payload?.allow_duplicate),duplicateButton,sending=false,requestId=restored?.requestId||null,lastPayload=restored?JSON.stringify(restored.payload):null;
 if(restored){
  text.value=String(restored.payload?.body||'');
  nick.value=String(restored.payload?.nickname||'');
  status.textContent='Sačuvano na ovom uređaju. Pritisni „Pošalji“ da nastaviš sa istim ID-jem zahtjeva.';
 }
 form.onsubmit=async e=>{
  e.preventDefault();if(sending)return;
  const body=text.value.trim(),nickname=nick.value.trim(),count=[...body].length,min=kind==='confession'?15:1,max=kind==='confession'?5000:1000;
  if(count<min||count>max){status.textContent=`Tekst mora imati od ${min} do ${max} znakova.`;status.className='hint error';return;}
  const payload={kind,body,nickname,...extra,allow_duplicate:allowDuplicate};
  const fingerprint=JSON.stringify(payload);if(fingerprint!==lastPayload){requestId=crypto.randomUUID();lastPayload=fingerprint;}
  const optimistic=kind==='confession'?null:{id:'pending-'+requestId,body,nickname:nickname||null,created_at:new Date().toISOString(),parent_id:extra.parent_id||null,has_replies:false,pending:true};
  let optimisticShown=false;sending=true;send.disabled=true;if(back)back.disabled=true;text.disabled=true;nick.disabled=true;
  const submittedAt=performance.now();status.className='hint';status.textContent='Šaljem…';
  try{
   await savePendingSubmission({requestId,kind,context:extra,payload,createdAt:restored?.createdAt||Date.now()});
   await refreshPendingSubmissions();
   if(optimistic){await done(optimistic,null,{phase:'optimistic'});optimisticShown=true;}
   const r=await request('submit',{...payload,request_id:requestId},null,form),confirmedAt=performance.now();
   if(r.duplicate){
    if(optimisticShown)await done(null,null,{phase:'rollback',pendingId:optimistic.id});
    await deletePendingSubmission(requestId).catch(()=>{});
    void refreshPendingSubmissions();
    requestId=null;lastPayload=null;status.textContent='Ovaj tekst si već poslao. Ako želiš, možeš ga poslati ponovo.';
    if(!duplicateButton){duplicateButton=button('Ipak pošalji',()=>{allowDuplicate=true;form.requestSubmit();});form.append(duplicateButton);}return;
   }
   const confirmed=r.item||{id:r.id,body,nickname:nickname||null,created_at:new Date().toISOString(),parent_id:extra.parent_id||null,has_replies:false};
   const completedRequestId=requestId;
    try{await deletePendingSubmission(completedRequestId);}catch{toast('Slanje je potvrđeno, ali lokalna evidencija nije uklonjena. Ponovno slanje je bezbjedno.');}
    void refreshPendingSubmissions();
    requestId=null;lastPayload=null;status.textContent='';text.value='';nick.value='';allowDuplicate=false;duplicateButton?.remove();duplicateButton=null;
   if(kind==='confession'){dialog.close();closeMenu();toast('Tvoja ispovest je uspešno poslata. Čeka svoj red za objavljivanje.');}
   else{await done(confirmed,r.context,{phase:'confirmed',pendingId:optimistic.id});toast(kind==='reply'?'Tvoj odgovor je poslat.':'Tvoj komentar je poslat.');}
   requestAnimationFrame(()=>{performance.measure('ispovesti-submit-render',{start:confirmedAt,end:performance.now()});performance.measure('ispovesti-submit-total',{start:submittedAt,end:performance.now()});const timings={};for(const name of ['session','captcha','network','render','total']){const measure=performance.getEntriesByName('ispovesti-submit-'+name).at(-1);if(measure)timings[name]=Math.round(measure.duration);}form.dataset.submissionTiming=JSON.stringify(timings);for(const name of ['session','captcha','network','render','total'])performance.clearMeasures('ispovesti-submit-'+name);});
  }catch(err){if(optimisticShown)await done(null,null,{phase:'rollback',pendingId:optimistic.id});status.textContent=err.message;status.className='hint error';}
  finally{sending=false;send.disabled=false;if(back)back.disabled=false;text.disabled=false;nick.disabled=false;}
 };
 text.addEventListener('input',()=>{allowDuplicate=false;duplicateButton?.remove();duplicateButton=null;});
 return form;
}
function pulseHeart(b){if(b.getAttribute('aria-pressed')==='true'&&!matchMedia('(prefers-reduced-motion: reduce)').matches)b.animate([{transform:'scale(1)'},{transform:'scale(1.14)'},{transform:'scale(1)'}],{duration:200,easing:'ease-out'});}
function heartStyleKey(kind,id){return 'ispovesti:heart-style:'+kind+':'+String(id);}
function applyHeartStyle(btn,kind,id,selected){
 const key=heartStyleKey(kind,id);
 if(!selected){delete btn.dataset.heartStyle;try{localStorage.removeItem(key);}catch{}return;}
 let style=0;
 try{style=Number(localStorage.getItem(key));}catch{}
 if(!Number.isInteger(style)||style<1||style>41){style=Math.random()<0.01?41:Math.floor(Math.random()*40)+1;try{localStorage.setItem(key,String(style));}catch{}}
 btn.dataset.heartStyle=String(style);
}
function voteControls(item){
 const row=node('div','vote-controls');const buttons=[];let current={likes:0,dislikes:0,my_vote:null,can_change:true};
 for(const [value,symbol] of [[1,'👍'],[-1,'👎']]){
  const b=button(symbol,async btn=>{
   if(btn.dataset.voteLocked==='true'||buttons.some(x=>x.dataset.pending==='true'))return;
   const previous={...current},next={...current};
   next.likes=Math.max(0,Number(current.likes||0)-(current.my_vote===1?1:0)+(value===1?1:0));
   next.dislikes=Math.max(0,Number(current.dislikes||0)-(current.my_vote===-1?1:0)+(value===-1?1:0));
   next.my_vote=value;render(next);
   btn.dataset.pending='true';btn.disabled=true;
   try{render(await request('vote',{id:item.id,value}));}
   catch(error){render(previous);throw error;}
   finally{delete btn.dataset.pending;btn.disabled=false;}
  });
  buttons.push(b);
 }
 function render(r){
  current={...current,...r};
  const hasVote=current.my_vote===1||current.my_vote===-1;
  row.classList.toggle('has-vote',hasVote);
  buttons.forEach((b,i)=>{
   const value=i===0?1:-1;
   b.classList.toggle('selected',current.my_vote===value);
   b.dataset.voteLocked=String(current.can_change===false);
   b.setAttribute('aria-disabled',String(current.can_change===false));
   b.setAttribute('aria-pressed',String(current.my_vote===value));
   b.setAttribute('aria-label',i===0?'Pozitivan glas':'Negativan glas');
   b.textContent=(i===0?'👍 ':'👎 ')+String(i===0?(current.likes??0):(current.dislikes??0));
  });
 }
 row.append(...buttons);render(current);
 watchState(item.id,'vote',row,render);
 return row;
}
function reportStorageKey(item,kind){return 'ispovesti:reported:'+kind+':'+String(item.id);}
function syncReportButton(btn,item,kind){try{const done=localStorage.getItem(reportStorageKey(item,kind))==='1';btn.classList.toggle('reported',done);btn.setAttribute('aria-label',done?'Sadržaj je prijavljen':'Prijavi sadržaj');btn.title=done?'Već si prijavio ovaj sadržaj':'Prijavi sadržaj';}catch{}}
let activeReportMenu=null,activeReactionMenu=null;
function closeReportMenu(){if(!activeReportMenu)return;activeReportMenu.panel.remove();activeReportMenu.button.setAttribute('aria-expanded','false');activeReportMenu=null;}
function closeReactionMenu(){if(!activeReactionMenu)return;activeReactionMenu.panel.remove();activeReactionMenu.button.setAttribute('aria-expanded','false');activeReactionMenu=null;}
document.addEventListener('pointerdown',event=>{
 if(activeReportMenu&&!activeReportMenu.panel.contains(event.target)&&!activeReportMenu.button.contains(event.target))closeReportMenu();
 if(activeReactionMenu&&!activeReactionMenu.panel.contains(event.target)&&!activeReactionMenu.button.contains(event.target))closeReactionMenu();
});
document.addEventListener('keydown',event=>{if(event.key==='Escape'){closeReportMenu();closeReactionMenu();}});
const reactionRefreshers=new Map(),visibleReactionElements=new Set();
const reactionObserver='IntersectionObserver' in window?new IntersectionObserver(entries=>{
 for(const entry of entries){
  const refresh=reactionRefreshers.get(entry.target);
  if(!refresh)continue;
  if(entry.isIntersecting){visibleReactionElements.add(entry.target);void refresh().catch(()=>{});}
  else visibleReactionElements.delete(entry.target);
 }
},{rootMargin:'120px 0px',threshold:0}):null;
setInterval(()=>{
 if(document.hidden)return;
 const active=[];
 for(const [element,refresh] of reactionRefreshers){
  if(!element.isConnected){reactionRefreshers.delete(element);visibleReactionElements.delete(element);reactionObserver?.unobserve(element);continue;}
  if(reactionObserver?visibleReactionElements.has(element):element.getBoundingClientRect().bottom>=0&&element.getBoundingClientRect().top<=innerHeight)active.push(refresh);
 }
 for(let i=0;i<active.length;i+=8)void Promise.allSettled(active.slice(i,i+8).map(refresh=>refresh()));
},45000);
function commentReactionControl(item){
 const wrap=node('span','comment-reaction-wrap');
 const choices=[['🫂','Zagrljaj'],['😢','Dirnulo me'],['😮','Nemam riječi'],['🤗','Uz tebe sam'],['🤣','Umirem od smijeha']];
 let current={popular_emoji:null,my_reaction:null,can_change:true};
 let loading=true;
 const indicator=node('span','comment-reaction-indicator');
 const trigger=button('',async()=>{
  if(activeReactionMenu?.button===trigger){closeReactionMenu();return;}
  closeReportMenu();closeReactionMenu();
  const panel=node('div','comment-reaction-menu');panel.setAttribute('role','group');panel.setAttribute('aria-label','Reakcije na komentar');
  for(const [emoji,label] of choices){
   const option=button(emoji,async()=>{
    if(option.disabled)return;
    option.disabled=true;
    try{
     const result=await request('reaction',{id:item.id,emoji});
     render(result);closeReactionMenu();
    }catch(error){option.disabled=false;toast(error.message);}
   },'comment-reaction-option');
   option.setAttribute('aria-label',label);option.title=label;
   option.setAttribute('aria-pressed',String(current.my_reaction===emoji));
   option.disabled=!current.can_change&&current.my_reaction!==emoji;
   panel.append(option);
  }
  wrap.append(panel);trigger.setAttribute('aria-expanded','true');activeReactionMenu={panel,button:trigger};
  if(loading)await refresh();
 },'action comment-reaction-trigger');
 function render(result){
  current={...current,...result};
  indicator.textContent=current.popular_emoji||'';
  trigger.setAttribute('aria-label',current.popular_emoji
   ?'Najčešća reakcija na komentar: '+current.popular_emoji+'. Otvori izbor reakcija'
   :'Dodaj reakciju na komentar');
  trigger.title=current.popular_emoji?'Najčešća reakcija':'Dodaj reakciju';
  const panel=wrap.querySelector('.comment-reaction-menu');
  if(panel)for(const option of panel.querySelectorAll('.comment-reaction-option')){
   const emoji=option.textContent;
   option.setAttribute('aria-pressed',String(current.my_reaction===emoji));
   option.disabled=!current.can_change&&current.my_reaction!==emoji;
  }
 }
 async function refresh(){
  if(!wrap.isConnected)return;
  const result=await request('reaction_status',{id:item.id});
  render(result);
  loading=false;
 }
 trigger.setAttribute('aria-haspopup','true');trigger.setAttribute('aria-expanded','false');
 wrap.append(indicator,trigger);
 reactionRefreshers.set(wrap,refresh);
 if(reactionObserver)reactionObserver.observe(wrap);else void refresh().catch(()=>{});
 return wrap;
}
function report(item,reportButton){
 closeReactionMenu();
 if(reportButton?.classList.contains('reported')){toast('Već si prijavio ovaj sadržaj.');return;}
 if(activeReportMenu?.button===reportButton){closeReportMenu();return;}closeReportMenu();
 const row=reportButton.closest('.story-actions,.comment-actions'),panel=node('div','report-menu');
 panel.setAttribute('role','group');panel.setAttribute('aria-label','Razlog prijave');
 const kind=reportButton.classList.contains('comment-report')?'comment':'confession';let sending=false;
 async function sendReport(reason,details=''){
  if(sending)return;sending=true;panel.querySelectorAll('button,textarea').forEach(el=>el.disabled=true);
  try{await request('report',{id:item.id,reason,details:details.trim()});try{localStorage.setItem(reportStorageKey(item,kind),'1');}catch{}syncReportButton(reportButton,item,kind);closeReportMenu();toast('Prijava je zabeležena. Hvala.');}
  catch(err){toast(err.message);panel.querySelectorAll('button,textarea').forEach(el=>el.disabled=false);sending=false;}
 }
 const hate=button('Govor mržnje',()=>sendReport('hate_speech'),'report-option');
 const spam=button('Spam',()=>sendReport('spam'),'report-option');
 const more=button('···',()=>{const custom=panel.querySelector('.report-custom');custom.hidden=!custom.hidden;if(!custom.hidden)custom.querySelector('textarea').focus();},'report-more');
 const custom=node('div','report-custom');custom.hidden=true;
 const detail=node('textarea');detail.rows=1;detail.maxLength=500;detail.placeholder='Opiši razlog prijave…';detail.setAttribute('aria-label','Dodatni razlog prijave');detail.style.height='28px';detail.addEventListener('input',()=>{detail.style.height='28px';detail.style.height=Math.min(detail.scrollHeight,70)+'px';});
 const send=button('Pošalji',()=>sendReport('other',detail.value),'report-send');
 custom.append(detail,send);panel.append(hate,spam,more,custom);row.append(panel);reportButton.setAttribute('aria-expanded','true');activeReportMenu={panel,button:reportButton};
}
async function commentBranch(confessionId,parentId,container,refreshContext,confirmed,heading){
 const allItems=[];
 const list=node('div','comment-list');
 const composer=!parentId?contentForm('comment',{confession_id:confessionId},async(item,context,meta)=>{
   if(meta.phase==='optimistic')allItems.push(item);
   else if(meta.phase==='confirmed'){const index=allItems.findIndex(x=>String(x.id)===String(meta.pendingId));if(index>=0)allItems[index]=item;else allItems.push(item);}
   else if(meta.phase==='rollback'){const index=allItems.findIndex(x=>String(x.id)===String(meta.pendingId));if(index>=0)allItems.splice(index,1);}
   await renderItems();if(meta.phase==='confirmed'&&context)refreshContext(context).catch(err=>toast(err.message));
  }):null;
 container.replaceChildren(...(composer?[composer]:[]),...(heading?[heading]:[]),list);
 function newest(a,b){return Date.parse(b.created_at||b.published_at||0)-Date.parse(a.created_at||a.published_at||0);}
 function reactionCount(item){return Number(item._reactionCount??item.likes??item.reactions??item.reaction_count??0)||0;}
 async function renderItems(){
  const unique=[...new Map(allItems.map(item=>[String(item.id),item])).values()];
  const ranked=[...unique].sort((a,b)=>reactionCount(b)-reactionCount(a)||newest(a,b));
  const first=ranked[0]||null,second=ranked[1]||null;
  const latest=unique.filter(x=>x!==first&&x!==second).sort(newest)[0]||null;
  const ordered=first?[first,...unique.filter(x=>x!==first).sort(newest)]:[];
  list.replaceChildren(...ordered.map(item=>comment(item,confessionId,refreshContext)));
 }
 async function loadCardData(items){
  const ids=items.map(item=>String(item.id));
  for(let i=0;i<ids.length;i+=50){
   try{
    const data=await request('cards',{ids:ids.slice(i,i+50)});
    for(const item of items){const vote=data[item.id]?.vote;if(vote)item._reactionCount=Number(vote.likes??vote.reactions??vote.reaction_count??0)||0;}
   }catch{}
  }
 }
 async function loadRemaining(offset){
  try{
   while(true){
    const r=await request('comments',{confession_id:confessionId,parent_id:parentId,offset});
    if(!r.items.length)break;
    r.items.forEach(item=>item._cacheOffset=offset);allItems.push(...r.items);
    await loadCardData(r.items);
    await renderItems();
    offset+=r.items.length;
    if(r.items.length<20)break;
   }
  }catch(err){toast('Dio komentara nije učitan: '+err.message);}
 }
 async function loadAll(){
  const first=await request('comments',{confession_id:confessionId,parent_id:parentId,offset:0});
  first.items.forEach(item=>item._cacheOffset=0);allItems.push(...first.items);
  await renderItems();
  if(first.items.length){
   void loadCardData(first.items).then(renderItems);
   if(first.items.length===20)void loadRemaining(20);
  }
 }

 const cacheUpdate=event=>{
  if(!container.isConnected){window.removeEventListener('ispovesti:read-cache-updated',cacheUpdate);return;}
  const detail=event.detail||{},args=detail.args||{};
  if(detail.action!=='comments'||String(args.confession_id)!==String(confessionId)||String(args.parent_id??'')!==String(parentId??''))return;
  const pageOffset=Math.max(0,Number(args.offset)||0),keep=allItems.filter(item=>item.pending||item._cacheOffset!==pageOffset),fresh=(detail.result?.items||[]).map(item=>({...item,_cacheOffset:pageOffset}));
  allItems.splice(0,allItems.length,...keep,...fresh);void loadCardData(fresh).then(renderItems);
 };
 window.addEventListener('ispovesti:read-cache-updated',cacheUpdate);
 if(confirmed)allItems.push(confirmed);
 await loadAll();
}
const commentMeta=new Set();let commentMetaTimer;
function updateCommentMeta(){clearTimeout(commentMetaTimer);commentMetaTimer=setTimeout(async()=>{
 for(const x of commentMeta)if(!x.wrap.isConnected)commentMeta.delete(x);
 const ids=[...new Set([...commentMeta].map(x=>String(x.item.id)))];
 for(let i=0;i<ids.length;i+=50){try{const data=await chatRequest('comment_meta',{ids:ids.slice(i,i+50)});for(const x of commentMeta){const d=data[x.item.id];if(d){x.count.textContent=replyCounterText(d.replies);x.favorite.classList.toggle('selected',d.favorite);x.favorite.setAttribute('aria-pressed',String(d.favorite));x.favorite.textContent=d.favorite?'♥':'♡';applyHeartStyle(x.favorite,'comment',x.item.id,d.favorite);}}}catch(err){toast(err.message);}}
 },40);}
function comment(item,confessionId,refreshContext,focusOptions={}){
  const wrap=node('div',item.pending?'comment pending':'comment'),card=node('div','comment-card');wrap.dataset.commentId=String(item.id);card.append(metadata(item),node('p','body-text',item.body));
  const row=node('div','comment-actions');
  if(item.pending){row.append(node('span','comment-pending','Šaljem…'));wrap.append(card,row);return wrap;}
  row.append(voteControls(item));
  const favorite=button('♡',async b=>{b.disabled=true;const previous=b.getAttribute('aria-pressed')==='true',enabled=!previous;const set=value=>{b.setAttribute('aria-pressed',String(value));b.classList.toggle('selected',value);b.textContent=value?'♥':'♡';applyHeartStyle(b,'comment',item.id,value);};set(enabled);pulseHeart(b);try{await chatRequest('comment_favorite',{id:item.id,enabled});}catch(error){set(previous);throw error;}finally{b.disabled=false;}},'comment-heart');favorite.setAttribute('aria-label','Sačuvaj komentar');row.append(favorite);
  const reportButton=button('!',()=>report(item,reportButton),'action comment-report');reportButton.setAttribute('aria-label','Prijavi komentar');reportButton.title='Prijavi komentar';syncReportButton(reportButton,item,'comment');
  const count=node('span','reply-count',''),arrow=node('span','reply-triangle');arrow.setAttribute('aria-hidden','true');
  const repliesButton=button('',()=>focusOptions.close?focusOptions.close():focusOptions.reply?focusOptions.reply(item):openReplies(item,confessionId,refreshContext,repliesButton),'reply-toggle');
  repliesButton.setAttribute('aria-label',focusOptions.close?'Zatvori odgovore':'Otvori ili napiši odgovore');repliesButton.append(count,arrow);if(!focusOptions.readOnly)row.append(repliesButton);
  const leftSpace=node('span','action-spacer'),rightSpace=node('span','action-spacer'),reactionControl=commentReactionControl(item);
  row.append(leftSpace,reactionControl,rightSpace,reportButton);wrap.append(card,row);commentMeta.add({item,wrap,count,favorite});updateCommentMeta();return wrap;
}
const inlineThreads=new WeakMap();let activeInlineThread=null,ignoreThreadPopstate=false;
 document.addEventListener('click',event=>{if(!activeInlineThread||event.target.closest('.inline-thread, .thread-active-comment, .reply-toggle'))return;activeInlineThread.close(true,'replace');});
 async function openReplies(item,confessionId,refreshContext,trigger){
  const existing=inlineThreads.get(trigger);if(existing){existing.close();return;}
  activeInlineThread?.close(false,'replace');
  const startedAt=performance.now(),top=window.scrollY,thread=node('section','inline-thread'),root=trigger.closest('.comment'),activeStory=trigger.closest('.story');thread.setAttribute('aria-label','Odgovori na komentar');
  const replies=node('div','thread-replies'),formBox=node('div'),notice=node('p','hint','Učitavam odgovore…');
  let sent=new Set(),closed=false;const replyNodes=new Map(),historyId=crypto.randomUUID(),historyUrl=window.location.href,historyState=window.history.state;
  window.history.pushState({...historyState,ispovestiThread:historyId},'',historyUrl);
  const close=(restore=true,mode='back')=>{
   if(closed)return;closed=true;thread.remove();inlineThreads.delete(trigger);activeInlineThread=null;
   if(mode==='replace')window.history.replaceState(historyState,'',historyUrl);
   else if(mode==='back'&&window.history.state?.ispovestiThread===historyId){ignoreThreadPopstate=true;window.history.back();}
   root.classList.remove('thread-active-comment');activeStory?.classList.remove('thread-active-story');document.body.classList.remove('inline-thread-open');
   trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-label','Otvori ili napiši odgovore');
   if(restore){window.scrollTo(0,top);trigger.focus({preventScroll:true});}updateCommentMeta();
  };
  activeInlineThread={close,historyUrl,historyState,scrollY:top,historyId};
  root.classList.add('thread-active-comment');activeStory?.classList.add('thread-active-story');document.body.classList.add('inline-thread-open');inlineThreads.set(trigger,{close});trigger.setAttribute('aria-expanded','true');trigger.setAttribute('aria-label','Zatvori odgovore');thread.append(replies,notice,formBox);trigger.closest('.comment').append(thread);
 formBox.append(contentForm('reply',{confession_id:confessionId,parent_id:item.id},(created,context,meta)=>{
   if(meta.phase==='optimistic'){const entry=comment(created,confessionId,refreshContext,{readOnly:true});entry.dataset.replyTime=created.created_at;entry.dataset.replyId=String(created.id);replyNodes.set(String(created.id),entry);replies.append(entry);}
   else if(meta.phase==='confirmed'){replyNodes.get(String(meta.pendingId))?.remove();replyNodes.delete(String(meta.pendingId));if(!replyNodes.has(String(created.id))){const entry=comment(created,confessionId,refreshContext,{readOnly:true});entry.dataset.replyTime=created.created_at;entry.dataset.replyId=String(created.id);replyNodes.set(String(created.id),entry);}sent.add(String(created.id));updateCommentMeta();if(context)refreshContext(context).catch(e=>toast(e.message));}
   else if(meta.phase==='rollback'){replyNodes.get(String(meta.pendingId))?.remove();replyNodes.delete(String(meta.pendingId));}
   for(const entry of [...replyNodes.values()].sort((x,y)=>Date.parse(x.dataset.replyTime)-Date.parse(y.dataset.replyTime)||String(x.dataset.replyId).localeCompare(String(y.dataset.replyId))))replies.append(entry);
  },close));
 function renderBatch(items){if(closed||!thread.isConnected)return;if(items.length&&!thread.dataset.firstReplyMs)thread.dataset.firstReplyMs=String(Math.round(performance.now()-startedAt));
  for(const r of items){const id=String(r.id);if(!replyNodes.has(id)){sent.add(id);const entry=comment(r,confessionId,refreshContext,{readOnly:true});entry.dataset.replyTime=r.created_at;entry.dataset.replyId=id;replyNodes.set(id,entry);}}for(const entry of [...replyNodes.values()].sort((a,b)=>Date.parse(a.dataset.replyTime)-Date.parse(b.dataset.replyTime)||Number(a.dataset.replyId)-Number(b.dataset.replyId)))replies.append(entry);notice.textContent='Učitavam preostale odgovore…';updateCommentMeta();
 }
 try{await collectReplies(request,confessionId,item.id,renderBatch,()=>closed||!thread.isConnected);if(closed)return;thread.dataset.loadedMs=String(Math.round(performance.now()-startedAt));notice.remove();}catch(e){if(!closed)notice.textContent=e.message;}
}
const commentWarmQueue=[];const commentWarmIds=new Set();let commentWarmActive=0;
function warmComments(confessionId){
 const id=String(confessionId);if(commentWarmIds.has(id))return;commentWarmIds.add(id);commentWarmQueue.push(id);runCommentWarmQueue();
}
function runCommentWarmQueue(){
 while(commentWarmActive<3&&commentWarmQueue.length){
  const id=commentWarmQueue.shift();commentWarmActive++;
  request('comments',{confession_id:id,parent_id:null,offset:0}).catch(()=>{}).finally(()=>{commentWarmActive--;runCommentWarmQueue();});
 }
}
const commentWarmObserver='IntersectionObserver' in window?new IntersectionObserver(entries=>{
 for(const entry of entries)if(entry.isIntersecting){commentWarmObserver.unobserve(entry.target);warmComments(entry.target.dataset.confessionId);}
},{rootMargin:'700px 0px',threshold:0}):null;
let allFeedPreloading=false;
async function preloadAllConfessions(){
 if(allFeedPreloading||!feedSorts.has(currentView))return;
 allFeedPreloading=true;const view=currentView;
 try{
  // Continue fetching every page in the background; each page is rendered as soon as it arrives.
  while(view===currentView&&hasMoreFeed){
   const before=offset;await load();
   if(offset===before)break;
  }
 }finally{allFeedPreloading=false;}
}
function story(item,options={}){
 const article=node('article','story');article.dataset.confessionId=String(item.id);if(commentWarmObserver)commentWarmObserver.observe(article);else warmComments(item.id);if(item.nickname)article.append(node('div','story-nickname',item.nickname));article.append(node('div','story-content body-text',item.body));const storyDate=node('div','story-date',date(item.published_at||item.created_at));article.append(storyDate);
 const row=node('div','story-actions'),commentsArea=node('section','comments-area comments'),commentComposeArea=node('section','comment-compose-area');
 const comments=node('h3','comment-title','Komentari');commentsArea.hidden=true;commentComposeArea.hidden=true;
 let composerCreated=false;
 const commentsButton=button('💬 …',b=>{
  const opening=commentComposeArea.hidden;
  commentComposeArea.hidden=!opening;
  b.setAttribute('aria-expanded',String(opening));
  b.setAttribute('aria-label',opening?'Napiši komentar':'Zatvori polje za komentar');
  if(opening&&!composerCreated){
   composerCreated=true;
   commentComposeArea.append(contentForm('comment',{confession_id:item.id},async(created,context,meta)=>{
    if(meta.phase==='confirmed'&&context)await refreshContext(context);
   }));
  }
  if(opening)commentComposeArea.querySelector('textarea')?.focus({preventScroll:true});
 },'action comment-entry-button');
 commentsButton.setAttribute('aria-expanded','false');
 commentsButton.setAttribute('aria-label','Napiši komentar');
 commentsButton.title='Napiši komentar';
 if(!options.detail)article.addEventListener('click',event=>{
  if(event.target.closest('.share-story-corner,.comments-area,.report-menu,button,a,input,textarea,select,label'))return;
  navigateToConfession(item.id);
 },true);
 const favorite=button('♡',async b=>{const previous=b.getAttribute('aria-pressed')==='true',enabled=!previous;setFavorite(enabled);pulseHeart(b);try{const result=await request('favorite',{id:item.id,enabled});setFavorite(enabled,result.favorite_style);}catch(error){setFavorite(previous);throw error;}},'action favorite');favorite.setAttribute('aria-label','Dodaj ili ukloni iz omiljenih');
 function setFavorite(value){favorite.textContent=value?'♥':'♡';favorite.setAttribute('aria-pressed',String(value));favorite.classList.toggle('selected',value);applyHeartStyle(favorite,'confession',item.id,value);}
 function updateCommentCount(context){
  const count=context?.comment_count,label=count===null||count===undefined?'…':String(count);
  comments.textContent='Komentari'+(label==='…'?'':' ('+label+')');
  commentsButton.textContent='💬 '+label;
  commentsButton.setAttribute('aria-label',label==='…'?'Otvori komentare':'Otvori komentare, broj komentara: '+label);
 }
 async function refreshContext(context){context ||= await request('context',{id:item.id});updateCommentCount(context);setFavorite(context.favorite,context.favorite_style);}
 watchState(item.id,'context',row,context=>{updateCommentCount(context);setFavorite(context.favorite,context.favorite_style);});
 const shareButton=button('⧉',async()=>{
  persistFeedState();
  const url=new URL(window.location.href);url.search='';url.hash='';url.searchParams.set('ispovest',String(item.id));
  try{await navigator.clipboard.writeText(url.toString());toast('Direktni link ispovesti je kopiran.');}
  catch{
   const field=node('textarea');field.value=url.toString();field.setAttribute('readonly','');field.style.position='fixed';field.style.opacity='0';document.body.append(field);field.select();
   const copied=document.execCommand('copy');field.remove();if(!copied)throw new Error('Kopiranje nije uspelo. Pokušaj ponovo.');toast('Direktni link ispovesti je kopiran.');
  }
 },'action share-story-corner');shareButton.setAttribute('aria-label','Kopiraj direktni link do ispovesti');shareButton.setAttribute('title','Kopiraj link');
 const reportButton=button('!',()=>report(item,reportButton),'action report');syncReportButton(reportButton,item,'confession');row.append(voteControls(item),favorite,...(options.detail?[]:[commentsButton]),node('span','action-spacer'),reportButton);article.append(shareButton,row,...(options.detail?[]:[commentComposeArea]),...(options.detail?[commentsArea]:[]));
 if(options.detail){commentsArea.hidden=false;void commentBranch(item.id,null,commentsArea,refreshContext,null,comments).catch(err=>{commentsArea.textContent=err.message;});}
 // A story is marked read after a visible part has remained visible for 1.5 seconds.
 let readTimer,recorded=false;
 const observer=new IntersectionObserver(entries=>{if(entries[0].isIntersecting&&!recorded){readTimer=setTimeout(()=>{recorded=true;request('read',{id:item.id}).catch(()=>{});observer.disconnect();},1500);}else clearTimeout(readTimer);},{threshold:.1});observer.observe(article);
 return article;
}
function dailyWinner(item,kind){
 const section=node('section','daily-winner');
 section.append(node('h3','daily-day-heading',dailyDayLabel(item.day)));
 if(kind==='confession'){
  section.append(story(item));
 }else{
  const card=node('article','story daily-comment-story');
  card.append(comment(item,item.confession_id,async()=>{},{readOnly:true}));
  card.append(button('Pogledaj ispovest',()=>navigateToConfession(item.confession_id),'text-button daily-context'));
  section.append(card);
 }
 return section;
}
function selectDailyView(kind){
 currentView=kind==='confession'?'daily_confessions':'daily_comments';
 closeMenu();
 document.querySelectorAll('[data-view]').forEach(b=>b.classList.remove('active'));
 for(const [key,tab] of Object.entries(dailyTabs)){
  const active=key===kind;
  tab.classList.toggle('active',active);
  tab.setAttribute('aria-pressed',String(active));
 }
 $('#feed-subtitle').hidden=false;
 $('#feed-subtitle').textContent=kind==='confession'
  ?'Najlajkovanija ispovest za svaki od poslednjih sedam dana.'
  :'Najlajkovaniji glavni komentar za svaki od poslednjih sedam dana.';
 load(true);
}
dailyTabs.confession.onclick=()=>selectDailyView('confession');
dailyTabs.comment.onclick=()=>selectDailyView('comment');
function myConfessionEntry(item){
 const card=node('article','story my-confession-entry');
 card.append(node('p','body-text',item.body));
 if(item.state==='published')card.append(button('Pogledaj ispovest',()=>navigateToConfession(item.id),'action open-confession'));
 return card;
}
async function load(reset=false){
 if(busy&&!reset)return;busy=true;const version=reset?++generation:generation;
 if(reset){offset=0;hasMoreFeed=true;feed.replaceChildren();}
 
 try{
  const dailyKind=currentView==='daily_confessions'?'confession':currentView==='daily_comments'?'comment':null;
  const isList=['favorites','recently_read','my_comments','my_confessions'].includes(currentView);
  const listAction=currentView==='my_confessions'?'my_confessions':'list';
  const listArgs=currentView==='my_confessions'?{offset}:{list:currentView,offset};
  const result=dailyKind
   ?await request('daily_highlights',{kind:dailyKind})
   :await request(isList?listAction:'feed',isList?listArgs:{sort:currentView,offset,...(currentView==='random'?{seed:randomFeedSeed}:{})});
  if(version!==generation)return;
  if(reset)feed.replaceChildren();
  if(dailyKind){
   for(const item of result.items)feed.append(dailyWinner(item,dailyKind));
   offset=result.items.length;
   hasMoreFeed=false;
  }else{
   for(const item of result.items){
    if(currentView==='my_confessions')feed.append(myConfessionEntry(item));
    else if(currentView==='my_comments'){const entry=node('article','story my-comment-entry');entry.append(metadata(item),node('p','body-text',item.body));entry.append(button('Otvori ispovest',()=>navigateToConfession(item.confession_id),'action open-confession'));feed.append(entry);}
    else feed.append(story(item));
   }
   offset+=result.items.length;
   hasMoreFeed=result.items.length===20;
  }
  if(!offset)feed.append(node('p','empty',dailyKind?(dailyKind==='confession'?'Još nema ispovesti za dnevni izbor.':'Još nema komentara za dnevni izbor.'):currentView==='my_confessions'?'Još nisi napisao nijednu ispovest.':isList?'Ova privatna lista je još prazna.':'Još nema objavljenih ispovesti.'));
 }catch(err){if(version!==generation)return;if(reset)feed.replaceChildren(node('p','empty error',err.message));else toast(err.message);hasMoreFeed=false;}
 finally{if(version===generation)busy=false;}
}
document.querySelectorAll('[data-feed-sort]').forEach(b=>b.onclick=()=>{
 currentView=b.dataset.feedSort;
 if(currentView==='random')randomFeedSeed=crypto.randomUUID();
 closeMenu();
 document.querySelectorAll('[data-view]').forEach(n=>n.classList.remove('active'));
 document.querySelectorAll('[data-feed-sort]').forEach(n=>{
  const active=n===b;n.classList.toggle('active',active);n.setAttribute('aria-pressed',String(active));
 });
 for(const tab of Object.values(dailyTabs)){tab.classList.remove('active');tab.setAttribute('aria-pressed','false');}
 const descriptions={likes:'Ispovesti sa najviše pozitivnih glasova.',dislikes:'Ispovesti sa najviše negativnih glasova.',comments:'Ispovesti sa najviše komentara.',random:'Nasumičan redosled ispovesti.'};
 $('#feed-subtitle').hidden=false;$('#feed-subtitle').textContent=descriptions[currentView];
 load(true).then(()=>void preloadAllConfessions());
});
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{currentView=b.dataset.view;closeMenu();document.querySelectorAll('[data-view]').forEach(n=>n.classList.toggle('active',n===b));document.querySelectorAll('[data-feed-sort]').forEach(n=>{n.classList.remove('active');n.setAttribute('aria-pressed','false');});for(const tab of Object.values(dailyTabs)){tab.classList.remove('active');tab.setAttribute('aria-pressed','false');}$('#feed-subtitle').hidden=false;$('#feed-subtitle').textContent=['favorites','recently_read','my_comments','my_confessions'].includes(currentView)?'Privatno · samo u tvojoj anonimnoj sesiji':'Svaka priča ima svoje mesto.';load(true).then(()=>{if(feedSorts.has(currentView))void preloadAllConfessions();});});


function navigateToConfession(id){
 const url=new URL(window.location.href);url.search='';url.hash='';url.searchParams.set('ispovest',String(id));
 if(url.href===window.location.href)return;
 persistFeedState();closeMenu();generation++;
 window.history.pushState({ispovestiDetail:true},'',url);
 void openDirectConfession(id);
}
function navigateToFeed(){
 if(window.history.state?.ispovestiDetail){window.history.back();return;}
 const url=new URL(window.location.href);url.searchParams.delete('ispovest');
 window.history.replaceState(null,'',url.pathname+url.search+url.hash);
 void initializeFeed();
}
async function openDirectConfession(id){
 const requestVersion=++detailGeneration;
 try{
  const result=await request('confession',{id});
  if(requestVersion!==detailGeneration)return;
  if(!result?.item)throw new Error('Ova ispovest trenutno nije dostupna.');
  const back=button('← Nazad na ispovesti',navigateToFeed,'text-button direct-story-back');
  const detail=story(result.item,{detail:true});detail.classList.add('direct-story');
  feed.replaceChildren(back,detail);hasMoreFeed=false;$('#feed-subtitle').hidden=true;
  document.querySelector('.daily-tabs').hidden=true;
  document.title='Ispovest | Ispovesti.ba';
 }catch(err){feed.replaceChildren(node('p','empty error',err.message||'Ispovest nije pronađena.'));hasMoreFeed=false;}
}
async function initializeFeed(){
 const directId=new URLSearchParams(location.search).get('ispovest');
 if(directId){await openDirectConfession(directId);return;}
 detailGeneration++;
 document.title='Ispovesti.ba — Reci šta ti je na duši.';
 document.querySelector('.daily-tabs').hidden=false;
 $('#feed-subtitle').hidden=false;
 let saved=null;try{saved=JSON.parse(sessionStorage.getItem(FEED_STATE_KEY)||'null');}catch{}
 if(saved?.view){
  currentView=String(saved.view);
  if(currentView==='random')randomFeedSeed=/^[0-9a-f-]{36}$/i.test(saved.seed||'')?saved.seed:crypto.randomUUID();
  document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===currentView));
  document.querySelectorAll('[data-feed-sort]').forEach(b=>{const active=b.dataset.feedSort===currentView;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
  for(const [key,tab] of Object.entries(dailyTabs)){const active=currentView===(key==='confession'?'daily_confessions':'daily_comments');tab.classList.toggle('active',active);tab.setAttribute('aria-pressed',String(active));}
 }
 const descriptions={new:'Svaka priča ima svoje mesto.',popular:'Najpopularnije ispovesti.',likes:'Ispovesti sa najviše pozitivnih glasova.',dislikes:'Ispovesti sa najviše negativnih glasova.',comments:'Ispovesti sa najviše komentara.',random:'Nasumičan redosled ispovesti.',favorites:'Privatno · samo u tvojoj anonimnoj sesiji',recently_read:'Privatno · samo u tvojoj anonimnoj sesiji',my_comments:'Privatno · samo u tvojoj anonimnoj sesiji',my_confessions:'Privatno · ispovesti napisane u tvojoj anonimnoj sesiji',daily_confessions:'Najlajkovanija ispovest za svaki od poslednjih sedam dana.',daily_comments:'Najlajkovaniji glavni komentar za svaki od poslednjih sedam dana.'};
 $('#feed-subtitle').textContent=descriptions[currentView]||'Svaka priča ima svoje mesto.';
 await load(true);
 if(saved&&Number.isFinite(Number(saved.offset))&&Number(saved.offset)>offset&&hasMoreFeed){
  while(offset<Number(saved.offset)&&hasMoreFeed){const previous=offset;await load();if(offset===previous)break;}
 }
 if(saved&&Number.isFinite(Number(saved.scrollY)))requestAnimationFrame(()=>window.scrollTo(0,Math.max(0,Number(saved.scrollY))));
 if(feedSorts.has(currentView))void preloadAllConfessions();
}
window.addEventListener('ispovesti:read-cache-updated',event=>{
 const detail=event.detail||{},args=detail.args||{};
 if(detail.action==='feed'&&feedSorts.has(currentView)&&String(args.sort||'new')===String(currentView))void load(true);
 else if(detail.action==='daily_highlights'&&currentView===(args.kind==='confession'?'daily_confessions':'daily_comments'))void load(true);
 else if(detail.action==='confession'&&new URLSearchParams(location.search).get('ispovest')===String(args.id))void openDirectConfession(args.id);
});
window.addEventListener('popstate',()=>{
 if(ignoreThreadPopstate){ignoreThreadPopstate=false;return;}
 if(activeInlineThread){const thread=activeInlineThread;thread.close(false,'popstate');requestAnimationFrame(()=>window.scrollTo(0,thread.scrollY));return;}
 const id=new URLSearchParams(location.search).get('ispovest');
 if(id)void openDirectConfession(id);else void initializeFeed();
});
function trackAnonymousVisit(){
 if(isPreview||isLocal)return;
 try{
  const idKey='ispovesti:analytics:visitor:v1',dayKey='ispovesti:analytics:last-day:v1';
  let visitorId=localStorage.getItem(idKey);
  if(!visitorId||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(visitorId)){
   visitorId=crypto.randomUUID();
   localStorage.setItem(idKey,visitorId);
  }
  const today=new Date().toISOString().slice(0,10);
  if(localStorage.getItem(dayKey)===today)return;
  void request('track_visit',{visitor_id:visitorId}).then(()=>{
   try{localStorage.setItem(dayKey,today);}catch{}
  }).catch(()=>{});
 }catch{}
}
initializeFeed();
void refreshPendingSubmissions();
trackAnonymousVisit();
void initializeSecurity().catch(error=>toast(error.message));
