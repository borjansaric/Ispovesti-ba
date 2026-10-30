// Isolated, in-memory visual fixture. Never shipped in /test/.
import {createChatPreview} from './chat-preview.mjs';import {randomUUID} from 'node:crypto';
const stage=await createChatPreview();await stage.db.exec('reset role');
const admin=(await stage.db.query('select user_id from community_test.admins')).rows[0].user_id;
await stage.db.query("insert into auth.users(id,is_anonymous) values($1,true)",[randomUUID()]);
const seed=(await stage.db.query('select id from auth.users where is_anonymous limit 1')).rows[0].id;
await stage.db.query("select public.chat_test_dispatch($1,'profile','{}')",[seed]);
await stage.db.query("insert into chat_test.access values($1,'30d',clock_timestamp()+interval '30 days',31,'admin_trial',$2)",[seed,admin]);
for(let i=0;i<110;i++)await stage.db.query("insert into chat_test.messages(user_id,body,request_id) values($1,$2,$3)",[seed,'Lokalna poruka za provjeru skrolovanja '+i,randomUUID()]);
await stage.db.exec('set role service_role');
setInterval(async()=>{await stage.db.query("insert into chat_test.access(user_id,plan,expires_at,history_hours,source,granted_by) select user_id,'24h',clock_timestamp()+interval '24 hours',1,'admin_trial',$1 from chat_test.profiles on conflict do nothing",[admin]);},500).unref();
stage.server.listen(Number(process.env.PORT||process.argv[process.argv.indexOf('--port')+1]||3000),'0.0.0.0');
