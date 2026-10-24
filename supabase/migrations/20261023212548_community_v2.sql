-- Isolated v2 schema. Does not delete, alter or import existing content.
-- Apply only to local/staging until final approval.
begin;
create schema community_private;
revoke all on schema community_private from public, anon, authenticated;
grant usage on schema community_private,auth to service_role;
grant select on auth.sessions to service_role;
create table community_private.content (
 id bigint generated always as identity primary key,
 kind text not null check(kind in ('confession','comment','reply')),
 author_id uuid not null references auth.users(id),
 confession_id bigint references community_private.content(id),
 parent_id bigint references community_private.content(id),
 body text not null,
 nickname text check(char_length(nickname) between 1 and 40),
 state text not null check(state in ('queued','published','removed')),
 created_at timestamptz not null default clock_timestamp(),
 published_at timestamptz,
 removed_at timestamptz,
 check(char_length(body) between 1 and 5000),
 check((kind='confession' and confession_id is null and parent_id is null and char_length(body)>=15)
 or (kind='comment' and confession_id is not null and parent_id is null and char_length(body)<=1000)
 or (kind='reply' and confession_id is not null and parent_id is not null and char_length(body)<=1000))
);
create index content_feed on community_private.content(state,published_at,id);
create index content_queue on community_private.content(created_at,id) where state='queued';
create index content_children on community_private.content(confession_id,parent_id,created_at,id);
create index content_author on community_private.content(author_id,created_at);
create table community_private.votes (
 content_id bigint references community_private.content(id) not null,
 user_id uuid references auth.users(id) not null,
 value smallint not null check(value in (-1,1)),
 first_voted_at timestamptz not null default clock_timestamp(),
 primary key(content_id,user_id)
);
create table community_private.lists (
 user_id uuid references auth.users(id) not null,
 kind text not null check(kind in ('favorites','recently_read')),
 content_id bigint references community_private.content(id) not null,
 touched_at timestamptz not null default clock_timestamp(),
 primary key(user_id,kind,content_id)
);
create index lists_owner on community_private.lists(user_id,kind,touched_at desc);
create table community_private.reports (
 content_id bigint references community_private.content(id) not null,
 user_id uuid references auth.users(id) not null,
 reason text not null check(reason in ('abuse','threat','spam','other')),
 created_at timestamptz not null default clock_timestamp(),
 primary key(content_id,user_id)
);
create table community_private.admins(user_id uuid primary key references auth.users(id));
create table community_private.audit_log (
 id bigint generated always as identity primary key,
 admin_id uuid not null references auth.users(id),
 content_id bigint not null references community_private.content(id),
 action text not null,
 created_at timestamptz not null default clock_timestamp()
);
create table community_private.rate_limits (
 user_id uuid not null references auth.users(id), action text not null,
 started_at timestamptz not null, n integer not null,
 primary key(user_id,action)
);
create table community_private.publisher (
 singleton boolean primary key default true check(singleton),
 last_published_at timestamptz not null default clock_timestamp(),
 started_at timestamptz not null default clock_timestamp(),
 paused boolean not null default false
);
insert into community_private.publisher(singleton) values(true);
-- All data is behind an authenticated Edge gateway; no direct client grants.
alter table community_private.content enable row level security;
alter table community_private.votes enable row level security;
alter table community_private.lists enable row level security;
alter table community_private.reports enable row level security;
alter table community_private.admins enable row level security;
alter table community_private.audit_log enable row level security;
alter table community_private.rate_limits enable row level security;
alter table community_private.publisher enable row level security;
create index content_parent on community_private.content(parent_id) where parent_id is not null;
create index votes_user on community_private.votes(user_id);
create index lists_content on community_private.lists(content_id);
create index reports_user on community_private.reports(user_id);
create index audit_admin on community_private.audit_log(admin_id);
create index audit_content on community_private.audit_log(content_id);
grant all on all tables in schema community_private to service_role;
grant usage, select on all sequences in schema community_private to service_role;

