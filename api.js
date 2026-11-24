import { captchaToken, prepareCaptcha, releaseCaptcha } from './captcha.js?v=room2';
const config = window.ISPOVESTI_CONFIG || {};
export const isPreview = config.mode === 'preview';
export const isLocal = config.mode === 'local';
let captchaClearancePromise,captchaClearanceUid=null;
async function ensureCaptchaClearance(host=document.body){
 if(isPreview||isLocal)return true;
 if(!captchaClearancePromise)captchaClearancePromise=(async()=>{
  const initialSession=await session(),initialUid=initialSession?.user?.id;
  if(!initialUid)throw new Error('Anonimna sesija trenutno nije dostupna. Pokušaj kasnije.');
  if(captchaClearanceUid===initialUid)return true;
  const current=await networkRequest('captcha_init',{},initialSession);
  if(current.verified===true){captchaClearanceUid=initialUid;return true;}
  if(current.required!==true)throw new Error('Sigurnosna provjera nije dostupna. Pokušaj kasnije.');
  prepareCaptcha({kind:'entry',host,action:'app_entry'});
  try{
   const token=await captchaToken({kind:'entry',host,action:'app_entry'});
   const result=await networkRequest('captcha_init',{captcha_token:token},initialSession);
   if(result.verified!==true)throw new Error('Sigurnosna provjera nije potvrđena. Pokušaj ponovo.');
   captchaClearanceUid=(await session()).user.id;return true;
  }finally{releaseCaptcha(host);}
 })().finally(()=>{captchaClearancePromise=null;});
 return captchaClearancePromise;
}
export function initializeSecurity(){return ensureCaptchaClearance(document.body);}
export function prepareSubmission(){if(!isPreview&&!isLocal&&!captchaClearanceUid)void ensureCaptchaClearance(document.body).catch(()=>{});}
let client, adminClient, sessionPromise;
export function authClient(admin = false) {
  if (isPreview) throw new Error('Administracija je dostupna samo na povezanom testnom ili živom okruženju.');
  if (!config.supabaseUrl || !config.publishableKey || !window.supabase) throw new Error('Veza sa serverom nije podešena.');
  if (admin) return adminClient ||= window.supabase.createClient(config.supabaseUrl, config.publishableKey, { auth: { storageKey: 'ispovesti-live-admin-session', storage: window.sessionStorage } });
  return client ||= window.supabase.createClient(config.supabaseUrl, config.publishableKey, { auth: { storageKey: 'ispovesti-live-user-session' } });
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
 const result=await response.json();if(!response.ok)throw new Error(result.error||'Lokalna provera nije uspela.');return result;
}
const readCacheActions=new Set(['feed','comments','confession','daily_highlights']);
const readCacheDb='ispovesti-read-cache-v1';
let readCacheDbPromise;
function openReadCache(){
 if(!('indexedDB' in window))return Promise.resolve(null);
 if(!readCacheDbPromise)readCacheDbPromise=new Promise(resolve=>{
  const req=indexedDB.open(readCacheDb,1);
  req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('responses'))req.result.createObjectStore('responses',{keyPath:'key'});};
  req.onsuccess=()=>resolve(req.result);req.onerror=()=>resolve(null);req.onblocked=()=>resolve(null);
 });
 return readCacheDbPromise;
}
async function getReadCache(key){
 try{const db=await openReadCache();if(!db)return null;return await new Promise(resolve=>{const req=db.transaction('responses','readonly').objectStore('responses').get(key);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>resolve(null);});}catch{return null;}
}
async function putReadCache(key,value){
 try{const db=await openReadCache();if(!db)return;await new Promise(resolve=>{const tx=db.transaction('responses','readwrite');tx.objectStore('responses').put({key,value,savedAt:Date.now()});tx.oncomplete=tx.onerror=tx.onabort=()=>resolve();});}catch{}
}
async function clearReadCache(action){
 try{const db=await openReadCache();if(!db)return;await new Promise(resolve=>{const tx=db.transaction('responses','readwrite'),store=tx.objectStore('responses'),req=store.openCursor();req.onsuccess=()=>{const cursor=req.result;if(!cursor)return;if(cursor.key.startsWith(action+':'))cursor.delete();cursor.continue();};tx.oncomplete=tx.onerror=tx.onabort=()=>resolve();});}catch{}
}
function readCacheKey(action,args){return action+':'+JSON.stringify(args||{});}
async function cachedRead(action,args,network){
 const key=readCacheKey(action,args),cached=await getReadCache(key);
 if(cached){
  // Keep fresh snapshots quiet; only revalidate older entries to avoid duplicate network traffic.
  if(Date.now()-Number(cached.savedAt||0)>15000)void network().then(async fresh=>{
   if(JSON.stringify(fresh)!==JSON.stringify(cached.value)){
    await putReadCache(key,fresh);
    window.dispatchEvent(new CustomEvent('ispovesti:read-cache-updated',{detail:{action,args,result:fresh}}));
   }
  }).catch(()=>{});
  return cached.value;
 }
 const fresh=await network();await putReadCache(key,fresh);return fresh;
}
export async function request(action, args = {}, adminSession = null, captchaHost = null) {
  if(config.mode==='local')return localRequest(action,args);
  if(readCacheActions.has(action)&&!adminSession)return cachedRead(action,args,()=>networkRequest(action,args,adminSession,captchaHost));
  const result=await networkRequest(action,args,adminSession,captchaHost);
  if(action==='submit'&&result?.success){if(args.kind==='confession')await clearReadCache('feed');else await clearReadCache('comments');}
  return result;
}
async function networkRequest(action, args = {}, adminSession = null, captchaHost = null) {

  if (isPreview) return previewRequest(action, args);
  if(action==='submit')await ensureCaptchaClearance(captchaHost||document.body);
  const headers = { apikey: config.publishableKey, 'Content-Type': 'application/json' };
  const needsSession = !['feed', 'comments', 'confession', 'daily_highlights', 'captcha_config', 'activate_admin', 'track_visit'].includes(action);
  const authAt=performance.now();
  const sessionTask = needsSession
    ? (adminSession ? Promise.resolve(adminSession) : session()).then(s => {
        if(action==='submit')performance.measure('ispovesti-submit-session',{start:authAt,end:performance.now()});
        headers.Authorization = 'Bearer ' + s.access_token;
        return s;
      })
    : Promise.resolve(null);
  await sessionTask;
  const networkAt=performance.now();
  const response = await fetch(config.supabaseUrl + '/functions/v1/community-live-api?forceFunctionRegion=eu-central-1', {
    method: 'POST', headers, body: JSON.stringify({ action, args }), signal: AbortSignal.timeout(20000), cache: 'no-store',
  });
  const result = await response.json();
  if(action==='submit')performance.measure('ispovesti-submit-network',{start:networkAt,end:performance.now()});
  if (!response.ok) throw new Error(result.error || 'Radnja nije uspela. Pokušaj ponovo.');
  return result;
}
// Explicit browser-local preview only. Production always enforces rules in SQL.
const storageKey = 'ispovesti-isolated-preview-v2';
const initial = () => ({
  contents: [
    { id:'1', kind:'confession', body:'Danas sam posle mnogo godina prošao ulicom u kojoj sam odrastao. Sve je drugačije, a opet sam na trenutak bio onaj klinac koji žuri kući jer ga čeka ručak. Neka mesta nas nikad ne puste sasvim.', nickname:null, published_at:'2026-10-20T11:00:00Z', state:'published' },
    { id:'2', kind:'confession', body:'Mama mi i dalje spakuje nešto za poneti svaki put kad dođem. Imam svoj posao, svoj stan i frižider pun hrane. Ali ta kesa je najlepša stvar koju donesem kući. 🤍', nickname:'Jedan sin', published_at:'2026-10-20T12:00:00Z', state:'published' },
    { id:'3', kind:'confession', body:'Nisam danas uradio ništa veliko. Izašao sam u šetnju, javio se starom prijatelju i spremio sebi večeru. Posle meseci u kojima mi je sve bilo teško, meni je to sasvim dovoljno.', nickname:null, published_at:'2026-10-20T13:00:00Z', state:'published' },
    { id:'4', kind:'confession', body:'Vratio sam se ovde jer mi je nedostajao osećaj da negde mogu napisati ono što mislim, bez objašnjavanja ko sam. Drago mi je da ovo mesto ponovo postoji.', nickname:null, published_at:'2026-10-20T14:00:00Z', state:'published' },
    { id:'5', kind:'comment', confession_id:'1', parent_id:null, body:'Nekad je dovoljan jedan miris iz nečije kuhinje i opet smo kod kuće.', created_at:'2026-10-20T12:00:00Z', state:'published' },
    { id:'6', kind:'reply', confession_id:'1', parent_id:'5', body:'Meni miris pečenih paprika. Odmah septembar kod bake. 🙂', created_at:'2026-10-20T13:00:00Z', state:'published' },
  ], votes:{}, favorites:[], favorite_styles:{}, recent:[], reports:[], nextId:100,
});
let state;
function readState() {
  if (state) return state;
  try { state = JSON.parse(localStorage.getItem(storageKey)) || initial(); }
  catch { state = initial(); }
  state.favorite_styles ||= {};
  return state;
}
function persist() { try { localStorage.setItem(storageKey,JSON.stringify(state)); } catch { throw new Error('Preglednik ne dozvoljava čuvanje podataka.'); } }
function safe(c) { const { mine, state: _, ...result } = c; return result; }
async function previewRequest(action, a) {
  const s = readState(), id = String(a.id), item = s.contents.find(c=>c.id===id), offset = a.offset || 0;
  const visible = c => c && c.state === 'published';
  if (action==='feed') {
    const rows=s.contents.filter(c=>c.kind==='confession'&&visible(c));
    rows.sort((x,y)=>Date.parse(y.published_at||y.created_at)-Date.parse(x.published_at||x.created_at));
    return { items:rows.slice(offset,offset+20).map(safe) };
  }
  if (action==='comments') return { items:s.contents.filter(c=>c.confession_id===String(a.confession_id)&&c.parent_id===(a.parent_id?String(a.parent_id):null)&&visible(c)).slice(offset,offset+20).map(c=>({...safe(c),has_replies:s.contents.some(r=>r.parent_id===c.id&&visible(r))})) };
  if (action==='submit') {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(a.request_id || ''))) {
      throw new Error('Nedostaje ili je neispravan ID zahtjeva za slanje.');
    }
    const body=a.body.trim(), min=a.kind==='confession'?15:1,max=a.kind==='confession'?5000:1000;
    if ([...body].length<min||[...body].length>max) throw new Error('Tekst nije dozvoljene dužine.');
    if (/(https?[:：]|www\.|[\p{L}\d][\p{L}\d._-]*\.[\p{L}]{2,}|mailto:|ftp:|tel:)/iu.test(body+' '+(a.nickname||''))) throw new Error('Linkovi nisu dozvoljeni.');
    if (!a.allow_duplicate&&s.contents.some(c=>c.mine&&c.kind===a.kind&&c.body===body)) return {duplicate:true};
    const c={id:String(s.nextId++),kind:a.kind,body,nickname:a.nickname||null,mine:true,state:a.kind==='confession'?'queued':'published',confession_id:a.confession_id?String(a.confession_id):null,parent_id:a.parent_id?String(a.parent_id):null,created_at:new Date().toISOString()};
    s.contents.push(c);persist();return{success:true,id:c.id};
  }
  if(action==='confession'){if(!visible(item)||item.kind!=='confession')throw new Error('Ispovest nije dostupna.');return{item:safe(item)};}
  if(action==='my_confessions') {
    const rows=s.contents.filter(c=>c.mine&&c.kind==='confession').reverse();
    return{items:rows.slice(offset,offset+20).map(c=>({id:c.id,body:c.body,nickname:c.nickname||null,state:c.state,created_at:c.created_at,published_at:c.published_at||null}))};
  }
  if(action==='list') {
    let rows=a.list==='my_comments'?s.contents.filter(c=>c.mine&&c.kind!=='confession'&&visible(c)).reverse(): (a.list==='favorites'?s.favorites:s.recent).map(i=>s.contents.find(c=>c.id===i)).filter(visible);
    return{items:rows.slice(offset,offset+20).map(safe)};
  }
  if(action==='cards'){const out={};for(const cid of a.ids){if(visible(s.contents.find(c=>c.id===String(cid))))out[cid]={vote:await previewRequest('vote_status',{id:cid}),context:await previewRequest('context',{id:cid})};}return out;}
  if(!visible(item))throw new Error('Sadržaj nije dostupan.');
  if(action==='vote'||action==='vote_status') {
    let v=s.votes[id];if(action==='vote'&&(!v||Date.now()<v.at+600000)){v=s.votes[id]={value:a.value,at:v?.at||Date.now()};persist();}
    return{my_vote:v?.value??null,can_change:!v||Date.now()<v.at+600000,likes:v?.value===1?1:0,dislikes:v?.value===-1?1:0};
  }
  if(action==='context'){const favorite=s.favorites.includes(id);if(favorite&&!s.favorite_styles[id]){s.favorite_styles[id]=Math.floor(Math.random()*40)+1;persist();}return{favorite,favorite_style:s.favorite_styles[id]??null,comment_count:s.contents.some(c=>c.mine&&c.confession_id===id)?s.contents.filter(c=>c.confession_id===id&&visible(c)).length:null};}
  if(action==='favorite'){s.favorites=s.favorites.filter(i=>i!==id);if(a.enabled){s.favorites.unshift(id);s.favorite_styles[id]=Math.floor(Math.random()*40)+1;}else{delete s.favorite_styles[id];}persist();return{success:true,favorite_style:s.favorite_styles[id]??null};}
  if(action==='read'){s.recent=[id,...s.recent.filter(i=>i!==id)].slice(0,100);persist();return{success:true};}
  if(action==='report'){const exists=s.reports.some(r=>String(typeof r==='object'&&r!==null?r.id:r)===id);if(!exists)s.reports.push({id,reason:a.reason||'other',details:a.details||''});persist();return{success:true};}
  throw new Error('Radnja nije dostupna u pregledu.');
}
