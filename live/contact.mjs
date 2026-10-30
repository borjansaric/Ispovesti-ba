const out=document.querySelector('#public-contact'),config=window.ISPOVESTI_CONFIG||{};
try{
 const r=await fetch(config.supabaseUrl+'/functions/v1/community-live-api',{method:'POST',headers:{apikey:config.publishableKey,'Content-Type':'application/json'},body:JSON.stringify({action:'public_contact',args:{}}),cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error();const info=await r.json();out.replaceChildren();
 if(info.operator_name){const p=document.createElement('p');p.textContent='Operater: '+info.operator_name;out.append(p)}
 if(info.contact_email&&/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(info.contact_email)){const a=document.createElement('a');a.textContent=info.contact_email;a.href='mailto:'+info.contact_email;out.append(a)}else{out.append('Opšti kontakt još nije objavljen. Prijave sadržaja putem uzvičnika su dostupne.');}
}catch{out.textContent='Kontakt trenutno nije moguće učitati. Pokušaj ponovo kasnije.'}
