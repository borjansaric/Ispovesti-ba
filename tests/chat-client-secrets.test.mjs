import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readdir,readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const root=new URL('../',import.meta.url);
test('complete test browser bundle contains no privileged key, server entrypoint or SQL',async()=>{
 execFileSync(process.execPath,['scripts/build-test-review.mjs'],{cwd:root,stdio:'pipe'});
 let files=0;
 async function scan(dir){for(const entry of await readdir(dir,{withFileTypes:true})){
  const url=new URL(entry.name+(entry.isDirectory()?'/':''),dir);
  if(entry.isDirectory()){await scan(url);continue;}
  files++;
  assert.ok(!/\.(?:sql|ts)$/.test(entry.name),entry.name);
  assert.ok(!['gateway.mjs','owner-key','chat-preview.mjs'].includes(entry.name),entry.name);
  if(!/\.(?:js|mjs|html|json|css)$/.test(entry.name))continue;
  const text=await readFile(url,'utf8');
  assert.doesNotMatch(text,/sb_secret_[A-Za-z0-9_-]{20,}/,url.pathname);
  assert.doesNotMatch(text,/SUPABASE_SERVICE_ROLE_KEY|Deno\.env\.get/,url.pathname);
  for(const token of text.matchAll(/eyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g)){
   let claims;try{claims=JSON.parse(Buffer.from(token[1],'base64url').toString());}catch{continue;}
   assert.notEqual(claims.role,'service_role',url.pathname);
  }
 }}
 await scan(new URL('.test-review/',root));assert.ok(files>10);
});
