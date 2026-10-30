// Reproducible public configuration binding for the approved isolated project.
// This exports source files only; it does not deploy, enroll users or handle secrets.
import {readFile} from 'node:fs/promises';
import {sandboxConfig} from '../admin-recovery/sandbox/config.mjs';
export async function recoveryEdgeBundle(value){
 const c=sandboxConfig(value),root=new URL('../',import.meta.url);
 const paths=['supabase/functions/admin-recovery-sandbox-login/index.ts','supabase/functions/admin-recovery-isolated-api/index.ts','admin-recovery/handler.mjs','admin-recovery/sandbox/login-handler.mjs','admin-recovery/sandbox/config.mjs'];
 const files=[];
 for(const name of paths){
  let content=await readFile(new URL(name,root),'utf8');
  if(name.endsWith('index.ts')){
   content=content.replaceAll("env('RECOVERY_SANDBOX_PROJECT_REF')",`(env('RECOVERY_SANDBOX_PROJECT_REF')||'${c.projectRef}')`);
   content=content.replaceAll("env('RECOVERY_LINK_URL')",`(env('RECOVERY_LINK_URL')||'${c.siteOrigin}/test/admin-recovery.html')`);
   if(name.includes('sandbox-login'))content=content.replace("if(env('RECOVERY_ISOLATED_APPROVED')!=='true')throw Error('Only the approved isolated Auth project is allowed');",'// Approved isolated project; owner authorization is still enforced for every request.');
  }
  files.push({name,content});
 }
 return files;
}
