import {mkdir,copyFile,cp,readFile,writeFile,rm} from 'node:fs/promises';
const out=new URL('../.production-review/',import.meta.url),root=new URL('../',import.meta.url);await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
for(const file of ['index.html','app.js','api.js','captcha.js','admin.html','admin.js','config.js','original.css','styles.css','diagnostics.mjs','favicon.svg','share-card.png','privacy.html','terms.html','cookies.html'])await copyFile(new URL(file,root),new URL(file,out));
await cp(new URL('vendor/',root),new URL('vendor/',out),{recursive:true});await mkdir(new URL('chat/',out),{recursive:true});for(const f of ['chat.css','thread-model.mjs'])await copyFile(new URL('chat/'+f,root),new URL('chat/'+f,out));
// Publish only the connected live clients; no trial generator or server source.
for(const f of ['ui.mjs','client.mjs'])await copyFile(new URL('chat/'+f,root),new URL('chat/'+f,out));
let chatClient=await readFile(new URL('chat/client.mjs',out),'utf8');
chatClient=chatClient.slice(0,chatClient.indexOf('export const recoveryKey='));
chatClient=chatClient.replace("(config.chatEnvironment==='live'?'chat-live-api':'chat-test-api')","'chat-live-api'");
await writeFile(new URL('chat/client.mjs',out),chatClient);
await copyFile(new URL('chat-admin.html',root),new URL('chat-admin.html',out));
await copyFile(new URL('admin-recovery.html',root),new URL('admin-recovery.html',out));
for(const dir of ['live','admin-prep','admin-recovery'])await mkdir(new URL(dir+'/',out),{recursive:true});
for(const file of ['live/chat-admin.mjs','live/recovery-settings.mjs','admin-prep/archive-ui.mjs','admin-recovery/forgot.mjs','admin-recovery/client.mjs','admin-recovery/reset.mjs'])await copyFile(new URL(file,root),new URL(file,out));
let recoveryClient=await readFile(new URL('admin-recovery/client.mjs',out),'utf8');
recoveryClient=recoveryClient.replace("(c.mode==='live'?'admin-recovery-live-api':'admin-recovery-test-api')","'admin-recovery-live-api'");
await writeFile(new URL('admin-recovery/client.mjs',out),recoveryClient);
console.log('Prepared .production-review; not published.');

// Preserve the already reviewed /test/ bytes; never regenerate it as a live client.
await cp(new URL('test/',root),new URL('test/',out),{recursive:true});

const origin=process.env.SITE_ORIGIN||'https://borjansaric.github.io/Ispovesti-ba/';const canonical=new URL(origin);if(canonical.protocol!=='https:'||canonical.search||canonical.hash||canonical.username||canonical.password)throw Error('Only a verified HTTPS site origin without user data is allowed');if(!canonical.pathname.endsWith('/'))canonical.pathname+='/';
let seo=await readFile(new URL('index.html',out),'utf8');seo=seo.replace('</head>','<link rel="canonical" href="'+canonical.href+'"><meta property="og:url" content="'+canonical.href+'"></head>').replace('content="share-card.png"','content="'+new URL('share-card.png',canonical).href+'"');await writeFile(new URL('index.html',out),seo);
await writeFile(new URL('robots.txt',out),'User-agent: *\nAllow: /\nDisallow: '+canonical.pathname+'test/\nDisallow: '+canonical.pathname+'admin.html\nDisallow: '+canonical.pathname+'chat-admin.html\nDisallow: '+canonical.pathname+'admin-recovery.html\nSitemap: '+new URL('sitemap.xml',canonical).href+'\n');
await writeFile(new URL('sitemap.xml',out),'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>'+canonical.href+'</loc></url></urlset>');
