import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const app=await readFile(new URL('../dist/app.js',import.meta.url),'utf8');
const source=app.slice(app.indexOf('function contentForm('),app.indexOf('function voteControls('));
function formTest(){
 const nodes=[],calls=[];let completed=0;
 const node=(tag,cls,text)=>{const el={tag,className:cls,textContent:text,value:'',children:[],dataset:{},append(...children){this.children.push(...children);},addEventListener(){},remove(){}};nodes.push(el);return el;};
 const context=vm.createContext({node,button:(text,callback)=>{const b=node('button','',text);b.onclick=callback;return b;},prepareSubmission(){},crypto,performance:{now:()=>1,measure(){},getEntriesByName:()=>[],clearMeasures(){}},requestAnimationFrame:fn=>fn(),toast(){},dialog:{close(){}},closeMenu(){},request:(action,args)=>new Promise((resolve,reject)=>calls.push({action,args,resolve,reject}))});
 vm.runInContext(source,context);
 const form=context.contentForm('comment',{confession_id:'1'},()=>completed++),text=nodes.find(n=>n.tag==='textarea'),nick=nodes.find(n=>n.tag==='input');
 text.value='Jedan komentar bez duplog slanja.';
 const submit=()=>form.onsubmit({preventDefault(){}});
 return{form,text,nick,calls,submit,get completed(){return completed;}};
}
test('form single-flight rejects a second submit and protects the submitted draft while waiting',async()=>{
 const f=formTest(),first=f.submit();await f.submit();assert.equal(f.calls.length,1);assert.equal(f.text.disabled,true);assert.equal(f.nick.disabled,true);
 f.calls[0].resolve({success:true,item:{id:'8',body:f.text.value}});await first;
 assert.equal(f.completed,1);assert.equal(f.text.value,'');assert.equal(f.text.disabled,false);
});
test('uncertain network retry preserves the idempotency UUID; an edited draft gets a new UUID',async()=>{
 const f=formTest();let send=f.submit();const original=f.calls[0].args.request_id;
 f.calls[0].reject(new Error('Mrežni prekid'));await send;assert.ok(f.text.value);assert.equal(f.text.disabled,false);
 send=f.submit();assert.equal(f.calls[1].args.request_id,original);f.calls[1].reject(new Error('Mrežni prekid'));await send;
 f.text.value+=' Izmijenjeno.';send=f.submit();assert.notEqual(f.calls[2].args.request_id,original);f.calls[2].resolve({success:true,item:{id:'9',body:f.text.value}});await send;
 assert.equal(f.completed,1);
});
