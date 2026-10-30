// Isolated preparation: caller must authenticate and authorize the administrator before reading.
// Storage, collection, identity generation and retention are intentionally not connected here.
const format=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Sarajevo',year:'numeric',month:'2-digit',day:'2-digit'});
const hourFormat=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Sarajevo',hour:'2-digit',hourCycle:'h23'});
function dayOf(date){return format.format(new Date(date));}
function monday(day){const d=new Date(day+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));return d.toISOString().slice(0,10);}
function dateOf(value){const n=Date.parse(value);if(!Number.isFinite(n))throw Error('Invalid event time');return n;}
export function summarize(events,{now=new Date(),section,activeWindowMs=300000}={}){
 if(!['site','chat'].includes(section))throw Error('Invalid section');
 const nowMs=new Date(now).getTime();if(!Number.isFinite(nowMs))throw Error('Invalid current time');
 const today=dayOf(nowMs),week=monday(today),month=today.slice(0,7);
 const days=new Map(),hours=Array(24).fill(0),visitors={day:new Set(),week:new Set(),month:new Set(),active:new Set()};let visits=0,views=0,messages=0;
 for(const e of events){
  if(e.section!==section)continue;
  if(!['visit','view','heartbeat','message'].includes(e.type)||typeof e.visitor!=='string'||!e.visitor||e.visitor.length>128)throw Error('Invalid event');
  const t=dateOf(e.at);if(t>nowMs)continue;const day=dayOf(t),row=days.get(day)||{date:day,visits:0,views:0,messages:0};
  if(e.type==='visit'){visits++;row.visits++;hours[Number(hourFormat.format(new Date(t)))]++;}if(e.type==='view'){views++;row.views++;}if(e.type==='message'){messages++;row.messages++;}days.set(day,row);
  if(e.type!=='message'){if(day===today)visitors.day.add(e.visitor);if(day>=week&&day<=today)visitors.week.add(e.visitor);if(day.slice(0,7)===month)visitors.month.add(e.visitor);}
  if(e.type==='heartbeat'&&t>nowMs-activeWindowMs)visitors.active.add(e.visitor);
 }
 return {section,visits,views,messages,estimatedUnique:{day:visitors.day.size,week:visitors.week.size,month:visitors.month.size},activeEstimate:visitors.active.size,history:[...days.values()].sort((a,b)=>a.date.localeCompare(b.date)),activityByHour:hours};
}
