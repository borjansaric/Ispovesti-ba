import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';
test('isolated advertising records reject double bookings and protect admin records',async()=>{
 const db=new PGlite();try{
  await db.exec('create role anon;create role authenticated;create role service_role bypassrls;');
  await db.exec(await readFile(new URL('../admin-prep/advertising-isolated.sql',import.meta.url),'utf8'));
  const owner='00000000-0000-4000-8000-000000000001',a='00000000-0000-4000-8000-000000000002',b='00000000-0000-4000-8000-000000000003';
  await db.query('insert into admin_ad_probe.advertisers values ($1,$2)',[owner,'Primjer']);
  await db.query('insert into admin_ad_probe.bookings(id,advertiser_id,month,slot) values ($1,$2,$3,$4)',[a,owner,'2026-10-01',0]);
  assert.equal((await db.query('select price_fening from admin_ad_probe.bookings')).rows[0].price_fening,10000);
  await assert.rejects(db.query('insert into admin_ad_probe.bookings(id,advertiser_id,month,slot) values ($1,$2,$3,$4)',[b,owner,'2026-10-01',0]));
  await assert.rejects(db.query('insert into admin_ad_probe.bookings(id,advertiser_id,month,slot) values ($1,$2,$3,$4)',[b,owner,'2026-10-02',1]));
  await assert.rejects(db.query('insert into admin_ad_probe.bookings(id,advertiser_id,month,slot) values ($1,$2,$3,$4)',[b,owner,'2026-10-01',34]));
  for(const role of ['anon','authenticated']){const {rows}=await db.query("select has_schema_privilege($1,'admin_ad_probe','USAGE') permitted",[role]);assert.equal(rows[0].permitted,false)}
 }finally{await db.close()}
});
