import {recoveryRequest} from './client.mjs';
import {captchaToken,releaseCaptcha} from '../captcha.js?v=room2';
const c=window.ISPOVESTI_CONFIG||{},login=document.querySelector('#login');
if(['live-test','live'].includes(c.mode)&&login){
 const toggle=document.createElement('button');toggle.type='button';toggle.className='text-button';toggle.textContent='Zaboravljena lozinka?';toggle.id='forgot-password';
 const section=document.createElement('section');section.hidden=true;
 const form=document.createElement('form');form.className='form';
 const label=document.createElement('label');label.textContent='Potvrđeni administratorski e-mail';const input=document.createElement('input');input.type='email';input.autocomplete='email';input.required=true;input.maxLength=254;label.append(input);
 const host=document.createElement('div'),button=document.createElement('button');button.className='text-button';button.type='submit';button.textContent='Pošalji link za oporavak';
 const info=document.createElement('p');info.className='hint';info.textContent='Link važi 10 minuta i koristi se jednom. Poslije promjene potrebna je nova prijava lozinkom i e-mail kodom.';
 const result=document.createElement('p');result.setAttribute('role','status');form.append(label,host,button);section.append(info,form,result);login.append(toggle,section);
 toggle.onclick=()=>{section.hidden=!section.hidden;if(section.hidden)releaseCaptcha(host);else input.focus();};
 let busy=false;form.onsubmit=async e=>{e.preventDefault();if(busy)return;busy=true;button.disabled=true;try{
  const sitekey=c.recoverySitekey||(c.mode==='live'?(await (await import('../api.js?v=room2')).request('captcha_config')).sitekey:null);
  if(!sitekey)throw Error('Probni oporavak još nije aktiviran na serveru. Postojeća prijava radi kao i ranije.');
  const captcha_token=await captchaToken({sitekey,action:'admin_recovery',host});
  result.textContent=(await recoveryRequest({action:'request',email:input.value.trim(),captcha_token})).message;
 }catch(e){result.textContent=e.message;}finally{busy=false;button.disabled=false;}};
}
