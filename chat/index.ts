import {createChatHandler} from './gateway.mjs';
Deno.serve(createChatHandler({
 supabaseUrl:Deno.env.get('SUPABASE_URL')!,serviceKey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
 allowedOrigins:(Deno.env.get('ALLOWED_ORIGINS')||'https://borjansaric.github.io').split(','),
 environment:'test',allowTrials:Deno.env.get('CHAT_TEST_GRANTS_ENABLED')==='true',
}));
