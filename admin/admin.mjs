import {authClient,request} from '../api.js?v=admin-panel-v1';
import {chatRequest} from '../chat/client.mjs?v=admin-panel-v1';
const $=s=>document.querySelector(s);
const loginPanel=$('#login-panel'),app=$('#admin-app'),loginForm=$('#login-form'),codeForm=$('#email-code-form');
const loginStatus=$('#login-status'),appStatus=$('#app-status'),viewContent=$('#view-content');
const viewTitle=$('#view-title'),viewDescription=$('#view-description'),viewKicker=$('#view-kicker'),signOut=$('#sign-out');
const adminClient=authClient(true);
let currentSession=null,emailChallenge=null,currentView='dashboard',chatMessages=[],oldestChatId=null;
const labels={dashboard:'Kontrolna tabla',confessions:'Ispovijesti',comments:'Komentari i odgovori',reports:'Prijave',chat:'Chat',stats:'Statistika',analytics:'Analitika posjetilaca',audit:'Evidencija radnji',queue:'Red objava'};
const descriptions={dashboard:'Sažetak stanja sajta, sadržaja i aktivnosti zajednice.',confessions:'Pregled, pretraga, uklanjanje i vraćanje ispovijesti.',comments:'Pregled komentara i odgovora, uz kontekst i moderatorske radnje.',reports:'Prijave sadržaja zajednice i poruka iz anonimnog chata.',chat:'Arhiva poruka, anonimni profili i postojeće moderatorske radnje.',stats:'Svi trenutno raspoloživi mjerljivi pokazatelji iz žive baze.',analytics:'Anonimno zadržavanje posjetilaca nakon 10, 20 i 30 dana.',audit:'Hronološka evidencija administratorskih radnji iz zajednice i chata.',queue:'Sadržaj na čekanju i kontrola pauziranja automatskog objavljivanja.'};
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n;};
const fmt=value=>Number(value||0).toLocaleString('sr-Latn-RS');
const date=value=>value?new Date(value).toLocaleString('sr-Latn-RS',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—';
const reportReasonLabel=reason=>({hate_speech:'Govor mržnje',spam:'Spam',other:'Drugo',abuse:'Uvredljiv sadržaj',threat:'Prijetnja'}[reason]||reason);
function setStatus(message=''){appStatus.textContent=message;}
function empty(message){return el('div','empty',message);}
function pill(text,cls=''){return el('span','pill '+cls,text);}
function actionButton(text,run,cls='small'){const b=el('button',cls,text);b.type='button';b.addEventListener('click',()=>Promise.resolve(run()).catch(e=>setStatus(e.message||'Radnja nije uspjela.')));return b;}
function statCard(label,value,note=''){const c=el('article','stat-card');c.append(el('div','stat-label',label),el('div','stat-value',fmt(value)));if(note)c.append(el('div','stat-note',note));return c;}
function notice(title,body,warning=false){const n=el('aside','notice'+(warning?' warning':''));n.append(el('strong','',title),el('p','',body));return n;}
function searchInput(placeholder,onInput){const input=el('input','search');input.type='search';input.placeholder=placeholder;input.setAttribute('aria-label',placeholder);input.addEventListener('input',()=>onInput(input.value.trim().toLowerCase()));return input;}
function filterList(list,q){for(const item of list.children)item.hidden=!!q&&!String(item.dataset.search||'').includes(q);}
async function community(action,args={}){if(!currentSession)throw new Error('Administratorska sesija nije aktivna.');return request(action,args,currentSession);}
async function loadDashboard(){return community('admin_dashboard');}
function addStatGrid(parent,items){const grid=el('div','stats-grid');for(const item of items)grid.append(statCard(item[0],item[1],item[2]||''));parent.append(grid);}
function setView(view){
 currentView=view;setStatus();viewContent.replaceChildren();
 document.querySelectorAll('#admin-nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
 viewKicker.textContent='ISPOVESTI.BA · ADMINISTRACIJA';viewTitle.textContent=labels[view]||'Administracija';viewDescription.textContent=descriptions[view]||'';
 const renderers={dashboard:renderDashboard,confessions:renderConfessions,comments:()=>renderComments(0),reports:()=>renderReports(0),chat:renderChat,stats:renderStats,analytics:renderAnalytics,audit:()=>renderAudit(0),queue:renderQueue};
 Promise.resolve(renderers[view]?.()).catch(e=>setStatus(e.message||'Podaci trenutno nisu dostupni.'));
}
async function renderDashboard(){
 setStatus('Učitavam pregled…');const d=await loadDashboard();if(currentView!=='dashboard')return;viewContent.replaceChildren();
 addStatGrid(viewContent,[['Sve ispovijesti',d.confessions?.total],['Objavljene ispovijesti',d.confessions?.published],['Na čekanju',d.confessions?.queued],['Uklonjene ispovijesti',d.confessions?.removed],['Komentari',d.community?.comments],['Odgovori',d.community?.replies],['Reakcije',d.reactions,'Odvojeno od komentara i odgovora'],['Glasovi',d.votes],['Prijave zajednice',d.reports],['Chat poruke',d.chat_messages?.total],['Uklonjene chat poruke',d.chat_messages?.removed],['Prijave chata',d.chat_reports]]);
 viewContent.append(notice('Red objava',d.publisher?.paused?'Automatsko objavljivanje je trenutno pauzirano.':'Automatsko objavljivanje nije pauzirano.'));
 viewContent.append(notice('Analitika posjetilaca nije dostupna','Testni backend trenutno ne bilježi pouzdane anonimne posjete ni povratne posjete. Ne prikazujem izmišljene vrijednosti za zadržavanje 10/20/30 dana.',true));
 setStatus('Podaci su učitani iz žive baze.');
}
function sumTrend(rows,key){return rows.reduce((total,row)=>total+Number(row[key]||0),0);}
function csvCell(value){const text=String(value??'');return '"'+text.replace(/"/g,'""')+'"';}
function exportStatsCsv(d){
 const lines=[['Pokazatelj','Vrijednost'],
 ['Ispovijesti ukupno',d.confessions?.total],['Objavljene ispovijesti',d.confessions?.published],['Ispovijesti na čekanju',d.confessions?.queued],['Uklonjene ispovijesti',d.confessions?.removed],
 ['Komentari',d.community?.comments],['Odgovori',d.community?.replies],['Reakcije ukupno',d.reactions],...['🫂','😢','😮','🤗','🤣'].map(emoji=>['Reakcija '+emoji,d.reaction_breakdown?.[emoji]||0]),['Glasovi',d.votes],['Prijave sadržaja',d.reports],
 ['Chat poruke',d.chat_messages?.total],['Vidljive chat poruke',d.chat_messages?.visible],['Uklonjene chat poruke',d.chat_messages?.removed],['Prijave chata',d.chat_reports],
 [],['Dnevni trend','Sadržaj','Chat']];
 for(const row of (d.trend_30d||[]))lines.push([row.day,row.content,row.chat]);
 const csv='\\uFEFF'+lines.map(row=>row.map(csvCell).join(';')).join('\\r\\n');
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
 const link=el('a');link.href=url;link.download='ispovesti-statistika-'+new Date().toISOString().slice(0,10)+'.csv';document.body.append(link);link.click();link.remove();URL.revokeObjectURL(url);
}
async function renderStats(){
 setStatus('Učitavam statistiku…');const d=await loadDashboard();if(currentView!=='stats')return;viewContent.replaceChildren();
 const toolbar=el('div','toolbar');toolbar.append(el('span','meta','Izvor: testna baza · dnevni podaci za posljednjih 30 dana'),actionButton('Izvezi CSV',()=>exportStatsCsv(d),'small'));viewContent.append(toolbar);
 viewContent.append(el('h3','','Sadržaj zajednice'));
 addStatGrid(viewContent,[['Ispovijesti ukupno',d.confessions?.total],['Objavljene',d.confessions?.published],['Na čekanju',d.confessions?.queued],['Uklonjene',d.confessions?.removed],['Komentari ukupno',d.community?.comments],['Komentari objavljeni',d.community?.published_comments],['Odgovori ukupno',d.community?.replies],['Odgovori objavljeni',d.community?.published_replies]]);
 viewContent.append(el('h3','','Aktivnost i reakcije'));
 addStatGrid(viewContent,[['Reakcije',d.reactions],['Glasovi',d.votes],['Prijave sadržaja',d.reports],['Chat poruke',d.chat_messages?.total],['Vidljive chat poruke',d.chat_messages?.visible],['Uklonjene chat poruke',d.chat_messages?.removed],['Prijave chata',d.chat_reports]]);
  viewContent.append(el('h3','','Reakcije po emoji-ju'));
  addStatGrid(viewContent,['🫂','😢','😮','🤗','🤣'].map(emoji=>[emoji,d.reaction_breakdown?.[emoji]||0]));
  viewContent.append(el('p','meta','Brojevi prikazuju ukupne reakcije iz žive baze, bez prikazivanja identiteta posjetilaca.'));
 const trend=[...(d.trend_30d||[])].sort((a,b)=>String(a.day).localeCompare(String(b.day)));
 const current=trend.slice(-7),previous=trend.slice(-14,-7);
 viewContent.append(el('h3','','Poređenje aktivnosti · posljednjih 7 dana'));
 if(current.length===7&&previous.length===7){
  const currentContent=sumTrend(current,'content'),previousContent=sumTrend(previous,'content');
  const currentChat=sumTrend(current,'chat'),previousChat=sumTrend(previous,'chat');
  const change=(now,before)=>before===0?(now===0?'0%':'novo'):((now-before)/before*100).toFixed(1).replace('.',',')+'%';
  addStatGrid(viewContent,[['Sadržaj · zadnjih 7 dana',currentContent,'Prethodnih 7 dana: '+fmt(previousContent)+' · promjena '+change(currentContent,previousContent)],['Chat · zadnjih 7 dana',currentChat,'Prethodnih 7 dana: '+fmt(previousChat)+' · promjena '+change(currentChat,previousChat)]]);
 }else viewContent.append(notice('Poređenje još nije dostupno','Potrebno je najmanje 14 dana evidentiranih podataka.'));
 viewContent.append(el('h3','','Dnevni trend · posljednjih 30 dana'));
 const rows=el('div','trend');for(const item of trend){const line=el('div','trend-row');line.append(el('span','',new Date(item.day+'T12:00:00').toLocaleDateString('sr-Latn-RS',{day:'2-digit',month:'2-digit'})),el('span','', 'Sadržaj: '+fmt(item.content)+' · Chat: '+fmt(item.chat)));rows.append(line);}viewContent.append(rows);
 viewContent.append(el('p','meta','Poređenje koristi posljednjih 7 dana naspram prethodnih 7 dana. CSV sadrži trenutno dostupne zbirne pokazatelje i dnevni trend. Reakcije i glasovi prikazani su odvojeno; ovo nije analitika jedinstvenih posjetilaca.'));
 setStatus('Statistika i poređenje su učitani.'); 
}
async function fetchConfessions(view){
 const found=[];let offset=0;
 for(let page=0;page<20&&found.length<50;page++,offset+=50){const d=await community('admin_list',{view,offset});const items=Array.isArray(d.items)?d.items:[];found.push(...items.filter(x=>x.kind==='confession'));if(items.length<50)break;}
 return found.slice(0,50);
}
function renderContentCard(item){
 const c=el('article','content-card');c.dataset.search=[item.body,item.nickname,item.id,item.kind].join(' ').toLowerCase();
 const head=el('div','card-head'),left=el('div');left.append(el('strong','',item.nickname||'Anonimno'),el('div','meta','#'+item.id+' · '+item.kind+' · '+date(item.created_at)));
 head.append(left,pill(item.state,item.state));c.append(head,el('p','card-body',item.body));
 if(item.reports?.length){const r=el('div','report-lines');r.append(el('strong','','Prijave: '+item.reports.length));for(const x of item.reports.slice(0,4))r.append(el('p','',x.reason+' · '+date(x.created_at)));c.append(r);}
 const actions=el('div','card-actions');
 if(item.state==='removed')actions.append(actionButton('Vrati sadržaj',async()=>{if(!confirm('Vrati ovaj sadržaj?'))return;await community('admin_restore',{id:item.id});setView(currentView);}));
 else actions.append(actionButton('Ukloni sadržaj',async()=>{if(!confirm('Ukloni ovaj sadržaj iz javnog prikaza?'))return;await community('admin_remove',{id:item.id});setView(currentView);},'small danger'));
 c.append(actions);return c;
}
async function renderConfessions(){
 setStatus('Učitavam ispovijesti…');viewContent.replaceChildren();const tabs=el('div','tabs'),list=el('div','list');let selected='queue';
 const load=async view=>{selected=view;tabs.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.state===view));list.replaceChildren();setStatus('Učitavam…');const items=await fetchConfessions(view);if(currentView!=='confessions')return;if(!items.length)list.append(empty('Nema ispovijesti u ovom pregledu.'));else items.forEach(x=>list.append(renderContentCard(x)));setStatus('Prikazano '+items.length+' ispovijesti.');};
 for(const pair of [['queue','Na čekanju'],['published','Objavljene'],['archive','Uklonjene / arhiva']]){const b=actionButton(pair[1],()=>load(pair[0]),'tab-button');b.dataset.state=pair[0];tabs.append(b);}
 const search=searchInput('Pretraži prikazane ispovijesti…',q=>filterList(list,q));const toolbar=el('div','toolbar');toolbar.append(search);viewContent.append(tabs,toolbar,list);await load(selected);
}
async function renderComments(offset){
 setStatus('Učitavam komentare…');viewContent.replaceChildren();const toolbar=el('div','toolbar'),list=el('div','list'),input=searchInput('Pretraži tekst, nadimak ili ID…',q=>filterList(list,q));toolbar.append(input);
 const pager=el('div','pager'),prev=actionButton('Prethodnih 50',()=>renderComments(Math.max(0,offset-50)),'secondary small'),next=actionButton('Sljedećih 50',()=>renderComments(offset+50),'secondary small');prev.disabled=offset===0;pager.append(prev,next);viewContent.append(toolbar,list,pager);
 const d=await community('admin_comments',{offset,limit:50});if(currentView!=='comments')return;const items=d.items||[];if(!items.length)list.append(empty('Nema komentara ili odgovora za ovaj pregled.'));else items.forEach(x=>list.append(renderContentCard(x)));setStatus('Prikazano '+items.length+' komentara i odgovora.');
}
async function renderReports(offset){
 setStatus('Učitavam prijave…');viewContent.replaceChildren();const toolbar=el('div','toolbar'),list=el('div','list'),input=searchInput('Pretraži prijave…',q=>filterList(list,q));toolbar.append(input);
 const pager=el('div','pager'),prev=actionButton('Prethodnih 50',()=>renderReports(Math.max(0,offset-50)),'secondary small'),next=actionButton('Sljedećih 50',()=>renderReports(offset+50),'secondary small');prev.disabled=offset===0;pager.append(prev,next);viewContent.append(toolbar,list,pager);
 const d=await community('admin_reports',{offset,limit:50});if(currentView!=='reports')return;const items=d.items||[];if(!items.length)list.append(empty('Nema prijava za ovaj pregled.'));
 for(const item of items){const c=el('article','report-card');c.dataset.search=[item.body,item.nickname,item.reason,item.details,item.target_id,item.source].join(' ').toLowerCase();const head=el('div','card-head');head.append(el('strong','', (item.source==='chat'?'Chat':'Zajednica')+' · '+item.target_kind+' #'+item.target_id),pill(item.state,item.state));c.append(head,el('p','meta','Prijavljeno: '+date(item.reported_at)+' · Razlog: '+reportReasonLabel(item.reason)),el('p','card-body',item.body||'Sadržaj nije dostupan.'));if(item.details)c.append(el('p','report-detail','Dodatni opis: '+item.details));const actions=el('div','card-actions');
  if(item.source==='chat')actions.append(actionButton(item.state==='removed'?'Vrati poruku':'Ukloni poruku',async()=>{if(item.state!=='removed'&&!confirm('Ukloni ovu chat poruku?'))return;await chatRequest(item.state==='removed'?'admin_restore':'admin_remove',{id:item.target_id},true);setView('reports');},item.state==='removed'?'small':'small danger'));
  else actions.append(actionButton(item.state==='removed'?'Vrati sadržaj':'Ukloni sadržaj',async()=>{if(item.state!=='removed'&&!confirm('Ukloni prijavljeni sadržaj?'))return;await community(item.state==='removed'?'admin_restore':'admin_remove',{id:item.target_id});setView('reports');},item.state==='removed'?'small':'small danger'));
  c.append(actions);list.append(c);
 }
 setStatus('Prikazano '+items.length+' prijava.');
}
async function renderChat(){
 setStatus('Učitavam chat arhivu i profile…');viewContent.replaceChildren();chatMessages=[];oldestChatId=null;
 viewContent.append(el('div','toolbar','Postojeće serverske moderatorske radnje; istorija je učitana iz chat_test.'));
 const profilesTitle=el('h3','','Anonimni profili'),profiles=el('div','profile-grid');viewContent.append(profilesTitle,profiles);
 const banForm=el('form','inline-form'),target=el('input'),hours=el('input'),reason=el('input'),ban=el('button','','Blokiraj nalog');target.placeholder='Javni ID anonimnog profila';target.required=true;hours.type='number';hours.min='1';hours.max='720';hours.value='24';hours.required=true;reason.placeholder='Razlog blokade';ban.type='submit';banForm.append(target,hours,reason,ban);viewContent.append(banForm);
 banForm.addEventListener('submit',async e=>{e.preventDefault();if(!confirm('Blokirati ovaj chat nalog?'))return;await chatRequest('admin_ban',{target:target.value.trim(),hours:Number(hours.value),reason:reason.value.trim()},true);setStatus('Nalog je blokiran.');});
 const unbanForm=el('form','inline-form'),unbanId=el('input'),unban=el('button','secondary','Ukloni blokadu');unbanId.placeholder='Javni ID za uklanjanje blokade';unbanId.required=true;unban.type='submit';unbanForm.append(unbanId,unban);viewContent.append(unbanForm);
 const title=el('h3','','Arhiva chat poruka'),list=el('div','list'),older=actionButton('Učitaj starije poruke',loadOlderChat,'secondary small');viewContent.append(title,list,older);
 try{const [p,m]=await Promise.all([chatRequest('admin_profiles',{},true),chatRequest('admin_messages',{},true)]);if(currentView!=='chat')return;
  if(!(p.items||[]).length)profiles.append(empty('Nema anonimnih profila.'));
  for(const item of (p.items||[])){const card=el('article','profile-card');card.dataset.search=[item.nickname,item.id].join(' ').toLowerCase();card.append(el('strong','',item.nickname||'Anonimni učesnik'),el('p','meta','Javni ID: '+item.id),el('p','meta','Avatar: '+(item.avatar||'—')));card.append(actionButton('Kopiraj ID',()=>navigator.clipboard.writeText(item.id),'secondary small'));profiles.append(card);}
  chatMessages=m.items||[];oldestChatId=chatMessages.length?chatMessages[chatMessages.length-1].id:null;renderChatMessages(list,chatMessages);older.hidden=chatMessages.length<100;setStatus('Učitano '+chatMessages.length+' poruka i '+(p.items||[]).length+' profila.');
 }catch(e){list.append(empty(e.message||'Chat arhiva nije dostupna.'));setStatus('Chat administracija nije dostupna.');}
}
function renderChatMessages(list,items){list.replaceChildren();if(!items.length){list.append(empty('Nema poruka.'));return;}for(const m of items){const c=el('article','message-card');c.dataset.search=[m.body,m.generated_nickname,m.id].join(' ').toLowerCase();const head=el('div','card-head');head.append(el('strong','',m.generated_nickname||'Anonimni učesnik'),pill(m.removed?'Uklonjena':'Sačuvana',m.removed?'removed':''));c.append(head,el('p','meta','Poruka #'+m.id+' · '+date(m.created_at)+' · '+(m.reports?.length||0)+' prijava'),el('p','card-body',m.body));const actions=el('div','card-actions');actions.append(actionButton(m.removed?'Vrati poruku':'Ukloni poruku',async()=>{if(!m.removed&&!confirm('Ukloniti ovu poruku iz javnog chata?'))return;await chatRequest(m.removed?'admin_restore':'admin_remove',{id:m.id},true);setView('chat');},m.removed?'small':'small danger'));c.append(actions);if(m.reports?.length){const reports=el('div','report-lines');for(const r of m.reports){reports.append(el('p','',reportReasonLabel(r.reason)+' · '+date(r.created_at)));if(r.details)reports.append(el('p','report-detail','Dodatni opis: '+r.details));}c.append(reports);}list.append(c);}}
async function loadOlderChat(){
 if(!oldestChatId)return;setStatus('Učitavam starije poruke…');const d=await chatRequest('admin_messages',{before:oldestChatId},true),items=d.items||[];if(items.length){chatMessages=chatMessages.concat(items);oldestChatId=items[items.length-1].id;const list=viewContent.querySelector('.list');renderChatMessages(list,chatMessages);}if(items.length<100){const button=[...viewContent.querySelectorAll('button')].find(b=>b.textContent==='Učitaj starije poruke');if(button)button.hidden=true;}setStatus('Prikazano '+chatMessages.length+' chat poruka.');
}
async function renderAudit(offset){
 setStatus('Učitavam evidenciju…');viewContent.replaceChildren();const toolbar=el('div','toolbar'),list=el('div','list'),input=searchInput('Pretraži radnje, ID administratora ili cilj…',q=>filterList(list,q));toolbar.append(input);
 const pager=el('div','pager'),prev=actionButton('Prethodnih 50',()=>renderAudit(Math.max(0,offset-50)),'secondary small'),next=actionButton('Sljedećih 50',()=>renderAudit(offset+50),'secondary small');prev.disabled=offset===0;pager.append(prev,next);viewContent.append(toolbar,list,pager);
 const d=await community('admin_audit',{offset,limit:50});if(currentView!=='audit')return;const items=d.items||[];if(!items.length)list.append(empty('Evidencija je prazna.'));
 for(const x of items){const c=el('article','content-card');c.dataset.search=[x.action,x.target,x.admin_id,x.source].join(' ').toLowerCase();c.append(el('strong','',x.action),el('p','meta',(x.source==='chat'?'Chat':'Zajednica')+' · '+date(x.created_at)),el('p','meta','Administrator: '+x.admin_id+' · Cilj: '+x.target));list.append(c);}
 setStatus('Prikazano '+items.length+' evidentiranih radnji.');
}
async function renderQueue(){
 setStatus('Učitavam red objava…');viewContent.replaceChildren();const [d,stats]=await Promise.all([community('admin_list',{view:'queue',offset:0}),loadDashboard()]);if(currentView!=='queue')return;
 const paused=!!stats.publisher?.paused,toolbar=el('div','toolbar');toolbar.append(el('p','',paused?'Automatsko objavljivanje je pauzirano.':'Automatsko objavljivanje je aktivno.'),actionButton(paused?'Nastavi objavljivanje':'Pauziraj objavljivanje',async()=>{await community('admin_publisher',{paused:!paused});setView('queue');},'small'));viewContent.append(toolbar);
 const list=el('div','list');viewContent.append(list);const items=(d.items||[]).filter(x=>x.kind==='confession');if(!items.length)list.append(empty('Nema ispovijesti na čekanju.'));else items.forEach(x=>list.append(renderContentCard(x)));setStatus('Na čekanju: '+items.length+'. Red je FIFO; panel ne mijenja redoslijed objava.');
}
async function renderAnalytics(){
 setStatus('Učitavam anonimnu analitiku…');const d=await community('admin_analytics');if(currentView!=='analytics')return;viewContent.replaceChildren();
 if(!d.available){viewContent.append(notice('Analitika nije dostupna',d.reason||'Podaci trenutno nisu dostupni.',true));setStatus('Analitika nije dostupna.');return;}
 const since=d.data_since?new Date(d.data_since+'T12:00:00').toLocaleDateString('sr-Latn-RS'):'još nema podataka';
 viewContent.append(notice('Način mjerenja','Broje se jedinstveni pregledači po UTC danu. Ne koristi se Auth UID, IP adresa, putanja stranice ni tekst sadržaja. Isti pregledač na više dana ostaje povezan samo preko nasumičnog identifikatora čiji se hash čuva na serveru.'));
 viewContent.append(el('h3','','Posjete i povratnici · posljednjih 30 dana'));
 addStatGrid(viewContent,[['Jedinstveni pregledači',d.unique_30d],['Novi pregledači',d.new_30d],['Povratnici',d.returning_30d],['Dana sa podacima',d.days_collected]]);
 viewContent.append(el('h3','','Zadržavanje posjetilaca'));
 const retentionGrid=el('div','stats-grid');
 for(const item of (d.retention||[])){
  const card=el('article','stat-card');
  const percent=item.percent===null||item.percent===undefined?'—':Number(item.percent).toLocaleString('sr-Latn-RS',{maximumFractionDigits:1})+'%';
  card.append(el('div','stat-label','Povratak tačno '+item.day+'. dan'),el('div','stat-value',percent),el('div','stat-note',fmt(item.returned)+' od '+fmt(item.cohort_size)+' posjetilaca u zreloj kohorti'));
  retentionGrid.append(card);
 }
 viewContent.append(retentionGrid);
 viewContent.append(el('p','meta','Zadržavanje se računa kao povratak tačno 10, 20. ili 30. dan nakon prve zabilježene posjete. Svaki period koristi do 30 dnevnih kohorti koje su dovoljno stare za mjerenje. Podaci počinju od dana uključivanja analitike; ranije posjete se ne mogu rekonstruisati.'));
 viewContent.append(el('h3','','Dnevni trend · posljednjih 30 dana'));
 const trend=el('div','trend');
 for(const item of (d.daily||[])){
  const line=el('div','trend-row');
  const day=new Date(item.day+'T12:00:00').toLocaleDateString('sr-Latn-RS',{day:'2-digit',month:'2-digit'});
  line.append(el('span','',day),el('span','','Jedinstveni: '+fmt(item.visitors)+' · novi: '+fmt(item.new_visitors)));
  trend.append(line);
 }
 viewContent.append(trend);
 viewContent.append(el('p','meta','Početak evidentiranja: '+since+'. Identifikator važi samo u istom pregledaču i na istom uređaju; brisanje podataka sajta ili korišćenje drugog uređaja može se prikazati kao novi posjetilac. Analitički zapisi čuvaju se najviše 180 dana.'));
 setStatus('Anonimna analitika je učitana.');
}
async function verifyAdmin(session){currentSession=session;await community('admin_session');loginPanel.hidden=true;app.hidden=false;signOut.hidden=false;setView('dashboard');}
async function beginEmailVerification(session){
 currentSession=session;const state=await request('admin_email_status',{},session);if(state.verified){await verifyAdmin(session);return;}
 const started=await request('admin_email_begin',{},session);if(started.limited)throw new Error('Sačekaj najmanje jednu minutu prije novog koda.');
 emailChallenge=started.challenge;codeForm.hidden=false;loginStatus.textContent='Poslala sam sigurnosni kod na unaprijed podešenu administratorsku e-mail adresu. Unesi ga ovdje.';
}
loginForm.addEventListener('submit',async event=>{event.preventDefault();const button=loginForm.querySelector('button');button.disabled=true;loginStatus.textContent='Provjeravam prijavu…';try{const result=await adminClient.auth.signInWithPassword({email:$('#email').value.trim(),password:$('#password').value});if(result.error)throw result.error;await beginEmailVerification(result.data.session);}catch(error){loginStatus.textContent=error.message||'Prijava nije potvrđena.';try{await adminClient.auth.signOut();}catch{}}finally{button.disabled=false;}});
codeForm.addEventListener('submit',async event=>{event.preventDefault();const button=codeForm.querySelector('button');button.disabled=true;loginStatus.textContent='Provjeravam sigurnosni kod…';try{if(!currentSession||!emailChallenge)throw new Error('Prijavi se ponovo.');const result=await request('admin_email_verify',{challenge:emailChallenge,code:$('#email-code').value.trim()},currentSession);if(result.relogin){await adminClient.auth.signOut();codeForm.hidden=true;loginStatus.textContent='Sigurnosna postavka je obnovljena. Prijavi se ponovo lozinkom.';return;}if(result.verified!==true)throw new Error('E-mail potvrda nije uspjela.');codeForm.hidden=true;emailChallenge=null;await verifyAdmin(currentSession);}catch(error){loginStatus.textContent=error.message||'Kod nije potvrđen. Pokušaj ponovo.';}finally{button.disabled=false;}});
document.querySelectorAll('#admin-nav button').forEach(button=>button.addEventListener('click',()=>setView(button.dataset.view)));
signOut.addEventListener('click',async()=>{try{await adminClient.auth.signOut();}finally{currentSession=null;emailChallenge=null;app.hidden=true;signOut.hidden=true;loginPanel.hidden=false;loginForm.reset();codeForm.reset();codeForm.hidden=true;viewContent.replaceChildren();loginStatus.textContent='Odjavljeni ste.';}});
adminClient.auth.getSession().then(async({data,error})=>{if(error||!data.session)return;try{await beginEmailVerification(data.session);}catch(e){loginStatus.textContent=e.message||'Sesija postoji, ali je potrebna nova prijava lozinkom.';}});
