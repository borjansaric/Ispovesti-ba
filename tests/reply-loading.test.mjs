import {test} from 'node:test';
import assert from 'node:assert/strict';
import {collectReplies} from '../chat/thread-model.mjs';
const row=(id,more=false)=>({id:String(id),created_at:new Date(id*1000).toISOString(),has_replies:more});
test('first replies render before a slow descendant; independent branches run together',async()=>{
 let release,started=[],batches=[];const slow=new Promise(r=>release=r);
 const request=async(_,a)=>{started.push(a.parent_id);if(a.parent_id==='1')return {items:[row(2,true),row(3,true)]};if(a.parent_id==='2'){await slow;return {items:[row(4)]};}return {items:[row(5)]};};
 const pending=collectReplies(request,'100','1',items=>batches.push(items.map(x=>x.id)));
 await new Promise(r=>setImmediate(r));assert.deepEqual(batches[0],['2','3']);assert.ok(started.includes('2')&&started.includes('3'));assert.ok(batches.some(b=>b.includes('5')));release();assert.deepEqual((await pending).map(x=>x.id),['2','3','4','5']);
});
test('pagination preserves all unique descendants in chronological order',async()=>{
 const first=Array.from({length:20},(_,i)=>row(i+2,i===0));
 const items=await collectReplies(async(_,a)=>({items:a.parent_id==='1'?(a.offset?[row(22)]:first):[row(2),row(50)]}),'100','1');assert.equal(items.length,22);assert.equal(new Set(items.map(x=>x.id)).size,22);assert.equal(items.at(-1).id,'50');
});
test('closing stops further pages and suppresses late batches',async()=>{
 let stopped=false,calls=0,batches=0;const items=await collectReplies(async()=>{calls++;return {items:Array.from({length:20},(_,i)=>row(i+2,true))};},'100','1',()=>{batches++;stopped=true;},()=>stopped);assert.equal(calls,1);assert.equal(batches,1);assert.equal(items.length,20);
});
