import {createChatHandler} from '../chat/gateway.mjs';
const env=(k:string)=>Deno.env.get(k)||'';
Deno.serve(createChatHandler({supabaseUrl:env('SUPABASE_URL'),serviceKey:env('SUPABASE_SERVICE_ROLE_KEY'),allowedOrigins:['https://borjansaric.github.io'],environment:'production',allowTrials:false,rpcName:'chat_live_dispatch_v2',archivePrefix:'chat_live_admin_archive',ownerAccess:true}));
