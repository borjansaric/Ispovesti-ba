-- Glavni sajt: dodatna priprema 30.10.2026. Postojeći podaci se ne brišu.
begin;
select set_config('ispovesti.recovery_approval','live-admin-recovery-v1',true);
do $$ begin
 if current_setting('ispovesti.recovery_approval',true) is distinct from 'live-admin-recovery-v1' then raise exception 'Oporavak čeka pregled i odobrenje SQL-a.';end if;
 if to_regclass('community_live.admin_recovery') is not null then raise exception 'Oporavak je već pripremljen; ne ponavljati SQL.';end if;
 if (select count(*) from community_live.admins)<>1 then raise exception 'Potreban je postojeći jedan administrator.';end if;
end $$;
create table community_live.admin_recovery (
 user_id uuid primary key references community_live.admins(user_id),
 token_hash text check(token_hash ~ '^[a-f0-9]{64}$'),
 issued_at timestamptz,expires_at timestamptz,consumed_at timestamptz,
 hour_start timestamptz not null default clock_timestamp(),sent_count integer not null default 0,
 working_hash text,blocked boolean not null default false
);
create table community_live.revoked_admin_sessions (
 session_id uuid primary key,user_id uuid not null references community_live.admins(user_id)
);
alter table community_live.admin_recovery enable row level security;
alter table community_live.revoked_admin_sessions enable row level security;
revoke all on community_live.admin_recovery,community_live.revoked_admin_sessions from public,anon,authenticated;
grant all on community_live.admin_recovery,community_live.revoked_admin_sessions to service_role;
create function public.community_live_admin_recovery(p_action text,p_args jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_uid uuid;v_email text;r community_live.admin_recovery;h text:=p_args->>'token_hash';
begin
 if current_user not in ('service_role','postgres') then raise exception 'Zabranjeno.' using errcode='42501';end if;
 perform pg_advisory_xact_lock(73142027);
 select a.user_id,s.owner_email into v_uid,v_email from community_live.admins a cross join community_live.security_settings s where s.singleton;
 if v_uid is null or v_email is null or h is null or h !~ '^[a-f0-9]{64}$' then return '{"denied":true}';end if;
 insert into community_live.admin_recovery(user_id) values(v_uid) on conflict do nothing;
 select * into r from community_live.admin_recovery where user_id=v_uid for update;
 if p_action='issue' then
  if lower(trim(p_args->>'email')) is distinct from v_email or r.working_hash is not null
   or r.issued_at>clock_timestamp()-interval '60 seconds'
   or (r.hour_start>clock_timestamp()-interval '1 hour' and r.sent_count>=3) then return '{"denied":true}';end if;
  update community_live.admin_recovery set token_hash=h,issued_at=clock_timestamp(),expires_at=clock_timestamp()+interval '10 minutes',consumed_at=null,
   sent_count=case when hour_start<=clock_timestamp()-interval '1 hour' then 1 else sent_count+1 end,
   hour_start=case when hour_start<=clock_timestamp()-interval '1 hour' then clock_timestamp() else hour_start end where user_id=v_uid;
  return jsonb_build_object('user_id',v_uid,'email',v_email);
 elsif p_action='consume' then
  if r.token_hash is distinct from h or r.expires_at<=clock_timestamp() or r.consumed_at is not null or r.working_hash is not null then return '{"denied":true}';end if;
  update community_live.admin_recovery set consumed_at=clock_timestamp(),working_hash=h,blocked=true where user_id=v_uid;
  insert into community_live.revoked_admin_sessions select s.id,s.user_id from auth.sessions s where s.user_id=v_uid on conflict do nothing;
  update community_live.admin_email_sessions set verified_until=null,expires_at=clock_timestamp(),verifying_until=null where user_id=v_uid;
  return jsonb_build_object('user_id',v_uid,'email',v_email);
 elsif p_action='finish' then
  if r.working_hash is distinct from h or not r.blocked then return '{"denied":true}';end if;
  insert into community_live.revoked_admin_sessions select s.id,s.user_id from auth.sessions s where s.user_id=v_uid on conflict do nothing;
  update community_live.admin_email_sessions set verified_until=null,expires_at=clock_timestamp(),verifying_until=null where user_id=v_uid;
  update community_live.admin_recovery set blocked=false,working_hash=null,token_hash=null where user_id=v_uid;
  return '{"success":true}';
 end if;
 return '{"denied":true}';
end $$;
revoke all on function public.community_live_admin_recovery(text,jsonb) from public,anon,authenticated;
grant execute on function public.community_live_admin_recovery(text,jsonb) to service_role;
-- Preserve the existing identity/session checks and add immediate test-admin revocation.
create or replace function community_live.assert_admin(p_uid uuid,p_session text) returns void
language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from community_live.admins a where a.user_id=p_uid)
 or not exists(select 1 from auth.sessions s where s.id=p_session::uuid and s.user_id=p_uid and (s.not_after is null or s.not_after>clock_timestamp()))
 or exists(select 1 from community_live.revoked_admin_sessions r where r.session_id=p_session::uuid and r.user_id=p_uid)
 or exists(select 1 from community_live.admin_recovery r where r.user_id=p_uid and r.blocked) then
  raise exception 'Zabranjena ili istekla administratorska sesija.' using errcode='42501';
 end if;
end $$;
notify pgrst,'reload schema';
commit;
