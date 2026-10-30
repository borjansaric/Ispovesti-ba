-- Glavni sajt: dodatna priprema 30.10.2026. Postojeći podaci se ne brišu.
begin;
create table chat_live.room_sides(user_id uuid primary key references auth.users(id),package_expires timestamptz not null,side text not null check(side in ('left','right')));
create table chat_live.access_codes(
 id uuid primary key,code_hash text not null unique check(code_hash~'^[a-f0-9]{64}$'),plan text not null check(plan in ('24h','7d','30d')),
 expires_at timestamptz not null,issued_by uuid not null references auth.users(id),issued_at timestamptz not null default clock_timestamp(),
 owner_id uuid unique references auth.users(id),holder_id uuid unique references auth.users(id),holder_session text,
 activated_at timestamptz,revoked boolean not null default false,transfers integer not null default 0,transfer_window timestamptz not null default clock_timestamp(),
 side text not null check(side in ('left','right')),source text not null default 'admin_trial' check(source='purchase')
);
create table chat_live.code_attempts(user_id uuid primary key references auth.users(id),window_start timestamptz not null,attempts integer not null);
create table chat_live.comment_favorites(user_id uuid references auth.users(id) not null,content_id bigint references community_live.content(id) not null,primary key(user_id,content_id));
alter table chat_live.room_sides enable row level security;
alter table chat_live.access_codes enable row level security;
alter table chat_live.code_attempts enable row level security;
alter table chat_live.comment_favorites enable row level security;
revoke all on chat_live.room_sides,chat_live.access_codes,chat_live.code_attempts,chat_live.comment_favorites from public,anon,authenticated;
grant all on chat_live.room_sides,chat_live.access_codes,chat_live.code_attempts,chat_live.comment_favorites to service_role;

