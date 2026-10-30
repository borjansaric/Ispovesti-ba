import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('free base site includes no rewarded imports, quota enforcement or active ad requests',async()=>{
 for(const path of ['index.html','app.js','api.js','chat/client.mjs']){const source=await read(path);assert.doesNotMatch(source,/ads\/rewards|reserveReward|reward_policy|applixir|googlesyndication/);}
 assert.match(await read('app.js'),/objavljivanje ispovijesti, komentari, odgovori i glasanje su besplatni/);
 assert.match(await read('index.html'),/id="banner-slot"[^>]*aria-label="Probno mjesto za reklamu"/);
 assert.equal(await read('original.css'),await read('dist/original.css'));assert.equal(await read('styles.css'),await read('dist/styles.css'));
});
