-- PENDING OWNER APPROVAL. Run only after backup and explicit approval.
-- Adds chat_test only. Does not alter community_test, public content or Auth accounts.
begin;
do $$ begin
 if to_regnamespace('chat_test') is not null then raise exception 'chat_test već postoji; prvo pregledati stanje.'; end if;
 if (select count(*) from community_test.admins)<>1 then raise exception 'Potreban je postojeći glavni administrator.'; end if;
end $$;
create schema chat_test;
revoke all on schema chat_test from public,anon,authenticated;
grant usage on schema chat_test to service_role;
create table chat_test.settings(singleton boolean primary key default true check(singleton),test_grants_enabled boolean not null default false);
insert into chat_test.settings values(true,false);
create table chat_test.profiles(
 user_id uuid primary key references auth.users(id),public_id uuid not null unique default gen_random_uuid(),
 generated_nickname text not null unique,avatar text not null check(avatar in ('ghost','moon','star','owl','fox','leaf','cloud','comet')),
 custom_nickname text,avatar_purchased boolean not null default false,created_at timestamptz not null default clock_timestamp()
);
create table chat_test.access(
 user_id uuid primary key references auth.users(id),plan text not null check(plan in ('24h','7d','30d')),
 expires_at timestamptz not null,history_hours integer not null check(history_hours in (1,7,31)),
 source text not null check(source='admin_trial'),granted_by uuid not null references auth.users(id),
 check(history_hours=case plan when '24h' then 1 when '7d' then 7 when '30d' then 31 end)
);
create table chat_test.nicknames(name_key text primary key,display_name text not null,user_id uuid not null unique references auth.users(id),reserved_until timestamptz not null);
create table chat_test.messages(
 id bigint generated always as identity primary key,user_id uuid not null references auth.users(id),
 body text not null check(char_length(body) between 1 and 1000),created_at timestamptz not null default clock_timestamp(),
 request_id uuid not null,removed boolean not null default false,unique(user_id,request_id)
);
create index chat_messages_time on chat_test.messages(created_at,id);
create index chat_messages_owner on chat_test.messages(user_id,created_at);
create table chat_test.blocks(user_id uuid not null references auth.users(id),blocked_id uuid not null references auth.users(id),primary key(user_id,blocked_id),check(user_id<>blocked_id));
create table chat_test.reports(message_id bigint references chat_test.messages(id) not null,user_id uuid references auth.users(id) not null,reason text not null check(reason in ('abuse','threat','spam','other')),created_at timestamptz not null default clock_timestamp(),primary key(message_id,user_id));
create table chat_test.bans(user_id uuid primary key references auth.users(id),until_at timestamptz,permanent boolean not null default false,reason text not null);
create table chat_test.recovery(user_id uuid primary key references auth.users(id),secret_hash text not null unique check(secret_hash~'^[a-f0-9]{64}$'));
create table chat_test.audit(id bigint generated always as identity primary key,admin_id uuid references auth.users(id) not null,action text not null,target text not null,created_at timestamptz not null default clock_timestamp());
create table chat_test.admin_receipts(admin_id uuid references auth.users(id) not null,request_id uuid not null,payload jsonb not null,result jsonb not null,primary key(admin_id,request_id));
do $$ declare t record;begin
 for t in select tablename from pg_tables where schemaname='chat_test' loop execute format('alter table chat_test.%I enable row level security',t.tablename);end loop;
end $$;
grant all on all tables in schema chat_test to service_role;
grant usage,select on all sequences in schema chat_test to service_role;

create function chat_test.assert_access(p_uid uuid) returns chat_test.access
language plpgsql security invoker set search_path='' as $$
declare a chat_test.access;begin
 if exists(select 1 from chat_test.bans where user_id=p_uid and (permanent or until_at>clock_timestamp())) then raise exception 'Pristup chatu je blokiran.' using errcode='42501';end if;
 select * into a from chat_test.access where user_id=p_uid;
 if not found or a.expires_at<=clock_timestamp() then raise exception 'Potreban je aktivan paket za chat.' using errcode='42501';end if;
 return a;
