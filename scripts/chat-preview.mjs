// Local preview only. This process never connects to Supabase or payment services.
import path from 'node:path';import {fileURLToPath} from 'node:url';import {readFile,writeFile,mkdir} from 'node:fs/promises';import {randomUUID,randomBytes,timingSafeEqual} from 'node:crypto';
import {createLocalPreview} from './local-preview.mjs';import {createChatHandler} from '../chat/gateway.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
export async function createChatPreview({ownerKey=randomBytes(32).toString('hex')}={}){
 const stage=await createLocalPreview({staticDirectory:root}),{db,server}=stage;await db.exec('reset role');
 await db.exec(await readFile(path.join(root,'supabase/admin-email.sql'),'utf8'));
 await db.exec(await readFile(path.join(root,'supabase/comments-response.sql'),'utf8'));
 await db.exec(await readFile(path.join(root,'supabase/submission-latency.sql'),'utf8'));
 const owner=randomUUID();await db.query("insert into auth.users(id,email,is_anonymous) values($1,'preview-owner@local.invalid',false)",[owner]);await db.query('insert into community_test.admins values($1)',[owner]);
 await db.exec("update community_test.security_settings set admin_auth_method='email'");
 await db.exec(await readFile(path.join(root,'chat/prepare-test.sql'),'utf8'));await db.exec('set role service_role');
 const cookies=new Map(),tokens=new Map();
 const session=(req,admin=false)=>{const name=admin?'ispovesti_chat_preview_admin=':'ispovesti_chat_preview=';const token=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(name))?.split('=')[1];const s=cookies.get(token);return s&&s.expires>Date.now()?s:null;};
 const mint=async(isOwner=false)=>{
  const uid=isOwner?owner:randomUUID(),sid=randomUUID();if(!isOwner)await db.query('insert into auth.users(id,is_anonymous) values($1,true)',[uid]);
  const cookie=randomBytes(32).toString('hex'),token='local.'+Buffer.from(JSON.stringify({sub:uid,session_id:sid,aal:'aal1'})).toString('base64url')+'.'+randomBytes(24).toString('hex');
  const s={uid,token,expires:Date.now()+8*3600000,isOwner};cookies.set(cookie,s);tokens.set(token,s);
  if(isOwner){
   await db.exec('reset role');await db.query("insert into auth.sessions values($1,$2,clock_timestamp()+interval '8 hours')",[sid,uid]);
   await db.query("insert into community_test.admin_email_sessions(user_id,session_id,challenge_hash,expires_at,verified_until) values($1,$2,$3,clock_timestamp()+interval '8 hours',clock_timestamp()+interval '8 hours') on conflict(user_id) do update set session_id=excluded.session_id,verified_until=excluded.verified_until",[uid,sid,'a'.repeat(64)]);await db.exec('set role service_role');
  }
  return {cookie,s};
 };
 const handler=createChatHandler({supabaseUrl:'https://chat-preview.invalid',serviceKey:'local-only',allowedOrigins:['http://local.invalid'],environment:'test',allowTrials:true,fetcher:async(url,options)=>{
  if(url.endsWith('/auth/v1/user')){const s=tokens.get(options.headers.Authorization?.slice(7));return s&&s.expires>Date.now()?Response.json({id:s.uid,is_anonymous:!s.isOwner}):Response.json({error:'expired'},{status:401});}
  if(url!=='https://chat-preview.invalid/rest/v1/rpc/chat_test_dispatch')throw Error('External request blocked.');
  const p=JSON.parse(options.body);try{const r=await db.query('select public.chat_test_dispatch($1,$2,$3::jsonb) r',[p.p_uid,p.p_action,JSON.stringify(p.p_args)]);return Response.json(r.rows[0].r);}catch(e){return Response.json({code:e.code,message:e.message},{status:400});}
 }});
 const old=server.listeners('request')[0];server.removeAllListeners('request');
 server.on('request',async(req,res)=>{
  const pathname=new URL(req.url,'http://'+req.headers.host).pathname;if(!['/api/chat-session','/api/chat-owner-login','/api/chat'].includes(pathname))return old(req,res);
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
   if(pathname==='/api/chat-session'){if(session(req))return reply(200,{success:true});const {cookie}=await mint();return reply(200,{success:true},cookie);}
   const s=body.action?.startsWith('admin_')?(session(req,true)||session(req)):session(req);if(!s)return reply(401,{error:'Potrebna je anonimna prijava.'});
   const response=await handler(new Request('http://local.invalid/chat',{method:'POST',headers:{Origin:'http://local.invalid','Content-Type':'application/json',Authorization:'Bearer '+s.token},body:raw}));
   return reply(response.status,await response.json());
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
