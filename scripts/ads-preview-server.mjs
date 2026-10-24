// Static, local-only QA server. It exposes no database routes and does not serve server source.
import http from 'node:http';import {readFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const files=new Set(['ads-preview.html','ads-mobile-preview.html','app.js','api.js','captcha.js','original.css','styles.css','vendor/supabase.js']);
const server=http.createServer(async(req,res)=>{
 let path;try{path=decodeURIComponent(new URL(req.url,'http://local.invalid').pathname).slice(1);}catch{res.writeHead(400);res.end();return;}
 if(!path){res.writeHead(302,{Location:'/ads-preview.html'});res.end();return;}
 if(!files.has(path)&&!/^ads\/[a-z0-9-]+\.(js|css)$/.test(path)){res.writeHead(404);res.end();return;}
 try{const body=await readFile(new URL(path,root));res.writeHead(200,{'Content-Type':path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(body);}catch{res.writeHead(404);res.end();}
});const portArg=process.argv.indexOf('--port');
server.listen(Number(portArg>=0?process.argv[portArg+1]:process.env.PORT||5173),'0.0.0.0',()=>console.log('Ads preview listening'));
