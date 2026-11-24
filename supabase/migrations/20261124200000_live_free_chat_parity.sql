-- Match the preview's free shared chat on live while preserving active purchased/owner access.
-- Prepared only; this migration has NOT been applied to Supabase.

alter table chat_live.settings
  add column if not exists free_chat_enabled boolean not null default false;

update chat_live.settings
set free_chat_enabled=true
where singleton=true;

alter table chat_live.access drop constraint if exists access_plan_check;
alter table chat_live.access add constraint access_plan_check
  check (plan in ('24h','7d','30d','free'));

alter table chat_live.access drop constraint if exists access_source_check;
alter table chat_live.access add constraint access_source_check
  check (source in ('purchase','owner','free_access'));

alter table chat_live.access drop constraint if exists access_check;
alter table chat_live.access add constraint access_check
  check (history_hours = case plan
    when '24h' then 1
    when '7d' then 7
    when '30d' then 31
    when 'free' then 31
    else null
  end);

do $migration$
declare
  v_definition text;
begin
  v_definition := pg_get_functiondef('public.chat_live_dispatch(uuid,text,jsonb)'::regprocedure);

  v_definition := replace(
    v_definition,
    $old$  select * into v_profile from chat_live.profiles where user_id=p_uid;
  select * into a from chat_live.access where user_id=p_uid;$old$,
    $new$  select * into v_profile from chat_live.profiles where user_id=p_uid;
  if (select free_chat_enabled from chat_live.settings where singleton) then
    insert into chat_live.access(user_id,plan,expires_at,history_hours,source,granted_by)
    values(p_uid,'free','infinity'::timestamptz,31,'free_access',p_uid)
    on conflict(user_id) do update
      set plan='free',expires_at='infinity'::timestamptz,history_hours=31,source='free_access',granted_by=p_uid
      where chat_live.access.source='free_access' or chat_live.access.expires_at<=v_now;
  end if;
  select * into a from chat_live.access where user_id=p_uid;$new$
  );

  v_definition := replace(
    v_definition,
    $old$msg.created_at>v_now-make_interval(hours=>a.history_hours)$old$,
    $new$msg.created_at>v_now-interval '100 years'$new$
  );
  v_definition := replace(
    v_definition,
    $old$created_at>v_now-make_interval(hours=>a.history_hours)$old$,
    $new$created_at>v_now-interval '100 years'$new$
  );

  if position('free_chat_enabled' in v_definition)=0
     or position('interval ''100 years''' in v_definition)=0 then
    raise exception 'Nije moguće bezbjedno uključiti free chat u chat_live_dispatch.';
  end if;

  execute v_definition;
end
$migration$;

do $migration$
declare
  v_definition text;
begin
  v_definition := pg_get_functiondef('public.chat_live_dispatch_v2(uuid,text,jsonb,text)'::regprocedure);
  v_definition := replace(
    v_definition,
    $old$if p_action in ('admin_test_mode','admin_grant','admin_nickname','admin_avatar','admin_issue_code','redeem_code','recovery_set','recover') then raise exception 'Probne radnje i naplata nisu dostupni.' using errcode='42501';end if;$old$,
    $new$if p_action in ('admin_test_mode','admin_grant','admin_nickname','admin_avatar','admin_issue_code','redeem_code') then raise exception 'Probne radnje i naplata nisu dostupni.' using errcode='42501';end if;$new$
  );
  if position('''recovery_set'',''recover''' in v_definition)>0 then
    raise exception 'Nije moguće bezbjedno omogućiti oporavak anonimnog chat naloga.';
  end if;
  execute v_definition;
end
$migration$;
