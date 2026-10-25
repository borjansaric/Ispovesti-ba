import {chatRequest,recoveryKey} from './client.mjs';
export const avatars={ghost:'👻',moon:'🌙',star:'⭐',owl:'🦉',fox:'🦊',leaf:'🍃',cloud:'☁️',comet:'☄️'};
const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
const button=(text,run)=>{const b=el('button','action',text);b.type='button';b.onclick=()=>Promise.resolve(run()).catch(e=>alert(e.message));return b;};
const date=t=>new Date(t).toLocaleString('sr-Latn');
export async function openChat(){
 const dialog=document.querySelector('#dialog'),root=el('section','chat-panel');let timer,stopped=false,polling=false,sending=false,profile,requestId,lastBody,beforeCursor=null,lastItems=[];
 if(document.body.classList.contains('menu-open'))document.querySelector('#menu-toggle').click();
 document.querySelector('#dialog-title').textContent='Anonimni chat';document.querySelector('#dialog-body').replaceChildren(root);if(!dialog.open)dialog.showModal();
 const status=el('p','chat-status','Jedna zajednička soba. Nema privatnih poruka.');root.append(status);
 const privacy=el('details'),summary=el('summary','','Pravila i privatnost');privacy.append(summary,el('p','hint','Bez vrijeđanja, prijetnji, spama i dijeljenja ličnih podataka. Do 1.000 znakova; linkovi i fotografije nisu dozvoljeni. Nadimak i avatar su javni učesnicima sobe. Moderatori mogu pregledati poruke i prijave, ukloniti sadržaj i blokirati pristup. Lično blokiranje skriva poruke tog naloga samo tebi. Ovo nije end-to-end šifrovan chat. Dostupna istorija nije rok brisanja podataka; rok čuvanja mora biti objavljen prije stvarnog pokretanja. Ne upisuj lične podatke.'));root.append(privacy);
 const identity=el('div','chat-identity'),plans=el('div','chat-plans'),tools=el('div'),list=el('div','chat-messages'),form=el('form','form'),text=el('textarea');text.maxLength=1000;text.required=true;text.placeholder='Poruka svima u sobi…';text.setAttribute('aria-label','Poruka u zajedničkom chatu');
 for(const [label,history]of [['24 sata','Istorija: 1 sat'],['7 dana','Istorija: 7 sati'],['30 dana','Istorija: 31 sat']]){const box=el('div');box.append(el('strong','',label),el('span','',history));plans.append(box);}
 const pages=el('div');pages.append(button('Najnovije poruke',async()=>{beforeCursor=null;await refresh();}),button('Starije poruke',async()=>{if(lastItems.length){beforeCursor=lastItems[0].id;await refresh();}}));
 const send=el('button','primary','Pošalji poruku');send.type='submit';form.append(text,send);root.append(identity,plans,tools,list,pages,form);
 const recovery=el('details'),rs=el('summary','','Sačuvaj ili povrati anonimni chat nalog');recovery.append(rs);
 const info=el('p','hint','Sačuvaj tajni ključ privatno. Ko ga ima može preuzeti tvoj chat nalog. Bez sačuvanog ključa oporavak nije moguć. Oporavak daje novi ključ i prenosi samo chat prava; ne vraća administratora niti privatne liste osnovnog sajta. Za oporavak koristi novi anonimni nalog prije ulaska u chat.');const code=el('input');code.type='password';code.autocomplete='off';code.placeholder='Postojeći ključ za oporavak';code.setAttribute('aria-label','Ključ za oporavak');
 const out=el('output');out.hidden=true;const save=button('Napravi novi ključ za čuvanje',async()=>{const key=recoveryKey();await chatRequest('recovery_set',{code:key});out.textContent=key;out.hidden=false;});
 const restore=button('Povrati nalog',async()=>{const next=recoveryKey();await chatRequest('recover',{code:code.value.trim(),new_code:next});code.value='';out.textContent=next;out.hidden=false;await loadProfile();save.disabled=false;enter.remove();restore.disabled=true;});
 recovery.append(info,save,code,restore,out);root.append(recovery);
 function stop(){stopped=true;clearInterval(timer);list.replaceChildren();text.value='';out.textContent='';}
 dialog.addEventListener('close',stop,{once:true});
 function message(m){const row=el('article','chat-message');row.dataset.id=m.id;row.dataset.at=m.created_at;const who=el('div','chat-identity');who.append(el('span','chat-avatar',avatars[m.avatar]||avatars.ghost),el('strong','',m.nickname));row.append(who,el('p','',m.body),el('time','',date(m.created_at)));
  row.append(button('Prijavi',async()=>{const reason=prompt('Razlog: abuse, threat, spam ili other','spam');if(reason){await chatRequest('report',{id:m.id,reason});status.textContent='Prijava je poslata moderatoru.';}}));
  if(m.sender!==profile?.id)row.append(button('Blokiraj',async()=>{await chatRequest('block',{target:m.sender});await loadProfile();}));return row;
 }
 async function refresh(){
  if(stopped||polling||document.hidden)return;polling=true;
  try{const r=await chatRequest('history',beforeCursor?{before:beforeCursor}:{});lastItems=r.items;if(stopped)return;const bottom=list.scrollHeight-list.scrollTop-list.clientHeight<60;list.replaceChildren(...r.items.map(message));if(bottom)list.scrollTop=list.scrollHeight;status.textContent='Uživo · pristup do '+date(r.expires_at)+' · istorija od '+date(r.history_cutoff);form.hidden=false;}
  catch(e){if(stopped)return;status.textContent=e.message;if(e.status===403||e.status===401){list.replaceChildren();form.hidden=true;clearInterval(timer);}}
  finally{polling=false;}
 }
 async function loadProfile(){
  profile=await chatRequest('profile');if(stopped)return;identity.replaceChildren(el('span','chat-avatar',avatars[profile.avatar]),el('strong','',profile.nickname));tools.replaceChildren(el('p','hint','Tvoj chat ID za probni paket: '+profile.id),el('p','hint','Vlastiti nadimak i promjena avatara su odvojene dodatne kupovine. Cijene još nisu određene; stvarna naplata je isključena.'));
  tools.append(button('Provjeri paket i profil',()=>loadProfile()));for(const b of profile.blocked||[])tools.append(button('Odblokiraj '+b.nickname,async()=>{await chatRequest('unblock',{target:b.id});await loadProfile();}));
  form.hidden=!profile.active;if(profile.active){await refresh();clearInterval(timer);timer=setInterval(refresh,1500);}else{list.replaceChildren();status.textContent='Za ulazak je potreban paket. U probnoj verziji paket i dodatke dodjeljuje administrator bez naplate.';}
 }
 form.onsubmit=async event=>{event.preventDefault();if(sending)return;sending=true;send.disabled=true;text.disabled=true;
  try{if(text.value!==lastBody){requestId=crypto.randomUUID();lastBody=text.value;}await chatRequest('send',{body:text.value,request_id:requestId});beforeCursor=null;text.value='';requestId=null;lastBody=null;await refresh();}catch(e){status.textContent=e.message;}finally{sending=false;send.disabled=false;text.disabled=false;}
 };
 const enter=button('Otvori moj chat nalog',async()=>{await loadProfile();save.disabled=false;enter.remove();restore.disabled=true;});root.insertBefore(enter,identity);form.hidden=true;save.disabled=true;
}
document.querySelector('#open-chat')?.addEventListener('click',()=>openChat().catch(e=>alert(e.message)));
