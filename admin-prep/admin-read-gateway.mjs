// Test-only dependency-injected gateway. Never deploy without real verified Auth and database adapters.
import {summarize} from './metrics-core.mjs';
import {searchArchive,reportContext} from './chat-archive-core.mjs';
export function createAdminReadGateway({origin,auth,store}){
 if(!origin||typeof auth?.verify!=='function'||typeof auth?.requireAdminAndSecondFactor!=='function'||typeof store?.read!=='function')throw Error('Missing verified server dependencies');
 return async request=>{
  const headers={'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};const respond=(value,status=200)=>new Response(JSON.stringify(value),{status,headers});
  if(request.method!=='POST'||request.headers.get('origin')!==origin)return respond({error:'Nedozvoljen zahtjev.'},403);
  const token=request.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];if(!token)return respond({error:'Prijava je potrebna.'},401);
  try{
   const identity=await auth.verify(token);if(!identity?.id)return respond({error:'Prijava je potrebna.'},401);
   if(!await auth.requireAdminAndSecondFactor(identity,token))return respond({error:'Pristup nije dozvoljen.'},403);
   const bytes=await request.arrayBuffer();if(bytes.byteLength>4096)return respond({error:'Zahtjev je prevelik.'},413);const body=JSON.parse(new TextDecoder().decode(bytes));
   if(!body||typeof body!=='object'||Array.isArray(body))return respond({error:'Neispravan zahtjev.'},400);
   // Identity, session and permissions supplied by the browser are never used.
   if(body.action==='metrics'){const events=await store.read('metrics');return respond(summarize(events,{section:body.section,now:new Date()}));}
   if(body.action==='archive'){const rows=await store.read('archive');return respond({items:searchArchive(rows,body.filters||{})});}
   if(body.action==='context'){const rows=await store.read('archive');return respond({items:reportContext(rows,body.id)});}
   return respond({error:'Nepoznata radnja.'},400);
  }catch(e){if(e instanceof SyntaxError)return respond({error:'Neispravan zahtjev.'},400);return respond({error:'Pregled trenutno nije dostupan.'},503);}
 };
}
