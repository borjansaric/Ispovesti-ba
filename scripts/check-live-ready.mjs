import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
export async function checkLiveReady(config,{fetcher=fetch,initial=false}={}){
 if(config.mode!=='live'||!config.supabaseUrl?.startsWith('https://')||!config.publishableKey?.startsWith('sb_publishable_'))throw Error('Nepotpuna javna konfiguracija zvaničnog sajta.');
 const endpoint=config.supabaseUrl+'/functions/v1/community-live-api?forceFunctionRegion=eu-central-1';
 async function request(action){const r=await fetcher(endpoint,{method:'POST',headers:{apikey:config.publishableKey,'Content-Type':'application/json'},body:JSON.stringify({action,args:{}}),signal:AbortSignal.timeout(15000)});return {r,data:await r.json()};}
 const health=await request('health');if(!health.r.ok||health.data.environment!=='live'||health.data.version!=='launch1')throw Error('Zvanični serverski dio nije spreman. Objavljivanje je zaustavljeno.');
 if(health.data.posting_policy!=='free')throw Error('Besplatno objavljivanje osnovnog sajta nije potvrđeno.');
 const captcha=await request('captcha_config');if(!captcha.r.ok||typeof captcha.data.enabled!=='boolean'||(initial&&captcha.data.enabled!==true))throw Error('Podešavanja zaštite nisu spremna.');
 const feed=await request('feed');if(!feed.r.ok||!Array.isArray(feed.data.items))throw Error('Zvanična baza nije dostupna.');
 if(initial&&feed.data.items.length!==0)throw Error('Početni zvanični feed nije prazan. Objavljivanje je zaustavljeno.');
 const denied=await request('admin_list');if(denied.r.status!==401)throw Error('Provjera administratorske zaštite nije prošla.');
 return {ready:true,environment:'live',captcha_enabled:captcha.data.enabled};
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
 try{const text=await readFile(new URL('../config.js',import.meta.url),'utf8');const config=JSON.parse(text.slice(text.indexOf('=')+1).trim().replace(/;$/,''));console.log(JSON.stringify(await checkLiveReady(config,{initial:process.argv.includes('--initial')})));}catch(e){console.error(e.message);process.exitCode=1;}
}
