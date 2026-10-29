// Isolated, in-memory preparation. A verified administrator-only server must enforce access.
export function snapshotMessage({id,body,createdAt,authorId,nickname,avatar}){
 if(!Number.isSafeInteger(id)||id<1||typeof body!=='string'||body.length<1||body.length>1000||!Number.isFinite(Date.parse(createdAt))||typeof authorId!=='string'||!authorId||typeof nickname!=='string'||!nickname||typeof avatar!=='string'||!avatar)throw Error('Invalid message snapshot');
 return Object.freeze({id,body,createdAt,authorId,nickname,avatar});
}
export function searchArchive(messages,{text='',authorId='',status='all',from=null,to=null,limit=100}={}){
 if(!['all','active','reported','removed'].includes(status)||!Number.isInteger(limit)||limit<1||limit>100)throw Error('Invalid search');
 const start=from===null?-Infinity:Date.parse(from),end=to===null?Infinity:Date.parse(to);if(Number.isNaN(start)||Number.isNaN(end)||start>end)throw Error('Invalid time range');
 return messages.filter(m=>{const t=Date.parse(m.createdAt),s=m.removed?'removed':m.reports?.length?'reported':'active';return t>=start&&t<=end&&(!authorId||m.authorId===authorId)&&m.body.toLocaleLowerCase().includes(text.toLocaleLowerCase())&&(status==='all'||s===status)}).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)||b.id-a.id).slice(0,limit);
}
export function reportContext(messages,id,radius=3){
 if(!Number.isInteger(radius)||radius<0||radius>10)throw Error('Invalid context');
 const sorted=[...messages].sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt)||a.id-b.id);const index=sorted.findIndex(m=>m.id===id);if(index<0)throw Error('Message missing');
 return sorted.slice(Math.max(0,index-radius),index+radius+1);
}