-- Match browser trim() for ASCII and Unicode whitespace; keep interior newlines intact.
create function community_private.trim_text(p_text text) returns text
language sql immutable security invoker set search_path='' as $$
 select btrim(p_text,U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF');
$$;

create function community_private.visible(p_id bigint) returns boolean
language sql stable security invoker set search_path='' as $$
 with recursive ancestors as (
 select c.id,c.parent_id,c.confession_id,c.state from community_private.content c where c.id=p_id
 union all
 select c.id,c.parent_id,c.confession_id,c.state from community_private.content c
 join ancestors a on c.id=coalesce(a.parent_id,a.confession_id)
 ) select exists(select 1 from ancestors) and not exists(select 1 from ancestors where state<>'published');
$$;

create function community_private.rate(p_uid uuid,p_action text,p_max integer) returns void
language plpgsql security invoker set search_path='' as $$
declare v_count integer;
begin
 insert into community_private.rate_limits values(p_uid,p_action,clock_timestamp(),1)
 on conflict(user_id,action) do update set
 n=case when community_private.rate_limits.started_at <= clock_timestamp()-interval '10 minutes' then 1 else community_private.rate_limits.n+1 end,
 started_at=case when community_private.rate_limits.started_at <= clock_timestamp()-interval '10 minutes' then clock_timestamp() else community_private.rate_limits.started_at end
 returning n into v_count;
 if v_count>p_max then raise exception 'Previše radnji. Pokušaj kasnije.' using errcode='P0001'; end if;
end $$;

create function community_private.publish_one() returns bigint
language plpgsql security invoker set search_path='' as $$
declare p community_private.publisher; v_id bigint;
begin
 select * into p from community_private.publisher where singleton for update;
 if p.paused or clock_timestamp() < p.last_published_at + interval '1 hour' then return null; end if;
 select id into v_id from community_private.content where state='queued' and kind='confession' order by created_at,id limit 1 for update;
 if v_id is null then return null; end if;
 update community_private.content set state='published',published_at=clock_timestamp() where id=v_id;
 update community_private.publisher set last_published_at=clock_timestamp() where singleton;
 return v_id;
end $$;

create function public.community_dispatch(p_uid uuid,p_action text,p_args jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
 v_id bigint; v_parent bigint; v_conf bigint; v_kind text; v_body text; v_nick text;
 v_row community_private.content; v_vote community_private.votes;
 v_result jsonb; v_ids jsonb; v_entry jsonb; v_duplicate boolean; v_value smallint;
 v_offset integer := greatest(0,least(coalesce((p_args->>'offset')::integer,0),1000000));
 v_now timestamptz := clock_timestamp();
begin
 -- Caller must be service_role. Identity is verified by gateway, never accepted from body.
 if current_user not in ('service_role','postgres') then raise exception 'Zabranjeno.' using errcode='42501'; end if;
 if p_action='feed' then
  select coalesce(jsonb_agg(to_jsonb(x)-'rank'), '[]') into v_result from (
   select c.id::text id,c.body,c.nickname,c.published_at,
    (select count(*) from community_private.votes v where v.content_id=c.id) rank
   from community_private.content c where c.kind='confession' and c.state='published'
   order by
    case when p_args->>'sort'='popular' then (select count(*) from community_private.votes v where v.content_id=c.id) end desc,
    case when p_args->>'sort'='new' then c.published_at end desc,
    c.published_at asc,c.id asc limit 20 offset v_offset
  ) x;
  return jsonb_build_object('items',v_result);
 end if;
 if p_action='confession' then
  v_id=(p_args->>'id')::bigint;
  if not community_private.visible(v_id) then raise exception 'Sadržaj nije dostupan.'; end if;
  select jsonb_build_object('id',c.id::text,'body',c.body,'nickname',c.nickname,'published_at',c.published_at) into v_result from community_private.content c where c.id=v_id and c.kind='confession';
  if v_result is null then raise exception 'Ispovijest nije dostupna.'; end if;
  return jsonb_build_object('item',v_result);
 end if;
 if p_action='comments' then
  v_conf=(p_args->>'confession_id')::bigint; v_parent=(p_args->>'parent_id')::bigint;
  if not community_private.visible(v_conf) then raise exception 'Sadržaj nije dostupan.'; end if;
  select coalesce(jsonb_agg(to_jsonb(x)),'[]') into v_result from (
   select c.id::text id,c.body,c.nickname,c.created_at,c.parent_id::text parent_id,
    exists(select 1 from community_private.content r where r.parent_id=c.id and r.state='published') has_replies
   from community_private.content c where c.confession_id=v_conf and c.parent_id is not distinct from v_parent
    and community_private.visible(c.id) order by c.created_at,c.id limit 20 offset v_offset
  ) x;
  return jsonb_build_object('items',v_result);
 end if;
 if p_uid is null then raise exception 'Potrebna je anonimna sesija.' using errcode='28000'; end if;
 if p_action in ('submit','vote','admin_remove') then perform pg_advisory_xact_lock(73142011); end if;
 if p_action like 'admin_%' then
  if not exists(select 1 from auth.sessions where id=(p_args->>'_session_id')::uuid and user_id=p_uid and (not_after is null or not_after>clock_timestamp())) then raise exception 'Administratorska sesija je istekla.' using errcode='42501'; end if;
  if not exists(select 1 from community_private.admins where user_id=p_uid) then raise exception 'Zabranjeno.' using errcode='42501'; end if;
  if p_action='admin_list' then
   select coalesce(jsonb_agg(to_jsonb(x)),'[]') into v_result from (
    select c.id::text id,c.kind,c.body,c.nickname,c.state,c.created_at,c.removed_at,
      (select coalesce(jsonb_agg(jsonb_build_object('reason',r.reason,'created_at',r.created_at)),'[]') from community_private.reports r where r.content_id=c.id) reports
    from community_private.content c where
     (p_args->>'view'='queue' and c.state='queued') or
     (p_args->>'view'='archive' and c.state='removed') or
     (p_args->>'view'='published' and c.state='published') or
     (p_args->>'view'='reports' and exists(select 1 from community_private.reports r where r.content_id=c.id))
    order by c.created_at,c.id limit 50 offset v_offset
   ) x;
   return jsonb_build_object('items',v_result);
  elsif p_action='admin_remove' then
   v_id=(p_args->>'id')::bigint;
   update community_private.content set state='removed',removed_at=v_now where id=v_id;
   if not found then raise exception 'Sadržaj nije dostupan.'; end if;
   insert into community_private.audit_log(admin_id,content_id,action) values(p_uid,v_id,'remove');
   return '{"success":true}';
  elsif p_action='admin_publisher' then
   -- No manual bulk publishing or reordering: only pause/resume FIFO scheduler.
   update community_private.publisher set paused=(p_args->>'paused')::boolean where singleton;
   return '{"success":true}';
  end if;
  raise exception 'Nepoznata administratorska radnja.';
 end if;
 if p_action='submit' then
  v_kind=p_args->>'kind'; v_body=community_private.trim_text(p_args->>'body'); v_nick=nullif(community_private.trim_text(p_args->>'nickname'),'');
  if v_kind is null or v_kind not in ('confession','comment','reply') or v_body is null or char_length(v_body)<(case when v_kind='confession' then 15 else 1 end)
   or char_length(v_body)>(case when v_kind='confession' then 5000 else 1000 end)
   or char_length(v_nick)>40 then raise exception 'Tekst nije dozvoljene dužine.'; end if;
  if v_body ~* '(https?[:：]|www\.|[[:alnum:]][[:alnum:]._-]*\.[[:alpha:]]{2,}|mailto:|ftp:|tel:)' or v_nick ~* '(https?[:：]|www\.|[[:alnum:]][[:alnum:]._-]*\.[[:alpha:]]{2,}|mailto:|ftp:|tel:)' then raise exception 'Linkovi nisu dozvoljeni.'; end if;
  perform community_private.rate(p_uid,'submit_'||v_kind,case when v_kind='confession' then 3 else 6 end);
  select exists(select 1 from community_private.content where author_id=p_uid and body=v_body and kind=v_kind) into v_duplicate;
  if v_duplicate and coalesce((p_args->>'allow_duplicate')::boolean,false)=false then return '{"duplicate":true}'; end if;
  if v_kind<>'confession' then
   v_conf=(p_args->>'confession_id')::bigint;
   select * into v_row from community_private.content where id=v_conf;
   if v_row.kind is distinct from 'confession' or not community_private.visible(v_conf) then raise exception 'Ispovijest nije dostupna.'; end if;
   if v_kind='reply' then
    v_parent=(p_args->>'parent_id')::bigint;
    select * into v_row from community_private.content where id=v_parent;
    if v_row.confession_id is distinct from v_conf or not community_private.visible(v_parent) then raise exception 'Komentar nije dostupan.'; end if;
   end if;
  end if;
  insert into community_private.content(kind,author_id,body,nickname,confession_id,parent_id,state,published_at)
  values(v_kind,p_uid,v_body,v_nick,v_conf,v_parent,case when v_kind='confession' then 'queued' else 'published' end,case when v_kind<>'confession' then v_now end) returning id into v_id;
  return jsonb_build_object('success',true,'id',v_id::text);
 end if;
 if p_action='cards' then
  v_ids=p_args->'ids';
  if jsonb_typeof(v_ids) is distinct from 'array' or jsonb_array_length(v_ids)>20 then raise exception 'Neispravna lista.'; end if;
  v_result='{}';
  for v_entry in select * from jsonb_array_elements(v_ids) loop
   v_id=(v_entry#>>'{}')::bigint;
   if community_private.visible(v_id) then
    v_result=v_result||jsonb_build_object(v_id::text,jsonb_build_object(
      'vote',public.community_dispatch(p_uid,'vote_status',jsonb_build_object('id',v_id::text)),
      'context',public.community_dispatch(p_uid,'context',jsonb_build_object('id',v_id::text))));
   end if;
  end loop;
  return v_result;
 end if;
 if p_action='list' then
  v_kind=p_args->>'list';
  if v_kind='my_comments' then
   select coalesce(jsonb_agg(to_jsonb(x)),'[]') into v_result from (
    select c.id::text id,c.confession_id::text confession_id,c.body,c.nickname,c.created_at from community_private.content c
    where c.author_id=p_uid and c.kind<>'confession' and community_private.visible(c.id)
    order by c.created_at desc,c.id desc limit 20 offset v_offset) x;
  elsif v_kind in ('favorites','recently_read') then
   select coalesce(jsonb_agg(to_jsonb(x)),'[]') into v_result from (
    select c.id::text id,c.body,c.nickname,c.published_at from community_private.lists l join community_private.content c on c.id=l.content_id
    where l.user_id=p_uid and l.kind=v_kind and community_private.visible(c.id)
    order by l.touched_at desc,c.id desc limit 20 offset v_offset) x;
  else raise exception 'Nepoznata lista.'; end if;
  return jsonb_build_object('items',v_result);
 end if;
 v_id=(p_args->>'id')::bigint;
 if not coalesce(community_private.visible(v_id),false) then raise exception 'Sadržaj nije dostupan.'; end if;
 if p_action='vote' or p_action='vote_status' then
  if p_action='vote' then
   perform community_private.rate(p_uid,'vote',120);
   v_value=(p_args->>'value')::smallint;
   if v_value is null or v_value not in (-1,1) then raise exception 'Neispravan glas.'; end if;
   insert into community_private.votes(content_id,user_id,value) values(v_id,p_uid,v_value)
   on conflict(content_id,user_id) do update set value=excluded.value
   where clock_timestamp() < community_private.votes.first_voted_at + interval '10 minutes';
  end if;
  select * into v_vote from community_private.votes where content_id=v_id and user_id=p_uid;
  v_result=jsonb_build_object('my_vote',v_vote.value);
  if v_vote.first_voted_at + interval '10 minutes' <= clock_timestamp() then
   select v_result||jsonb_build_object('likes',count(*) filter(where value=1),'dislikes',count(*) filter(where value=-1)) into v_result from community_private.votes where content_id=v_id;
  end if;
  return v_result;
 elsif p_action='context' then
  select case when exists(select 1 from community_private.content where author_id=p_uid and confession_id=v_id) then
    (select count(*) from community_private.content c where c.confession_id=v_id and community_private.visible(c.id)) end into v_conf;
  return jsonb_build_object('comment_count',v_conf,'favorite',exists(select 1 from community_private.lists where user_id=p_uid and kind='favorites' and content_id=v_id));
 elsif p_action='favorite' or p_action='read' then
  select * into v_row from community_private.content where id=v_id;
  if v_row.kind<>'confession' then raise exception 'Očekivana je ispovijest.'; end if;
  perform community_private.rate(p_uid,'lists',240);
  v_kind=case when p_action='read' then 'recently_read' else 'favorites' end;
  if p_action='favorite' and (p_args->>'enabled')::boolean=false then
   delete from community_private.lists where user_id=p_uid and kind=v_kind and content_id=v_id;
  else
   insert into community_private.lists values(p_uid,v_kind,v_id,v_now) on conflict(user_id,kind,content_id) do update set touched_at=excluded.touched_at;
   if v_kind='recently_read' then
    delete from community_private.lists where user_id=p_uid and kind=v_kind and content_id in
     (select content_id from community_private.lists where user_id=p_uid and kind=v_kind order by touched_at desc,content_id desc offset 100);
   end if;
  end if;
  return '{"success":true}';
 elsif p_action='report' then
  if p_args->>'reason' is null or p_args->>'reason' not in ('abuse','threat','spam','other') then raise exception 'Neispravan razlog prijave.'; end if;
  perform community_private.rate(p_uid,'reports',20);
  insert into community_private.reports(content_id,user_id,reason) values(v_id,p_uid,p_args->>'reason') on conflict do nothing;
  return '{"success":true}';
 end if;
 raise exception 'Nepoznata radnja.';
end $$;
revoke all on all functions in schema community_private from public,anon,authenticated;
grant execute on all functions in schema community_private to service_role;
revoke all on function public.community_dispatch(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.community_dispatch(uuid,text,jsonb) to service_role;
commit;
