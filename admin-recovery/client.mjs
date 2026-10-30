export async function recoveryRequest(payload){
 const c=window.ISPOVESTI_CONFIG||{};
 if(!['live-test','live'].includes(c.mode))throw Error('Oporavak je pripremljen isključivo za /test/.');
 const response=await fetch(c.supabaseUrl+'/functions/v1/'+(c.mode==='live'?'admin-recovery-live-api':'admin-recovery-test-api'),{method:'POST',headers:{apikey:c.publishableKey,'Content-Type':'application/json'},body:JSON.stringify(payload),cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(45000)});
 const result=await response.json();if(!response.ok)throw Error(result.error||'Oporavak trenutno nije dostupan.');return result;
}
export function takeRecoveryToken(location,history){const params=new URLSearchParams(location.hash.slice(1)),token=params.get('token');history.replaceState(null,'',location.pathname);return typeof token==='string'&&/^[A-Za-z0-9_-]{43}$/.test(token)?token:null;}
