import {chatRequest} from './client.mjs?v=20261124-module-singleton1';
export const avatars={ghost:'👻',moon:'🌙',star:'⭐',owl:'🦉',fox:'🦊',leaf:'🍃',cloud:'☁️',comet:'☄️'};
const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
const button=(label,run,cls='chat-small')=>{const b=el('button',cls,label);b.type='button';b.onclick=()=>Promise.resolve(run()).catch(e=>alert(e.message));return b;};
export async function openChat(){
 const dialog=document.querySelector('#dialog'),root=el('section','chat-panel');let stopped=false,polling=false,timer,profile,sending=false,requestId,lastBody,pendingMessage=null,initial=true,noOlder=false,activeActionMenu=null;
 let messages=[];let activeReportOptions=null;const messageNodes=new Map();
 root.addEventListener('click',event=>{if(!activeReportOptions)return;if(event.target.closest('.chat-report-options, .chat-message-menu'))return;activeReportOptions.remove();activeReportOptions=null;});
 if(document.body.classList.contains('menu-open'))document.querySelector('#menu-toggle').click();
 dialog.classList.add('chat-room');document.body.classList.add('chat-open');document.querySelector('#dialog-title').textContent='Anonimni chat';document.querySelector('#dialog-body').replaceChildren(root);
 const close=document.querySelector('#close-dialog');close.setAttribute('aria-label','Vrati se na ispovesti');if(!dialog.open)dialog.showModal();
 const top=el('div','chat-topbar'),privacy=el('details','chat-settings'),summary=el('summary','','⋯');summary.setAttribute('aria-label','Pravila i privatnost');
 const settings=el('section','chat-settings-content');settings.append(el('h2','','Pravila i privatnost'),el('p','','Jedna zajednička anonimna soba, bez privatnih poruka. Bez pretnji, vređanja, spama, linkova i deljenja tuđih ličnih podataka. Poruke imaju najviše 1.000 znakova; fotografije nisu dozvoljene.'),el('p','','Lično blokiranje sakriva poruke izabranog korisnika samo tebi. Administratorska zabrana onemogućava pristup chatu; administrator pregleda prijave i može ukloniti ili vratiti poruku.'),el('p','','Veza koristi HTTPS. Chat nije end-to-end šifrovan: ovlašćeni moderatori i infrastruktura mogu pristupiti sadržaju. Ne šalji osetljive podatke. U javnom chatu prikazuje se najviše posljednjih 100 poruka. Starije poruke ostaju sačuvane i dostupne su samo ovlašćenom administratoru. Konačan rok čuvanja biće objavljen prije stvarnog pokretanja.'),el('p','','Chat je trenutno besplatan i ne traži pristupni kod niti SMS. Pristup se automatski aktivira u anonimnoj sesiji.'));
 const account=el('div','chat-account'),blocked=el('div');settings.append(account,blocked);privacy.append(summary,settings);top.append(privacy);
 const status=el('p','chat-status');status.setAttribute('role','status');
 const list=el('div','chat-messages');list.setAttribute('aria-label','Poruke u zajedničkoj sobi');list.setAttribute('role','log');list.setAttribute('aria-live','polite');
 const form=el('form','chat-compose'),text=el('textarea');text.maxLength=1000;text.required=true;text.rows=1;text.placeholder='Napiši poruku…';text.setAttribute('aria-label','Poruka u zajedničkom chatu');
 const send=el('button','chat-send','➤');send.type='submit';send.setAttribute('aria-label','Pošalji poruku');form.append(text,send);form.hidden=true;root.append(top,status,list,form);
 function resetAccess(message){profile=null;messages=[];list.replaceChildren();form.hidden=true;status.textContent=message;clearInterval(timer);}
 function render(items,older=false){
  const atBottom=initial||list.scrollHeight-list.scrollTop-list.clientHeight<80,oldHeight=list.scrollHeight,oldTop=list.scrollTop;
  const desired=[],wanted=new Set();
  for(const m of items){
   const id=String(m.id);wanted.add(id);let row=messageNodes.get(id);
   if(!row){
    const own=m.sender===profile.id;row=el('article','chat-message '+(own?'own':'other'));row.dataset.id=id;
    const avatar=el('span','chat-avatar',avatars[m.avatar]||avatars.ghost);avatar.setAttribute('aria-hidden','true');const body=el('p','chat-body',m.body);row.append(avatar,body);
    const actions=el('details','chat-message-menu');actions.addEventListener('toggle',()=>{if(actions.open){if(activeReportOptions){activeReportOptions.remove();activeReportOptions=null;}if(activeActionMenu&&activeActionMenu!==actions)activeActionMenu.open=false;activeActionMenu=actions;}else if(activeActionMenu===actions)activeActionMenu=null;});const more=el('summary','','⋮');more.setAttribute('aria-label','Radnje uz poruku');const menu=el('div','chat-message-actions');
    const reportOptions=el('div','chat-report-options');reportOptions.hidden=true;
    const custom=el('div','chat-report-custom');custom.hidden=true;
    const detail=el('textarea');detail.rows=1;detail.maxLength=500;detail.placeholder='Opiši razlog prijave…';detail.setAttribute('aria-label','Dodatni opis prijave');detail.style.height='28px';detail.addEventListener('input',()=>{detail.style.height='28px';detail.style.height=Math.min(detail.scrollHeight,70)+'px';});
    let reportSending=false;
    async function sendReport(reason,details=''){
     if(reportSending)return;reportSending=true;
     const controls=[...reportOptions.querySelectorAll('button,textarea')];controls.forEach(control=>control.disabled=true);
     try{
      const result=await chatRequest('report',{id:m.id,reason,details:details.trim()});
      status.textContent=result.already_reported?'Već si prijavio ovu poruku.':'Prijava je zabilježena. Hvala.';
      actions.open=false;reportOptions.remove();if(activeReportOptions===reportOptions)activeReportOptions=null;
     }catch(error){
      status.textContent=error.message||'Prijava nije uspjela.';
      controls.forEach(control=>control.disabled=false);reportSending=false;
     }
    }
    const reportButton=button('Prijavi',()=>{if(activeReportOptions===reportOptions){reportOptions.remove();activeReportOptions=null;return;}if(activeReportOptions)activeReportOptions.remove();activeReportOptions=reportOptions;reportOptions.hidden=false;row.append(reportOptions);actions.open=false;});
    const hateButton=button('Govor mržnje',()=>sendReport('hate_speech'),'chat-small');
    const spamButton=button('Spam',()=>sendReport('spam'),'chat-small');
    const moreReason=button('···',()=>{custom.hidden=!custom.hidden;if(!custom.hidden)detail.focus();},'chat-small');
    const sendReportButton=button('Pošalji',()=>sendReport('other',detail.value),'chat-small');
    custom.append(detail,sendReportButton);
    reportOptions.append(hateButton,spamButton,moreReason,custom);
    menu.append(reportButton,reportOptions);
    if(!own){const blockButton=button('Blokiraj',async()=>{await chatRequest('block',{target:m.sender});actions.open=false;status.textContent='Korisnik je blokiran. Njegove poruke više nećeš vidjeti.';await loadProfile();});menu.append(blockButton);}
    actions.append(more,menu);row.append(actions);messageNodes.set(id,row);
   }else{
    row.classList.toggle('own',m.sender===profile.id);row.classList.toggle('other',m.sender!==profile.id);
    const avatar=row.querySelector('.chat-avatar'),body=row.querySelector('.chat-body');
    if(avatar)avatar.textContent=avatars[m.avatar]||avatars.ghost;
    if(body&&body.textContent!==m.body)body.textContent=m.body;
   }
   desired.push(row);
  }
  if(activeActionMenu&&!wanted.has(String(activeActionMenu.closest('.chat-message')?.dataset.id)))activeActionMenu.open=false;
  for(let i=0;i<desired.length;i++){const current=list.children[i];if(current!==desired[i])list.insertBefore(desired[i],current||null);}
  for(const child of [...list.children])if(!wanted.has(String(child.dataset.id))){messageNodes.delete(String(child.dataset.id));child.remove();}
  if(older)list.scrollTop=oldTop+list.scrollHeight-oldHeight;else if(atBottom)list.scrollTop=list.scrollHeight;else list.scrollTop=oldTop;initial=false;
 }
 async function refresh(older=false,initialHistory=null){if(stopped||polling||!profile?.active||document.hidden||activeActionMenu)return;polling=true;
  try{const responses=[initialHistory||await chatRequest('history')];if(stopped)return;
   if(activeActionMenu)return;
   const latest=responses[0],cutoff=Date.parse(latest.history_cutoff),seen=new Map();for(const r of responses)for(const m of r.items)if(Date.parse(m.created_at)>cutoff)seen.set(m.id,m);
   messages=[...seen.values()].sort((a,b)=>Date.parse(a.created_at)-Date.parse(b.created_at)||(BigInt(a.id)<BigInt(b.id)?-1:1));
   if(pendingMessage&&!seen.has(pendingMessage.id))messages.push(pendingMessage);
   root.dataset.ownSide=latest.side||profile.side||'left';
   noOlder=true;render(messages,older);form.hidden=false;
  }catch(e){if(stopped)return;if([401,403].includes(e.status))resetAccess(e.message);else status.textContent=e.message;}
  finally{polling=false;}
 }
 async function loadProfile(){try{profile=await chatRequest('profile');if(stopped)return;root.dataset.ownSide=profile.side||'left';
   account.replaceChildren(el('p','hint','Tvoj anonimni chat ID: '+profile.id),el('p','hint',profile.active?(profile.plan==='free'?'Besplatan pristup':'Paket '+profile.plan+' · ističe '+new Date(profile.expires_at).toLocaleString('sr-Latn')):'Chat trenutno nije dostupan.'));
   blocked.replaceChildren();for(const [i,b]of (profile.blocked||[]).entries())blocked.append(button('Odblokiraj korisnika '+(i+1),async()=>{await chatRequest('unblock',{target:b.id});await loadProfile();}));
   form.hidden=!profile.active;if(profile.active){status.textContent='';await refresh(false);clearInterval(timer);timer=setInterval(()=>refresh(),1500);}else status.textContent='Chat trenutno nije dostupan.';
  }catch(e){resetAccess(e.message);}}
 form.onsubmit=async event=>{
  event.preventDefault();if(sending)return;
  const draft=text.value.trim();
  if(!pendingMessage&&!draft)return;
  const body=pendingMessage?pendingMessage.body:draft;
  if([...body].length>1000){status.textContent='Poruka može imati najviše 1.000 znakova.';return;}
  if(pendingMessage&&draft&&draft!==pendingMessage.body){status.textContent='Prethodna poruka još čeka potvrdu. Pošalji je ponovo prije slanja nove.';return;}
  if(!pendingMessage){
   requestId=crypto.randomUUID();lastBody=body;
   pendingMessage={id:'pending-'+requestId,requestId,sender:profile.id,body,avatar:profile.avatar,created_at:new Date().toISOString(),pending:true};
   messages.push(pendingMessage);render(messages);text.value='';
  }
  const sendingMessage=pendingMessage;
  sending=true;send.disabled=true;text.disabled=true;
  try{
   await chatRequest('send',{body:sendingMessage.body,request_id:sendingMessage.requestId});
   pendingMessage=null;requestId=null;lastBody=null;text.disabled=false;
   if(text.value.trim()===sendingMessage.body)text.value='';
   status.textContent='';await refresh();list.scrollTop=list.scrollHeight;
  }catch(e){
   sendingMessage.failed=true;
   if(!text.value.trim())text.value=sendingMessage.body;
   render(messages);
   status.textContent=[401,403].includes(e.status)?e.message:'Poruka još nije potvrđena. Pritisni „Pošalji“ ponovo; koristi se isti zahtev kako se poruka ne bi duplirala.';
   if([401,403].includes(e.status))resetAccess(e.message);
  }finally{sending=false;send.disabled=false;}
 };
 dialog.addEventListener('close',()=>{stopped=true;clearInterval(timer);messages=[];list.replaceChildren();text.value='';dialog.classList.remove('chat-room');document.body.classList.remove('chat-open');close.setAttribute('aria-label','Zatvori');document.querySelector('#open-chat')?.focus({preventScroll:true});},{once:true});
 await loadProfile();
}
document.querySelector('#open-chat')?.addEventListener('click',()=>openChat().catch(e=>alert(e.message)));
