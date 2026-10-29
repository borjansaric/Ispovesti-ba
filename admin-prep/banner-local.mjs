// Simulated local banner only. No live advertiser creative or external tracking.
export function startLocalBanner(){
 const slot=document.querySelector('#banner-slot');if(!slot)return;let timer,visibilityTimer,observer,item=null,viewId=crypto.randomUUID();
 async function call(body){const r=await fetch('/api/local-banner',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),credentials:'same-origin'});if(!r.ok)throw Error('Banner test unavailable');return r.json()}
 async function refresh(){clearTimeout(timer);clearTimeout(visibilityTimer);observer?.disconnect();try{
  const start=Date.now(),d=await call({action:'active'});item=d.item;slot.textContent=item?'Probni oglas: '+item.name:'Probno mjesto za reklamu';
  if(item){observer=new IntersectionObserver(entries=>{clearTimeout(visibilityTimer);if(entries[0]?.intersectionRatio>=0.5&&!document.hidden&&!document.body.classList.contains('chat-open'))visibilityTimer=setTimeout(()=>{if(!document.hidden&&!document.body.classList.contains('chat-open'))void call({action:'impression',id:item.id,view_id:viewId}).catch(()=>{})},1000)},{threshold:[0.5]});observer.observe(slot)}
  const delay=Math.max(250,Date.parse(d.nextBoundary)-Date.parse(d.serverTime)-(Date.now()-start));timer=setTimeout(refresh,delay);
 }catch{slot.textContent='Probno mjesto za reklamu';timer=setTimeout(refresh,30000)}}
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh()});void refresh();
}
