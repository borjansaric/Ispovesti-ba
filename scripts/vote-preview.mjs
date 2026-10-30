// Disposable local QA only. Applies pending vote SQL to an in-memory database.
import {createChatPreview} from './chat-preview.mjs';import {readFile} from 'node:fs/promises';
const stage=await createChatPreview();await stage.db.exec('reset role');await stage.db.exec(await readFile(new URL('../supabase/one-vote-change-test.sql',import.meta.url),'utf8'));await stage.db.exec('set role service_role');
const args=process.argv.slice(2),i=args.indexOf('--port');stage.server.listen(Number(process.env.PORT||(i>=0?args[i+1]:3000)),'0.0.0.0');
