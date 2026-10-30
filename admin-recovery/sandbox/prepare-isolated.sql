-- REVIEW ONLY. New empty Supabase project only. No existing project is a target.
begin;
do $$ begin
 if current_setting('ispovesti.sandbox_approval',true) is distinct from 'isolated-admin-recovery-v1' then raise exception 'Odvojeni probni SQL čeka odobrenje.';end if;
 if to_regnamespace('community_test') is not null or to_regnamespace('community_live') is not null or to_regnamespace('chat_test') is not null or to_regclass('public.confessions') is not null or to_regnamespace('recovery_sandbox') is not null then raise exception 'Nije prazan odvojeni projekat; prekid bez izmjena.';end if;
 if (select count(*) from auth.users)<>1 or not exists(select 1 from auth.users where id=nullif(current_setting('ispovesti.sandbox_owner_uid',true),'')::uuid and is_anonymous=false and email_confirmed_at is not null) then raise exception 'Potreban je samo jedan novi potvrđeni probni Auth nalog.';end if;
end $$;
create schema recovery_sandbox;
revoke all on schema recovery_sandbox from public,anon,authenticated;
grant usage on schema recovery_sandbox,auth to service_role;
grant select on auth.sessions to service_role;
create table recovery_sandbox.admins(user_id uuid primary key references auth.users(id));
create unique index sandbox_one_owner on recovery_sandbox.admins((true));
create table recovery_sandbox.security_settings(singleton boolean primary key default true check(singleton),owner_email text not null,admin_auth_method text not null default 'email' check(admin_auth_method='email'),updated_at timestamptz not null default clock_timestamp());
insert into recovery_sandbox.admins values(current_setting('ispovesti.sandbox_owner_uid')::uuid);
insert into recovery_sandbox.security_settings(singleton,owner_email) select true,lower(email) from auth.users where id=current_setting('ispovesti.sandbox_owner_uid')::uuid;
alter table recovery_sandbox.admins enable row level security;
alter table recovery_sandbox.security_settings enable row level security;
revoke all on recovery_sandbox.admins,recovery_sandbox.security_settings from public,anon,authenticated;
grant all on recovery_sandbox.admins,recovery_sandbox.security_settings to service_role;
create function recovery_sandbox.assert_admin(p_uid uuid,p_session text) returns void
language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from recovery_sandbox.admins a where a.user_id=p_uid)
 or not exists(select 1 from auth.sessions s where s.id=p_session::uuid and s.user_id=p_uid and (s.not_after is null or s.not_after>clock_timestamp())) then
  raise exception 'Zabranjena ili istekla administratorska sesija.' using errcode='42501';
 end if;
end $$;
create table recovery_sandbox.admin_email_sessions (
 user_id uuid primary key references recovery_sandbox.admins(user_id),
 session_id uuid not null,
 challenge_hash text not null,
 issued_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null,
 attempts integer not null default 0 check(attempts between 0 and 5),
 verified_until timestamptz,
 verifying_until timestamptz
);
alter table recovery_sandbox.admin_email_sessions enable row level security;
revoke all on recovery_sandbox.admin_email_sessions from public,anon,authenticated;
grant all on recovery_sandbox.admin_email_sessions to service_role;
create function recovery_sandbox.assert_admin_email(p_uid uuid,p_session text) returns void
language plpgsql security invoker set search_path='' as $$
begin
 perform recovery_sandbox.assert_admin(p_uid,p_session);
 if not exists(select 1 from recovery_sandbox.admin_email_sessions where user_id=p_uid and session_id=p_session::uuid and verified_until>clock_timestamp()) then
  raise exception 'Potvrdi pristup kodom sa e-maila.' using errcode='42501';
 end if;
