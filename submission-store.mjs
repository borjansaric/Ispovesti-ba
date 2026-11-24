const DB_NAME='ispovesti-live-pending-submissions';
const DB_VERSION=1;
const STORE_NAME='pending';
let databasePromise;

function openDatabase(){
 if(!globalThis.indexedDB)return Promise.reject(new Error('Ovaj pregledač ne podržava IndexedDB. Slanje nije pokrenuto da se tekst ne bi izgubio.'));
 if(!databasePromise){
  databasePromise=new Promise((resolve,reject)=>{
   const request=globalThis.indexedDB.open(DB_NAME,DB_VERSION);
   request.onupgradeneeded=()=>{
    const db=request.result;
    if(!db.objectStoreNames.contains(STORE_NAME))db.createObjectStore(STORE_NAME,{keyPath:'requestId'});
   };
   request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>db.close();resolve(db);};
   request.onerror=()=>{databasePromise=null;reject(new Error('Ne mogu otvoriti lokalnu evidenciju nedovršenih slanja.'));};
   request.onblocked=()=>{databasePromise=null;reject(new Error('Lokalna evidencija je zauzeta u drugom prozoru. Zatvori druge kartice i pokušaj ponovo.'));};
  });
 }
 return databasePromise;
}

function runTransaction(mode,operation){
 return openDatabase().then(db=>new Promise((resolve,reject)=>{
  let result;
  let settled=false;
  const tx=db.transaction(STORE_NAME,mode);
  const fail=()=>{if(settled)return;settled=true;reject(new Error('Lokalno čuvanje nedovršenog slanja nije uspjelo.'));};
  try{
   const request=operation(tx.objectStore(STORE_NAME));
   if(request){
    request.onsuccess=()=>{result=request.result;};
    request.onerror=fail;
   }
  }catch(error){settled=true;reject(error);return;}
  tx.oncomplete=()=>{if(settled)return;settled=true;resolve(result);};
  tx.onerror=fail;
  tx.onabort=fail;
 }));
}

function validateRecord(record){
 if(!record||typeof record!=='object'||!/^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.test(String(record.requestId||'')))throw new Error('Neispravan ID nedovršenog slanja.');
 if(!['confession','comment','reply'].includes(record.kind))throw new Error('Nepoznata vrsta nedovršenog slanja.');
 if(!record.payload||typeof record.payload!=='object'||record.payload.kind!==record.kind||typeof record.payload.body!=='string')throw new Error('Nedostaje sadržaj nedovršenog slanja.');
 if(record.kind!=='confession'&&!/^\d+$/.test(String(record.payload.confession_id||'')))throw new Error('Nedostaje ispovest kojoj pripada komentar.');
 if(record.kind==='reply'&&!/^\d+$/.test(String(record.payload.parent_id||'')))throw new Error('Nedostaje glavni komentar kojem odgovor pripada.');
}

export async function savePendingSubmission(record){
 validateRecord(record);
 const safeRecord={
  requestId:String(record.requestId),
  kind:record.kind,
  context:record.context&&typeof record.context==='object'?record.context:{},
  payload:record.payload,
  createdAt:Number.isFinite(Number(record.createdAt))?Number(record.createdAt):Date.now(),
  updatedAt:Date.now(),
  schemaVersion:1
 };
 await runTransaction('readwrite',store=>store.put(safeRecord));
 return safeRecord;
}

export async function listPendingSubmissions(){
 const records=await runTransaction('readonly',store=>store.getAll());
 return (Array.isArray(records)?records:[]).sort((a,b)=>Number(a.createdAt)-Number(b.createdAt));
}

export async function deletePendingSubmission(requestId){
 if(!/^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.test(String(requestId||'')))throw new Error('Neispravan ID nedovršenog slanja.');
 await runTransaction('readwrite',store=>store.delete(String(requestId)));
}
