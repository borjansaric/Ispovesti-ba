begin;
alter table community_test.content add column removal_previous_state text check(removal_previous_state in ('queued','published'));
create unique index admins_one_owner on community_test.admins ((true));
create table community_test.security_settings (
 singleton boolean primary key default true check(singleton),
 captcha_enabled boolean not null default false,
 captcha_sitekey text not null default '',
 captcha_secret_ciphertext text,
 captcha_hostname text not null default 'borjansaric.github.io',
 owner_email text,
 activation_hash text,
 activation_expires_at timestamptz,
 activation_claim_until timestamptz,
 updated_at timestamptz not null default clock_timestamp()
);
alter table community_test.security_settings enable row level security;
revoke all on community_test.security_settings from public,anon,authenticated;
grant all on community_test.security_settings to service_role;
insert into community_test.security_settings(singleton) values(true);
grant select on auth.users to service_role;
create function community_test.assert_admin(p_uid uuid,p_session text) returns void
language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from community_test.admins a join auth.users u on u.id=a.user_id
  where a.user_id=p_uid and u.is_anonymous=false and u.email_confirmed_at is not null)
 or not exists(select 1 from auth.sessions s where s.id=p_session::uuid and s.user_id=p_uid and (s.not_after is null or s.not_after>clock_timestamp())) then
  raise exception 'Zabranjena ili istekla administratorska sesija.' using errcode='42501';
 end if;
end $$;
alter function public.community_test_dispatch(uuid,text,jsonb) rename to community_test_dispatch_base;
create function public.community_test_dispatch(p_uid uuid,p_action text,p_args jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_result jsonb;v_id bigint;v_state text;v_previous text;v_kind text;v_at timestamptz;v_offset integer;
begin
 if current_user not in ('service_role','postgres') then raise exception 'Zabranjeno.' using errcode='42501'; end if;
 if p_action like 'admin_%' then
  perform community_test.assert_admin(p_uid,p_args->>'_session_id');
  if p_action='admin_session' then return '{"admin":true}'; end if;
  if p_args->>'_aal' is distinct from 'aal2' then raise exception 'Potrebna je dvofaktorska potvrda.' using errcode='42501'; end if;
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
create function public.community_test_security(p_uid uuid,p_action text,p_args jsonb default '{}') returns jsonb
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
   if not exists(select 1 from auth.users where id=v_uid and lower(email)=s.owner_email and is_anonymous=false and email_confirmed_at is not null) then
    raise exception 'Nalog nije potvrđen.' using errcode='42501';
   end if;
   insert into community_test.admins(user_id) values(v_uid);
   update community_test.security_settings set activation_hash=null,activation_expires_at=null,activation_claim_until=null,updated_at=clock_timestamp() where singleton;
   return '{"success":true}';
  end if;
 else
  perform community_test.assert_admin(p_uid,p_args->>'_session_id');
  if p_args->>'_aal' is distinct from 'aal2' then raise exception 'Potrebna je dvofaktorska potvrda.' using errcode='42501'; end if;
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
revoke all on all functions in schema community_test from public,anon,authenticated;
grant execute on all functions in schema community_test to service_role;
revoke all on function public.community_test_dispatch(uuid,text,jsonb),public.community_test_dispatch_base(uuid,text,jsonb),public.community_test_security(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.community_test_dispatch(uuid,text,jsonb),public.community_test_dispatch_base(uuid,text,jsonb),public.community_test_security(uuid,text,jsonb) to service_role;
commit;
