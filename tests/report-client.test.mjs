import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const app=await readFile(new URL('../app.js',import.meta.url),'utf8');
const source=app.slice(app.indexOf('function report(item)'),app.indexOf('async function commentBranch('));
function setup(){
 const nodes=[],calls=[],messages=[];let closed=0;
 const node=(tag,cls,text)=>{const el={tag,textContent:text,value:'',children:[],append(...items){this.children.push(...items);}};nodes.push(el);return el;};
 const context=vm.createContext({node,modal(){},dialog:{close(){closed++;}},toast:t=>messages.push(t),request:(action,args)=>new Promise((resolve,reject)=>calls.push({action,args,resolve,reject}))});
 vm.runInContext(source,context);context.report({id:'37'});
 const form=nodes.find(n=>n.tag==='form'),select=nodes.find(n=>n.tag==='select'),send=nodes.find(n=>n.tag==='button');select.value='spam';
 return {form,select,send,calls,messages,submit:()=>form.onsubmit({preventDefault(){}}),get closed(){return closed;}};
}
test('report submits the selected reason once while a request is pending',async()=>{
 const f=setup(),pending=f.submit();await f.submit();assert.equal(f.calls.length,1);assert.equal(f.send.disabled,true);
 assert.equal(f.calls[0].action,'report');assert.equal(f.calls[0].args.id,'37');assert.equal(f.calls[0].args.reason,'spam');
 f.calls[0].resolve({success:true});await pending;assert.equal(f.closed,1);assert.equal(f.send.disabled,false);
});
test('report failure preserves the dialog and permits retry',async()=>{
 const f=setup();let pending=f.submit();f.calls[0].reject(new Error('Veza je prekinuta.'));await pending;
 assert.equal(f.closed,0);assert.equal(f.select.value,'spam');assert.equal(f.send.disabled,false);assert.equal(f.messages[0],'Veza je prekinuta.');
 pending=f.submit();assert.equal(f.calls.length,2);f.calls[1].resolve({success:true});await pending;assert.equal(f.closed,1);
});
