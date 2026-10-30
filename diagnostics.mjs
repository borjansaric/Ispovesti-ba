// Volatile, coarse error counters only. No visitor IDs, text, URL, stack, storage or remote reporting.
const events=[];
export function recordDiagnostic(code){if(!['client_error','unhandled_promise','resource_error'].includes(code))return;events.push({code,minute:Math.floor(Date.now()/60000),build:'release12'});if(events.length>30)events.shift();}
export const getDiagnostics=()=>events.map(e=>({...e}));
if(typeof window!=='undefined'){window.addEventListener('error',e=>recordDiagnostic(e.target&&e.target!==window?'resource_error':'client_error'),true);window.addEventListener('unhandledrejection',()=>recordDiagnostic('unhandled_promise'));}
