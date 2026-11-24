import {chatRequest} from './chat/client.mjs?v=live1';
import {collectReplies,replyCounterText} from './chat/thread-model.mjs?v=progressive11';
import { request, isPreview, isLocal, prepareSubmission } from './api.js?v=20261124-live-captcha-config1';
const $ = s => document.querySelector(s);
const feed = $('#feed'), dialog = $('#dialog');
const dailyTabs={confession:$('#daily-confessions'),comment:$('#daily-comments')};
let currentView='new',offset=0,generation=0,busy=false;
// One batched state request per group of 20 cards, rather than 40 separate requests.
const stateListeners=new Set();let stateTimer;
function watchState(id,type,element,render){stateListeners.add({id,type,element,render});clearTimeout(stateTimer);stateTimer=setTimeout(refreshStates,30);}
async function refreshStates(){
 for(const entry of stateListeners)if(!entry.element.isConnected)stateListeners.delete(entry);
 const entries=[...stateListeners],ids=[...new Set(entries.map(e=>e.id))];
 for(let i=0;i<ids.length;i+=20){try{const result=await request('cards',{ids:ids.slice(i,i+20)});for(const e of entries){const data=result[e.id]?.[e.type];if(data)e.render(data);}}catch{}}
 await Promise.all(entries.map(async e=>{
  try{
   const status=await request('vote_status',{id:e.id});
   if(status.can_change!==undefined)e.element.querySelectorAll('.vote-controls button').forEach(b=>{b.dataset.voteLocked=String(status.can_change===false);b.setAttribute('aria-disabled',String(status.can_change===false));});
  }catch{}
 }));
}
setInterval(()=>{if(!document.hidden)refreshStates();},60000);
setInterval(()=>{if(!document.hidden&&currentView.startsWith('daily_'))load(true);},60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&currentView.startsWith('daily_'))load(true);});
const node=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const button=(text,fn,cls='action')=>{const b=node('button',cls,text);b.type='button';b.addEventListener('click',()=>Promise.resolve(fn(b)).catch(err=>toast(err.message)));return b;};
const date=v=>v?new Date(v).toLocaleString('sr-Latn-RS',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'';
const dailyDayLabel=value=>{const d=new Date(String(value)+'T12:00:00');return Number.isNaN(d.getTime())?String(value):d.toLocaleDateString('sr-Latn-RS',{weekday:'long',day:'numeric',month:'long',year:'numeric'});};
function toast(text){$('#toast').textContent=text;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').textContent='',6500);}
function modal(title,content){$('#dialog-title').textContent=title;$('#dialog-body').replaceChildren(content);if(!dialog.open)dialog.showModal();}
const menuToggle=$('#menu-toggle'),sideMenu=$('#side-menu'),menuOverlay=$('#menu-overlay');
function closeMenu(){setMenu(false);}
function setMenu(open){
 document.body.classList.toggle('menu-open',open);sideMenu.hidden=!open;menuOverlay.hidden=!open;
 menuToggle.setAttribute('aria-expanded',String(open));menuToggle.setAttribute('aria-label',open?'Zatvori meni':'Otvori meni');menuToggle.textContent=open?'×':'›››';
 for(const el of document.querySelectorAll('.site-header,main,footer'))el.inert=open;
 if(open)sideMenu.querySelector('button')?.focus();
}
menuToggle.onclick=()=>{const open=sideMenu.hidden;setMenu(open);if(!open)menuToggle.focus();};
menuOverlay.onclick=()=>{closeMenu();menuToggle.focus();};
document.addEventListener('keydown',event=>{
 if(sideMenu.hidden||dialog.open)return;
 if(event.key==='Escape'){closeMenu();menuToggle.focus();}
 if(event.key==='Tab'){
  const items=[menuToggle,...sideMenu.querySelectorAll('button:not(:disabled),input,textarea,select,a[href]')];
  const first=items[0],last=items.at(-1);
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
 }
});
$('#close-dialog').onclick=()=>dialog.close();
$('#write').onclick=()=>modal('Podeli svoju ispovest',contentForm('confession',{},()=>{}));
$('#privacy').onclick=()=>modal('Tvoja privatnost',node('p','', 'Ne tražimo e-mail, lozinku ni pravo ime. Anonimna sesija čuva se u tvom pregledaču. Brisanje podataka pregledača može značiti gubitak privatnih lista i istorije. Nema javnih profila. Tehnički podaci koje obrađuju hosting i sigurnosni sistemi ne znače apsolutnu anonimnost. U tekst ne upisuj podatke po kojima se ti ili drugi mogu prepoznati.'));
$('#footer-privacy').onclick=()=>$('#privacy').click();
$('#rules').onclick=()=>modal('Pravila zajednice',node('p','', 'Piši bez vređanja, uznemiravanja, pretnji i spama. Slike i linkovi nisu dozvoljeni. Objavljeni tekst ne možeš naknadno uređivati ili brisati. Administrator može ukloniti neprikladan sadržaj. Čitanje, objavljivanje ispovesti, komentari, odgovori i glasanje su besplatni. Ispovesti čekaju red i objavljuje se najviše jedna na sat.'));
if(isLocal)$('#preview').textContent='Lokalni test · bez veze sa živim sajtom';
else if(window.ISPOVESTI_CONFIG?.mode==='live-test')$('#preview').textContent='TEST · prava baza, odvojeni probni podaci';
else if(!isPreview)$('#preview').hidden=true;
function metadata(item){const div=node('div','story-meta');const author=String(item.nickname||'').trim();if(author)div.append(node('span','author',author));const t=node('time','',date(item.published_at||item.created_at));t.dateTime=item.published_at||item.created_at||'';div.append(t);return div;}
function contentForm(kind,extra,done,onBack){
 const form=node('form',kind==='confession'?'form':'form discussion-form'),label=node('label','',kind==='confession'?'Tvoja priča':'Tvoje reči'),text=node('textarea');text.addEventListener('focus',()=>prepareSubmission(kind,form));text.addEventListener('input',()=>prepareSubmission(kind,form));text.required=true;text.maxLength=kind==='confession'?10000:2000;text.classList.toggle('discussion-textarea',kind!=='confession');text.placeholder=kind==='confession'?'Napiši ono što želiš da podeliš...':kind==='comment'?'':'Napiši odgovor...';label.append(text);
 const nickLabel=node('label','','Ms./Mr.'),nick=node('input');nick.maxLength=40;nick.autocomplete='off';nickLabel.append(nick);
 const status=node('p','hint'),send=node('button','primary',kind==='confession'?'Pošalji ispovest':'Pošalji');send.type='submit';
 const identityRow=node('div','identity-row');identityRow.append(nickLabel,send);
 const row=node('div','row'),back=onBack?button('← Nazad',()=>onBack(),'discussion-back'):null;if(back)row.append(back);
 form.append(label,identityRow,...(back?[row]:[]),status);
 let allowDuplicate=false,duplicateButton,sending=false,requestId=null,lastPayload=null;
 form.onsubmit=async e=>{e.preventDefault();if(sending)return;sending=true;send.disabled=true;if(back)back.disabled=true;text.disabled=true;nick.disabled=true;const submittedAt=performance.now();status.className='hint';status.textContent='Šaljem…';
  try{
   const count=[...text.value.trim()].length,min=kind==='confession'?15:1,max=kind==='confession'?5000:1000;
   if(count<min||count>max)throw new Error(`Tekst mora imati od ${min} do ${max} znakova.`);
   const payload={kind,body:text.value,nickname:nick.value,...extra,allow_duplicate:allowDuplicate};
   const fingerprint=JSON.stringify(payload);if(fingerprint!==lastPayload){requestId=crypto.randomUUID();lastPayload=fingerprint;}
   const r=await request('submit',{...payload,request_id:requestId},null,form);
   const confirmedAt=performance.now();
   if(r.duplicate){requestId=null;lastPayload=null;status.textContent='Ovaj tekst si već poslao. Ako želiš, možeš ga poslati ponovo.';if(!duplicateButton){duplicateButton=button('Ipak pošalji',()=>{allowDuplicate=true;form.requestSubmit();});form.append(duplicateButton);}return;}
   const confirmed=r.item||{id:r.id,body:text.value.trim(),nickname:nick.value.trim()||null,created_at:new Date().toISOString(),parent_id:extra.parent_id||null,has_replies:false};
   requestId=null;lastPayload=null;status.textContent='';text.value='';nick.value='';allowDuplicate=false;duplicateButton?.remove();duplicateButton=null;
   if(kind==='confession'){dialog.close();closeMenu();toast('Tvoja ispovest je uspešno poslata. Čeka svoj red za objavljivanje.');}
   else{done(confirmed,r.context);toast(kind==='reply'?'Tvoj odgovor je poslat.':'Tvoj komentar je poslat.');}
   requestAnimationFrame(()=>{performance.measure('ispovesti-submit-render',{start:confirmedAt,end:performance.now()});performance.measure('ispovesti-submit-total',{start:submittedAt,end:performance.now()});
    const timings={};for(const name of ['session','captcha','network','render','total']){const measure=performance.getEntriesByName('ispovesti-submit-'+name).at(-1);if(measure)timings[name]=Math.round(measure.duration);}
    form.dataset.submissionTiming=JSON.stringify(timings);
    for(const name of ['session','captcha','network','render','total'])performance.clearMeasures('ispovesti-submit-'+name);});
  }catch(err){status.textContent=err.message;status.className='hint error';}finally{sending=false;send.disabled=false;if(back)back.disabled=false;text.disabled=false;nick.disabled=false;}
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
 if(!Number.isInteger(style)||style<1||style>40){style=Math.floor(Math.random()*40)+1;try{localStorage.setItem(key,String(style));}catch{}}
 btn.dataset.heartStyle=String(style);
}
function voteControls(item){
 const row=node('div','vote-controls');const buttons=[];
 for(const [value,symbol] of [[1,'👍'],[-1,'👎']]){
  const b=button(symbol,async btn=>{
   if(btn.dataset.voteLocked==='true'||buttons.some(x=>x.dataset.pending==='true'))return;
   btn.dataset.pending='true';btn.disabled=true;
   try{render(await request('vote',{id:item.id,value}));}
   finally{delete btn.dataset.pending;btn.disabled=false;}
  });
  buttons.push(b);
 }
 function render(r){
  const hasVote=r.my_vote===1||r.my_vote===-1;
  row.classList.toggle('has-vote',hasVote);
  buttons.forEach((b,i)=>{
   const value=i===0?1:-1;
   b.classList.toggle('selected',r.my_vote===value);
   b.dataset.voteLocked=String(r.can_change===false);
   b.setAttribute('aria-disabled',String(r.can_change===false));
   b.setAttribute('aria-pressed',String(r.my_vote===value));
   b.setAttribute('aria-label',i===0?'Pozitivan glas':'Negativan glas');
   b.textContent=(i===0?'👍 ':'👎 ')+String(i===0?(r.likes??0):(r.dislikes??0));
  });
 }
 async function refreshVoteLock(){
  try{
   const status=await request('vote_status',{id:item.id});
   if(status.can_change!==undefined)buttons.forEach(b=>{
    b.dataset.voteLocked=String(status.can_change===false);
    b.setAttribute('aria-disabled',String(status.can_change===false));
   });
  }catch{}
 }
 row.append(...buttons);render({likes:0,dislikes:0});
 watchState(item.id,'vote',row,render);
 void refreshVoteLock();
 return row;
}
function reportStorageKey(item,kind){return 'ispovesti:reported:'+kind+':'+String(item.id);}
function syncReportButton(btn,item,kind){try{const done=localStorage.getItem(reportStorageKey(item,kind))==='1';btn.classList.toggle('reported',done);btn.setAttribute('aria-label',done?'Sadržaj je prijavljen':'Prijavi sadržaj');btn.title=done?'Već si prijavio ovaj sadržaj':'Prijavi sadržaj';}catch{}}
let activeReportMenu=null;
function closeReportMenu(){if(!activeReportMenu)return;activeReportMenu.panel.remove();activeReportMenu.button.setAttribute('aria-expanded','false');activeReportMenu=null;}
document.addEventListener('pointerdown',event=>{if(activeReportMenu&&!activeReportMenu.panel.contains(event.target)&&!activeReportMenu.button.contains(event.target))closeReportMenu();});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&activeReportMenu)closeReportMenu();});
function report(item,reportButton){
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
 const detail=node('textarea');detail.rows=1;detail.maxLength=500;detail.placeholder='Opiši razlog prijave…';detail.setAttribute('aria-label','Dodatni razlog prijave');
 const send=button('Pošalji',()=>sendReport('other',detail.value),'report-send');
 custom.append(detail,send);panel.append(hate,spam,more,custom);row.append(panel);reportButton.setAttribute('aria-expanded','true');activeReportMenu={panel,button:reportButton};
}
async function commentBranch(confessionId,parentId,container,refreshContext,confirmed,heading){
 const allItems=[];let expanded=false;
 const list=node('div','comment-list'),more=button('Prikaži još komentara',showMore,'load-more');
 const composer=!parentId?contentForm('comment',{confession_id:confessionId},async(item,context)=>{allItems.push(item);await renderItems();refreshContext(context).catch(err=>toast(err.message));}):null;
 container.replaceChildren(...(composer?[composer]:[]),...(heading?[heading]:[]),list,more);
 function newest(a,b){return Date.parse(b.created_at||b.published_at||0)-Date.parse(a.created_at||a.published_at||0);}
 function reactionCount(item){return Number(item._reactionCount??item.likes??item.reactions??item.reaction_count??0)||0;}
 async function renderItems(){
  const unique=[...new Map(allItems.map(item=>[String(item.id),item])).values()];
  const ranked=[...unique].sort((a,b)=>reactionCount(b)-reactionCount(a)||newest(a,b));
  const first=ranked[0]||null,second=ranked[1]||null;
  const latest=unique.filter(x=>x!==first&&x!==second).sort(newest)[0]||null;
  const preview=[first,second,latest].filter(Boolean);
  const ordered=expanded&&first?[first,...unique.filter(x=>x!==first).sort(newest)]:preview;
  list.replaceChildren(...ordered.map(item=>comment(item,confessionId,refreshContext)));
  more.hidden=expanded||unique.length<=preview.length;
 }
 async function loadAll(){
  let offset=0;
  while(true){
   const r=await request('comments',{confession_id:confessionId,parent_id:parentId,offset});
   allItems.push(...r.items);
   if(r.items.length<20)break;
   offset+=r.items.length;
  }
  const ids=allItems.map(item=>String(item.id));
  for(let i=0;i<ids.length;i+=50){
   try{
    const data=await request('cards',{ids:ids.slice(i,i+50)});
    for(const item of allItems){const vote=data[item.id]?.vote;if(vote)item._reactionCount=Number(vote.likes??vote.reactions??vote.reaction_count??0)||0;}
   }catch{}
  }
  await renderItems();
 }
 async function showMore(){more.disabled=true;try{expanded=true;await renderItems();}finally{more.disabled=false;}}
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
 const wrap=node('div','comment'),card=node('div','comment-card');card.append(metadata(item),node('p','body-text',item.body));
 const row=node('div','comment-actions');row.append(voteControls(item));
 const favorite=button('♡',async b=>{b.disabled=true;try{const enabled=b.getAttribute('aria-pressed')!=='true';await chatRequest('comment_favorite',{id:item.id,enabled});b.setAttribute('aria-pressed',String(enabled));b.classList.toggle('selected',enabled);b.textContent=enabled?'♥':'♡';applyHeartStyle(b,'comment',item.id,enabled);pulseHeart(b);}finally{b.disabled=false;}},'comment-heart');favorite.setAttribute('aria-label','Sačuvaj komentar');row.append(favorite);
 const reportButton=button('!',()=>report(item,reportButton),'action comment-report');reportButton.setAttribute('aria-label','Prijavi komentar');reportButton.title='Prijavi komentar';syncReportButton(reportButton,item,'comment');
 const count=node('span','reply-count',''),arrow=node('span','reply-triangle');arrow.setAttribute('aria-hidden','true');
 const repliesButton=button('',()=>focusOptions.close?focusOptions.close():focusOptions.reply?focusOptions.reply(item):openReplies(item,confessionId,refreshContext,repliesButton),'reply-toggle');
 repliesButton.setAttribute('aria-label',focusOptions.close?'Zatvori odgovore':'Otvori ili napiši odgovore');repliesButton.append(count,arrow);if(!focusOptions.readOnly)row.append(repliesButton);row.append(node('span','action-spacer'),reportButton);wrap.append(card,row);
 commentMeta.add({item,wrap,count,favorite});updateCommentMeta();return wrap;
}
const inlineThreads=new WeakMap();let activeInlineThread=null;
document.addEventListener('click',event=>{
 if(!activeInlineThread||event.target.closest('.inline-thread, .thread-active-comment'))return;
 activeInlineThread.close();
});
async function openReplies(item,confessionId,refreshContext,trigger){
 const existing=inlineThreads.get(trigger);if(existing){existing.close();return;}
 activeInlineThread?.close(false);
 const startedAt=performance.now(),top=window.scrollY,thread=node('section','inline-thread'),root=trigger.closest('.comment'),activeStory=trigger.closest('.story');thread.setAttribute('aria-label','Odgovori na komentar');
 const replies=node('div','thread-replies'),formBox=node('div'),notice=node('p','hint','Učitavam odgovore…');
 let sent=new Set(),closed=false;const replyNodes=new Map();
 const close=(restore=true)=>{if(closed)return;closed=true;thread.remove();inlineThreads.delete(trigger);activeInlineThread=null;root.classList.remove('thread-active-comment');activeStory?.classList.remove('thread-active-story');document.body.classList.remove('inline-thread-open');trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-label','Otvori ili napiši odgovore');if(restore){window.scrollTo(0,top);trigger.focus({preventScroll:true});}updateCommentMeta();};
 activeInlineThread={close};root.classList.add('thread-active-comment');activeStory?.classList.add('thread-active-story');document.body.classList.add('inline-thread-open');inlineThreads.set(trigger,{close});trigger.setAttribute('aria-expanded','true');trigger.setAttribute('aria-label','Zatvori odgovore');thread.append(replies,notice,formBox);trigger.closest('.comment').append(thread);
 formBox.append(contentForm('reply',{confession_id:confessionId,parent_id:item.id},(created,context)=>{
  if(!sent.has(String(created.id))){sent.add(String(created.id));const entry=comment(created,confessionId,refreshContext,{readOnly:true});entry.dataset.replyTime=created.created_at;entry.dataset.replyId=String(created.id);replyNodes.set(String(created.id),entry);replies.append(entry);}updateCommentMeta();refreshContext(context).catch(e=>toast(e.message));
 },close));
 function renderBatch(items){if(closed||!thread.isConnected)return;if(items.length&&!thread.dataset.firstReplyMs)thread.dataset.firstReplyMs=String(Math.round(performance.now()-startedAt));
  for(const r of items){const id=String(r.id);if(!replyNodes.has(id)){sent.add(id);const entry=comment(r,confessionId,refreshContext,{readOnly:true});entry.dataset.replyTime=r.created_at;entry.dataset.replyId=id;replyNodes.set(id,entry);}}for(const entry of [...replyNodes.values()].sort((a,b)=>Date.parse(a.dataset.replyTime)-Date.parse(b.dataset.replyTime)||Number(a.dataset.replyId)-Number(b.dataset.replyId)))replies.append(entry);notice.textContent='Učitavam preostale odgovore…';updateCommentMeta();
 }
 try{await collectReplies(request,confessionId,item.id,renderBatch,()=>closed||!thread.isConnected);if(closed)return;thread.dataset.loadedMs=String(Math.round(performance.now()-startedAt));notice.remove();}catch(e){if(!closed)notice.textContent=e.message;}
}
function story(item){
 const article=node('article','story');if(item.nickname)article.append(node('div','story-nickname',item.nickname));article.append(node('div','story-content body-text',item.body));const storyDate=node('div','story-date',date(item.published_at||item.created_at));article.append(storyDate);
 const row=node('div','story-actions'),commentsArea=node('section','comments-area comments');
 const comments=node('h3','comment-title','Komentari');const commentsList=node('div','comment-list');commentsArea.hidden=true;commentsArea.append(commentsList);
 let commentsLoaded=false,commentsLoading=false;
 async function toggleComments(){if(commentsLoading)return;commentsArea.hidden=!commentsArea.hidden;if(commentsArea.hidden||commentsLoaded)return;commentsLoading=true;try{await commentBranch(item.id,null,commentsList,refreshContext,null,comments);commentsLoaded=true;}catch(err){commentsList.textContent=err.message;}finally{commentsLoading=false;}}
 article.querySelector('.story-content').addEventListener('click',toggleComments);
 const favorite=button('♡',async b=>{const enabled=b.getAttribute('aria-pressed')!=='true';const result=await request('favorite',{id:item.id,enabled});setFavorite(enabled,result.favorite_style);pulseHeart(b);},'action favorite');favorite.setAttribute('aria-label','Dodaj ili ukloni iz omiljenih');
 function setFavorite(value){favorite.textContent=value?'♥':'♡';favorite.setAttribute('aria-pressed',String(value));favorite.classList.toggle('selected',value);applyHeartStyle(favorite,'confession',item.id,value);}
 async function refreshContext(context){context ||= await request('context',{id:item.id});comments.textContent='Komentari'+(context.comment_count===null?'':' ('+context.comment_count+')');setFavorite(context.favorite,context.favorite_style);}
 watchState(item.id,'context',row,context=>{comments.textContent='Komentari'+(context.comment_count===null?'':' ('+context.comment_count+')');setFavorite(context.favorite,context.favorite_style);});
 const reportButton=button('!',()=>report(item,reportButton),'action report');syncReportButton(reportButton,item,'confession');row.append(voteControls(item),favorite,node('span','action-spacer'),reportButton);article.append(row,commentsArea);
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
  card.append(button('Pogledaj ispovest',async()=>{
   const result=await request('confession',{id:item.confession_id});
   modal('Ispovest',story(result.item));
  },'text-button daily-context'));
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
async function load(reset=false){
 if(busy&&!reset)return;busy=true;const version=reset?++generation:generation;
 if(reset){offset=0;feed.replaceChildren(node('p','empty','Učitavam priče…'));}
 $('#more').disabled=true;
 try{
  const dailyKind=currentView==='daily_confessions'?'confession':currentView==='daily_comments'?'comment':null;
  const isList=['favorites','recently_read','my_comments'].includes(currentView);
  const result=dailyKind
   ?await request('daily_highlights',{kind:dailyKind})
   :await request(isList?'list':'feed',isList?{list:currentView,offset}:{sort:currentView,offset});
  if(version!==generation)return;
  if(reset)feed.replaceChildren();
  if(dailyKind){
   for(const item of result.items)feed.append(dailyWinner(item,dailyKind));
   offset=result.items.length;
   $('#more').hidden=true;
  }else{
   for(const item of result.items){if(currentView==='my_comments'){const entry=node('article','story my-comment-entry');entry.append(metadata(item),node('p','body-text',item.body));entry.append(button('Otvori ispovest',async()=>{
      // Exact parent endpoint avoids searching only the first feed page.
      const r=await request('confession',{id:item.confession_id});modal('Ispovest',story(r.item));
    },'action open-confession'));feed.append(entry);}else feed.append(story(item));}
   offset+=result.items.length;
   $('#more').hidden=result.items.length<20;
  }
  if(!offset)feed.append(node('p','empty',dailyKind?(dailyKind==='confession'?'Još nema ispovesti za dnevni izbor.':'Još nema komentara za dnevni izbor.'):isList?'Ova privatna lista je još prazna.':'Još nema objavljenih ispovesti.'));
 }catch(err){if(version!==generation)return;if(reset)feed.replaceChildren(node('p','empty error',err.message));else toast(err.message);$('#more').hidden=false;}
 finally{if(version===generation){busy=false;$('#more').disabled=false;}}
}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{currentView=b.dataset.view;closeMenu();document.querySelectorAll('[data-view]').forEach(n=>n.classList.toggle('active',n===b));for(const tab of Object.values(dailyTabs)){tab.classList.remove('active');tab.setAttribute('aria-pressed','false');}$('#feed-subtitle').hidden=false;$('#feed-subtitle').textContent=['favorites','recently_read','my_comments'].includes(currentView)?'Privatno · samo u tvojoj anonimnoj sesiji':'Svaka priča ima svoje mesto.';load(true);});
$('#sidebar-compose').append(contentForm('confession',{},()=>{}));
$('#more').onclick=()=>load();
load(true);
