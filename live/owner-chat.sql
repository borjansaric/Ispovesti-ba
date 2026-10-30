-- Glavni sajt: dodatna priprema 30.10.2026. Postojeći podaci se ne brišu.
begin;
create table chat_live.owner_access(owner_id uuid primary key references community_live.admins(user_id),user_id uuid unique references auth.users(id),session_id uuid not null);
alter table chat_live.owner_access enable row level security;
revoke all on chat_live.owner_access from public,anon,authenticated;
grant all on chat_live.owner_access to service_role;
create function public.chat_live_owner_access(p_uid uuid,p_session text,p_target uuid,p_target_session uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare previous uuid;
begin
 if current_user not in ('service_role','postgres') then raise exception 'Zabranjeno.' using errcode='42501';end if;
 perform community_live.assert_admin_access(p_uid,p_session,'aal1');
 if not chat_live.is_anonymous_user(p_target) or not exists(select 1 from auth.sessions where id=p_target_session and user_id=p_target and (not_after is null or not_after>clock_timestamp())) then raise exception 'Potreban je zaseban anonimni nalog.';end if;
 perform pg_advisory_xact_lock(902630);
 select user_id into previous from chat_live.owner_access where owner_id=p_uid;
 if previous is not null and previous<>p_target then update chat_live.access set expires_at=clock_timestamp() where user_id=previous and source='owner';end if;
 perform public.chat_live_dispatch(p_target,'profile','{}');
 insert into chat_live.owner_access values(p_uid,p_target,p_target_session) on conflict(owner_id) do update set user_id=excluded.user_id,session_id=excluded.session_id;
 insert into chat_live.access values(p_target,'30d',clock_timestamp()+interval '30 days',31,'owner',p_uid) on conflict(user_id) do update set plan=excluded.plan,expires_at=excluded.expires_at,history_hours=31,source='owner',granted_by=p_uid;
 insert into chat_live.audit(admin_id,action,target) values(p_uid,'owner_access',p_target::text);
 return '{"success":true}';
end $$;
revoke all on function public.chat_live_owner_access(uuid,text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.chat_live_owner_access(uuid,text,uuid,uuid) to service_role;
-- Pin owner access to one anonymous Auth session as well as its UID.
do $$ declare d text;begin
 d=pg_get_functiondef('public.chat_live_dispatch_v2(uuid,text,jsonb,text)'::regprocedure);
 d=replace(d,'-- An SMS lease never grants Auth or admin rights, and the old session loses chat access.',
 'if exists(select 1 from chat_live.access lease where lease.user_id=p_uid and lease.source=''owner'') and not exists(select 1 from chat_live.owner_access o where o.user_id=p_uid and o.session_id::text=p_session) then raise exception ''Pristup je aktiviran u drugoj sesiji.'' using errcode=''42501'';end if;');
 execute d;
end $$;
commit;
