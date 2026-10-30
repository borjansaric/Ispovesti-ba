import {chatRequest} from '../chat/client.mjs?v=room2';
// Isolated preview only; every request requires the server-owned admin session.
export function mountArchive(container,{request:remoteRequest,moderate=chatRequest,title:heading='Probna arhiva chata'}={}){
 const section=document.createElement('section'),title=document.createElement('h2'),form=document.createElement('form'),out=document.createElement('div'),status=document.createElement('p'),more=document.createElement('button');
 title.textContent=heading;status.setAttribute('role','status');form.className='form';
 for(const [name,label,type] of [['text','Tekst','text'],['author','Anonimni ID','text'],['from','Od','date'],['to','Do','date']]){
  const l=document.createElement('label'),input=document.createElement('input');l.textContent=label;input.name=name;input.type=type;if(name==='text')input.maxLength=100;l.append(input);form.append(l);
 }
 const label=document.createElement('label'),select=document.createElement('select');label.textContent='Status';select.name='status';
 for(const [value,text] of [['all','Sve'],['active','Aktivne'],['reported','Prijavljene'],['removed','Uklonjene']]){const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option)}
 label.append(select);form.append(label);
 const button=document.createElement('button');button.className='action';button.textContent='Pretraži';form.append(button);
 more.type='button';more.className='action';more.textContent='Prikaži starije poruke';more.hidden=true;
 section.append(title,form,status,out,more);container.append(section);
 let filters={},cursor=null,generation=0,controller=null,loading=false,count=0;
 async function call(body,signal){
  if(remoteRequest)return remoteRequest(body,signal);
  const r=await fetch('/api/admin-archive',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),credentials:'same-origin',signal});
  const result=await r.json();if(!r.ok)throw Error(result.error||'Arhiva nije dostupna.');return result;
 }
 function messageRow(m,contextOnly=false){
  const row=document.createElement('article'),text=document.createElement('p'),meta=document.createElement('p');row.className='story';row.dataset.messageId=String(m.id);
  text.textContent=m.body;meta.className='hint';meta.textContent=['#'+m.id,new Date(m.created_at).toLocaleString('sr-Latn',{timeZone:'Europe/Sarajevo'}),m.author_public_id||'Anonimni ID nije sačuvan',m.nickname||'Raniji nadimak nije sačuvan',m.avatar||'Raniji avatar nije sačuvan',m.removed?'Uklonjeno':'Aktivno'].join(' · ');row.append(meta,text);
  for(const report of m.reports||[]){const p=document.createElement('p');p.textContent='Prijava: '+report.reason+' · '+report.created_at;row.append(p)}
  for(const decision of m.decisions||[]){const p=document.createElement('p');p.textContent='Odluka: '+({admin_remove:'Uklanjanje poruke',admin_restore:'Vraćanje poruke'}[decision.action]||decision.action)+' · '+decision.created_at;row.append(p)}
  if(contextOnly)return row;
  const context=document.createElement('button'),contextOut=document.createElement('div');context.type='button';context.className='action';context.textContent='Okolne poruke';context.setAttribute('aria-expanded','false');
  context.onclick=async()=>{
   if(context.getAttribute('aria-expanded')==='true'){contextOut.replaceChildren();context.setAttribute('aria-expanded','false');return}
   const version=generation;context.disabled=true;
   try{const result=await call({action:'context',id:m.id},controller?.signal);if(version!==generation)return;contextOut.replaceChildren(...result.items.map(x=>messageRow(x,true)));context.setAttribute('aria-expanded','true')}
   catch(err){if(err.name!=='AbortError'&&version===generation)status.textContent=err.message}finally{context.disabled=false}
  };
  const remove=document.createElement('button');remove.type='button';remove.className='action';remove.textContent=m.removed?'Vrati poruku':'Ukloni poruku';
  remove.onclick=async()=>{remove.disabled=true;try{await moderate(m.removed?'admin_restore':'admin_remove',{id:m.id},true);await load(false)}catch(err){status.textContent=err.message}finally{remove.disabled=false}};
  row.append(context,remove);
  if(m.author_public_id){const ban=document.createElement('button');ban.type='button';ban.className='action';ban.textContent='Zabrani pristup 24 sata';ban.onclick=async()=>{ban.disabled=true;try{await moderate('admin_ban',{target:m.author_public_id,hours:24,reason:'Moderacija'},true);status.textContent='Zabrana je postavljena.'}catch(err){status.textContent=err.message}finally{ban.disabled=false}};row.append(ban);const unban=document.createElement('button');unban.type='button';unban.className='action';unban.textContent='Ukloni zabranu';unban.onclick=async()=>{unban.disabled=true;try{await moderate('admin_unban',{target:m.author_public_id},true);status.textContent='Zabrana je uklonjena.'}catch(e){status.textContent=e.message}finally{unban.disabled=false}};row.append(unban)}
  row.append(contextOut);return row;
 }
 async function load(append){
  if(append&&(loading||!cursor))return;
  if(!append){controller?.abort();controller=new AbortController();generation++;cursor=null;count=0;out.replaceChildren();more.hidden=true}
  const version=generation;loading=true;more.disabled=true;button.disabled=true;status.textContent='Učitavanje…';
  try{
   const result=await call({action:'list',filters:{...filters,...(append?{before:cursor}:{})}},controller.signal);
   if(version!==generation)return;
   out.append(...result.items.map(m=>messageRow(m)));count+=result.items.length;cursor=result.next_before;more.hidden=!result.has_more;
   status.textContent=count?'Prikazano poruka: '+count+(result.has_more?' · Dostupne su starije poruke.':' · Kraj rezultata.'):'Nema rezultata.';
  }catch(err){if(err.name!=='AbortError'&&version===generation)status.textContent=err.message}
  finally{if(version===generation){loading=false;button.disabled=false;more.disabled=false}}
 }
 form.onsubmit=e=>{
  e.preventDefault();const data=new FormData(form);filters={text:data.get('text'),status:data.get('status')};
  for(const field of ['author','from','to'])if(data.get(field))filters[field]=data.get(field);
  void load(false);
 };
 more.onclick=()=>void load(true);
 window.addEventListener('pagehide',()=>{generation++;controller?.abort()},{once:true});
}
