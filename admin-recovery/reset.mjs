import {recoveryRequest,takeRecoveryToken} from './client.mjs';
let token=takeRecoveryToken(location,history),busy=false;
const form=document.querySelector('#reset-form'),status=document.querySelector('#recovery-status'),password=document.querySelector('#new-password'),confirm=document.querySelector('#repeat-password');
if(!token){form.hidden=true;status.textContent='Link nije ispravan ili je već uklonjen iz ovog prozora. Zatraži novi link na administratorskoj prijavi.';}
form.onsubmit=async e=>{e.preventDefault();if(busy||!token)return;if(password.value!==confirm.value){status.textContent='Lozinke se ne podudaraju.';return;}busy=true;e.submitter.disabled=true;
try{const result=await recoveryRequest({action:'complete',token,password:password.value});token=null;form.hidden=true;status.textContent=result.message;}
catch(e){status.textContent=e.message+' Ako je promjena možda započela, ne ponavljaj slanje.';token=null;form.hidden=true;}
finally{password.value='';confirm.value='';busy=false;}};
window.addEventListener('pagehide',()=>{token=null;password.value='';confirm.value='';});
