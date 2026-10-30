import {authClient} from '../api.js?v=release12';
import {chatRequest} from '../chat/client.mjs?v=room2';
import {mountArchive} from '../admin-prep/archive-ui.mjs';
const status=document.querySelector('#chat-admin-status'),tools=document.querySelector('#chat-admin-tools'),sb=authClient(true);
try{
 await chatRequest('admin_status',{},true);tools.hidden=false;status.textContent='Zaštićena administracija chata.';
 mountArchive(tools,{title:'Cijela istorija chata',moderate:chatRequest,request:(body)=>chatRequest(body.action==='context'?'admin_context':'admin_archive',body.action==='context'?{id:body.id}:{filters:body.filters},true)});
 document.querySelector('#owner-enter').onclick=async e=>{const button=e.currentTarget;button.disabled=true;try{const anonymous=authClient();let {data,error}=await anonymous.auth.getSession();if(error)throw error;if(!data.session){const signed=await anonymous.auth.signInAnonymously();if(signed.error)throw signed.error;data=signed.data}await chatRequest('admin_owner_access',{anonymous_token:data.session.access_token},true);status.textContent='Anonimni pristup je spreman. Otvori chat na početnoj stranici.'}catch(err){status.textContent=err.message}finally{button.disabled=false}};
}catch{tools.hidden=true;status.textContent='Prvo se prijavi u administratorski panel lozinkom i kodom sa e-maila.'}
document.querySelector('#chat-logout').onclick=async()=>{await sb.auth.signOut({scope:'local'});tools.hidden=true;location.replace('admin.html')};
