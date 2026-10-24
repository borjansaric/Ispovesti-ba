import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import vm from 'node:vm';
import {DemoRewards,DemoAd,AD_COSTS,productionAdsUnavailable} from '../ads/rewards.js';import {installAds} from '../ads/ui.js';
const reward=(kind,id=crypto.randomUUID())=>({kind,id,provider:'mock',completed:true});
test('mock is opt-in and inactive in live, live-test, and unconfigured environments',()=>{
 for(const config of [{mode:'live',ads:{enabled:true,provider:'mock'}},{mode:'live-test',ads:{enabled:true,provider:'mock'}},{mode:'preview'},{mode:'preview',ads:{enabled:false,provider:'mock'}}])assert.equal(installAds(config).attachForm({},'comment'),null);
 assert.throws(()=>new DemoRewards(),/Stvarnom|stvarnom/);assert.throws(productionAdsUnavailable,/nisu povezane/);
});
test('only completed mock events grant once, separately for each content kind',()=>{
 const w=new DemoRewards({demo:true}),r=reward('comment');assert.throws(()=>w.grant({...r,completed:false}));assert.throws(()=>w.grant({...r,provider:'banner'}));
 assert.equal(w.grant(r),true);assert.equal(w.grant(r),false);assert.equal(w.balance('comment'),1);assert.equal(w.balance('reply'),0);assert.equal(w.balance('confession'),0);assert.throws(()=>w.grant(reward('other')));
});
test('reservation prevents double spend, failure releases, and a confirmed post consumes once',()=>{
 const w=new DemoRewards({demo:true});w.grant(reward('reply'));w.grant(reward('reply'));const a=w.reserve('reply');assert.throws(()=>w.reserve('reply'));assert.throws(()=>w.commit(a,null));assert.equal(w.release(a),true);assert.equal(w.balance('reply'),1);
 const b=w.reserve('reply');assert.equal(w.commit(b,'42'),true);assert.equal(w.commit(b,'42'),false);assert.equal(w.release(b),false);assert.equal(w.balance('reply'),0);
});
function clock(){let now=0,visible=true,tick;const ad=new DemoAd({durationMs:1000,now:()=>now,visible:()=>visible,schedule:fn=>{tick=fn;return 1;},cancel:()=>{tick=null;}});return{ad,step(n=1){for(let i=0;i<n;i++){now+=250;tick?.();}},hide(){visible=false;},show(){visible=true;}};}
test('mock viewing pauses while hidden, rejects concurrent ads and grants only on completion',async()=>{
 const c=clock(),controller=new AbortController(),p=c.ad.play({kind:'confession',signal:controller.signal});assert.throws(()=>c.ad.play({kind:'reply'}),/već/);c.step(2);c.hide();c.step(20);c.show();c.step(2);assert.equal((await p).completed,true);
});
test('skip and cancellation produce no reward and release the ad slot',async()=>{
 const c=clock(),a=new AbortController(),p=c.ad.play({kind:'comment',signal:a.signal});c.step(2);a.abort();await assert.rejects(p,{name:'AbortError'});c.step(20);
 const next=c.ad.play({kind:'comment'});c.step(4);assert.equal((await next).kind,'comment');
});
const app=await readFile(new URL('../app.js',import.meta.url),'utf8');
function formHarness(kind='comment'){
 const wallet=new DemoRewards({demo:true});for(let i=0;i<AD_COSTS[kind];i++)wallet.grant(reward(kind));const nodes=[],calls=[];let done=0;
 const node=(tag,cls,text)=>{const x={tag,value:'',dataset:{},children:[],className:cls,textContent:text,append(...c){this.children.push(...c);},addEventListener(){},remove(){}};nodes.push(x);return x;};
 const ctx=vm.createContext({node,button:()=>node('button'),ads:{attachForm:()=>({reserve:()=>wallet.reserve(kind),commit:(id,post)=>wallet.commit(id,post),release:id=>wallet.release(id)})},prepareSubmission(){},crypto,randomId:()=>crypto.randomUUID(),performance:{now:()=>0,measure(){},getEntriesByName:()=>[],clearMeasures(){}},requestAnimationFrame:f=>f(),toast(){},dialog:{close(){}},closeMenu(){},request:(_,args)=>new Promise((resolve,reject)=>calls.push({args,resolve,reject}))});
 vm.runInContext(app.slice(app.indexOf('function contentForm('),app.indexOf('function voteControls(')),ctx);
 const form=ctx.contentForm(kind,{confession_id:'1'},()=>done++);const text=nodes.find(n=>n.tag==='textarea');text.value='Probni tekst.';return{wallet,calls,form,text,submit:()=>form.onsubmit({preventDefault(){}}),get done(){return done;}};
}
test('posting consumes the mandatory demo unlock only after server confirmation; failure and duplicate keep it',async()=>{
 const f=formHarness();let p=f.submit();await f.submit();assert.equal(f.calls.length,1);f.calls[0].reject(Error('Prekid'));await p;assert.equal(f.wallet.balance('comment'),1);assert.ok(f.text.value);
 p=f.submit();f.calls[1].resolve({duplicate:true});await p;assert.equal(f.wallet.balance('comment'),1);assert.ok(f.text.value);
 p=f.submit();f.calls[2].resolve({success:true,id:'44',item:{id:'44',body:'Probni tekst.'}});await p;assert.equal(f.wallet.balance('comment'),0);assert.equal(f.done,1);
});
test('report form keeps its own single-flight state without touching posting-only inputs',async()=>{
 const nodes=[];const node=(tag)=>{const x={tag,children:[],append(...c){this.children.push(...c);}};nodes.push(x);return x;};let calls=0;
 const ctx=vm.createContext({node,request:async()=>{calls++;},dialog:{close(){}},toast(){},modal(){}});vm.runInContext(app.slice(app.indexOf('function report('),app.indexOf('async function commentBranch(')),ctx);ctx.report({id:'1'});const form=nodes.find(n=>n.tag==='form');await form.onsubmit({preventDefault(){}});assert.equal(calls,1);
});
test('standalone ads preview cannot contact Supabase and keeps draft storage separate',async()=>{
 const html=await readFile(new URL('../ads-preview.html',import.meta.url),'utf8');const config=await readFile(new URL('../ads/demo-config.js',import.meta.url),'utf8');
 assert.ok(html.includes("connect-src 'self';"));assert.ok(html.includes('PROBNE REKLAME'));assert.ok(config.includes("mode:'preview'"));assert.ok(config.includes('ispovesti-ads-demo-content-v1'));
 const ui=await readFile(new URL('../ads/ui.js',import.meta.url),'utf8');assert.ok(!ui.includes('window.open'));assert.ok(!ui.includes('fetch('));
});

