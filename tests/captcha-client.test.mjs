import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=(await readFile(new URL('../dist/captcha.js',import.meta.url),'utf8')).replaceAll('export ','');
function client(){
 let now=1000,settingsReads=0,executions=0,removed=0;const widgets=[],boxes=[];
 const host={append:e=>boxes.push(e)};
 const window={ISPOVESTI_CONFIG:{supabaseUrl:'https://test.invalid',publishableKey:'public'},turnstile:{render:(box,options)=>{widgets.push(options);return widgets.length-1;},execute:()=>{executions++;},remove:()=>{removed++;}}};
 const context=vm.createContext({window,document:{body:host,createElement:()=>({remove(){}})},Date:class extends Date{static now(){return now;}},AbortSignal,setTimeout,clearTimeout,fetch:async()=>{settingsReads++;return{ok:true,json:async()=>({enabled:true,sitekey:'public-sitekey'})};}});
 vm.runInContext(source,context);const tick=()=>new Promise(resolve=>setImmediate(resolve));
 return {host,widgets,boxes,tick,prepare:kind=>context.prepareCaptcha({kind,host}),take:kind=>context.captchaToken({kind,host}),expire:()=>{now+=241000;},get executions(){return executions;},get reads(){return settingsReads;},get removed(){return removed;}};
}
test('client starts action-bound verification while typing and consumes a prepared token once',async()=>{
 const c=client();c.prepare('comment');c.prepare('comment');await c.tick();assert.equal(c.executions,1);assert.equal(c.reads,1);
 assert.equal(c.widgets[0].action,'submit_comment');assert.equal(c.widgets[0].appearance,'interaction-only');
 c.widgets[0].callback('prepared');assert.equal(await c.take('comment'),'prepared');assert.equal(c.removed,1);
 const second=c.take('comment');await c.tick();assert.equal(c.executions,2);c.widgets[1].callback('fresh');assert.equal(await second,'fresh');
});
test('client joins in-flight preparation and refreshes expired tokens before sending',async()=>{
 const c=client();c.prepare('reply');await c.tick();const waiting=c.take('reply');assert.equal(c.executions,1);c.widgets[0].callback('first');assert.equal(await waiting,'first');
 c.prepare('reply');await c.tick();c.widgets[1].callback('will-expire');c.expire();const next=c.take('reply');await c.tick();assert.equal(c.executions,3);c.widgets[2].callback('renewed');assert.equal(await next,'renewed');
});
test('client preserves failure, retries with a fresh challenge and never reuses another action token',async()=>{
 const c=client();c.prepare('comment');await c.tick();const pending=c.take('comment');c.widgets[0]['error-callback']();await assert.rejects(pending,/provjera/);
 c.prepare('reply');await c.tick();assert.equal(c.widgets[1].action,'submit_reply');const next=c.take('reply');c.widgets[1].callback('reply-only');assert.equal(await next,'reply-only');
});
