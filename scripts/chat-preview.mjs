// Local preview only. This process never connects to Supabase or payment services.
import path from 'node:path';import {fileURLToPath} from 'node:url';import {readFile,writeFile,mkdir} from 'node:fs/promises';import {randomUUID,randomBytes,timingSafeEqual} from 'node:crypto';
import {createLocalPreview} from './local-preview.mjs';import {createChatHandler} from '../chat/gateway.mjs';
import {summarize} from '../admin-prep/metrics-core.mjs';
import {currentSlot} from '../admin-prep/banner-schedule.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
export async function createChatPreview({ownerKey=randomBytes(32).toString('hex'),clock=()=>new Date()}={}){
 const stage=await createLocalPreview({staticDirectory:root}),{db,server}=stage;await db.exec('reset role');
 await db.exec(await readFile(path.join(root,'supabase/admin-email.sql'),'utf8'));
 await db.exec(await readFile(path.join(root,'supabase/comments-response.sql'),'utf8'));
 await db.exec(await readFile(path.join(root,'supabase/submission-latency.sql'),'utf8'));
 const owner=randomUUID();await db.query("insert into auth.users(id,email,is_anonymous) values($1,'preview-owner@local.invalid',false)",[owner]);await db.query('insert into community_test.admins values($1)',[owner]);
 await db.exec("update community_test.security_settings set admin_auth_method='email'");
 await db.exec(await readFile(path.join(root,'chat/prepare-test.sql'),'utf8'));await db.exec(await readFile(path.join(root,'chat/room-access.sql'),'utf8'));await db.exec(await readFile(path.join(root,'chat/room-auth-check.sql'),'utf8'));await db.exec(await readFile(path.join(root,'admin-prep/chat-archive-isolated.sql'),'utf8'));await db.exec(await readFile(path.join(root,'admin-prep/advertising-isolated.sql'),'utf8'));await db.exec(await readFile(path.join(root,'admin-prep/analytics-isolated.sql'),'utf8'));await db.exec('set role service_role');
 const cookies=new Map(),tokens=new Map();let eventCount=0;
 const record=async(section,type,visitor)=>{if(eventCount>=50000)return;await db.query('insert into admin_metrics_probe.events(section,event_type,visitor) values($1,$2,$3)',[section,type,visitor]);eventCount++};
 const session=(req,admin=false)=>{const name=admin?'ispovesti_chat_preview_admin=':'ispovesti_chat_preview=';const token=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(name))?.split('=')[1];const s=cookies.get(token);return s&&s.expires>Date.now()?s:null;};
 const mint=async(isOwner=false)=>{
  const uid=isOwner?owner:randomUUID(),sid=randomUUID();if(!isOwner)await db.query('insert into auth.users(id,is_anonymous) values($1,true)',[uid]);
  const cookie=randomBytes(32).toString('hex'),token='local.'+Buffer.from(JSON.stringify({sub:uid,session_id:sid,aal:'aal1'})).toString('base64url')+'.'+randomBytes(24).toString('hex');
  const s={uid,sid,token,expires:Date.now()+8*3600000,isOwner};cookies.set(cookie,s);tokens.set(token,s);
  await db.exec('reset role');await db.query("insert into auth.sessions values($1,$2,clock_timestamp()+interval '8 hours')",[sid,uid]);await db.exec('set role service_role');
  if(isOwner){
   await db.exec('reset role');
   await db.query("insert into community_test.admin_email_sessions(user_id,session_id,challenge_hash,expires_at,verified_until) values($1,$2,$3,clock_timestamp()+interval '8 hours',clock_timestamp()+interval '8 hours') on conflict(user_id) do update set session_id=excluded.session_id,verified_until=excluded.verified_until",[uid,sid,'a'.repeat(64)]);await db.exec('set role service_role');
  }
  return {cookie,s};
 };
 const handler=createChatHandler({supabaseUrl:'https://chat-preview.invalid',serviceKey:'local-only',allowedOrigins:['http://local.invalid'],environment:'test',allowTrials:true,fetcher:async(url,options)=>{
  if(url.endsWith('/auth/v1/user')){const s=tokens.get(options.headers.Authorization?.slice(7));return s&&s.expires>Date.now()?Response.json({id:s.uid,is_anonymous:!s.isOwner}):Response.json({error:'expired'},{status:401});}
  if(url!=='https://chat-preview.invalid/rest/v1/rpc/chat_test_dispatch_v2')throw Error('External request blocked.');
  const p=JSON.parse(options.body);try{const r=await db.query('select public.chat_test_dispatch_v2($1,$2,$3::jsonb,$4) r',[p.p_uid,p.p_action,JSON.stringify(p.p_args),p.p_session]);return Response.json(r.rows[0].r);}catch(e){return Response.json({code:e.code,message:e.message},{status:400});}
 }});
 const old=server.listeners('request')[0];server.removeAllListeners('request');
 server.on('request',async(req,res)=>{
  const pathname=new URL(req.url,'http://'+req.headers.host).pathname;if(!['/api/chat-session','/api/chat-owner-login','/api/chat-owner-logout','/api/chat','/api/admin-archive','/api/admin-advertising','/api/owner-anonymous-chat','/api/local-metrics','/api/admin-metrics','/api/local-banner','/api/admin-community'].includes(pathname))return old(req,res);
  const reply=(status,data,cookie,admin=false)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...(cookie?{'Set-Cookie':(admin?'ispovesti_chat_preview_admin=':'ispovesti_chat_preview=')+cookie+'; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800'}:{})});res.end(JSON.stringify(data));};
  if(req.method!=='POST')return reply(405,{error:'Nedozvoljen zahtjev.'});
  const allowed=new Set(['http://'+req.headers.host,process.env.LOCAL_PREVIEW_ORIGIN||'http://terminal.local:4173']);
  if((req.headers.origin&&!allowed.has(req.headers.origin))||req.headers['sec-fetch-site']==='cross-site')return reply(403,{error:'Nedozvoljeno porijeklo.'});
  if(!req.headers['content-type']?.startsWith('application/json'))return reply(415,{error:'Očekivan je JSON.'});
  try{
   const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>8192)return reply(413,{error:'Prevelik zahtjev.'});chunks.push(c);}const raw=Buffer.concat(chunks).toString();const body=JSON.parse(raw||'{}');
   if(pathname==='/api/chat-owner-login'){
    if(typeof body.key!=='string'||body.key.length!==ownerKey.length||!timingSafeEqual(Buffer.from(body.key),Buffer.from(ownerKey)))return reply(403,{error:'Potreban je privatni ključ vlasnika lokalnog pregleda.'});
    const {cookie}=await mint(true);return reply(200,{success:true,local:true},cookie,true);
   }
   if(pathname==='/api/chat-owner-logout'){
    const ownerSession=session(req,true);if(ownerSession){for(const [key,value] of cookies)if(value===ownerSession)cookies.delete(key);tokens.delete(ownerSession.token)}
    res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store','Set-Cookie':'ispovesti_chat_preview_admin=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'});return res.end('{"success":true}');
   }
   if(pathname==='/api/chat-session'){if(session(req))return reply(200,{success:true});const {cookie}=await mint();return reply(200,{success:true},cookie);}
   if(pathname==='/api/local-metrics'){
    if(!['site','chat'].includes(body.section)||!['visit','view','heartbeat'].includes(body.type)||typeof body.visitor!=='string'||!/^[0-9a-f-]{36}$/i.test(body.visitor))return reply(400,{error:'Neispravni probni podaci.'});
    await record(body.section,body.type,body.visitor);return reply(200,{success:true});
   }
   if(pathname==='/api/admin-metrics'){
    const admin=session(req,true);if(!admin?.isOwner)return reply(403,{error:'Potreban je provjeren administrator.'});
    await db.query('select community_test.assert_admin_access($1,$2,$3)',[admin.uid,admin.sid,'aal1']);
    const events=(await db.query("select section,event_type as type,visitor,occurred_at as at from admin_metrics_probe.events order by id limit 50000")).rows.map(e=>({...e,at:new Date(e.at).toISOString()}));
    return reply(200,{site:summarize(events,{section:'site'}),chat:summarize(events,{section:'chat'}),temporary:true,limitReached:eventCount>=50000});
   }
   if(pathname==='/api/local-banner'){
    const now=clock(),slot=currentSlot(now);let item=null;
    if(slot.slot!==null){const r=await db.query('select b.id,a.name from admin_ad_probe.bookings b join admin_ad_probe.advertisers a on a.id=b.advertiser_id where b.month=$1 and b.slot=$2',[slot.month+'-01',slot.slot]);item=r.rows[0]||null;}
    if(body.action==='active')return reply(200,{item,serverTime:now.toISOString(),nextBoundary:new Date((Math.floor(now.getTime()/1800000)+1)*1800000).toISOString(),test:true});
    if(body.action==='impression'){
     if(!item||body.id!==item.id||typeof body.view_id!=='string'||!/^[0-9a-f-]{36}$/i.test(body.view_id))return reply(400,{error:'Nevažeći probni prikaz.'});
     const r=await db.query('with receipt as (insert into admin_ad_probe.impression_receipts(booking_id,day,view_id) values($1,$2,$3) on conflict do nothing returning booking_id,day) insert into admin_ad_probe.impressions_daily(booking_id,day,impressions) select booking_id,day,1 from receipt on conflict(booking_id,day) do update set impressions=admin_ad_probe.impressions_daily.impressions+1 returning impressions',[item.id,slot.localDate,body.view_id]);
     return reply(200,{success:true,recorded:r.rows.length===1});
    }
    return reply(400,{error:'Nepoznata radnja.'});
   }
   if(pathname==='/api/owner-anonymous-chat'){
    const admin=session(req,true);if(!admin?.isOwner)return reply(403,{error:'Potreban je provjeren administrator.'});
    await db.query('select community_test.assert_admin_access($1,$2,$3)',[admin.uid,admin.sid,'aal1']);
    const {cookie,s}=await mint(false);
    await db.query("select public.chat_test_dispatch_v2($1,'profile','{}'::jsonb,$2)",[s.uid,s.sid]);
    await db.query("insert into chat_test.access(user_id,plan,expires_at,history_hours,source,granted_by) values($1,'30d',clock_timestamp()+interval '30 days',31,'admin_trial',$2)",[s.uid,admin.uid]);
    return reply(200,{success:true},cookie);
   }
   if(pathname==='/api/admin-archive'){
    const s=session(req,true);if(!s?.isOwner)return reply(403,{error:'Potreban je provjeren administrator.'});
    if(body.action==='list'){
     const args=body.filters||{};const r=await db.query("select public.admin_archive_probe_list($1,$2,'aal1',$3,$4,$5,$6,($7::date::timestamp at time zone 'Europe/Sarajevo'),(($8::date+1)::timestamp at time zone 'Europe/Sarajevo')-interval '1 microsecond') data",[s.uid,s.sid,args.before||null,args.text||'',args.status||'all',args.author||null,args.from||null,args.to||null]);return reply(200,r.rows[0].data);
    }
    if(body.action==='context'){const r=await db.query("select public.admin_archive_probe_context($1,$2,'aal1',$3) data",[s.uid,s.sid,body.id]);return reply(200,r.rows[0].data);}
    return reply(400,{error:'Nepoznata radnja.'});
   }
   if(pathname==='/api/admin-community'){
    const admin=session(req,true);if(!admin?.isOwner)return reply(403,{error:'Potreban je provjeren administrator.'});
    if(!['admin_list','admin_remove','admin_restore','admin_publisher'].includes(body.action))return reply(400,{error:'Nepoznata radnja.'});
    const args=body.args&&typeof body.args==='object'&&!Array.isArray(body.args)?body.args:{};
    const r=await db.query('select public.community_test_dispatch($1,$2,$3::jsonb) data',[admin.uid,body.action,JSON.stringify({...args,_session_id:admin.sid,_aal:'aal1'})]);return reply(200,r.rows[0].data);
   }
   if(pathname==='/api/admin-advertising'){
    const s=session(req,true);if(!s?.isOwner)return reply(403,{error:'Potreban je provjeren administrator.'});
    await db.query('select community_test.assert_admin_access($1,$2,$3)',[s.uid,s.sid,'aal1']);
    if(body.action==='list'){
     if(typeof body.month!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(body.month))return reply(400,{error:'Neispravan mjesec.'});
     const r=await db.query("select b.id,b.month,b.slot,b.price_fening,b.payment_status,a.name,coalesce((select sum(impressions) from admin_ad_probe.impressions_daily i where i.booking_id=b.id),0) impressions from admin_ad_probe.bookings b join admin_ad_probe.advertisers a on a.id=b.advertiser_id where b.month=$1 order by b.slot",[body.month+'-01']);return reply(200,{items:r.rows});
    }
    if(body.action==='create'){
     if(typeof body.name!=='string'||body.name.trim().length<1||body.name.length>120||typeof body.month!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(body.month)||!Number.isInteger(body.slot)||body.slot<0||body.slot>33||!Number.isSafeInteger(body.price_fening)||body.price_fening<0)return reply(400,{error:'Neispravan zakup.'});
     const id=randomUUID(),advertiser=randomUUID();try{await db.query('with a as (insert into admin_ad_probe.advertisers(id,name) values ($1,$2) returning id) insert into admin_ad_probe.bookings(id,advertiser_id,month,slot,price_fening) select $3,id,$4,$5,$6 from a',[advertiser,body.name.trim(),id,body.month+'-01',body.slot,body.price_fening]);return reply(200,{success:true})}catch(e){if(e.code==='23505')return reply(409,{error:'Termin je već zauzet.'});throw e}
    }
    if(body.action==='payment'){
     if(!['paid','unpaid'].includes(body.status)||typeof body.id!=='string'||!/^[0-9a-f-]{36}$/i.test(body.id))return reply(400,{error:'Neispravna uplata.'});
     const r=await db.query('update admin_ad_probe.bookings set payment_status=$1 where id=$2 returning id',[body.status,body.id]);return r.rows.length?reply(200,{success:true}):reply(404,{error:'Zakup nije pronađen.'});
    }
    return reply(400,{error:'Nepoznata radnja.'});
   }
   const s=body.action?.startsWith('admin_')?(session(req,true)||session(req)):session(req);if(!s)return reply(401,{error:'Potrebna je anonimna prijava.'});
   const response=await handler(new Request('http://local.invalid/chat',{method:'POST',headers:{Origin:'http://local.invalid','Content-Type':'application/json',Authorization:'Bearer '+s.token},body:raw}));
   const result=await response.json();if(body.action==='send'&&response.ok&&!result.replayed)await record('chat','message','local-message').catch(()=>{});return reply(response.status,result);
  }catch{return reply(400,{error:'Neispravan zahtjev.'});}
 });
 return {...stage,ownerKey};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const stage=await createChatPreview();const args=process.argv.slice(2),i=args.indexOf('--port');const port=Number(process.env.PORT||(i>=0?args[i+1]:3000));
 await mkdir(path.join(root,'.local-stage'),{recursive:true});await writeFile(path.join(root,'.local-stage/owner-key'),stage.ownerKey,{mode:0o600});
 stage.server.listen(port,'0.0.0.0',()=>console.log('Free site and isolated chat preview on '+port+'. Owner key saved privately; no production connection.'));
 for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>stage.close().then(()=>process.exit(0)));
}
