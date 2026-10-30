// Test preview only; no IP address, message, or account identifier is sent.
const key='ispovesti_local_analytics_id';let visitor=sessionStorage.getItem(key);if(!visitor){visitor=crypto.randomUUID();sessionStorage.setItem(key,visitor)}
export function track(section,type){if(document.hidden&&type==='heartbeat')return;void fetch('/api/local-metrics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({section,type,visitor}),credentials:'same-origin',keepalive:true}).catch(()=>{})}
export function begin(section){track(section,'visit');track(section,'view');track(section,'heartbeat');const timer=setInterval(()=>track(section,'heartbeat'),60000);return ()=>clearInterval(timer)}
