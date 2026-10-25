import { captchaToken, prepareCaptcha } from './captcha.js?v=freechat1';
const config = window.ISPOVESTI_CONFIG || {};
export const isPreview = config.mode === 'preview';
export const isLocal = config.mode === 'local';
export function prepareSubmission(kind,host){if(!isPreview&&!isLocal){prepareCaptcha({kind,host});void session().catch(()=>{});}}
let client, sessionPromise;
export function authClient(admin = false) {
  if (isPreview) throw new Error('Administracija je dostupna samo na povezanom testnom ili živom okruženju.');
  if (!config.supabaseUrl || !config.publishableKey || !window.supabase) throw new Error('Veza sa serverom nije podešena.');
  if (admin) return window.supabase.createClient(config.supabaseUrl, config.publishableKey, { auth: { storageKey: 'ispovesti-test-admin-session', storage: window.sessionStorage } });
  return client ||= window.supabase.createClient(config.supabaseUrl, config.publishableKey, { auth: { storageKey: 'ispovesti-test-user-session' } });
}
async function session() {
  if (!sessionPromise) sessionPromise = (async () => {
    const sb = authClient();
    let { data, error } = await sb.auth.getSession();
    if (error) throw error;
    if (data.session) return data.session;
    ({ data, error } = await sb.auth.signInAnonymously());
    if (error) throw new Error('Anonimna sesija trenutno nije dostupna. Pokušaj kasnije.');
    return data.session;
  })().finally(() => { sessionPromise = null; });
  return sessionPromise;
}
let localSessionReady=false,localSessionPending;
async function ensureLocalSession(){
 if(localSessionReady)return;
 if(!localSessionPending)localSessionPending=fetch('/api/local-session',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',credentials:'same-origin',cache:'no-store'})
  .then(async r=>{if(!r.ok)throw new Error('Lokalna anonimna sesija nije dostupna.');localSessionReady=true;})
  .finally(()=>localSessionPending=null);
 await localSessionPending;
}
async function localRequest(action,args,retry=true){
 const protectedAction=!['feed','comments','confession'].includes(action);
 if(protectedAction)await ensureLocalSession();
 const response=await fetch('/api/community',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,args}),credentials:'same-origin',signal:AbortSignal.timeout(20000),cache:'no-store'});
 if(response.status===401&&protectedAction&&retry){localSessionReady=false;return localRequest(action,args,false);}
 const result=await response.json();if(!response.ok)throw new Error(result.error||'Lokalna provjera nije uspjela.');return result;
}
export async function request(action, args = {}, adminSession = null, captchaHost = null) {
  if(config.mode==='local')return localRequest(action,args);
  if (isPreview) return previewRequest(action, args);
  const headers = { apikey: config.publishableKey, 'Content-Type': 'application/json' };
  if (!['feed', 'comments', 'confession', 'captcha_config', 'activate_admin'].includes(action)) {
    const authAt=performance.now();
    const s = adminSession || await session();
    if(action==='submit')performance.measure('ispovesti-submit-session',{start:authAt,end:performance.now()});
    headers.Authorization = 'Bearer ' + s.access_token;
  }
  if(action==='submit'){const at=performance.now();args={...args,captcha_token:await captchaToken({kind:args.kind,host:captchaHost})};performance.measure('ispovesti-submit-captcha',{start:at,end:performance.now()});}
  const networkAt=performance.now();
  const response = await fetch(config.supabaseUrl + '/functions/v1/community-test-api?forceFunctionRegion=eu-central-1', {
    method: 'POST', headers, body: JSON.stringify({ action, args }), signal: AbortSignal.timeout(20000), cache: 'no-store',
  });
  const result = await response.json();
  if(action==='submit')performance.measure('ispovesti-submit-network',{start:networkAt,end:performance.now()});
  if (!response.ok) throw new Error(result.error || 'Radnja nije uspjela. Pokušaj ponovo.');
  return result;
}
// Explicit browser-local preview only. Production always enforces rules in SQL.
const storageKey = 'ispovesti-isolated-preview-v2';
const initial = () => ({
  contents: [
    { id:'1', kind:'confession', body:'Danas sam poslije mnogo godina prošao ulicom u kojoj sam odrastao. Sve je drugačije, a opet sam na trenutak bio onaj klinac koji žuri kući jer ga čeka ručak. Neka mjesta nas nikad ne puste sasvim.', nickname:null, published_at:'2026-10-20T11:00:00Z', state:'published' },
    { id:'2', kind:'confession', body:'Mama mi i dalje spakuje nešto za ponijeti svaki put kad dođem. Imam svoj posao, svoj stan i frižider pun hrane. Ali ta kesa je najljepša stvar koju donesem kući. 🤍', nickname:'Jedan sin', published_at:'2026-10-20T12:00:00Z', state:'published' },
    { id:'3', kind:'confession', body:'Nisam danas uradio ništa veliko. Izašao sam u šetnju, javio se starom prijatelju i spremio sebi večeru. Poslije mjeseci u kojima mi je sve bilo teško, meni je to sasvim dovoljno.', nickname:null, published_at:'2026-10-20T13:00:00Z', state:'published' },
    { id:'4', kind:'confession', body:'Vratio sam se ovdje jer mi je nedostajao osjećaj da negdje mogu napisati ono što mislim, bez objašnjavanja ko sam. Drago mi je da ovo mjesto ponovo postoji.', nickname:null, published_at:'2026-10-20T14:00:00Z', state:'published' },
    { id:'5', kind:'comment', confession_id:'1', parent_id:null, body:'Nekad je dovoljan jedan miris iz nečije kuhinje i opet smo kod kuće.', created_at:'2026-10-20T12:00:00Z', state:'published' },
    { id:'6', kind:'reply', confession_id:'1', parent_id:'5', body:'Meni miris pečenih paprika. Odmah septembar kod bake. 🙂', created_at:'2026-10-20T13:00:00Z', state:'published' },
  ], votes:{}, favorites:[], recent:[], reports:[], nextId:100,
});
let state;
function readState() {
  if (state) return state;
  try { state = JSON.parse(localStorage.getItem(storageKey)) || initial(); }
  catch { state = initial(); }
  return state;
}
function persist() { try { localStorage.setItem(storageKey,JSON.stringify(state)); } catch { throw new Error('Preglednik ne dozvoljava čuvanje podataka.'); } }
function safe(c) { const { mine, state: _, ...result } = c; return result; }
async function previewRequest(action, a) {
  const s = readState(), id = String(a.id), item = s.contents.find(c=>c.id===id), offset = a.offset || 0;
  const visible = c => c && c.state === 'published';
  if (action==='feed') {
    const rows=s.contents.filter(c=>c.kind==='confession'&&visible(c));
    rows.sort((x,y)=>a.sort==='new'?Date.parse(y.published_at)-Date.parse(x.published_at):Date.parse(x.published_at)-Date.parse(y.published_at));
    return { items:rows.slice(offset,offset+20).map(safe) };
  }
  if (action==='comments') return { items:s.contents.filter(c=>c.confession_id===String(a.confession_id)&&c.parent_id===(a.parent_id?String(a.parent_id):null)&&visible(c)).slice(offset,offset+20).map(c=>({...safe(c),has_replies:s.contents.some(r=>r.parent_id===c.id&&visible(r))})) };
  if (action==='submit') {
    const body=a.body.trim(), min=a.kind==='confession'?15:1,max=a.kind==='confession'?5000:1000;
    if ([...body].length<min||[...body].length>max) throw new Error('Tekst nije dozvoljene dužine.');
    if (/(https?[:：]|www\.|[\p{L}\d][\p{L}\d._-]*\.[\p{L}]{2,}|mailto:|ftp:|tel:)/iu.test(body+' '+(a.nickname||''))) throw new Error('Linkovi nisu dozvoljeni.');
    if (!a.allow_duplicate&&s.contents.some(c=>c.mine&&c.kind===a.kind&&c.body===body)) return {duplicate:true};
    const c={id:String(s.nextId++),kind:a.kind,body,nickname:a.nickname||null,mine:true,state:a.kind==='confession'?'queued':'published',confession_id:a.confession_id?String(a.confession_id):null,parent_id:a.parent_id?String(a.parent_id):null,created_at:new Date().toISOString()};
    s.contents.push(c);persist();return{success:true,id:c.id};
  }
  if(action==='confession'){if(!visible(item)||item.kind!=='confession')throw new Error('Ispovijest nije dostupna.');return{item:safe(item)};}
  if(action==='list') {
    let rows=a.list==='my_comments'?s.contents.filter(c=>c.mine&&c.kind!=='confession'&&visible(c)).reverse(): (a.list==='favorites'?s.favorites:s.recent).map(i=>s.contents.find(c=>c.id===i)).filter(visible);
    return{items:rows.slice(offset,offset+20).map(safe)};
  }
  if(action==='cards'){const out={};for(const cid of a.ids){if(visible(s.contents.find(c=>c.id===String(cid))))out[cid]={vote:await previewRequest('vote_status',{id:cid}),context:await previewRequest('context',{id:cid})};}return out;}
  if(!visible(item))throw new Error('Sadržaj nije dostupan.');
  if(action==='vote'||action==='vote_status') {
    let v=s.votes[id];if(action==='vote'&&(!v||Date.now()<v.at+600000)){v=s.votes[id]={value:a.value,at:v?.at||Date.now()};persist();}
    return{my_vote:v?.value??null,...(v&&Date.now()>=v.at+600000?{likes:v.value===1?1:0,dislikes:v.value===-1?1:0}:{})};
  }
  if(action==='context') return{favorite:s.favorites.includes(id),comment_count:s.contents.some(c=>c.mine&&c.confession_id===id)?s.contents.filter(c=>c.confession_id===id&&visible(c)).length:null};
  if(action==='favorite'){s.favorites=s.favorites.filter(i=>i!==id);if(a.enabled)s.favorites.unshift(id);persist();return{success:true};}
  if(action==='read'){s.recent=[id,...s.recent.filter(i=>i!==id)].slice(0,100);persist();return{success:true};}
  if(action==='report'){if(!s.reports.includes(id))s.reports.push(id);persist();return{success:true};}
  throw new Error('Radnja nije dostupna u pregledu.');
}
