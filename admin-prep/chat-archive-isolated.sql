-- ISOLATED TEST ONLY. Not approved for any existing project or production.
begin;
create schema admin_archive_probe;
revoke all on schema admin_archive_probe from public,anon,authenticated;
grant usage on schema admin_archive_probe to service_role;
create table admin_archive_probe.snapshots(
 message_id bigint primary key references chat_test.messages(id),
 author_public_id uuid not null, nickname text not null, avatar text not null
);
alter table admin_archive_probe.snapshots enable row level security;
revoke all on admin_archive_probe.snapshots from public,anon,authenticated;
grant all on admin_archive_probe.snapshots to service_role;
create function admin_archive_probe.snapshot_new_message() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 insert into admin_archive_probe.snapshots(message_id,author_public_id,nickname,avatar)
 select new.id,p.public_id,coalesce((select n.display_name from chat_test.nicknames n where n.user_id=p.user_id and n.reserved_until>new.created_at),p.generated_nickname),p.avatar
 from chat_test.profiles p where p.user_id=new.user_id;
 if not found then raise exception 'Nedostaje profil autora';end if;
 return new;
end $$;
create trigger snapshot_message after insert on chat_test.messages for each row execute function admin_archive_probe.snapshot_new_message();
create function public.admin_archive_probe_list(p_uid uuid,p_session text,p_aal text,p_before bigint default null,p_text text default '',p_status text default 'all',p_author uuid default null,p_from timestamptz default null,p_to timestamptz default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 if current_user not in ('service_role','postgres') then raise exception 'Zabranjeno' using errcode='42501';end if;
 perform community_test.assert_admin_access(p_uid,p_session,p_aal);
 if p_status not in ('all','active','removed','reported') or length(p_text)>100 or (p_from is not null and p_to is not null and p_from>p_to) then raise exception 'Neispravna pretraga';end if;
 select coalesce(jsonb_agg(q order by q.id desc),'[]'::jsonb) into result from (
  select m.id::text id,m.body,m.created_at,m.removed,s.author_public_id,s.nickname,s.avatar,
   (select coalesce(jsonb_agg(jsonb_build_object('reason',r.reason,'created_at',r.created_at) order by r.created_at),'[]'::jsonb) from chat_test.reports r where r.message_id=m.id) reports,
   (select coalesce(jsonb_agg(jsonb_build_object('action',a.action,'created_at',a.created_at) order by a.created_at),'[]'::jsonb) from chat_test.audit a where a.target=m.id::text) decisions
  from chat_test.messages m left join admin_archive_probe.snapshots s on s.message_id=m.id
  where (p_before is null or m.id<p_before) and position(lower(p_text) in lower(m.body))>0
   and (p_author is null or s.author_public_id=p_author) and (p_from is null or m.created_at>=p_from) and (p_to is null or m.created_at<=p_to)
   and (p_status='all' or (p_status='removed' and m.removed) or (p_status='active' and not m.removed) or (p_status='reported' and exists(select 1 from chat_test.reports r where r.message_id=m.id)))
  order by m.id desc limit 100
 ) q;
 return jsonb_build_object('items',result);
end $$;
revoke all on function admin_archive_probe.snapshot_new_message(),public.admin_archive_probe_list(uuid,text,text,bigint,text,text,uuid,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function admin_archive_probe.snapshot_new_message(),public.admin_archive_probe_list(uuid,text,text,bigint,text,text,uuid,timestamptz,timestamptz) to service_role;
commit;
