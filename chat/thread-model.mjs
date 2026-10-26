// Flatten reply trees without recursive DOM indentation. All pages use the existing visible-content API.
export async function collectReplies(request,confessionId,parentId){
 const queue=[String(parentId)],seenParents=new Set(),seenItems=new Set(),items=[];
 while(queue.length){const parent=queue.shift();if(seenParents.has(parent))continue;seenParents.add(parent);let offset=0;
  for(;;){const r=await request('comments',{confession_id:confessionId,parent_id:parent,offset});for(const item of r.items){if(seenItems.has(String(item.id)))continue;seenItems.add(String(item.id));items.push(item);if(item.has_replies)queue.push(String(item.id));}offset+=r.items.length;if(r.items.length<20)break;}
 }
 return items.sort((a,b)=>Date.parse(a.created_at)-Date.parse(b.created_at)||Number(a.id)-Number(b.id));
}
export const replyCounterText=n=>Number(n)>0?String(Math.floor(Number(n))):'';
