import {sandboxConfig} from './config.mjs';
// Pure preparation helper. Caller supplies the server SDK; no credentials are saved/logged.
export async function inviteSandboxAccount({config,serviceKey,email,approved},createClient){
 const c=sandboxConfig(config);if(!approved||typeof serviceKey!=='string'||!serviceKey||typeof email!=='string'||!email.includes('@'))throw Error('Potrebno je odobrenje novog projekta i probnog e-maila.');
 const db=createClient(c.supabaseUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const existing=await db.auth.admin.listUsers({page:1,perPage:1});if(existing.error||existing.data.users.length)throw Error('Probni Auth projekat mora biti nov i prazan; ne preuzimati postojeće naloge.');
 const result=await db.auth.admin.inviteUserByEmail(email,{redirectTo:c.siteOrigin+'/test/admin.html'});if(result.error||!result.data.user?.id)throw Error('Poziv probnom nalogu nije dovršen; provjeri stanje prije ponavljanja.');
 return {userId:result.data.user.id,invited:true,passwordCreatedByAssistant:false};
}
