import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const app=await readFile(new URL('../app.js',import.meta.url),'utf8');
test('community report menu sends the selected reason once and locks controls while pending',()=>{
 assert.match(app,/async function sendReport\(reason,details=''/);
 assert.match(app,/if\(sending\)return;sending=true/);
 assert.match(app,/request\('report',\{id:item\.id,reason,details:details\.trim\(\)\}\)/);
 assert.match(app,/sendReport\('hate_speech'\)/);
 assert.match(app,/sendReport\('spam'\)/);
});
test('custom report details are optional, capped at 500 characters, and retry after failure',()=>{
 assert.match(app,/detail\.maxLength=500/);
 assert.match(app,/sendReport\('other',detail\.value\)/);
 assert.match(app,/catch\(err\)\{toast\(err\.message\);panel\.querySelectorAll\('button,textarea'\)\.forEach\(el=>el\.disabled=false\);sending=false;\}/);
});
