import {test} from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';import {recoveryEdgeBundle} from '../scripts/recovery-edge-bundle.mjs';
const c=JSON.parse(await readFile(new URL('../admin-recovery/sandbox/approved-public-config.json',import.meta.url),'utf8'));
test('isolated edge binding pins only the approved new project and keeps reset disabled by default',async()=>{
 const files=await recoveryEdgeBundle(c);assert.equal(files.length,5);
 for(const f of files.filter(f=>f.name.endsWith('index.ts'))){assert.ok(f.content.includes(c.projectRef));assert.ok(f.content.includes(c.siteOrigin));assert.ok(f.content.includes('assertIsolatedProject'));}
 const reset=files.find(f=>f.name.includes('isolated-api/index.ts')).content;
 assert.ok(reset.includes("env('RECOVERY_ENABLED')==='true'"));assert.ok(reset.includes("env('RECOVERY_ISOLATED_APPROVED')==='true'"));assert.ok(reset.includes("env('RECOVERY_TURNSTILE_SECRET')"));assert.ok(reset.includes("env('RECOVERY_RESEND_API_KEY')"));
 for(const projectRef of ['roxajqagksffbsbzdrap','wrvljpngjsinidbcpyaq'])await assert.rejects(recoveryEdgeBundle({...c,projectRef,supabaseUrl:'https://'+projectRef+'.supabase.co'}));
 assert.equal(c.deploymentReady,false);assert.equal(c.recoverySitekey,'');
});