end $$;

create function public.chat_test_dispatch(p_uid uuid,p_action text,p_args jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
 v_profile chat_test.profiles;a chat_test.access;v_message chat_test.messages;n chat_test.nicknames;
 v_now timestamptz:=clock_timestamp();v_target uuid;v_id bigint;v_body text;v_name text;v_key text;
 v_hours integer;v_days integer;v_plan text;v_result jsonb;v_req uuid;v_saved chat_test.admin_receipts;
 v_old uuid;v_hash text;v_new_hash text;v_avatars text[]:=array['ghost','moon','star','owl','fox','leaf','cloud','comet'];
begin
 if current_user not in ('service_role','postgres') then raise exception 'Zabranjeno.' using errcode='42501';end if;
 if p_uid is null then raise exception 'Potrebna je anonimna prijava.' using errcode='28000';end if;
 if p_action not in ('profile','history','send','block','unblock','report','recovery_set','recover','admin_status','admin_profiles','admin_test_mode','admin_grant','admin_nickname','admin_avatar','admin_messages','admin_remove','admin_restore','admin_ban','admin_unban') then raise exception 'Nepoznata chat radnja.';end if;
 if p_action like 'admin_%' then
  perform community_test.assert_admin_access(p_uid,p_args->>'_session_id',p_args->>'_aal');
  if p_action='admin_status' then return jsonb_build_object('test_grants_enabled',(select test_grants_enabled from chat_test.settings where singleton));end if;
  if p_action='admin_profiles' then
   select coalesce(jsonb_agg(x),'[]'::jsonb) into v_result from (select public_id id,generated_nickname nickname,avatar from chat_test.profiles order by created_at desc limit 100) x;
   return jsonb_build_object('items',v_result);
  end if;
  if p_action='admin_test_mode' then
   update chat_test.settings set test_grants_enabled=coalesce((p_args->>'enabled')::boolean,false) where singleton;
   insert into chat_test.audit(admin_id,action,target) values(p_uid,p_action,'settings');return '{"success":true}';
  end if;
  if p_action in ('admin_grant','admin_nickname','admin_avatar') then
   if not (select test_grants_enabled from chat_test.settings where singleton) then raise exception 'Probna prava su isključena.' using errcode='42501';end if;
   v_req=(p_args->>'request_id')::uuid;if v_req is null then raise exception 'Nedostaje identifikator zahtjeva.';end if;
   perform pg_advisory_xact_lock(hashtextextended(p_uid::text,902510));
   select * into v_saved from chat_test.admin_receipts where admin_id=p_uid and request_id=v_req;
   if found then
    if v_saved.payload<>jsonb_build_object('action',p_action,'args',p_args-'_session_id'-'_aal') then raise exception 'Ponovljeni zahtjev je promijenjen.';end if;
    return v_saved.result||'{"replayed":true}'::jsonb;
   end if;
   select user_id into v_target from chat_test.profiles where public_id=(p_args->>'target')::uuid;
   if v_target is null then raise exception 'Chat nalog nije pronađen.';end if;
   perform pg_advisory_xact_lock(hashtextextended(v_target::text,902511));
   if p_action='admin_grant' then
    v_plan=p_args->>'plan';
    if v_plan not in ('24h','7d','30d') or v_plan is null then raise exception 'Nepoznat paket.';end if;
    v_days=case v_plan when '24h' then 1 when '7d' then 7 else 30 end;
    v_hours=case v_plan when '24h' then 1 when '7d' then 7 else 31 end;
    insert into chat_test.access values(v_target,v_plan,v_now+make_interval(days=>v_days),v_hours,'admin_trial',p_uid)
     on conflict(user_id) do update set plan=excluded.plan,history_hours=excluded.history_hours,expires_at=greatest(chat_test.access.expires_at,v_now)+make_interval(days=>v_days),granted_by=p_uid;
    update chat_test.nicknames set reserved_until=(select expires_at+interval '15 days' from chat_test.access where user_id=v_target) where user_id=v_target and reserved_until>v_now;
    if not found then update chat_test.profiles set custom_nickname=null where user_id=v_target;end if;
   elsif p_action='admin_nickname' then
    a=chat_test.assert_access(v_target);
    v_name=btrim(p_args->>'nickname');v_key=lower(v_name);
    if v_name is null or char_length(v_name) not between 3 and 24 or v_name!~'^[[:alnum:]_ -]+$' or v_name~'^[Aa][Nn][Oo][Nn][Ii][Mm]-' then raise exception 'Nadimak mora imati 3–24 slova, broja, razmaka ili crtice.';end if;
    perform pg_advisory_xact_lock(hashtextextended(v_key,902512));
    select * into n from chat_test.nicknames where name_key=v_key for update;
    if found and n.user_id<>v_target and n.reserved_until>v_now then raise exception 'Nadimak je rezervisan.';end if;
    if found and n.user_id<>v_target then
     update chat_test.profiles set custom_nickname=null where user_id=n.user_id;
     update chat_test.nicknames set name_key='released-'||gen_random_uuid()::text where name_key=v_key;
    end if;
    insert into chat_test.nicknames values(v_key,v_name,v_target,a.expires_at+interval '15 days')
     on conflict(user_id) do update set name_key=excluded.name_key,display_name=excluded.display_name,reserved_until=excluded.reserved_until;
    update chat_test.profiles set custom_nickname=v_name where user_id=v_target;
   else
    a=chat_test.assert_access(v_target);
    if not coalesce((p_args->>'avatar')=any(v_avatars),false) then raise exception 'Nepoznat avatar.';end if;
    update chat_test.profiles set avatar=p_args->>'avatar',avatar_purchased=true where user_id=v_target;
   end if;
   insert into chat_test.audit(admin_id,action,target) values(p_uid,p_action,p_args->>'target');
   v_result='{"success":true}'::jsonb;
   insert into chat_test.admin_receipts values(p_uid,v_req,jsonb_build_object('action',p_action,'args',p_args-'_session_id'-'_aal'),v_result);return v_result;
  end if;
  if p_action='admin_messages' then
   select coalesce(jsonb_agg(x order by x.id desc),'[]'::jsonb) into v_result from (
    select msg.id::text id,msg.body,msg.created_at,msg.removed,prof.public_id sender,prof.generated_nickname,
     (select coalesce(jsonb_agg(jsonb_build_object('reason',r.reason,'created_at',r.created_at)),'[]'::jsonb) from chat_test.reports r where r.message_id=msg.id) reports
    from chat_test.messages msg join chat_test.profiles prof on prof.user_id=msg.user_id
    where (p_args->>'before' is null or msg.id<(p_args->>'before')::bigint) order by msg.id desc limit 100) x;
   return jsonb_build_object('items',v_result);
  elsif p_action in ('admin_remove','admin_restore') then
   update chat_test.messages set removed=p_action='admin_remove' where id=(p_args->>'id')::bigint;
   if not found then raise exception 'Poruka nije pronađena.';end if;
  elsif p_action in ('admin_ban','admin_unban') then
   select user_id into v_target from chat_test.profiles where public_id=(p_args->>'target')::uuid;
   if v_target is null then raise exception 'Nalog nije pronađen.';end if;
   if exists(select 1 from community_test.admins where user_id=v_target) then raise exception 'Glavni administrator se ne može blokirati.';end if;
   if p_action='admin_unban' then update chat_test.bans set permanent=false,until_at=v_now where user_id=v_target;
   else
    v_hours=(p_args->>'hours')::integer;if v_hours is null or v_hours not between 1 and 720 then raise exception 'Trajanje blokade mora biti 1–720 sati.';end if;
    insert into chat_test.bans values(v_target,v_now+make_interval(hours=>v_hours),false,left(coalesce(p_args->>'reason','Moderacija'),200))
     on conflict(user_id) do update set until_at=excluded.until_at,permanent=false,reason=excluded.reason;
   end if;
  end if;
  insert into chat_test.audit(admin_id,action,target) values(p_uid,p_action,coalesce(p_args->>'id',p_args->>'target',''));
  return '{"success":true}';
 end if;

 if p_action='recover' then
  v_hash=p_args->>'recovery_hash';v_new_hash=p_args->>'new_recovery_hash';
  if v_hash is null or v_new_hash is null or v_hash!~'^[a-f0-9]{64}$' or v_new_hash!~'^[a-f0-9]{64}$' or v_hash=v_new_hash then raise exception 'Neispravan ključ za oporavak.';end if;
  -- One transfer at a time, including concurrent attempts using the same recovery key.
  perform pg_advisory_xact_lock(902513);
  select user_id into v_old from chat_test.recovery where secret_hash=v_hash for update;
  if v_old is null or v_old=p_uid then raise exception 'Ključ za oporavak nije važeći.';end if;
  if exists(select 1 from chat_test.access where user_id=p_uid) or exists(select 1 from chat_test.messages where user_id=p_uid) then raise exception 'Oporavak zahtijeva novi prazan anonimni chat nalog.';end if;
  if exists(select 1 from community_test.admins where user_id in (v_old,p_uid)) then raise exception 'Oporavak administratora nije dozvoljen ovim putem.';end if;
  if exists(select 1 from chat_test.profiles where user_id=p_uid) then
   raise exception 'Za oporavak otvori novi anonimni nalog prije ulaska u chat.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_old::text,902511));
  perform pg_advisory_xact_lock(hashtextextended(p_uid::text,902511));
  update chat_test.profiles set user_id=p_uid where user_id=v_old;
  update chat_test.access set user_id=p_uid where user_id=v_old;
  update chat_test.nicknames set user_id=p_uid where user_id=v_old;
  update chat_test.messages set user_id=p_uid where user_id=v_old;
  update chat_test.blocks set user_id=p_uid where user_id=v_old;
  update chat_test.blocks set blocked_id=p_uid where blocked_id=v_old;
  update chat_test.reports set user_id=p_uid where user_id=v_old;
  update chat_test.bans set user_id=p_uid where user_id=v_old;
  update chat_test.recovery set user_id=p_uid,secret_hash=v_new_hash where user_id=v_old;
  return '{"success":true}';
 end if;
 if p_action='profile' then
  insert into chat_test.profiles(user_id,generated_nickname,avatar) values(p_uid,'Anonim-'||replace(gen_random_uuid()::text,'-',''),v_avatars[1+floor(random()*8)::int]) on conflict(user_id) do nothing;
  select * into v_profile from chat_test.profiles where user_id=p_uid;
  select * into a from chat_test.access where user_id=p_uid;
  select * into n from chat_test.nicknames where user_id=p_uid and reserved_until>v_now;
  return jsonb_build_object('id',v_profile.public_id,'nickname',coalesce(n.display_name,v_profile.generated_nickname),'avatar',v_profile.avatar,'avatar_purchased',v_profile.avatar_purchased,'plan',a.plan,'expires_at',a.expires_at,'history_hours',a.history_hours,'active',a.expires_at>v_now,'nickname_reserved_until',n.reserved_until,'blocked',(select coalesce(jsonb_agg(jsonb_build_object('id',bp.public_id,'nickname',bp.generated_nickname)),'[]'::jsonb) from chat_test.blocks b join chat_test.profiles bp on bp.user_id=b.blocked_id where b.user_id=p_uid),'has_recovery',exists(select 1 from chat_test.recovery where user_id=p_uid),'server_now',v_now);
 end if;
 if p_action='recovery_set' then
  v_hash=p_args->>'recovery_hash';if v_hash is null or v_hash!~'^[a-f0-9]{64}$' then raise exception 'Neispravan ključ.';end if;
  if not exists(select 1 from chat_test.profiles where user_id=p_uid) then raise exception 'Prvo otvori chat nalog.';end if;
  insert into chat_test.recovery values(p_uid,v_hash) on conflict(user_id) do update set secret_hash=excluded.secret_hash;
  return '{"success":true}';
 end if;
 a=chat_test.assert_access(p_uid);
 if p_action='history' then
  select coalesce(jsonb_agg(x order by x.created_at,x.id),'[]'::jsonb) into v_result from (
   select msg.id::text id,msg.body,msg.created_at,prof.public_id sender,
    coalesce((select display_name from chat_test.nicknames where user_id=prof.user_id and reserved_until>v_now),prof.generated_nickname) nickname,prof.avatar
   from chat_test.messages msg join chat_test.profiles prof on prof.user_id=msg.user_id
   where not msg.removed and msg.created_at>v_now-make_interval(hours=>a.history_hours)
    and not exists(select 1 from chat_test.blocks where user_id=p_uid and blocked_id=msg.user_id)
    and (p_args->>'before' is null or msg.id<(p_args->>'before')::bigint)
   order by msg.created_at desc,msg.id desc limit 100) x;
  return jsonb_build_object('items',v_result,'server_now',v_now,'history_cutoff',v_now-make_interval(hours=>a.history_hours),'expires_at',a.expires_at);
 elsif p_action='send' then
  perform pg_advisory_xact_lock(hashtextextended(p_uid::text,902511));
  a=chat_test.assert_access(p_uid);
  v_req=(p_args->>'request_id')::uuid;v_body=btrim(p_args->>'body');
  if v_req is null or v_body is null or char_length(v_body) not between 1 and 1000 then raise exception 'Poruka mora imati 1–1000 znakova.';end if;
  if v_body~* '(https?[:：]|www\.|[[:alnum:]][[:alnum:]._-]*\.[[:alpha:]]{2,}|mailto:|ftp:|tel:)' then raise exception 'Linkovi nisu dozvoljeni.';end if;
  select * into v_message from chat_test.messages where user_id=p_uid and request_id=v_req;
  if found then if v_message.body<>v_body then raise exception 'Ponovljeni zahtjev je promijenjen.';end if;return jsonb_build_object('success',true,'id',v_message.id::text,'replayed',true);end if;
  if (select count(*) from chat_test.messages where user_id=p_uid and created_at>v_now-interval '10 seconds')>=5 or
     (select count(*) from chat_test.messages where user_id=p_uid and created_at>v_now-interval '1 minute')>=30 or
     exists(select 1 from chat_test.messages where user_id=p_uid and body=v_body and created_at>v_now-interval '1 minute') then raise exception 'Prebrzo šalješ ili ponavljaš poruku. Sačekaj malo.';end if;
  insert into chat_test.messages(user_id,body,request_id) values(p_uid,v_body,v_req) returning id into v_id;
  return jsonb_build_object('success',true,'id',v_id::text);
 elsif p_action in ('block','unblock') then
  select user_id into v_target from chat_test.profiles where public_id=(p_args->>'target')::uuid;
  if v_target is null or v_target=p_uid then raise exception 'Neispravan nalog.';end if;
  if p_action='block' then insert into chat_test.blocks values(p_uid,v_target) on conflict do nothing;
  else delete from chat_test.blocks where user_id=p_uid and blocked_id=v_target;end if;
  return '{"success":true}';
 elsif p_action='report' then
  v_id=(p_args->>'id')::bigint;
  if not exists(select 1 from chat_test.messages where id=v_id and not removed and created_at>v_now-make_interval(hours=>a.history_hours)) then raise exception 'Poruka nije dostupna.';end if;
  if p_args->>'reason' is null or p_args->>'reason' not in ('abuse','threat','spam','other') then raise exception 'Neispravan razlog prijave.';end if;
  if (select count(*) from chat_test.reports where user_id=p_uid and created_at>v_now-interval '1 hour')>=30 then raise exception 'Previše prijava. Pokušaj kasnije.';end if;
  insert into chat_test.reports(message_id,user_id,reason) values(v_id,p_uid,p_args->>'reason') on conflict do nothing;return '{"success":true}';
 end if;
 raise exception 'Nepoznata radnja.';
end $$;
revoke all on function chat_test.assert_access(uuid),public.chat_test_dispatch(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function chat_test.assert_access(uuid),public.chat_test_dispatch(uuid,text,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
