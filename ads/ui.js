import {DemoRewards,DemoAd,KINDS} from './rewards.js';
const labels={confession:'Ispovijest',comment:'Komentar',reply:'Odgovor'};
const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
const none={attachForm:()=>null};
export function installAds(config=window.ISPOVESTI_CONFIG){
 // Two independent switches: no mock ad code runs in live or /test/ modes.
 if(config?.mode!=='preview'||config.ads?.enabled!==true||config.ads?.provider!=='mock')return none;
 const wallet=new DemoRewards({demo:true}),provider=new DemoAd();let activeController=null;
 const bannerRow=el('aside','ads-top');bannerRow.setAttribute('aria-label','Probna reklama');
 const banner=el('div','ads-banner');banner.append(el('span','ads-label','PROBNA REKLAMA'),el('div','ads-banner-creative','Mjesto za reklamu · 320 × 50'));bannerRow.append(banner);document.querySelector('.site-header').before(bannerRow);
 const controls=el('div','ads-controls'),hint=el('span','ads-hint','Probna otključavanja'),plus=el('button','ads-plus','+');plus.type='button';plus.setAttribute('aria-label','Otvori probna otključavanja objavljivanja');plus.onclick=()=>open();controls.append(hint,plus);document.querySelector('main').before(controls);
 const dialog=el('dialog','ads-dialog');dialog.setAttribute('aria-labelledby','ads-title');document.body.append(dialog);
 dialog.addEventListener('close',()=>{activeController?.abort();activeController=null;plus.focus();});
 function open(selected){
  if(dialog.open)return;
  const title=el('h2','','Probna otključavanja');title.id='ads-title';
  const intro=el('p','ads-explanation','Jedna završena probna reklama daje jedno probno otključavanje za izabranu vrstu objave. Nema stvarnih oglasa, zarade ni naplate.');
  const free=el('p','ads-explanation','Gledanje je dobrovoljno. Besplatno slanje, čitanje i glasanje ostaju dostupni. Otključavanje ne preskače CAPTCHA provjeru. Ispovijest i dalje čeka svoj red za objavljivanje.');
  const list=el('div','ads-options');const status=el('p','ads-status');status.setAttribute('role','status');
  const stage=el('div','ads-stage');stage.hidden=true;const progress=el('progress');progress.max=1;progress.value=0;progress.setAttribute('aria-label','Napredak probne reklame');
  const stageText=el('p','','Probna reklama — simulacija gledanja.');const stop=el('button','action','Prekini');stop.type='button';stop.onclick=()=>activeController?.abort();stage.append(stageText,progress,stop);
  const buttons=[];
  for(const kind of KINDS){const row=el('section','ads-option'),name=el('h3','',labels[kind]),balance=el('p','ads-status'),watch=el('button','action','Pogledaj probnu reklamu');watch.type='button';watch.setAttribute('aria-label','Pogledaj probnu reklamu za '+labels[kind].toLowerCase());
   const update=()=>balance.textContent='Dostupno: '+wallet.balance(kind);update();buttons.push(watch);row.append(name,balance,watch);list.append(row);
   watch.onclick=async()=>{if(activeController)return;const controller=new AbortController();activeController=controller;for(const b of buttons)b.disabled=true;stage.hidden=false;progress.value=0;status.textContent='';
    try{const result=await provider.play({kind,signal:controller.signal,onProgress:value=>{progress.value=value;}});if(controller.signal.aborted)return;wallet.grant(result);status.textContent='Dodato je jedno probno otključavanje: '+labels[kind].toLowerCase()+'.';}
    catch(error){status.textContent=error.name==='AbortError'?'Prekinuto. Otključavanje nije dodato.':error.message;}
    finally{if(activeController===controller)activeController=null;stage.hidden=true;for(const b of buttons)b.disabled=false;for(const section of list.children){const i=[...list.children].indexOf(section);section.querySelector('p').textContent='Dostupno: '+wallet.balance(KINDS[i]);}}
   };
  }
  const note=el('p','ads-explanation','Probni saldo važi samo dok je ova stranica otvorena. Brojevi reklama za zvanični sajt još nisu aktivirani.');
  const close=el('button','action','Zatvori');close.type='button';close.onclick=()=>dialog.close();dialog.replaceChildren(title,intro,free,list,stage,status,note,close);dialog.showModal();
  if(selected)buttons[KINDS.indexOf(selected)]?.focus();
 }
 return {attachForm(form,kind){
  const wrap=el('div','ads-form'),label=el('label','ads-use'),input=el('input');input.type='checkbox';const text=el('span'),openButton=el('button','text-button','+ Probna otključavanja');openButton.type='button';openButton.onclick=()=>open(kind);label.append(input,text);wrap.append(label,openButton);form.append(wrap);
  function update(){const n=wallet.balance(kind);input.disabled=n<1;if(n<1)input.checked=false;text.textContent='Koristi probno otključavanje (dostupno: '+n+'). Bez izbora šalješ besplatno.';}
  const unsubscribe=wallet.subscribe(()=>{if(!form.isConnected){unsubscribe();return;}update();});update();
  return {reserve:()=>input.checked?wallet.reserve(kind):null,commit:(ticket,id)=>ticket?wallet.commit(ticket,id):false,release:ticket=>ticket?wallet.release(ticket):false};
 }};
}
