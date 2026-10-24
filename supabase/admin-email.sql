begin;
alter table community_test.security_settings add column admin_auth_method text not null default 'totp' check(admin_auth_method in ('totp','email'));
create table community_test.admin_email_sessions (
 user_id uuid primary key references community_test.admins(user_id),
 session_id uuid not null,
 challenge_hash text not null,
 issued_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null,
 attempts integer not null default 0 check(attempts between 0 and 5),
 verified_until timestamptz,
 verifying_until timestamptz
);
alter table community_test.admin_email_sessions enable row level security;
revoke all on community_test.admin_email_sessions from public,anon,authenticated;
grant all on community_test.admin_email_sessions to service_role;
create function community_test.assert_admin_email(p_uid uuid,p_session text) returns void
language plpgsql security invoker set search_path='' as $$
begin
 perform community_test.assert_admin(p_uid,p_session);
 if not exists(select 1 from community_test.admin_email_sessions where user_id=p_uid and session_id=p_session::uuid and verified_until>clock_timestamp()) then
  raise exception 'Potvrdi pristup kodom sa e-maila.' using errcode='42501';
 end if;
end $$;
create function public.community_test_admin_email(p_uid uuid,p_action text,p_args jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare s community_test.admin_email_sessions;v_email text;
begin
 if current_user not in ('service_role','postgres') then raise exception 'Zabranjeno.' using errcode='42501'; end if;
 perform community_test.assert_admin(p_uid,p_args->>'_session_id');
 select owner_email into v_email from community_test.security_settings where singleton;
 if p_action='status' then
  return jsonb_build_object('verified',exists(select 1 from community_test.admin_email_sessions where user_id=p_uid and session_id=(p_args->>'_session_id')::uuid and verified_until>clock_timestamp()));
 end if;
 -- Serialize all challenges for the sole owner, including requests from other sessions.
 perform pg_advisory_xact_lock(73142012);
 select * into s from community_test.admin_email_sessions where user_id=p_uid for update;
 if p_action='begin' then
  if s.issued_at>clock_timestamp()-interval '60 seconds' then return '{"limited":true}'; end if;
  if length(p_args->>'challenge_hash')<>64 then raise exception 'Neispravan zahtjev.'; end if;
  insert into community_test.admin_email_sessions(user_id,session_id,challenge_hash,expires_at)
  values(p_uid,(p_args->>'_session_id')::uuid,p_args->>'challenge_hash',clock_timestamp()+interval '10 minutes')
  on conflict(user_id) do update set session_id=excluded.session_id,challenge_hash=excluded.challenge_hash,issued_at=excluded.issued_at,expires_at=excluded.expires_at,attempts=0,verified_until=null,verifying_until=null;
  return jsonb_build_object('email',v_email);
 end if;
 if s.user_id is null or s.session_id<>(p_args->>'_session_id')::uuid or s.challenge_hash is distinct from p_args->>'challenge_hash' or s.expires_at<=clock_timestamp() or s.verified_until is not null then
  return '{"denied":true}';
 end if;
 if p_action='attempt' then
  if s.attempts>=5 or s.verifying_until>clock_timestamp() then return '{"denied":true}'; end if;
  update community_test.admin_email_sessions set attempts=attempts+1,verifying_until=clock_timestamp()+interval '30 seconds' where user_id=p_uid;
  return jsonb_build_object('email',v_email);
 elsif p_action='failed' then
  update community_test.admin_email_sessions set verifying_until=null where user_id=p_uid;
  return '{"success":true}';
 elsif p_action='finish' then
  if s.verifying_until is null or s.verifying_until<=clock_timestamp() or p_args->>'verified_uid' is distinct from p_uid::text or lower(p_args->>'verified_email') is distinct from v_email then return '{"denied":true}'; end if;
  update community_test.admin_email_sessions set verified_until=clock_timestamp()+interval '8 hours',expires_at=clock_timestamp(),verifying_until=null where user_id=p_uid;
  update community_test.security_settings set admin_auth_method='email',updated_at=clock_timestamp() where singleton;
  return '{"verified":true}';
 end if;
 raise exception 'Nepoznata radnja.';
end $$;
revoke all on function community_test.assert_admin_email(uuid,text),public.community_test_admin_email(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function community_test.assert_admin_email(uuid,text),public.community_test_admin_email(uuid,text,jsonb) to service_role;
-- Preserve existing TOTP until this owner successfully proves the new e-mail flow.
create function community_test.assert_admin_access(p_uid uuid,p_session text,p_aal text) returns void
language plpgsql security invoker set search_path='' as $$
begin
 perform community_test.assert_admin(p_uid,p_session);
 if (select admin_auth_method from community_test.security_settings where singleton)='totp' and p_aal='aal2' then return; end if;
 perform community_test.assert_admin_email(p_uid,p_session);
end $$;
revoke all on function community_test.assert_admin_access(uuid,text,text) from public,anon,authenticated;
grant execute on function community_test.assert_admin_access(uuid,text,text) to service_role;
create or replace function public.community_test_dispatch(p_uid uuid,p_action text,p_args jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_result jsonb;v_id bigint;v_state text;v_previous text;v_kind text;v_at timestamptz;v_offset integer;
begin
 if current_user not in ('service_role','postgres') then raise exception 'Zabranjeno.' using errcode='42501'; end if;
 if p_action like 'admin_%' then
  perform community_test.assert_admin(p_uid,p_args->>'_session_id');
  if p_action='admin_session' then return '{"admin":true}'; end if;
  perform community_test.assert_admin_access(p_uid,p_args->>'_session_id',p_args->>'_aal');
  if p_action='admin_remove' then
   perform pg_advisory_xact_lock(73142011);
   v_id=(p_args->>'id')::bigint;select state into v_state from community_test.content where id=v_id for update;
   if not found then raise exception 'Sadržaj nije dostupan.'; end if;
   if v_state='removed' then return '{"success":true}'; end if;
   v_result=public.community_test_dispatch_base(p_uid,p_action,p_args);
   update community_test.content set removal_previous_state=v_state where id=v_id;return v_result;
  elsif p_action='admin_restore' then
   perform pg_advisory_xact_lock(73142011);v_id=(p_args->>'id')::bigint;
   select state,removal_previous_state,kind,published_at into v_state,v_previous,v_kind,v_at from community_test.content where id=v_id for update;
   if not found then raise exception 'Sadržaj nije dostupan.'; end if;
   if v_state<>'removed' then return '{"success":true}'; end if;
   v_previous=coalesce(v_previous,case when v_kind='confession' and v_at is null then 'queued' else 'published' end);
   update community_test.content set state=v_previous,removed_at=null,removal_previous_state=null where id=v_id;
   insert into community_test.audit_log(admin_id,content_id,action) values(p_uid,v_id,'restore');
   return jsonb_build_object('success',true,'state',v_previous,'visible',community_test.visible(v_id));
  elsif p_action='admin_list' then
   v_offset=greatest(0,least(coalesce((p_args->>'offset')::integer,0),1000000));
   if p_args->>'view' not in ('queue','archive','published','reports') then raise exception 'Nepoznat pregled.'; end if;
   select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into v_result from (
    select c.id::text id,c.kind,c.body,c.nickname,c.state,c.created_at,c.removed_at,c.parent_id::text parent_id,c.confession_id::text confession_id,
     community_test.visible(c.id) as publicly_visible,
     (select coalesce(jsonb_agg(jsonb_build_object('reason',r.reason,'created_at',r.created_at) order by r.created_at),'[]'::jsonb) from community_test.reports r where r.content_id=c.id) reports
    from community_test.content c where
     (p_args->>'view'='queue' and c.state='queued') or
     (p_args->>'view'='archive' and (c.state='removed' or (c.state='published' and not community_test.visible(c.id)))) or
     (p_args->>'view'='published' and community_test.visible(c.id)) or
     (p_args->>'view'='reports' and exists(select 1 from community_test.reports r where r.content_id=c.id))
    order by c.created_at,c.id limit 50 offset v_offset) x;
   return jsonb_build_object('items',v_result);
  end if;
 end if;
 return public.community_test_dispatch_base(p_uid,p_action,p_args);
end $$;
create or replace function public.community_test_security(p_uid uuid,p_action text,p_args jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare s community_test.security_settings;v_uid uuid;v_enabled boolean;v_sitekey text;v_cipher text;
begin
 if current_user not in ('service_role','postgres') then raise exception 'Zabranjeno.' using errcode='42501'; end if;
 if p_action='public_config' then
  select * into s from community_test.security_settings where singleton;
  return jsonb_build_object('enabled',s.captcha_enabled,'sitekey',s.captcha_sitekey);
 elsif p_action='runtime_config' then
  select * into s from community_test.security_settings where singleton;
  return jsonb_build_object('enabled',s.captcha_enabled,'sitekey',s.captcha_sitekey,'secret_ciphertext',s.captcha_secret_ciphertext,'hostname',s.captcha_hostname);
 elsif p_action like 'bootstrap_%' then
  select * into s from community_test.security_settings where singleton for update;
  if s.activation_hash is null or s.activation_hash is distinct from p_args->>'hash' or s.activation_expires_at is null or s.activation_expires_at<=clock_timestamp()
   or lower(p_args->>'email') is distinct from s.owner_email or exists(select 1 from community_test.admins) then
   raise exception 'Aktivacija nije dozvoljena ili je istekla.' using errcode='42501';
  end if;
  if p_action='bootstrap_claim' then
   if s.activation_claim_until>clock_timestamp() then raise exception 'Aktivacija je već u toku. Sačekaj dvije minute.'; end if;
   update community_test.security_settings set activation_claim_until=clock_timestamp()+interval '2 minutes' where singleton;
   return '{"claimed":true}';
  elsif p_action='bootstrap_release' then
   update community_test.security_settings set activation_claim_until=null where singleton;return '{"success":true}';
  elsif p_action='bootstrap_finish' then
   v_uid=(p_args->>'user_id')::uuid;
   -- These claims come only from the gateway's verified Auth response, not client arguments.
   -- The admins.user_id foreign key additionally requires a real Auth identity.
   if lower(p_args->>'verified_email') is distinct from s.owner_email or (p_args->>'verified_anonymous')::boolean is distinct from false or nullif(p_args->>'verified_confirmed_at','') is null then
    raise exception 'Nalog nije potvrđen.' using errcode='42501';
   end if;
   insert into community_test.admins(user_id) values(v_uid);
   update community_test.security_settings set activation_hash=null,activation_expires_at=null,activation_claim_until=null,updated_at=clock_timestamp() where singleton;
   return '{"success":true}';
  end if;
 else
  perform community_test.assert_admin(p_uid,p_args->>'_session_id');
  perform community_test.assert_admin_access(p_uid,p_args->>'_session_id',p_args->>'_aal');
  if p_action='admin_security_get' then
   select * into s from community_test.security_settings where singleton;
   return jsonb_build_object('enabled',s.captcha_enabled,'sitekey',s.captcha_sitekey,'secret_set',s.captcha_secret_ciphertext is not null,'hostname',s.captcha_hostname);
  elsif p_action='admin_security_set' then
   select * into s from community_test.security_settings where singleton for update;
   v_enabled=coalesce((p_args->>'enabled')::boolean,false);v_sitekey=coalesce(nullif(p_args->>'sitekey',''),s.captcha_sitekey);
   v_cipher=coalesce(nullif(p_args->>'secret_ciphertext',''),s.captcha_secret_ciphertext);
   if length(v_sitekey)>100 or length(v_cipher)>2000 or (v_enabled and (length(v_sitekey)<10 or v_cipher is null)) then raise exception 'Nedostaju ispravni CAPTCHA ključevi.'; end if;
   update community_test.security_settings set captcha_enabled=v_enabled,captcha_sitekey=v_sitekey,captcha_secret_ciphertext=v_cipher,updated_at=clock_timestamp() where singleton;
   return jsonb_build_object('enabled',v_enabled,'sitekey',v_sitekey,'secret_set',v_cipher is not null,'hostname',s.captcha_hostname);
  end if;
 end if;
 raise exception 'Nepoznata sigurnosna radnja.';
end $$;
notify pgrst, 'reload schema';
commit;
