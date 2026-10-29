/** Local staging only. No external network, Supabase credentials, or production data.
 * Uses the real SQL migration and Edge handler with an explicitly local Auth adapter.
 * This is not a replacement for testing real Supabase Auth, CAPTCHA, MFA and pg_cron.
 */
import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import { PGlite } from '@electric-sql/pglite';
const root=fileURLToPath(new URL('../',import.meta.url));
const staticRoot=path.join(root,'dist');
const publicActions=new Set(['feed','comments','confession']);
const cookieName='ispovesti_local_session';
const sessionLifetime=8*60*60*1000;
const seedStories=[
 ['Danas sam poslije mnogo godina prošao ulicom u kojoj sam odrastao. Sve je drugačije, a opet sam na trenutak bio onaj klinac koji žuri kući jer ga čeka ručak. Neka mjesta nas nikad ne puste sasvim.',null],
 ['Mama mi i dalje spakuje nešto za ponijeti svaki put kad dođem. Imam svoj posao, svoj stan i frižider pun hrane. Ali ta kesa je najljepša stvar koju donesem kući. 🤍','Jedan sin'],
 ['Nisam danas uradio ništa veliko. Izašao sam u šetnju, javio se starom prijatelju i spremio sebi večeru. Poslije mjeseci u kojima mi je sve bilo teško, meni je to sasvim dovoljno.',null],
 ['Vratio sam se ovdje jer mi je nedostajao osjećaj da negdje mogu napisati ono što mislim, bez objašnjavanja ko sam. Drago mi je da ovo mjesto ponovo postoji.',null],
];
export async function createLocalPreview({dataDir,seed=true,staticDirectory=staticRoot}={}){
 const servingRoot=path.resolve(staticDirectory);
 const db=new PGlite(dataDir);
 const migration=await readFile(path.join(root,'supabase/migrations/20261023212548_community_v2.sql'),'utf8');
 const securityMigration=await readFile(path.join(root,'supabase/admin-captcha.sql'),'utf8');
 const hash=createHash('sha256').update(migration+securityMigration).digest('hex');
 const exists=(await db.query("select to_regclass('community_test.content') as t")).rows[0].t;
 if(!exists){
  await db.exec('create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,is_anonymous boolean default false,email_confirmed_at timestamptz default now());create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);');
  await db.exec(migration);await db.exec(securityMigration);
  await db.exec('create schema preview_meta;create table preview_meta.schema_version(hash text not null);');
  await db.query('insert into preview_meta.schema_version values($1)',[hash]);
  if(seed){
   const owner=randomUUID();await db.query('insert into auth.users values($1)',[owner]);
   let first;
   for(let i=0;i<seedStories.length;i++){
    const r=await db.query("insert into community_test.content(kind,author_id,body,nickname,state,published_at) values('confession',$1,$2,$3,'published',clock_timestamp()-make_interval(hours=>$4)) returning id",[owner,...seedStories[i],seedStories.length-i]);
    first??=r.rows[0].id;
   }
   const c=await db.query("insert into community_test.content(kind,author_id,confession_id,body,state,published_at) values('comment',$1,$2,$3,'published',clock_timestamp()) returning id",[owner,first,'Nekad je dovoljan jedan miris iz nečije kuhinje i opet smo kod kuće.']);
   await db.query("insert into community_test.content(kind,author_id,confession_id,parent_id,body,state,published_at) values('reply',$1,$2,$3,$4,'published',clock_timestamp())",[owner,first,c.rows[0].id,'Meni miris pečenih paprika. Odmah septembar kod bake. 🙂']);
  }
 }else{
  const version=(await db.query('select hash from preview_meta.schema_version')).rows[0]?.hash;
  if(version!==hash){await db.close();throw new Error('Local database schema is outdated. Choose a new empty ISPOVESTI_LOCAL_DB directory; existing local data was not changed.');}
 }
 await db.exec('grant insert on auth.users to service_role;set role service_role;');
 const sessions=new Map(),tokens=new Map();let edgeHandler;
 const edgeSource=stripTypeScriptTypes(await readFile(path.join(root,'supabase/functions/community-api/index.ts'),'utf8'));
 const sessionForCookie=cookie=>{
  const entry=(cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='));
  const token=entry?.slice(cookieName.length+1),session=sessions.get(token);
  if(!session||session.expiresAt<=Date.now())return null;
  return session;
 };
 vm.runInNewContext(edgeSource,{
  Request,Response,Uint8Array,TextDecoder,TextEncoder,crypto,btoa,JSON,Set,AbortSignal,SyntaxError,atob,
  Deno:{env:{get:key=>({SUPABASE_URL:'https://isolated.local.invalid',SUPABASE_SERVICE_ROLE_KEY:'isolated-local-key',ALLOWED_ORIGINS:'http://local.invalid'})[key]},serve:fn=>edgeHandler=fn},
  fetch:async(url,options)=>{
   // This adapter intentionally cannot forward requests to any external system.
   if(url==='https://isolated.local.invalid/auth/v1/user'){
    const token=options.headers.Authorization?.replace(/^Bearer /,'');const session=tokens.get(token);
    return Response.json(session&&session.expiresAt>Date.now()?{id:session.uid,is_anonymous:true}:{error:'Invalid local session'},{status:session&&session.expiresAt>Date.now()?200:401});
   }
   if(!['https://isolated.local.invalid/rest/v1/rpc/community_test_dispatch','https://isolated.local.invalid/rest/v1/rpc/community_test_security'].includes(url))throw new Error('External network access forbidden in local staging.');
   try{
    const args=JSON.parse(options.body);const rpcName=url.endsWith('community_test_security')?'community_test_security':'community_test_dispatch';
    const r=await db.query('select public.'+rpcName+'($1::uuid,$2,$3::jsonb) as result',[args.p_uid,args.p_action,JSON.stringify(args.p_args)]);
    return Response.json(r.rows[0].result);
   }catch(error){return Response.json({code:error.code,message:error.message},{status:400});}
  },
 });
 const send=(res,status,body,headers={})=>{res.writeHead(status,{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(body);};
 const json=(res,status,value,headers={})=>send(res,status,JSON.stringify(value),{'Content-Type':'application/json; charset=utf-8',...headers});
 const server=http.createServer(async(req,res)=>{
  try{
   const ownOrigin='http://'+req.headers.host;
   const pathname=new URL(req.url,ownOrigin).pathname;
   if(pathname.startsWith('/api/')){
    if(req.method!=='POST')return json(res,405,{error:'Nedozvoljen zahtjev.'});
    // Browser CSRF protection; local HTTP tests without an Origin remain supported.
    const origins=new Set([ownOrigin,process.env.LOCAL_PREVIEW_ORIGIN||'http://terminal.local:4173']);
    if((req.headers.origin&&!origins.has(req.headers.origin))||req.headers['sec-fetch-site']==='cross-site')return json(res,403,{error:'Nedozvoljeno porijeklo.'});
    if(!req.headers['content-type']?.startsWith('application/json'))return json(res,415,{error:'Očekivan je JSON zahtjev.'});
    let size=0;const bodyChunks=[];
    for await(const chunk of req){size+=chunk.length;if(size>32768)return json(res,413,{error:'Zahtjev je prevelik.'});bodyChunks.push(chunk);}
    const body=Buffer.concat(bodyChunks).toString('utf8');
    if(pathname==='/api/local-session'){
     let session=sessionForCookie(req.headers.cookie),cookieToken;
     if(!session){
      const uid=randomUUID();await db.query('insert into auth.users values($1)',[uid]);
      cookieToken=randomBytes(32).toString('hex');const authToken=randomBytes(32).toString('hex');
      session={uid,authToken,expiresAt:Date.now()+sessionLifetime};sessions.set(cookieToken,session);tokens.set(authToken,session);
     }
     return json(res,200,{success:true,mode:'local'},cookieToken?{'Set-Cookie':`${cookieName}=${cookieToken}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800`}:{});
    }
    if(pathname!=='/api/community')return json(res,404,{error:'Nije pronađeno.'});
    let parsed;try{parsed=JSON.parse(body);}catch{return json(res,400,{error:'Neispravan zahtjev.'});}
    const session=sessionForCookie(req.headers.cookie);
    if(!publicActions.has(parsed?.action)&&!session)return json(res,401,{error:'Potrebna je lokalna anonimna sesija.'});
    const response=await edgeHandler(new Request('http://local.invalid/community',{method:'POST',headers:{Origin:'http://local.invalid',...(session?{Authorization:'Bearer '+session.authToken}:{})},body}));
    return send(res,response.status,await response.text(),{'Content-Type':'application/json; charset=utf-8'});
   }
   if(req.method!=='GET'&&req.method!=='HEAD')return send(res,405,'Method not allowed');
   if(pathname==='/__qa/mobile'&&servingRoot!==staticRoot)return send(res,200,'<!doctype html><html><meta name=viewport content=\"width=device-width,initial-scale=1\"><title>Mobilna provjera</title><body style=\"margin:0;background:#303030\"><iframe title=\"Ispovesti.ba mobilni test\" src=\"/\" style=\"display:block;width:390px;height:844px;border:0;margin:auto\"></iframe></body></html>',{'Content-Type':'text/html; charset=utf-8'});
   if(pathname==='/config.js')return send(res,200,"window.ISPOVESTI_CONFIG={mode:'local',supabaseUrl:'',publishableKey:''};if(!crypto.randomUUID)crypto.randomUUID=()=>{const b=crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const h=Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);};",{'Content-Type':'text/javascript; charset=utf-8'});
   let decoded;try{decoded=decodeURIComponent(pathname);}catch{return send(res,400,'Bad path');}
   const filename=path.resolve(servingRoot,'.'+(decoded==='/'?'/index.html':decoded));
   if(!filename.startsWith(servingRoot+path.sep))return send(res,404,'Not found');
   const rel=path.relative(servingRoot,filename);
   if(servingRoot!==staticRoot&&(!['index.html','config.js','app.js','api.js','captcha.js','original.css','styles.css','chat-admin.html','diagnostics.mjs','favicon.svg','share-card.png','privacy.html','terms.html','cookies.html','admin-prep/archive-ui.mjs','admin-prep/advertising-ui.mjs','admin-prep/owner-chat-ui.mjs','admin-prep/telemetry-local.mjs','admin-prep/metrics-ui.mjs','admin-prep/banner-local.mjs'].includes(rel)&&!/^chat\/(client\.mjs|ui\.mjs|admin\.mjs|thread-model\.mjs|chat\.css)$/.test(rel)&&!rel.startsWith('vendor/')))return send(res,404,'Not found');
   const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.txt':'text/plain; charset=utf-8'};
   let bytes;try{bytes=await readFile(filename);}catch{return send(res,404,'Not found');}
   return send(res,200,req.method==='HEAD'?'':bytes,{'Content-Type':types[path.extname(filename)]||'application/octet-stream'});
  }catch{return json(res,500,{error:'Lokalni test trenutno nije dostupan.'});}
 });
 const publisher=setInterval(()=>db.query('select community_test.publish_one()').catch(()=>{}),60000);publisher.unref();
 const cleanup=setInterval(()=>{for(const[key,s]of sessions)if(s.expiresAt<=Date.now()){sessions.delete(key);tokens.delete(s.authToken);}},60000);cleanup.unref();
 return{server,db,async close(){clearInterval(publisher);clearInterval(cleanup);if(server.listening)await new Promise(resolve=>server.close(resolve));await db.close();}};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const stage=await createLocalPreview({dataDir:process.env.ISPOVESTI_LOCAL_DB||path.join(root,'.local-stage')});
 const args=process.argv.slice(2);
 const portIndex=args.indexOf('--port');
 const port=Number(process.env.PORT||(portIndex>=0?args[portIndex+1]:3000));
 if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid local preview port.');
 stage.server.listen(port,'0.0.0.0',()=>console.log(`Isolated local staging listening on ${port}; no production connection.`));
 for(const signal of['SIGINT','SIGTERM'])process.once(signal,()=>stage.close().then(()=>process.exit(0)));
}
