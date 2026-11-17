import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql=readFileSync(new URL('../supabase/migrations/20261117180000_emoji_reactions_test.sql',import.meta.url),'utf8');
const lockSql=readFileSync(new URL('../supabase/migrations/20261117181500_emoji_reaction_lock_to_vote_window_test.sql',import.meta.url),'utf8');
const ruleSql=readFileSync(new URL('../supabase/migrations/20261117201000_emoji_reaction_first_choice_once_test.sql',import.meta.url),'utf8');
const app=readFileSync(new URL('../test/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../test/styles.css',import.meta.url),'utf8');

test('emoji reactions are stored separately in the isolated test schema',()=>{
 assert.match(sql,/community_test\.reactions/);
 assert.match(sql,/primary key \(content_id,user_id\)/i);
 assert.match(sql,/community_test\.visible\(v_id\)/);
 assert.doesNotMatch(sql,/community_live\./);
});

test('first emoji choice starts a ten-minute window and permits only one change',()=>{
 assert.match(ruleSql,/first_reacted_at \+ interval '10 minutes'/);
 assert.match(ruleSql,/change_used boolean not null default false/);
 assert.match(ruleSql,/if v_row\.change_used then/);
 assert.match(ruleSql,/set emoji=v_emoji,updated_at=clock_timestamp\(\),change_used=true/);
 assert.doesNotMatch(ruleSql,/first_voted_at/);
 assert.match(sql,/❤️.*😂.*😢.*😮.*🤗.*😡/s);
});

test('picker explains the one permitted change and stats are requested by long press',()=>{
 assert.match(app,/async function showReactionPicker/);
 assert.doesNotMatch(app,/\basync\s+async\b/);
 assert.match(app,/request\('reaction'/);
 assert.match(app,/pointerdown/);
 assert.match(app,/showReactionStats\(item\)/);
 assert.match(app,/request\('reaction_status'/);
 assert.match(app,/izmjenu iskorištena/);
 assert.match(app,/prvom izboru/);
 assert.match(app,/function voteControls/);
 assert.match(app,/row\.append\(voteControls\(item\)/);
 assert.match(app,/row\.append\(voteControls\(item\),/);
});

test('reaction picker and statistics keep the black-and-gold UI',()=>{
 assert.match(css,/\.reaction-picker/);
 assert.match(css,/\.reaction-statistics/);
});