end $$;
create function public.recovery_sandbox_admin_email(p_uid uuid,p_action text,p_args jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare s recovery_sandbox.admin_email_sessions;v_email text;
begin
 if current_user not in ('service_role','postgres') then raise exception 'Zabranjeno.' using errcode='42501'; end if;
 perform recovery_sandbox.assert_admin(p_uid,p_args->>'_session_id');
 select owner_email into v_email from recovery_sandbox.security_settings where singleton;
 if p_action='status' then
  return jsonb_build_object('verified',exists(select 1 from recovery_sandbox.admin_email_sessions where user_id=p_uid and session_id=(p_args->>'_session_id')::uuid and verified_until>clock_timestamp()));
 end if;
 -- Serialize all challenges for the sole owner, including requests from other sessions.
 perform pg_advisory_xact_lock(73142012);
 select * into s from recovery_sandbox.admin_email_sessions where user_id=p_uid for update;
 if p_action='begin' then
  if s.issued_at>clock_timestamp()-interval '60 seconds' then return '{"limited":true}'; end if;
  if length(p_args->>'challenge_hash')<>64 then raise exception 'Neispravan zahtjev.'; end if;
  insert into recovery_sandbox.admin_email_sessions(user_id,session_id,challenge_hash,expires_at)
  values(p_uid,(p_args->>'_session_id')::uuid,p_args->>'challenge_hash',clock_timestamp()+interval '10 minutes')
  on conflict(user_id) do update set session_id=excluded.session_id,challenge_hash=excluded.challenge_hash,issued_at=excluded.issued_at,expires_at=excluded.expires_at,attempts=0,verified_until=null,verifying_until=null;
  return jsonb_build_object('email',v_email);
 end if;
 if s.user_id is null or s.session_id<>(p_args->>'_session_id')::uuid or s.challenge_hash is distinct from p_args->>'challenge_hash' or s.expires_at<=clock_timestamp() or s.verified_until is not null then
  return '{"denied":true}';
 end if;
 if p_action='attempt' then
  if s.attempts>=5 or s.verifying_until>clock_timestamp() then return '{"denied":true}'; end if;
  update recovery_sandbox.admin_email_sessions set attempts=attempts+1,verifying_until=clock_timestamp()+interval '30 seconds' where user_id=p_uid;
  return jsonb_build_object('email',v_email);
 elsif p_action='failed' then
  update recovery_sandbox.admin_email_sessions set verifying_until=null where user_id=p_uid;
  return '{"success":true}';
 elsif p_action='finish' then
  if s.verifying_until is null or s.verifying_until<=clock_timestamp() or p_args->>'verified_uid' is distinct from p_uid::text or lower(p_args->>'verified_email') is distinct from v_email then return '{"denied":true}'; end if;
  update recovery_sandbox.admin_email_sessions set verified_until=clock_timestamp()+interval '8 hours',expires_at=clock_timestamp(),verifying_until=null where user_id=p_uid;
  update recovery_sandbox.security_settings set admin_auth_method='email',updated_at=clock_timestamp() where singleton;
  return '{"verified":true}';
 end if;
 raise exception 'Nepoznata radnja.';
end $$;
revoke all on function recovery_sandbox.assert_admin_email(uuid,text),public.recovery_sandbox_admin_email(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function recovery_sandbox.assert_admin_email(uuid,text),public.recovery_sandbox_admin_email(uuid,text,jsonb) to service_role;
create table recovery_sandbox.admin_recovery (
 user_id uuid primary key references recovery_sandbox.admins(user_id),
 token_hash text check(token_hash ~ '^[a-f0-9]{64}$'),
 issued_at timestamptz,expires_at timestamptz,consumed_at timestamptz,
 hour_start timestamptz not null default clock_timestamp(),sent_count integer not null default 0,
 working_hash text,blocked boolean not null default false
);
create table recovery_sandbox.revoked_admin_sessions (
 session_id uuid primary key,user_id uuid not null references recovery_sandbox.admins(user_id)
);
alter table recovery_sandbox.admin_recovery enable row level security;
alter table recovery_sandbox.revoked_admin_sessions enable row level security;
revoke all on recovery_sandbox.admin_recovery,recovery_sandbox.revoked_admin_sessions from public,anon,authenticated;
grant all on recovery_sandbox.admin_recovery,recovery_sandbox.revoked_admin_sessions to service_role;
create function public.recovery_sandbox_admin_recovery(p_action text,p_args jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_uid uuid;v_email text;r recovery_sandbox.admin_recovery;h text:=p_args->>'token_hash';
begin
 if current_user not in ('service_role','postgres') then raise exception 'Zabranjeno.' using errcode='42501';end if;
 perform pg_advisory_xact_lock(73142027);
 select a.user_id,s.owner_email into v_uid,v_email from recovery_sandbox.admins a cross join recovery_sandbox.security_settings s where s.singleton;
 if v_uid is null or v_email is null or h is null or h !~ '^[a-f0-9]{64}$' then return '{"denied":true}';end if;
 insert into recovery_sandbox.admin_recovery(user_id) values(v_uid) on conflict do nothing;
 select * into r from recovery_sandbox.admin_recovery where user_id=v_uid for update;
 if p_action='issue' then
  if lower(trim(p_args->>'email')) is distinct from v_email or r.working_hash is not null
   or r.issued_at>clock_timestamp()-interval '60 seconds'
   or (r.hour_start>clock_timestamp()-interval '1 hour' and r.sent_count>=3) then return '{"denied":true}';end if;
  update recovery_sandbox.admin_recovery set token_hash=h,issued_at=clock_timestamp(),expires_at=clock_timestamp()+interval '10 minutes',consumed_at=null,
   sent_count=case when hour_start<=clock_timestamp()-interval '1 hour' then 1 else sent_count+1 end,
   hour_start=case when hour_start<=clock_timestamp()-interval '1 hour' then clock_timestamp() else hour_start end where user_id=v_uid;
  return jsonb_build_object('user_id',v_uid,'email',v_email);
 elsif p_action='consume' then
  if r.token_hash is distinct from h or r.expires_at<=clock_timestamp() or r.consumed_at is not null or r.working_hash is not null then return '{"denied":true}';end if;
  update recovery_sandbox.admin_recovery set consumed_at=clock_timestamp(),working_hash=h,blocked=true where user_id=v_uid;
  insert into recovery_sandbox.revoked_admin_sessions select s.id,s.user_id from auth.sessions s where s.user_id=v_uid on conflict do nothing;
  update recovery_sandbox.admin_email_sessions set verified_until=null,expires_at=clock_timestamp(),verifying_until=null where user_id=v_uid;
  return jsonb_build_object('user_id',v_uid,'email',v_email);
 elsif p_action='finish' then
  if r.working_hash is distinct from h or not r.blocked then return '{"denied":true}';end if;
  insert into recovery_sandbox.revoked_admin_sessions select s.id,s.user_id from auth.sessions s where s.user_id=v_uid on conflict do nothing;
  update recovery_sandbox.admin_email_sessions set verified_until=null,expires_at=clock_timestamp(),verifying_until=null where user_id=v_uid;
  update recovery_sandbox.admin_recovery set blocked=false,working_hash=null,token_hash=null where user_id=v_uid;
  return '{"success":true}';
 end if;
 return '{"denied":true}';
end $$;
revoke all on function public.recovery_sandbox_admin_recovery(text,jsonb) from public,anon,authenticated;
grant execute on function public.recovery_sandbox_admin_recovery(text,jsonb) to service_role;
create or replace function recovery_sandbox.assert_admin(p_uid uuid,p_session text) returns void
language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from recovery_sandbox.admins a where a.user_id=p_uid)
 or not exists(select 1 from auth.sessions s where s.id=p_session::uuid and s.user_id=p_uid and (s.not_after is null or s.not_after>clock_timestamp()))
 or exists(select 1 from recovery_sandbox.revoked_admin_sessions r where r.session_id=p_session::uuid and r.user_id=p_uid)
 or exists(select 1 from recovery_sandbox.admin_recovery r where r.user_id=p_uid and r.blocked) then
  raise exception 'Zabranjena ili istekla administratorska sesija.' using errcode='42501';
 end if;
end $$;

create function recovery_sandbox.assert_admin_access(p_uid uuid,p_session text,p_aal text) returns void language plpgsql security invoker set search_path='' as $$ begin perform recovery_sandbox.assert_admin_email(p_uid,p_session);end $$;
revoke all on function recovery_sandbox.assert_admin_access(uuid,text,text) from public,anon,authenticated;
grant execute on function recovery_sandbox.assert_admin_access(uuid,text,text) to service_role;
create function public.recovery_sandbox_login(p_uid uuid,p_action text,p_args jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$ begin
 if current_user not in ('service_role','postgres') then raise exception 'Zabranjeno.' using errcode='42501';end if;
 perform recovery_sandbox.assert_admin(p_uid,p_args->>'_session_id');
 if p_action='session' then return '{"admin":true}';end if;
 if p_action='panel' then perform recovery_sandbox.assert_admin_access(p_uid,p_args->>'_session_id','aal1');return '{"verified":true}';end if;
 raise exception 'Nepoznata radnja.';
end $$;
revoke all on function public.recovery_sandbox_login(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.recovery_sandbox_login(uuid,text,jsonb) to service_role;
revoke all on all functions in schema recovery_sandbox from public,anon,authenticated;
grant execute on all functions in schema recovery_sandbox to service_role;
create function public.recovery_sandbox_owner() returns uuid
language plpgsql security invoker set search_path='' as $$ begin
 if current_user not in ('service_role','postgres') then raise exception 'Zabranjeno.' using errcode='42501';end if;
 return (select user_id from recovery_sandbox.admins);
end $$;
revoke all on function public.recovery_sandbox_owner() from public,anon,authenticated;
grant execute on function public.recovery_sandbox_owner() to service_role;
notify pgrst,'reload schema';
commit;
