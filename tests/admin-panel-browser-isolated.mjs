import assert from 'node:assert/strict';import {randomBytes} from 'node:crypto';import {chromium} from 'playwright';import {createChatPreview} from '../scripts/chat-preview.mjs';
const key=randomBytes(32).toString('hex'),stage=await createChatPreview({ownerKey:key});await new Promise(r=>stage.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+stage.server.address().port,browser=await chromium.launch({headless:true});
try{let slot=0;for(const viewport of [{width:390,height:844},{width:1366,height:768}]){
 const page=await browser.newPage({viewport});await page.goto(base+'/');await page.waitForTimeout(300);await page.goto(base+'/chat-admin.html');await page.locator('#chat-owner-key').fill(key);await page.locator('#chat-owner-login button').click();await page.locator('#chat-admin-tools').waitFor({state:'visible'});
 await page.getByRole('heading',{name:'Probna statistika'}).waitFor();await page.getByRole('button',{name:'Osvježi statistiku'}).click();await page.getByText(/Posjete.*Pregledi/).first().waitFor();
 await page.getByRole('heading',{name:'Probna arhiva chata'}).waitFor();await page.getByRole('button',{name:'Pretraži'}).click();await page.getByText('Nema rezultata.').waitFor();
 const ad=page.locator('section').filter({has:page.getByRole('heading',{name:'Probni reklamni termini'})});await ad.locator('[name=name]').fill('Probni oglašivač '+slot);await ad.locator('[name=month]').fill('2026-11');await ad.locator('[name=slot]').selectOption(String(slot++));await ad.getByRole('button',{name:'Sačuvaj probni zakup'}).click();await ad.getByText('Probni zakup je sačuvan.').waitFor();
 const entry=page.getByRole('button',{name:'Uđi anonimno u probni chat'});await entry.click();await page.getByText(/Probni anonimni pristup je spreman/).waitFor();
 assert.ok(await page.locator('#chat-admin-tools').isVisible());await page.close();
 }console.log('PASS isolated admin panel browser flow on mobile and desktop (local owner-key authentication, simulated data).')
}finally{await browser.close();await stage.close()}
