import {test} from 'node:test';import assert from 'node:assert/strict';import {summarize} from '../admin-prep/metrics-core.mjs';
test('unique visitors, visits, page views and online users remain distinct and separated by section',()=>{
 const at='2026-10-29T12:00:00Z',event=(type,visitor,section='site',time=at)=>({type,visitor,section,at:time});
 const events=[event('visit','a'),event('visit','a'),event('view','a'),event('heartbeat','a'),event('heartbeat','a'),event('visit','b'),event('heartbeat','b','site','2026-10-29T11:40:00Z'),event('visit','c','chat'),event('message','c','chat')];
 const site=summarize(events,{now:'2026-10-29T12:02:00Z',section:'site'});assert.equal(site.visits,3);assert.equal(site.views,1);assert.equal(site.estimatedUnique.day,2);assert.equal(site.activeEstimate,1);assert.equal(site.messages,0);
 const chat=summarize(events,{now:'2026-10-29T12:02:00Z',section:'chat'});assert.equal(chat.visits,1);assert.equal(chat.messages,1);assert.equal(chat.estimatedUnique.day,1);
});
test('days use Sarajevo time, week starts Monday and future events do not count',()=>{
 const events=[{section:'site',type:'visit',visitor:'a',at:'2026-10-28T23:30:00Z'},{section:'site',type:'view',visitor:'b',at:'2026-10-30T12:00:00Z'}];
 const r=summarize(events,{now:'2026-10-29T00:00:00Z',section:'site'});assert.equal(r.history[0].date,'2026-10-29');assert.equal(r.estimatedUnique.day,1);assert.equal(r.views,0);
});
