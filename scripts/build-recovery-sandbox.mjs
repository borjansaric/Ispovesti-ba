// Local preparation only. No GitHub writes, network, SQL, secrets, deploy or Pages settings.
import {readFile,writeFile,mkdir,copyFile,rm} from 'node:fs/promises';
import {sandboxConfig} from '../admin-recovery/sandbox/config.mjs';
const root=new URL('../',import.meta.url),out=new URL('../.recovery-sandbox-review/',import.meta.url);
export async function buildSandbox(value){
 const config=value?sandboxConfig(value):null;
 await rm(out,{recursive:true,force:true});await mkdir(new URL('test/admin-recovery/',out),{recursive:true});await mkdir(new URL('test/vendor/',out),{recursive:true});
 for(const f of ['original.css','styles.css','vendor/supabase.js','vendor/SUPABASE-LICENSE'])await copyFile(new URL(f,root),new URL('test/'+f,out));
 for(const f of ['client.mjs','forgot.mjs','reset.mjs']){
  let s=await readFile(new URL('admin-recovery/'+f,root),'utf8');
  if(f==='client.mjs')s=s.replace("if(c.mode!=='live-test')", "if(c.mode!=='recovery-sandbox')").replace('admin-recovery-test-api','admin-recovery-isolated-api');
  if(f==='forgot.mjs')s=s.replace("c.mode==='live-test'", "c.mode==='recovery-sandbox'");
  await writeFile(new URL('test/admin-recovery/'+f,out),s);
 }
 // The existing CAPTCHA helper is copied, but only explicit sandbox sitekey/action are used.
 let captcha=await readFile(new URL('captcha.js',root),'utf8');const a=captcha.indexOf('let settingsPromise'),b=captcha.indexOf('function challenge(');captcha=captcha.slice(0,a)+"async function settings(){throw Error('Koristi samo namjenski probni CAPTCHA ključ.');}\n"+captcha.slice(b);await writeFile(new URL('test/captcha.js',out),captcha);
 await copyFile(new URL('admin-recovery/reset-template.html',root),new URL('test/admin-recovery.html',out));
 for(const f of ['admin.html','admin.mjs'])await copyFile(new URL('admin-recovery/sandbox/'+f,root),new URL('test/'+f,out));
 await copyFile(new URL('admin-recovery/sandbox/config.mjs',root),new URL('test/sandbox-config.mjs',out));
 await writeFile(new URL('test/config.js',out),'window.ISPOVESTI_CONFIG = '+JSON.stringify(config||{mode:'recovery-sandbox',configured:false})+';\n');
 await writeFile(new URL('index.html',out),'<!doctype html><html lang="sr-Latn"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><meta http-equiv="refresh" content="0;url=/test/admin.html"><title>Odvojena proba prijave</title></head><body><a href="/test/admin.html">Otvori probni panel</a></body></html>');
 await writeFile(new URL('robots.txt',out),'User-agent: *\nDisallow: /\n');
 return {directory:out.pathname,configured:!!config,mainSiteTouched:false};
}
if(process.argv[1]===new URL(import.meta.url).pathname){const file=process.argv[2];console.log(JSON.stringify(await buildSandbox(file?JSON.parse(await readFile(file,'utf8')):null)));}
