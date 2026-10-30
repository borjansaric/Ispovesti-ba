-- Glavni sajt: dodatna priprema 30.10.2026. Postojeći podaci se ne brišu.
begin;
create schema admin_archive_live;
revoke all on schema admin_archive_live from public,anon,authenticated;
grant usage on schema admin_archive_live to service_role;
create table admin_archive_live.snapshots(
 message_id bigint primary key references chat_live.messages(id),
 author_public_id uuid not null, nickname text not null, avatar text not null
);
alter table admin_archive_live.snapshots enable row level security;
revoke all on admin_archive_live.snapshots from public,anon,authenticated;
grant all on admin_archive_live.snapshots to service_role;
create index snapshots_author_message on admin_archive_live.snapshots(author_public_id,message_id);
create function admin_archive_live.snapshot_new_message() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 insert into admin_archive_live.snapshots(message_id,author_public_id,nickname,avatar)
 select new.id,p.public_id,coalesce((select n.display_name from chat_live.nicknames n where n.user_id=p.user_id and n.reserved_until>new.created_at),p.generated_nickname),p.avatar
 from chat_live.profiles p where p.user_id=new.user_id;
 if not found then raise exception 'Nedostaje profil autora';end if;
 return new;
end $$;
create trigger snapshot_message after insert on chat_live.messages for each row execute function admin_archive_live.snapshot_new_message();
create function public.admin_archive_live_list(p_uid uuid,p_session text,p_aal text,p_before bigint default null,p_text text default '',p_status text default 'all',p_author uuid default null,p_from timestamptz default null,p_to timestamptz default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result jsonb; has_more boolean;
begin
 if current_user not in ('service_role','postgres') then raise exception 'Zabranjeno' using errcode='42501';end if;
 perform community_live.assert_admin_access(p_uid,p_session,p_aal);
 if p_status not in ('all','active','removed','reported') or length(p_text)>100 or (p_from is not null and p_to is not null and p_from>p_to) then raise exception 'Neispravna pretraga';end if;
 with matches as materialized (
  select m.id::text id,m.body,m.created_at,m.removed,s.author_public_id,s.nickname,s.avatar,
   (select coalesce(jsonb_agg(jsonb_build_object('reason',r.reason,'created_at',r.created_at) order by r.created_at),'[]'::jsonb) from chat_live.reports r where r.message_id=m.id) reports,
   (select coalesce(jsonb_agg(jsonb_build_object('action',a.action,'created_at',a.created_at) order by a.created_at),'[]'::jsonb) from chat_live.audit a where a.target=m.id::text) decisions
  from chat_live.messages m left join admin_archive_live.snapshots s on s.message_id=m.id
  where (p_before is null or m.id<p_before) and position(lower(p_text) in lower(m.body))>0
   and (p_author is null or s.author_public_id=p_author) and (p_from is null or m.created_at>=p_from) and (p_to is null or m.created_at<=p_to)
   and (p_status='all' or (p_status='removed' and m.removed) or (p_status='active' and not m.removed) or (p_status='reported' and exists(select 1 from chat_live.reports r where r.message_id=m.id)))
  order by m.id desc limit 101
 ), page as (select * from matches order by id::bigint desc limit 100)
 select coalesce((select jsonb_agg(q order by q.id::bigint desc) from page q),'[]'::jsonb),
  (select count(*)>100 from matches) into result,has_more;
 return jsonb_build_object('items',result,'has_more',has_more,
  'next_before',case when has_more then result->-1->>'id' else null end);
end $$;
create function public.admin_archive_live_context(p_uid uuid,p_session text,p_aal text,p_message bigint) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 if current_user not in ('service_role','postgres') then raise exception 'Zabranjeno' using errcode='42501';end if;
 perform community_live.assert_admin_access(p_uid,p_session,p_aal);
 if not exists(select 1 from chat_live.messages where id=p_message) then raise exception 'Poruka ne postoji';end if;
 select coalesce(jsonb_agg(q order by q.created_at,q.id::bigint),'[]'::jsonb) into result from (
  (select m.id::text id,m.body,m.created_at,m.removed,s.author_public_id,s.nickname,s.avatar from chat_live.messages m left join admin_archive_live.snapshots s on s.message_id=m.id where (m.created_at,m.id)<(select created_at,id from chat_live.messages where id=p_message) order by m.created_at desc,m.id desc limit 5)
  union all
  (select m.id::text id,m.body,m.created_at,m.removed,s.author_public_id,s.nickname,s.avatar from chat_live.messages m left join admin_archive_live.snapshots s on s.message_id=m.id where m.id=p_message)
  union all
  (select m.id::text id,m.body,m.created_at,m.removed,s.author_public_id,s.nickname,s.avatar from chat_live.messages m left join admin_archive_live.snapshots s on s.message_id=m.id where (m.created_at,m.id)>(select created_at,id from chat_live.messages where id=p_message) order by m.created_at,m.id limit 5)
 ) q;
 return jsonb_build_object('items',result);
end $$;
revoke all on function admin_archive_live.snapshot_new_message(),public.admin_archive_live_list(uuid,text,text,bigint,text,text,uuid,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function admin_archive_live.snapshot_new_message(),public.admin_archive_live_list(uuid,text,text,bigint,text,text,uuid,timestamptz,timestamptz) to service_role;
revoke all on function public.admin_archive_live_context(uuid,text,text,bigint) from public,anon,authenticated;
grant execute on function public.admin_archive_live_context(uuid,text,text,bigint) to service_role;
commit;
begin;
create function public.chat_live_admin_archive(p_uid uuid,p_session text,p_args jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare f jsonb:=coalesce(p_args->'filters','{}');
begin
 if current_user not in ('service_role','postgres') then raise exception 'Zabranjeno.' using errcode='42501';end if;
 perform community_live.assert_admin_access(p_uid,p_session,'aal1');
 if p_args->>'action'='context' then return public.admin_archive_live_context(p_uid,p_session,'aal1',(p_args->>'id')::bigint);end if;
 if p_args->>'action'<>'list' then raise exception 'Nepoznata radnja.';end if;
 return public.admin_archive_live_list(p_uid,p_session,'aal1',nullif(f->>'before','')::bigint,coalesce(f->>'text',''),coalesce(f->>'status','all'),nullif(f->>'author','')::uuid,(nullif(f->>'from','')::date::timestamp at time zone 'Europe/Sarajevo'),((nullif(f->>'to','')::date+1)::timestamp at time zone 'Europe/Sarajevo')-interval '1 microsecond');
end $$;
revoke all on function public.chat_live_admin_archive(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.chat_live_admin_archive(uuid,text,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
