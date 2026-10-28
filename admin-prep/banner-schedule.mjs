// Pure scheduling logic, not connected to production, billing, tracking or chat.
const fmt=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Sarajevo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
export function currentSlot(now){
 const date=new Date(now);if(!Number.isFinite(date.getTime()))throw new Error('Invalid date');
 const p=Object.fromEntries(fmt.formatToParts(date).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
 const minutes=Number(p.hour)*60+Number(p.minute);
 const localDate=`${p.year}-${p.month}-${p.day}`;
 return Object.freeze({localDate,month:`${p.year}-${p.month}`,slot:minutes>=420?Math.floor((minutes-420)/30):null});
}
export function selectBanner(now,bookings){
 const {slot,month}=currentSlot(now);if(slot===null)return null;
 const matches=bookings.filter(b=>b.slot===slot&&b.month===month);
 if(matches.length>1)throw new Error('Overlapping ad bookings');
 return matches[0]??null;
}
export function validateBooking(b){
 if(!b||!Number.isInteger(b.slot)||b.slot<0||b.slot>=34||!/^\d{4}-(0[1-9]|1[0-2])$/.test(b.month)||!Number.isSafeInteger(b.priceFening)||b.priceFening<0||typeof b.advertiserId!=='string'||!b.advertiserId.trim())throw new Error('Invalid booking');
 return true;
}
export function addBooking(bookings,booking){
 validateBooking(booking);if(bookings.some(b=>b.month===booking.month&&b.slot===booking.slot))throw new Error('Overlapping ad bookings');
 return [...bookings,Object.freeze({...booking})];
}
