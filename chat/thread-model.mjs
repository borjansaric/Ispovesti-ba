// Stream sorted public replies while fetching independent legacy branches in bounded parallel batches.
export async function collectReplies(request,confessionId,parentId,onBatch=()=>{},cancelled=()=>false){
 const queue=[String(parentId)],seenParents=new Set(),seenItems=new Set(),items=[];
 const sorted=()=>[...items].sort((a,b)=>Date.parse(a.created_at)-Date.parse(b.created_at)||Number(a.id)-Number(b.id));
 async function load(parent){
  if(seenParents.has(parent)||cancelled())return;seenParents.add(parent);let offset=0;
  for(;;){if(cancelled())return;const r=await request('comments',{confession_id:confessionId,parent_id:parent,offset});if(cancelled())return;
   for(const item of r.items){if(seenItems.has(String(item.id)))continue;seenItems.add(String(item.id));items.push(item);if(item.has_replies)queue.push(String(item.id));}
   if(r.items.length)onBatch(sorted());offset+=r.items.length;if(r.items.length<20)break;
  }
 }
 while(queue.length&&!cancelled())await Promise.all(queue.splice(0,3).map(load));
 return sorted();
}
export const replyCounterText=n=>Number(n)>0?String(Math.floor(Number(n))):'';
