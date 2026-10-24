import { request, isPreview, isLocal } from './api.js';
const $ = s => document.querySelector(s);
const feed = $('#feed'), dialog = $('#dialog');
let currentView='oldest',offset=0, generation=0, openMenu=null,openBranch=null,busy=false;
// One batched state request per group of 20 cards, rather than 40 separate requests.
const stateListeners=new Set();let stateTimer;
function watchState(id,type,element,render){stateListeners.add({id,type,element,render});clearTimeout(stateTimer);stateTimer=setTimeout(refreshStates,30);}
async function refreshStates(){
 for(const entry of stateListeners)if(!entry.element.isConnected)stateListeners.delete(entry);
 const ids=[...new Set([...stateListeners].map(e=>e.id))];
 for(let i=0;i<ids.length;i+=20){try{const result=await request('cards',{ids:ids.slice(i,i+20)});for(const e of stateListeners){const data=result[e.id]?.[e.type];if(data)e.render(data);}}catch{}}
}
setInterval(()=>{if(!document.hidden)refreshStates();},60000);
const titles={oldest:'Ispovijesti',new:'Novo',popular:'Popularno',favorites:'Omiljene ispovijesti',recently_read:'Nedavno pročitane',my_comments:'Moji komentari'};
const node=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const button=(text,fn,cls='action')=>{const b=node('button',cls,text);b.type='button';b.addEventListener('click',()=>Promise.resolve(fn(b)).catch(err=>toast(err.message)));return b;};
const date=v=>v?new Date(v).toLocaleString('sr-Latn',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'';
function toast(text){$('#toast').textContent=text;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').textContent='',6500);}
function modal(title,content){$('#dialog-title').textContent=title;$('#dialog-body').replaceChildren(content);if(!dialog.open)dialog.showModal();}
const menuToggle=$('#menu-toggle'),sideMenu=$('#side-menu'),menuOverlay=$('#menu-overlay');
function closeMenu(){setMenu(false);}
function setMenu(open){
 document.body.classList.toggle('menu-open',open);sideMenu.hidden=!open;menuOverlay.hidden=!open;
 menuToggle.setAttribute('aria-expanded',String(open));menuToggle.setAttribute('aria-label',open?'Zatvori meni':'Otvori meni');menuToggle.textContent=open?'×':'☰';
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
$('#write').onclick=()=>modal('Podijeli svoju ispovijest',contentForm('confession',{},()=>{}));
$('#privacy').onclick=()=>modal('Tvoja privatnost',node('p','', 'Ne tražimo e-mail, lozinku ni pravo ime. Anonimna sesija čuva se u tvom pregledniku. Brisanje podataka preglednika može značiti gubitak privatnih lista i istorije. Nema javnih profila. Tehnički podaci koje obrađuju hosting i sigurnosni sistemi ne znače apsolutnu anonimnost. U tekst ne upisuj podatke po kojima se ti ili drugi mogu prepoznati.'));
$('#footer-privacy').onclick=()=>$('#privacy').click();
$('#rules').onclick=()=>modal('Pravila zajednice',node('p','', 'Piši bez vrijeđanja, uznemiravanja, prijetnji i spama. Slike i linkovi nisu dozvoljeni. Objavljeni tekst ne možeš naknadno uređivati ili brisati. Administrator može ukloniti neprikladan sadržaj. Čitanje i glasanje su besplatni. Ispovijesti čekaju red i objavljuje se najviše jedna na sat.'));
if(isLocal)$('#preview').textContent='Lokalni test · bez veze sa živim sajtom';
else if(window.ISPOVESTI_CONFIG?.mode==='live-test')$('#preview').textContent='TEST · prava baza, odvojeni probni podaci';
else if(!isPreview)$('#preview').hidden=true;
function metadata(item){const div=node('div','story-meta');div.append(node('span','avatar','“'),node('span','author',item.nickname||'Anonimno'));const t=node('time','',date(item.published_at||item.created_at));t.dateTime=item.published_at||item.created_at||'';div.append(t);return div;}
function contentForm(kind,extra,done){
 const form=node('form','form'),label=node('label','',kind==='confession'?'Tvoja priča':'Tvoje riječi'),text=node('textarea');text.required=true;text.maxLength=kind==='confession'?10000:2000;text.placeholder=kind==='confession'?'Napiši ono što želiš da podijeliš...':kind==='comment'?'Napiši komentar...':'Napiši odgovor...';label.append(text);
 const nickLabel=node('label','','Nadimak'),nick=node('input');nick.maxLength=40;nick.autocomplete='off';nickLabel.append(nick);
 const status=node('p','hint'),counter=node('span','hint','0 znakova'),send=node('button','primary',kind==='confession'?'Pošalji ispovijest':'Pošalji');send.type='submit';
 const row=node('div','row');row.append(counter,send);text.oninput=()=>counter.textContent=[...text.value.trim()].length+' znakova';
 form.append(label,nickLabel,row,status);
 let allowDuplicate=false,duplicateButton;
 form.onsubmit=async e=>{e.preventDefault();send.disabled=true;status.textContent='';
  try{
   const count=[...text.value.trim()].length,min=kind==='confession'?15:1,max=kind==='confession'?5000:1000;
   if(count<min||count>max)throw new Error(`Tekst mora imati od ${min} do ${max} znakova.`);
   const r=await request('submit',{kind,body:text.value,nickname:nick.value,...extra,allow_duplicate:allowDuplicate});
   if(r.duplicate){status.textContent='Ovaj tekst si već poslao. Ako želiš, možeš ga poslati ponovo.';if(!duplicateButton){duplicateButton=button('Ipak pošalji',()=>{allowDuplicate=true;form.requestSubmit();});form.append(duplicateButton);}return;}
   text.value='';nick.value='';counter.textContent='0 znakova';allowDuplicate=false;duplicateButton?.remove();duplicateButton=null;
   if(kind==='confession'){dialog.close();closeMenu();toast('Tvoja ispovijest je uspješno poslata. Čeka svoj red za objavljivanje.');}
   else{toast('Tvoj komentar je poslat.');await done();}
  }catch(err){status.textContent=err.message;status.className='hint error';}finally{send.disabled=false;}
 };
 text.addEventListener('input',()=>{allowDuplicate=false;duplicateButton?.remove();duplicateButton=null;});
 return form;
}
function voteControls(item){
 const row=node('div','vote-controls');row.style.display='contents';const buttons=[];
 for(const [value,symbol] of [[1,'👍'],[-1,'👎']])buttons.push(button(symbol,async b=>{b.disabled=true;try{render(await request('vote',{id:item.id,value}));}finally{b.disabled=false;}}));
 function render(r){buttons.forEach((b,i)=>{const value=i===0?1:-1;b.classList.toggle('selected',r.my_vote===value);b.setAttribute('aria-pressed',String(r.my_vote===value));b.setAttribute('aria-label',i===0?'Pozitivan glas':'Negativan glas');b.textContent=(i===0?'👍':'👎')+(r.likes===undefined?'':' '+(i===0?r.likes:r.dislikes));});}
 row.append(...buttons);render({});
 watchState(item.id,'vote',row,render);
 return row;
}
function report(item){const form=node('form','form');const label=node('label','','Razlog prijave'),select=node('select');for(const [value,text]of [['abuse','Vrijeđanje ili uznemiravanje'],['threat','Prijetnje'],['spam','Spam'],['other','Ostalo']]){const o=node('option','',text);o.value=value;select.append(o);}label.append(select);const send=node('button','primary','Pošalji prijavu');form.append(label,send);form.onsubmit=async e=>{e.preventDefault();send.disabled=true;try{await request('report',{id:item.id,reason:select.value});dialog.close();toast('Prijava je zabilježena. Hvala.');}catch(err){toast(err.message);}finally{send.disabled=false;}};modal('Prijavi sadržaj',form);}
async function commentBranch(confessionId,parentId,container,refreshContext){
 let loaded=0;
 const list=node('div'),more=button('Učitaj još komentara ↓',load,'load-more');container.replaceChildren(list,more);
 async function load(){more.disabled=true;try{const r=await request('comments',{confession_id:confessionId,parent_id:parentId,offset:loaded});r.items.forEach(item=>list.append(comment(item,confessionId,refreshContext)));loaded+=r.items.length;more.hidden=r.items.length<20;}finally{more.disabled=false;}}
 await load();
 if(!parentId)container.append(contentForm('comment',{confession_id:confessionId},async()=>{await commentBranch(confessionId,null,container,refreshContext);await refreshContext();}));
}
function comment(item,confessionId,refreshContext){
 const wrap=node('div','comment'),card=button('',()=>toggleMenu(),'comment-card');card.append(metadata(item),node('p','body-text',item.body));card.setAttribute('aria-label','Otvori radnje za komentar');const menu=node('div','context-menu');menu.hidden=true;wrap.append(card,menu);
 function toggleMenu(){if(openMenu&&openMenu!==menu)openMenu.hidden=true;menu.hidden=!menu.hidden;openMenu=menu.hidden?null:menu;}
 const replyForm=node('div');replyForm.hidden=true;
 menu.append(voteControls(item),button('Odgovori',()=>{replyForm.hidden=!replyForm.hidden;if(!replyForm.hidden){replyForm.replaceChildren(contentForm('reply',{confession_id:confessionId,parent_id:item.id},async()=>{replyForm.hidden=true;repliesButton.hidden=false;await refreshContext();}));replyForm.querySelector('textarea').focus();}}),button('❗',()=>report(item)));
 const branch=node('div','replies');branch.hidden=true;
 const repliesButton=button('Otvori odgovore',async b=>{
   if(!branch.hidden){branch.hidden=true;b.textContent='Otvori odgovore';return;}
   document.querySelectorAll('.replies').forEach(other=>{if(other!==branch&&!other.contains(branch)){other.hidden=true;const prev=other.previousElementSibling;if(prev?.tagName==='BUTTON')prev.textContent='Otvori odgovore';}});
   branch.hidden=false;openBranch=branch;b.textContent='Sakrij odgovore';
   await commentBranch(confessionId,item.id,branch,refreshContext);
 });repliesButton.hidden=!item.has_replies;
 wrap.append(replyForm,repliesButton,branch);return wrap;
}
function story(item){
 const article=node('article','story');if(item.nickname)article.append(node('div','story-nickname',item.nickname));article.append(node('div','story-content body-text',item.body));const storyDate=node('div','story-date',date(item.published_at||item.created_at));article.append(storyDate);
 const row=node('div','story-actions vote-row'),commentsArea=node('section','comments-area comments');
 const comments=node('h3','comment-title','Komentari');const commentsList=node('div','comment-list');commentsArea.append(comments,commentsList);
 const favorite=button('♡',async b=>{const enabled=b.getAttribute('aria-pressed')!=='true';await request('favorite',{id:item.id,enabled});setFavorite(enabled);},'action favorite');favorite.setAttribute('aria-label','Dodaj ili ukloni iz omiljenih');
 function setFavorite(value){favorite.textContent=value?'♥':'♡';favorite.setAttribute('aria-pressed',String(value));favorite.classList.toggle('selected',value);}
 async function refreshContext(){const context=await request('context',{id:item.id});comments.textContent='Komentari'+(context.comment_count===null?'':' ('+context.comment_count+')');setFavorite(context.favorite);}
 watchState(item.id,'context',row,context=>{comments.textContent='Komentari'+(context.comment_count===null?'':' ('+context.comment_count+')');setFavorite(context.favorite);});
 row.append(voteControls(item),favorite,button('❗',()=>report(item),'action report'));article.append(row,commentsArea);commentBranch(item.id,null,commentsList,refreshContext).catch(err=>{commentsList.textContent=err.message;});
 // A story is marked read after a visible part has remained visible for 1.5 seconds.
 let readTimer,recorded=false;
 const observer=new IntersectionObserver(entries=>{if(entries[0].isIntersecting&&!recorded){readTimer=setTimeout(()=>{recorded=true;request('read',{id:item.id}).catch(()=>{});observer.disconnect();},1500);}else clearTimeout(readTimer);},{threshold:.1});observer.observe(article);
 return article;
}
async function load(reset=false){
 if(busy&&!reset)return;busy=true;const version=reset?++generation:generation;
 if(reset){offset=0;feed.replaceChildren(node('p','empty','Učitavam priče…'));}
 $('#more').disabled=true;
 try{
  const isList=['favorites','recently_read','my_comments'].includes(currentView);
  const result=await request(isList?'list':'feed',isList?{list:currentView,offset}:{sort:currentView,offset});
  if(version!==generation)return;
  if(reset)feed.replaceChildren();
  for(const item of result.items){if(currentView==='my_comments'){const entry=node('article','story');entry.append(metadata(item),node('p','body-text',item.body));entry.append(button('Otvori ispovijest',async()=>{
      // Exact parent endpoint avoids searching only the first feed page.
      const r=await request('confession',{id:item.confession_id});modal('Ispovijest',story(r.item));
    }));feed.append(entry);}else feed.append(story(item));}
  offset+=result.items.length;$('#more').hidden=result.items.length<20;
  if(!offset)feed.append(node('p','empty',isList?'Ova privatna lista je još prazna.':'Još nema objavljenih ispovijesti.'));
 }catch(err){if(version!==generation)return;if(reset)feed.replaceChildren(node('p','empty error',err.message));else toast(err.message);$('#more').hidden=false;}
 finally{if(version===generation){busy=false;$('#more').disabled=false;}}
}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{currentView=b.dataset.view;closeMenu();document.querySelectorAll('[data-view]').forEach(n=>n.classList.toggle('active',n===b));$('#feed-title').textContent=titles[currentView];$('#feed-subtitle').textContent=['favorites','recently_read','my_comments'].includes(currentView)?'Privatno · samo u tvojoj anonimnoj sesiji':'Svaka priča ima svoje mjesto.';load(true);});
$('#sidebar-compose').append(contentForm('confession',{},()=>{}));
$('#more').onclick=()=>load();
load(true);
