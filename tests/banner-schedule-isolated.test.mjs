import {test} from 'node:test';import assert from 'node:assert/strict';import {currentSlot,selectBanner,addBooking} from '../admin-prep/banner-schedule.mjs';
test('Sarajevo slots start at 07:00 and end at midnight across summer and winter',()=>{
 for(const [before,start,last,after] of [['2026-07-01T04:59:59Z','2026-07-01T05:00:00Z','2026-07-01T21:59:59Z','2026-07-01T22:00:00Z'],['2026-12-01T05:59:59Z','2026-12-01T06:00:00Z','2026-12-01T22:59:59Z','2026-12-01T23:00:00Z']]){assert.equal(currentSlot(before).slot,null);assert.equal(currentSlot(start).slot,0);assert.equal(currentSlot(last).slot,33);assert.equal(currentSlot(after).slot,null)}
});
test('a booking applies every day in its calendar month, and clashes are rejected',()=>{
 const b={month:'2026-10',slot:3,advertiserId:'example',priceFening:10000};const all=addBooking([],b);assert.equal(selectBanner('2026-10-02T06:30:00Z',all).advertiserId,'example');assert.equal(selectBanner('2026-10-30T07:30:00Z',all).advertiserId,'example');assert.equal(selectBanner('2026-11-01T07:30:00Z',all),null);assert.throws(()=>addBooking(all,b),/Overlapping/);assert.throws(()=>addBooking([],{...b,slot:34}),/Invalid/);
});
test('slot changes exactly at half hour and no paid ad is selected at night',()=>{const all=addBooking([],{month:'2026-10',slot:0,advertiserId:'a',priceFening:10000});assert.ok(selectBanner('2026-10-27T06:29:59Z',all));assert.equal(selectBanner('2026-10-27T06:30:00Z',all),null);assert.equal(selectBanner('2026-10-27T02:00:00Z',all),null)});
