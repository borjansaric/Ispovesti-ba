import {chatRequest} from './client.mjs?v=room2';
export const avatars={ghost:'👻',moon:'🌙',star:'⭐',owl:'🦉',fox:'🦊',leaf:'🍃',cloud:'☁️',comet:'☄️'};
const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
const button=(label,run,cls='chat-small')=>{const b=el('button',cls,label);b.type='button';b.onclick=()=>Promise.resolve(run()).catch(e=>alert(e.message));return b;};
export async function openChat(){
 const live=window.ISPOVESTI_CONFIG?.chatEnvironment==='live';
 let stopMetrics=()=>{},metricsActive=false;
 const dialog=document.querySelector('#dialog'),root=el('section','chat-panel');let stopped=false,polling=false,timer,profile,sending=false,requestId,lastBody,initial=true,noOlder=false;
 const pages=[null];let messages=[];
 if(document.body.classList.contains('menu-open'))document.querySelector('#menu-toggle').click();
 dialog.classList.add('chat-room');document.body.classList.add('chat-open');document.querySelector('#dialog-title').textContent='Anonimni chat';document.querySelector('#dialog-body').replaceChildren(root);
 const close=document.querySelector('#close-dialog');close.setAttribute('aria-label','Vrati se na ispovijesti');if(!dialog.open)dialog.showModal();
 const top=el('div','chat-topbar'),privacy=el('details','chat-settings'),summary=el('summary','','⋯');summary.setAttribute('aria-label','Pravila i privatnost');
 const settings=el('section','chat-settings-content');settings.append(el('h2','','Pravila i privatnost'),el('p','','Jedna zajednička anonimna soba, bez privatnih poruka. Bez prijetnji, vrijeđanja, spama, linkova i dijeljenja tuđih ličnih podataka. Poruke imaju najviše 1.000 znakova; fotografije nisu dozvoljene.'),el('p','','Lično blokiranje sakriva poruke izabranog korisnika samo tebi. Administratorska zabrana onemogućava pristup chatu; administrator pregleda prijave i može ukloniti ili vratiti poruku.'),el('p','','Veza koristi HTTPS. Chat nije end-to-end šifrovan: ovlašteni moderatori i infrastruktura mogu pristupiti sadržaju. Ne šalji osjetljive podatke. Pomična istorija od 1, 7 ili 31 sat ograničava pristup porukama, a ne njihov rok čuvanja. Konačan rok čuvanja bit će objavljen prije stvarnog pokretanja.'),el('p','','Pristupni kod važi do prvobitnog isteka paketa. Ponovni unos ne produžava paket. Aktivacija u drugoj sesiji prekida prethodnu; dozvoljena su najviše tri prelaska u 24 sata. Kod čuvaj privatno: ko ga zna može pokušati preuzeti chat pristup. Stvarna SMS naplata još nije povezana.'));
 const account=el('div','chat-account'),blocked=el('div');settings.append(account,blocked);privacy.append(summary,settings);top.append(privacy);
 const status=el('p','chat-status');status.setAttribute('role','status');
 const gate=el('section','chat-gate'),codeForm=el('form','form'),label=el('label','','Pristupni kod'),code=el('input');code.type='password';code.autocomplete='off';code.maxLength=40;code.placeholder=live?'Pristupni kod':'TEST-…';codeForm.hidden=live;code.setAttribute('aria-label','Pristupni kod');label.append(code);
 const enter=el('button','primary','Uđi');enter.type='submit';codeForm.append(label,enter);gate.append(codeForm,el('p','hint',live?'Kupovina pristupa još nije dostupna.':'Probna verzija: kod izdaje administrator, bez naplate. SMS slanje još nije povezano.'),button('Provjeri postojeći paket',loadProfile));
 const list=el('div','chat-messages');list.setAttribute('aria-label','Poruke u zajedničkoj sobi');list.setAttribute('role','log');list.setAttribute('aria-live','polite');
 const form=el('form','chat-compose'),text=el('textarea');text.maxLength=2000;text.required=true;text.rows=1;text.placeholder='Napiši poruku…';text.setAttribute('aria-label','Poruka u zajedničkom chatu');
 const send=el('button','chat-send','➤');send.type='submit';send.setAttribute('aria-label','Pošalji poruku');form.append(text,send);form.hidden=true;root.append(top,status,gate,list,form);
 function resetAccess(message){stopMetrics();metricsActive=false;profile=null;messages=[];pages.splice(1);list.replaceChildren();form.hidden=true;gate.hidden=false;status.textContent=message;clearInterval(timer);}
 function render(items,older=false){const atBottom=initial||list.scrollHeight-list.scrollTop-list.clientHeight<80,oldHeight=list.scrollHeight,oldTop=list.scrollTop;
  const openId=list.querySelector('details[open]')?.closest('[data-id]')?.dataset.id;
  const frag=document.createDocumentFragment();for(const m of items){const own=m.sender===profile.id,row=el('article','chat-message '+(own?'own':'other'));row.dataset.id=m.id;
   const avatar=el('span','chat-avatar',avatars[m.avatar]||avatars.ghost);avatar.setAttribute('aria-hidden','true');row.append(avatar,el('p','chat-body',m.body));
   const actions=el('details','chat-message-menu'),more=el('summary','','⋮');more.setAttribute('aria-label','Radnje uz poruku');const menu=el('div','chat-message-actions');
   menu.append(button('Prijavi',async()=>{const reason=prompt('Razlog: abuse, threat, spam ili other','spam');if(reason){await chatRequest('report',{id:m.id,reason});status.textContent='Prijava je poslata.';actions.open=false;}}));
   if(!own)menu.append(button('Sakrij ovog korisnika',async()=>{await chatRequest('block',{target:m.sender});await loadProfile();}));actions.append(more,menu);if(m.id===openId)actions.open=true;row.append(actions);frag.append(row);
  }list.replaceChildren(frag);if(older)list.scrollTop=oldTop+list.scrollHeight-oldHeight;else if(atBottom)list.scrollTop=list.scrollHeight;else list.scrollTop=oldTop;initial=false;
 }
 async function refresh(older=false){if(stopped||polling||!profile?.active||document.hidden)return;polling=true;
  try{const responses=[];for(const cursor of pages){responses.push(await chatRequest('history',cursor?{before:cursor}:{}));if(stopped)return;}
   const latest=responses[0],cutoff=Date.parse(latest.history_cutoff),seen=new Map();for(const r of responses)for(const m of r.items)if(Date.parse(m.created_at)>cutoff)seen.set(m.id,m);
   messages=[...seen.values()].sort((a,b)=>Date.parse(a.created_at)-Date.parse(b.created_at)||(BigInt(a.id)<BigInt(b.id)?-1:1));root.dataset.ownSide=latest.side||profile.side||'left';
   noOlder=responses.at(-1).items.length<100;render(messages,older);form.hidden=false;gate.hidden=true;
  }catch(e){if(stopped)return;if([401,403].includes(e.status))resetAccess(e.message);else status.textContent=e.message;}
  finally{polling=false;}
 }
 async function loadProfile(){try{profile=await chatRequest('profile');if(stopped)return;root.dataset.ownSide=profile.side||'left';
   account.replaceChildren(el('p','hint',(live?'Tvoj chat ID: ':'Tvoj testni chat ID: ')+profile.id),el('p','hint',profile.active?'Paket '+profile.plan+' · ističe '+new Date(profile.expires_at).toLocaleString('sr-Latn'):'Nema aktivnog paketa.'));
   blocked.replaceChildren();for(const [i,b]of (profile.blocked||[]).entries())blocked.append(button('Odblokiraj korisnika '+(i+1),async()=>{await chatRequest('unblock',{target:b.id});await loadProfile();}));
   gate.hidden=!!profile.active;form.hidden=!profile.active;if(profile.active){if(window.ISPOVESTI_CONFIG?.mode==='local'&&!metricsActive){metricsActive=true;import('../admin-prep/telemetry-local.mjs').then(m=>{if(!stopped&&profile?.active)stopMetrics=m.begin('chat')})}status.textContent='';await refresh();clearInterval(timer);timer=setInterval(()=>refresh(),1500);}else resetAccess('');
  }catch(e){resetAccess(e.message);}}
 list.addEventListener('scroll',async()=>{if(list.scrollTop>36||polling||noOlder||!messages.length)return;const cursor=messages[0].id;if(pages.includes(cursor))return;pages.push(cursor);await refresh(true);});
 let redeemBusy=false;codeForm.onsubmit=async event=>{event.preventDefault();if(redeemBusy)return;redeemBusy=true;enter.disabled=true;status.textContent='Provjeravam kod…';try{await chatRequest('redeem_code',{code:code.value});code.value='';pages.splice(1);initial=true;noOlder=false;await loadProfile();}catch(e){status.textContent=e.message;}finally{code.value='';enter.disabled=false;redeemBusy=false;}};
 form.onsubmit=async event=>{event.preventDefault();if(sending)return;if([...text.value.trim()].length>1000){status.textContent='Poruka može imati najviše 1.000 znakova.';return;}sending=true;send.disabled=true;text.disabled=true;
  try{if(text.value!==lastBody){requestId=crypto.randomUUID();lastBody=text.value;}await chatRequest('send',{body:text.value,request_id:requestId});text.value='';requestId=null;lastBody=null;status.textContent='';await refresh();list.scrollTop=list.scrollHeight;}catch(e){status.textContent=e.message;if([401,403].includes(e.status))resetAccess(e.message);}finally{sending=false;send.disabled=false;text.disabled=false;}};
 dialog.addEventListener('close',()=>{stopMetrics();stopped=true;clearInterval(timer);messages=[];list.replaceChildren();code.value='';text.value='';dialog.classList.remove('chat-room');document.body.classList.remove('chat-open');close.setAttribute('aria-label','Zatvori');document.querySelector('#open-chat')?.focus({preventScroll:true});},{once:true});
 await loadProfile();
}
document.querySelector('#open-chat')?.addEventListener('click',()=>openChat().catch(e=>alert(e.message)));