import {randomId} from '../ads/ids.js';
test('HTTP preview uses cryptographic UUID fallback without weakening request IDs',()=>{const id=randomId({getRandomValues:b=>crypto.getRandomValues(b)});assert.match(id,/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);assert.throws(()=>randomId({}));});

test('final 3/2/1 rule: incomplete bundles cannot publish, kinds cannot substitute and each success spends the full cost',()=>{
 assert.deepEqual(AD_COSTS,{confession:3,comment:1,reply:2});
 for(const [kind,cost] of Object.entries(AD_COSTS)){
  const w=new DemoRewards({demo:true});assert.throws(()=>w.reserve(kind));
  for(let i=1;i<cost;i++){w.grant(reward(kind));assert.equal(w.balance(kind),0);assert.equal(w.progress(kind),i);assert.throws(()=>w.reserve(kind));}
  w.grant(reward(kind));assert.equal(w.balance(kind),1);
  for(const other of Object.keys(AD_COSTS).filter(k=>k!==kind))assert.throws(()=>w.reserve(other));
  const hold=w.reserve(kind);assert.throws(()=>w.reserve(kind));assert.equal(w.release(hold),true);assert.equal(w.balance(kind),1);
  assert.equal(w.commit(w.reserve(kind),'saved-'+kind),true);assert.equal(w.balance(kind),0);assert.equal(w.credits(kind),0);assert.throws(()=>w.reserve(kind));
 }
});
test('no free posting after repeated submissions, and duplicate confirmed IDs do not spend twice',()=>{
 const w=new DemoRewards({demo:true});
 for(let i=0;i<20;i++){assert.throws(()=>w.reserve('comment'));w.grant(reward('comment'));w.commit(w.reserve('comment'),'saved-'+i);assert.equal(w.balance('comment'),0);}
 w.grant(reward('comment'));assert.equal(w.commit(w.reserve('comment'),'saved-0'),false);assert.equal(w.balance('comment'),1);
});
test('unfunded form refuses submit before any API call and preserves the draft',async()=>{
 const f=formHarness();f.wallet.commit(f.wallet.reserve('comment'),'previous');await f.submit();assert.equal(f.calls.length,0);assert.equal(f.text.value,'Probni tekst.');assert.equal(f.done,0);
 const ui=await readFile(new URL('../ads/ui.js',import.meta.url),'utf8');assert.ok(!ui.includes("input.type='checkbox'"));assert.ok(ui.includes('reserve:()=>wallet.reserve(kind)'));
});

test('all three actual forms block at zero, preserve quota on error and spend only on confirmed save',async()=>{
 for(const kind of ['confession','reply','comment']){
  const f=formHarness(kind);f.text.value='Probni tekst za svaku vrstu sadržaja.';
  let p=f.submit();assert.equal(f.calls.length,1);f.calls[0].reject(Error('Greška'));await p;assert.equal(f.wallet.balance(kind),1);
  p=f.submit();f.calls[1].resolve({success:true,id:'saved-'+kind,item:{id:'saved-'+kind}});await p;assert.equal(f.wallet.credits(kind),0);
  f.text.value='Drugi probni tekst za istu vrstu.';await f.submit();assert.equal(f.calls.length,2);assert.ok(f.text.value);
 }
});
