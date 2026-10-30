// Builds an isolated review bundle. Does not modify dist/, deploy, or call a database.
import {mkdir,copyFile,cp,readFile,writeFile} from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),out=path.join(root,'.test-review');
await mkdir(out,{recursive:true});
for(const f of ['index.html','app.js','api.js','captcha.js','admin.html','admin.js','chat-admin.html','original.css','styles.css','diagnostics.mjs','favicon.svg','share-card.png','privacy.html','terms.html','cookies.html'])await copyFile(path.join(root,f),path.join(out,f));
await cp(path.join(root,'vendor'),path.join(out,'vendor'),{recursive:true});await mkdir(path.join(out,'chat'),{recursive:true});
for(const f of ['client.mjs','ui.mjs','admin.mjs','trial-client.mjs','chat.css','thread-model.mjs'])await copyFile(path.join(root,'chat',f),path.join(out,'chat',f));
for(const f of ['api.js','captcha.js']){let s=await readFile(path.join(out,f),'utf8');s=s.replaceAll('community-live-api','community-test-api').replaceAll('ispovesti-live-user-session','ispovesti-test-user-session').replaceAll('ispovesti-live-admin-session','ispovesti-test-admin-session');await writeFile(path.join(out,f),s);}
let admin=await readFile(path.join(out,'admin.html'),'utf8');await writeFile(path.join(out,'admin.html'),admin.replace('postavke odnose na glavni sajt','postavke odnose samo na /test/'));
const text=await readFile(path.join(root,'dist/config.js'),'utf8');const config=JSON.parse(text.slice(text.indexOf('=')+1).trim().replace(/;$/,''));config.chatEnvironment='test';config.mode='live-test';await writeFile(path.join(out,'config.js'),'window.ISPOVESTI_CONFIG = '+JSON.stringify(config)+';\n');
console.log('Test review bundle prepared in .test-review; /test/ and dist remain unchanged.');

let index=await readFile(path.join(out,'index.html'),'utf8');await writeFile(path.join(out,'index.html'),index.replace('index,follow','noindex,nofollow').replace('<link rel="stylesheet" href="live/banner.css">','').replace('<script type="module" src="live/banner.mjs"></script>','').replace(' · <a href="contact.html">Kontakt</a>',''));

// Test-only recovery. The root/production administrator remains unchanged.
await mkdir(path.join(out,'admin-recovery'),{recursive:true});
for(const f of ['client.mjs','forgot.mjs','reset.mjs'])await copyFile(path.join(root,'admin-recovery',f),path.join(out,'admin-recovery',f));
await copyFile(path.join(root,'admin-recovery/reset-template.html'),path.join(out,'admin-recovery.html'));
let recoveryAdmin=await readFile(path.join(out,'admin.html'),'utf8');
await writeFile(path.join(out,'admin.html'),recoveryAdmin.replace('</head>','<script type="module" src="admin-recovery/forgot.mjs"></script></head>'));

// Keep main clients live-only; this explicitly selected review uses its retained test client.
await copyFile(path.join(root,'test/chat/client.mjs'),path.join(out,'chat/client.mjs'));
await copyFile(path.join(root,'test/chat-admin.html'),path.join(out,'chat-admin.html'));
let testAdmin=await readFile(path.join(out,'admin.html'),'utf8');testAdmin=testAdmin.replace('<script type="module" src="live/recovery-settings.mjs"></script>','').replace('<script type="module" src="live/operations.mjs"></script>','').replace('<link rel="stylesheet" href="live/operations.css">','');await writeFile(path.join(out,'admin.html'),testAdmin);
let testRecovery=await readFile(path.join(out,'admin-recovery/client.mjs'),'utf8');testRecovery=testRecovery.replace("c.mode!=='live'","c.mode!=='live-test'").replaceAll('admin-recovery-live-api','admin-recovery-test-api');await writeFile(path.join(out,'admin-recovery/client.mjs'),testRecovery);
