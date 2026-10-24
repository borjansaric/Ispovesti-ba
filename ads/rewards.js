import {randomId} from './ids.js';
// Browser-memory simulation only. This ledger never grants server permissions.
export const KINDS=Object.freeze(['confession','comment','reply']);
const kindOf=kind=>{if(!KINDS.includes(kind))throw Error('Nepoznata vrsta otključavanja.');return kind;};
export class DemoRewards{
 #balances={confession:0,comment:0,reply:0};#events=new Set();#holds=new Map();#listeners=new Set();
 constructor({demo=false}={}){if(demo!==true)throw Error('Probne nagrade nisu dozvoljene u stvarnom režimu.');}
 balance(kind){kindOf(kind);return this.#balances[kind]-[...this.#holds.values()].filter(h=>h.kind===kind).length;}
 subscribe(fn){this.#listeners.add(fn);return()=>this.#listeners.delete(fn);}
 #notify(){for(const fn of this.#listeners)try{fn();}catch{}}
 grant({id,kind,provider,completed}){kindOf(kind);if(provider!=='mock'||completed!==true||typeof id!=='string'||!id)throw Error('Nema potvrđene probne nagrade.');if(this.#events.has(id))return false;this.#events.add(id);this.#balances[kind]++;this.#notify();return true;}
 reserve(kind){kindOf(kind);if(this.balance(kind)<1)throw Error('Nema probnog otključavanja. Možeš izabrati besplatno slanje.');const id=randomId();this.#holds.set(id,{kind});this.#notify();return id;}
 commit(ticket,submissionId){const h=this.#holds.get(ticket);if(!h)return false;if(!submissionId)throw Error('Objava nije potvrđena.');this.#holds.delete(ticket);this.#balances[h.kind]--;this.#notify();return true;}
 release(ticket){const removed=this.#holds.delete(ticket);if(removed)this.#notify();return removed;}
}
export class DemoAd{
 #active=null;
 constructor({durationMs=5000,now=()=>performance.now(),visible=()=>!document.hidden,schedule=(fn,ms)=>setInterval(fn,ms),cancel=id=>clearInterval(id)}={}){this.durationMs=durationMs;this.now=now;this.visible=visible;this.schedule=schedule;this.cancel=cancel;}
 play({kind,signal,onProgress=()=>{}}){
  kindOf(kind);if(this.#active)throw Error('Jedna reklama je već u toku.');if(signal?.aborted)return Promise.reject(new DOMException('Prekinuto','AbortError'));
  return new Promise((resolve,reject)=>{
   const id=randomId();let elapsed=0,last=this.now(),done=false,timer;
   const finish=(result,error)=>{if(done)return;done=true;this.cancel(timer);signal?.removeEventListener('abort',abort);this.#active=null;error?reject(error):resolve(result);};
   const abort=()=>finish(null,new DOMException('Prekinuto','AbortError'));this.#active=id;signal?.addEventListener('abort',abort,{once:true});
   timer=this.schedule(()=>{const time=this.now();if(this.visible())elapsed+=Math.max(0,Math.min(time-last,300));last=time;onProgress(Math.min(elapsed/this.durationMs,1));if(elapsed>=this.durationMs)finish({id,kind,provider:'mock',completed:true});},250);
  });
 }
}
// No real provider is enabled in this preparation. Never accept client reward claims on a server.
export function productionAdsUnavailable(){throw new Error('Stvarne reklamne mreže još nisu povezane.');}