create function public.chat_live_dispatch_v2(p_uid uuid,p_action text,p_args jsonb default '{}',p_session text default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare c chat_live.access_codes; a chat_live.access; v_uid uuid:=p_uid; v_now timestamptz:=clock_timestamp(); v_result jsonb; v_side text; v_id uuid; v_plan text; v_hash text; v_attempts integer; v_content bigint; v_ids bigint[]; v_json jsonb;
begin
 if p_action in ('admin_test_mode','admin_grant','admin_nickname','admin_avatar','admin_issue_code','redeem_code','recovery_set','recover') then raise exception 'Probne radnje i naplata nisu dostupni.' using errcode='42501';end if;
 if p_session is null or not exists(select 1 from auth.sessions where id::text=p_session and user_id=p_uid and (not_after is null or not_after>clock_timestamp())) then raise exception 'Prijava je istekla.' using errcode='28000';end if;
 if current_user not in ('service_role','postgres') or p_uid is null then raise exception 'Zabranjen pristup.' using errcode='42501'; end if;
 if p_action='admin_issue_code' then
  perform community_live.assert_admin_access(p_uid,p_args->>'_session_id',p_args->>'_aal');
  if not (select test_grants_enabled from chat_live.settings where singleton) then raise exception 'Probna prava su isključena.' using errcode='42501'; end if;
  v_id=(p_args->>'request_id')::uuid;v_plan=p_args->>'plan';v_hash=p_args->>'code_hash';
  if v_id is null or v_plan is null or v_plan not in ('24h','7d','30d') or v_hash is null or v_hash!~'^[a-f0-9]{64}$' then raise exception 'Neispravan probni kod.';end if;
  perform pg_advisory_xact_lock(hashtextextended(v_id::text,902601));
  select * into c from chat_live.access_codes where id=v_id;
  if found then
   if c.issued_by<>p_uid or c.plan<>v_plan or c.code_hash<>v_hash then raise exception 'Promijenjen ponovljeni zahtjev.';end if;
   return jsonb_build_object('success',true,'expires_at',c.expires_at,'replayed',true,'test_only',true);
  end if;
  insert into chat_live.access_codes(id,code_hash,plan,expires_at,issued_by,side) values(v_id,v_hash,v_plan,v_now+case v_plan when '24h' then interval '24 hours' when '7d' then interval '7 days' else interval '30 days' end,p_uid,case when random()<0.5 then 'left' else 'right' end) returning * into c;
  insert into chat_live.audit(admin_id,action,target) values(p_uid,p_action,v_id::text);
  return jsonb_build_object('success',true,'expires_at',c.expires_at,'test_only',true);
 end if;
 if p_action='redeem_code' then
  if not exists(select 1 from auth.users where id=p_uid and is_anonymous) or exists(select 1 from community_live.admins where user_id=p_uid) then raise exception 'Kod je samo za anonimni chat pristup.' using errcode='42501';end if;
  if p_session is null or not exists(select 1 from auth.sessions where id::text=p_session and user_id=p_uid and (not_after is null or not_after>v_now)) then raise exception 'Prijava je istekla.' using errcode='28000';end if;
  perform pg_advisory_xact_lock(902602);
  insert into chat_live.code_attempts values(p_uid,v_now,1) on conflict(user_id) do update set attempts=case when chat_live.code_attempts.window_start<v_now-interval '15 minutes' then 1 else chat_live.code_attempts.attempts+1 end,window_start=case when chat_live.code_attempts.window_start<v_now-interval '15 minutes' then v_now else chat_live.code_attempts.window_start end returning attempts into v_attempts;
  if v_attempts>20 then return jsonb_build_object('_http_status',429,'error','Previše pokušaja. Sačekaj 15 minuta.');end if;
  select * into c from chat_live.access_codes where code_hash=p_args->>'code_hash' for update;
  if not found or c.revoked or c.expires_at<=v_now then return jsonb_build_object('_http_status',403,'error','Kod nije važeći ili je pristup istekao.');end if;
  if exists(select 1 from chat_live.bans where user_id in (p_uid,c.owner_id) and (permanent or until_at>v_now)) then return jsonb_build_object('_http_status',403,'error','Pristup chatu je blokiran.');end if;
  if exists(select 1 from chat_live.access_codes where (owner_id=p_uid or holder_id=p_uid) and id<>c.id) then return jsonb_build_object('_http_status',403,'error','Ovaj nalog je već vezan za drugi pristupni kod.');end if;
  if c.owner_id is null then
   if exists(select 1 from chat_live.access where user_id=p_uid and expires_at>v_now) then return jsonb_build_object('_http_status',403,'error','Nalog već ima aktivan paket. Sačuvaj kod za odgovarajući nalog.');end if;
   perform public.chat_live_dispatch(p_uid,'profile','{}');
   update chat_live.access_codes set owner_id=p_uid,holder_id=p_uid,holder_session=p_session,activated_at=v_now where id=c.id returning * into c;
   insert into chat_live.access(user_id,plan,expires_at,history_hours,source,granted_by) values(p_uid,c.plan,c.expires_at,case c.plan when '24h' then 1 when '7d' then 7 else 31 end,'admin_trial',c.issued_by) on conflict(user_id) do update set plan=excluded.plan,expires_at=excluded.expires_at,history_hours=excluded.history_hours,granted_by=excluded.granted_by;
  elsif c.holder_id is distinct from p_uid or c.holder_session is distinct from p_session then
   if exists(select 1 from chat_live.access where user_id=p_uid and user_id<>c.owner_id and expires_at>v_now) then return jsonb_build_object('_http_status',403,'error','Nalog već ima drugi aktivan paket.');end if;
   if c.transfer_window<v_now-interval '24 hours' then c.transfers=0;c.transfer_window=v_now;end if;
   if c.transfers>=3 then return jsonb_build_object('_http_status',429,'error','Dostignut je dnevni broj prelazaka između uređaja.');end if;
   update chat_live.access_codes set holder_id=p_uid,holder_session=p_session,transfers=c.transfers+1,transfer_window=c.transfer_window where id=c.id returning * into c;
  end if;
  insert into chat_live.room_sides values(c.owner_id,c.expires_at,c.side) on conflict(user_id) do update set package_expires=excluded.package_expires,side=excluded.side;
  return jsonb_build_object('success',true,'expires_at',c.expires_at,'test_only',true);
 end if;
 if p_action in ('comment_meta','comment_favorite') then
  if p_action='comment_favorite' then
   v_content=(p_args->>'id')::bigint;
   if not community_live.visible(v_content) or not exists(select 1 from community_live.content where id=v_content and kind in ('comment','reply')) then raise exception 'Komentar nije dostupan.';end if;
   perform community_live.rate(p_uid,'lists',240);
   if coalesce((p_args->>'enabled')::boolean,false) then insert into chat_live.comment_favorites values(p_uid,v_content) on conflict do nothing;
   else delete from chat_live.comment_favorites where user_id=p_uid and content_id=v_content;end if;
   return '{"success":true}';
  end if;
  if jsonb_typeof(p_args->'ids')<>'array' or jsonb_array_length(p_args->'ids')>50 then raise exception 'Najviše 50 komentara.';end if;
  select array_agg(value::bigint) into v_ids from jsonb_array_elements_text(p_args->'ids');
  select coalesce(jsonb_object_agg(x.id::text,jsonb_build_object('replies',x.n,'favorite',exists(select 1 from chat_live.comment_favorites f where f.user_id=p_uid and f.content_id=x.id))),'{}'::jsonb) into v_result from (
   select c0.id,(with recursive descendants as (select id from community_live.content where parent_id=c0.id and community_live.visible(id) union all select c1.id from community_live.content c1 join descendants d on c1.parent_id=d.id where community_live.visible(c1.id)) select count(*) from descendants) n
   from community_live.content c0 where c0.id=any(v_ids) and c0.kind in ('comment','reply') and community_live.visible(c0.id)
  ) x;return v_result;
 end if;
 if p_action like 'admin_%' then
  v_result=public.chat_live_dispatch(p_uid,p_action,p_args);
  if p_action='admin_grant' then
   select user_id into v_uid from chat_live.profiles where public_id=(p_args->>'target')::uuid;
   select * into a from chat_live.access where user_id=v_uid;
   insert into chat_live.room_sides values(v_uid,a.expires_at,case when random()<0.5 then 'left' else 'right' end) on conflict(user_id) do update set package_expires=excluded.package_expires,side=excluded.side where chat_live.room_sides.package_expires<>excluded.package_expires;
  end if;return v_result;
 end if;
 -- An SMS lease never grants Auth or admin rights, and the old session loses chat access.
 if exists(select 1 from chat_live.bans where user_id=p_uid and (permanent or until_at>v_now)) then raise exception 'Pristup chatu je blokiran.' using errcode='42501';end if;
 select * into c from chat_live.access_codes where holder_id=p_uid or owner_id=p_uid order by (holder_id=p_uid) desc limit 1;
 if found then
  if not exists(select 1 from auth.sessions where id::text=p_session and user_id=p_uid and (not_after is null or not_after>v_now)) then raise exception 'Prijava je istekla.' using errcode='28000';end if;
  if c.revoked or c.expires_at<=v_now or c.holder_id<>p_uid or c.holder_session is distinct from p_session then raise exception 'Pristup je istekao ili je kod aktiviran u drugoj sesiji.' using errcode='42501';end if;
  if p_action in ('recover','recovery_set') then raise exception 'Za ovaj pristup ponovo unesi SMS kod.' using errcode='42501';end if;
  v_uid=c.owner_id;
 end if;
 if p_action='recover' and exists(select 1 from chat_live.recovery r join chat_live.access_codes ac on ac.owner_id=r.user_id where r.secret_hash=p_args->>'recovery_hash') then raise exception 'Za ovaj pristup koristi SMS kod.' using errcode='42501';end if;
 v_result=public.chat_live_dispatch(v_uid,p_action,p_args);
 if p_action in ('profile','history') then
  select * into a from chat_live.access where user_id=v_uid;
  if a.user_id is not null then
   insert into chat_live.room_sides values(v_uid,a.expires_at,case when random()<0.5 then 'left' else 'right' end) on conflict(user_id) do update set package_expires=excluded.package_expires,side=excluded.side where chat_live.room_sides.package_expires<>excluded.package_expires;
   select side into v_side from chat_live.room_sides where user_id=v_uid;
  end if;
  v_result=v_result||jsonb_build_object('side',v_side,'sms_access',c.id is not null);
 end if;
 return v_result;
end $$;
revoke all on function public.chat_live_dispatch_v2(uuid,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.chat_live_dispatch_v2(uuid,text,jsonb,text) to service_role;
notify pgrst,'reload schema';
commit;
