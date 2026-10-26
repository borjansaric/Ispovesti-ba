# Kompletan SQL za pregled — NIJE IZVRŠEN

Faze su odvojene. Ne izvršavati cijeli dokument kao jednu skriptu. Nijedan SQL ovdje nije odobren za produkcijsku primjenu.

## prepare-live.sql

```sql
-- PREPARED ONLY. Do not apply before explicit owner approval for the main site.
begin;
do $preflight$ begin
 if current_setting('ispovesti.launch_approval',true) is distinct from 'production-launch-v1' then raise exception 'Nedostaje odobrenje za glavni sajt.';end if;
 if to_regnamespace('community_live') is not null then raise exception 'Zvanična šema već postoji; ne ponavljati početnu pripremu.';end if;
 if (select count(*) from community_test.admins)<>1 then raise exception 'Potreban je tačno jedan postojeći administrator.';end if;
 if not exists(select 1 from community_test.security_settings where admin_auth_method='email' and captcha_enabled and captcha_secret_ciphertext is not null and captcha_sitekey<>'') then raise exception 'Potrebna je aktivna CAPTCHA i potvrda e-mailom.';end if;
end $preflight$;
-- Source: supabase/migrations/20261023212548_community_v2.sql
-- Isolated v2 schema. Does not delete, alter or import existing content.
-- Apply only to local/staging until final approval.
create schema community_live;
revoke all on schema community_live from public, anon, authenticated;
grant usage on schema community_live,auth to service_role;
grant select on auth.sessions to service_role;
create table community_live.content (
 id bigint generated always as identity primary key,
 kind text not null check(kind in ('confession','comment','reply')),
 author_id uuid references auth.users(id),
 confession_id bigint references community_live.content(id),
 parent_id bigint references community_live.content(id),
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
create index content_feed on community_live.content(state,published_at,id);
create index content_queue on community_live.content(created_at,id) where state='queued';
create index content_children on community_live.content(confession_id,parent_id,created_at,id);
create index content_author on community_live.content(author_id,created_at);
create table community_live.votes (
 content_id bigint references community_live.content(id) not null,
 user_id uuid references auth.users(id) not null,
 value smallint not null check(value in (-1,1)),
 first_voted_at timestamptz not null default clock_timestamp(),
 change_used boolean not null default false,
 primary key(content_id,user_id)
);

-- Fresh live-only comment favorites; these do not depend on the test chat.
create table community_live.comment_favorites(user_id uuid references auth.users(id) not null,content_id bigint references community_live.content(id) not null,primary key(user_id,content_id));
alter table community_live.comment_favorites enable row level security;
revoke all on community_live.comment_favorites from public,anon,authenticated;
grant all on community_live.comment_favorites to service_role;
create index comment_favorites_content on community_live.comment_favorites(content_id);

create function community_live.limit_vote_change() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if TG_OP='INSERT' then
  new.change_used=false;
 else
  if new.content_id is distinct from old.content_id or new.user_id is distinct from old.user_id
   or new.first_voted_at is distinct from old.first_voted_at then
   raise exception 'Identitet i vrijeme prvog glasa se ne mijenjaju.';
  end if;
  new.change_used=old.change_used;
  if new.value is distinct from old.value then
   if old.change_used or clock_timestamp()>=old.first_voted_at+interval '10 minutes' then
    new.value=old.value;
   else
    new.change_used=true;
   end if;
  end if;
 end if;
 return new;
end $$;
revoke all on function community_live.limit_vote_change() from public,anon,authenticated;
create trigger enforce_one_vote_change before insert or update on community_live.votes
for each row execute function community_live.limit_vote_change();

create table community_live.lists (
 user_id uuid references auth.users(id) not null,
 kind text not null check(kind in ('favorites','recently_read')),
 content_id bigint references community_live.content(id) not null,
 touched_at timestamptz not null default clock_timestamp(),
 primary key(user_id,kind,content_id)
);
create index lists_owner on community_live.lists(user_id,kind,touched_at desc);
create table community_live.reports (
 content_id bigint references community_live.content(id) not null,
 user_id uuid references auth.users(id) not null,
 reason text not null check(reason in ('abuse','threat','spam','other')),
 created_at timestamptz not null default clock_timestamp(),
 primary key(content_id,user_id)
);
create table community_live.admins(user_id uuid primary key references auth.users(id));
create table community_live.audit_log (
 id bigint generated always as identity primary key,
 admin_id uuid not null references auth.users(id),
 content_id bigint not null references community_live.content(id),
 action text not null,
 created_at timestamptz not null default clock_timestamp()
);
create table community_live.rate_limits (
 user_id uuid not null references auth.users(id), action text not null,
 started_at timestamptz not null, n integer not null,
 primary key(user_id,action)
);
create table community_live.publisher (
 singleton boolean primary key default true check(singleton),
 last_published_at timestamptz not null default clock_timestamp(),
 started_at timestamptz not null default clock_timestamp(),
 paused boolean not null default false
);
insert into community_live.publisher(singleton) values(true);
-- All data is behind an authenticated Edge gateway; no direct client grants.
alter table community_live.content enable row level security;
alter table community_live.votes enable row level security;
alter table community_live.lists enable row level security;
alter table community_live.reports enable row level security;
alter table community_live.admins enable row level security;
alter table community_live.audit_log enable row level security;
alter table community_live.rate_limits enable row level security;
alter table community_live.publisher enable row level security;
create index content_parent on community_live.content(parent_id) where parent_id is not null;
create index votes_user on community_live.votes(user_id);
create index lists_content on community_live.lists(content_id);
create index reports_user on community_live.reports(user_id);
create index audit_admin on community_live.audit_log(admin_id);
create index audit_content on community_live.audit_log(content_id);
grant all on all tables in schema community_live to service_role;
grant usage, select on all sequences in schema community_live to service_role;

-- Match browser trim() for ASCII and Unicode whitespace; keep interior newlines intact.
create function community_live.trim_text(p_text text) returns text
language sql immutable security invoker set search_path='' as $$
 select btrim(p_text,U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF');
$$;

create function community_live.visible(p_id bigint) returns boolean
language sql stable security invoker set search_path='' as $$
 with recursive ancestors as (
 select c.id,c.parent_id,c.confession_id,c.state from community_live.content c where c.id=p_id
 union all
 select c.id,c.parent_id,c.confession_id,c.state from community_live.content c
 join ancestors a on c.id=coalesce(a.parent_id,a.confession_id)
 ) select exists(select 1 from ancestors) and not exists(select 1 from ancestors where state<>'published');
$$;

create function community_live.rate(p_uid uuid,p_action text,p_max integer) returns void
language plpgsql security invoker set search_path='' as $$
declare v_count integer;
begin
 insert into community_live.rate_limits values(p_uid,p_action,clock_timestamp(),1)
 on conflict(user_id,action) do update set
 n=case when community_live.rate_limits.started_at <= clock_timestamp()-interval '10 minutes' then 1 else community_live.rate_limits.n+1 end,
 started_at=case when community_live.rate_limits.started_at <= clock_timestamp()-interval '10 minutes' then clock_timestamp() else community_live.rate_limits.started_at end
 returning n into v_count;
 if v_count>p_max then raise exception 'Previše radnji. Pokušaj kasnije.' using errcode='P0001'; end if;
end $$;

create function community_live.publish_one() returns bigint
language plpgsql security invoker set search_path='' as $$
declare p community_live.publisher; v_id bigint;
begin
 select * into p from community_live.publisher where singleton for update;
 if p.paused or clock_timestamp() < p.last_published_at + interval '1 hour' then return null; end if;
 select id into v_id from community_live.content where state='queued' and kind='confession' order by created_at,id limit 1 for update;
 if v_id is null then return null; end if;
 update community_live.content set state='published',published_at=clock_timestamp() where id=v_id;
 update community_live.publisher set last_published_at=clock_timestamp() where singleton;
 return v_id;
end $$;

create function public.community_live_dispatch(p_uid uuid,p_action text,p_args jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
 v_id bigint; v_parent bigint; v_conf bigint; v_kind text; v_body text; v_nick text;
 v_row community_live.content; v_vote community_live.votes;
 v_result jsonb; v_ids jsonb; v_entry jsonb; v_duplicate boolean; v_value smallint;
 v_offset integer := greatest(0,least(coalesce((p_args->>'offset')::integer,0),1000000));
 v_now timestamptz := clock_timestamp();
begin
 -- Caller must be service_role. Identity is verified by gateway, never accepted from body.
 if current_user not in ('service_role','postgres') then raise exception 'Zabranjeno.' using errcode='42501'; end if;
 if p_action='release_status' then return jsonb_build_object('vote_changes',1,'reply_parent','root-comment','comment_meta','live-isolated','posting_policy','free');end if;
 if p_action='feed' then
  select coalesce(jsonb_agg(to_jsonb(x)-'rank'), '[]') into v_result from (
   select c.id::text id,c.body,c.nickname,c.published_at,
    (select count(*) from community_live.votes v where v.content_id=c.id) rank
   from community_live.content c where c.kind='confession' and c.state='published'
   order by
    case when p_args->>'sort'='popular' then (select count(*) from community_live.votes v where v.content_id=c.id) end desc,
    case when p_args->>'sort'='new' then c.published_at end desc,
    c.published_at asc,c.id asc limit 20 offset v_offset
  ) x;
  return jsonb_build_object('items',v_result);
 end if;
 if p_action='confession' then
  v_id=(p_args->>'id')::bigint;
  if not community_live.visible(v_id) then raise exception 'Sadržaj nije dostupan.'; end if;
  select jsonb_build_object('id',c.id::text,'body',c.body,'nickname',c.nickname,'published_at',c.published_at) into v_result from community_live.content c where c.id=v_id and c.kind='confession';
  if v_result is null then raise exception 'Ispovijest nije dostupna.'; end if;
  return jsonb_build_object('item',v_result);
 end if;
 if p_action='comments' then
  v_conf=(p_args->>'confession_id')::bigint; v_parent=(p_args->>'parent_id')::bigint;
  if not community_live.visible(v_conf) then raise exception 'Sadržaj nije dostupan.'; end if;
  select coalesce(jsonb_agg(to_jsonb(x)),'[]') into v_result from (
   select c.id::text id,c.body,c.nickname,c.created_at,c.parent_id::text parent_id,
    exists(select 1 from community_live.content r where r.parent_id=c.id and r.state='published') has_replies
   from community_live.content c where c.confession_id=v_conf and c.parent_id is not distinct from v_parent
    and community_live.visible(c.id) order by c.created_at,c.id limit 20 offset v_offset
  ) x;
  return jsonb_build_object('items',v_result);
 end if;
 if p_uid is null then raise exception 'Potrebna je anonimna sesija.' using errcode='28000'; end if;
 if p_action in ('comment_meta','comment_favorite') then
  if p_action='comment_favorite' then
   v_id=(p_args->>'id')::bigint;
   if not coalesce(community_live.visible(v_id),false) or not exists(select 1 from community_live.content where id=v_id and kind in ('comment','reply')) then raise exception 'Komentar nije dostupan.';end if;
   perform community_live.rate(p_uid,'lists',240);
   if coalesce((p_args->>'enabled')::boolean,false) then insert into community_live.comment_favorites values(p_uid,v_id) on conflict do nothing;
   else delete from community_live.comment_favorites where user_id=p_uid and content_id=v_id;end if;
   return '{"success":true}';
  end if;
  if coalesce(jsonb_typeof(p_args->'ids'),'null')<>'array' then raise exception 'Najviše 50 komentara.';end if;
  if jsonb_array_length(p_args->'ids')>50 then raise exception 'Najviše 50 komentara.';end if;
  select coalesce(jsonb_object_agg(x.id::text,jsonb_build_object('replies',x.n,'favorite',exists(select 1 from community_live.comment_favorites f where f.user_id=p_uid and f.content_id=x.id))),'{}'::jsonb) into v_result from (
   select c0.id,(with recursive descendants as (select id from community_live.content where parent_id=c0.id and community_live.visible(id) union all select c1.id from community_live.content c1 join descendants d on c1.parent_id=d.id where community_live.visible(c1.id)) select count(*) from descendants) n
   from community_live.content c0 where c0.id in (select value::bigint from jsonb_array_elements_text(p_args->'ids')) and c0.kind in ('comment','reply') and community_live.visible(c0.id)
  ) x;return v_result;
 end if;

 if p_action in ('submit','vote','admin_remove') then perform pg_advisory_xact_lock(73142011); end if;
 if p_action like 'admin_%' then
  if not exists(select 1 from auth.sessions where id=(p_args->>'_session_id')::uuid and user_id=p_uid and (not_after is null or not_after>clock_timestamp())) then raise exception 'Administratorska sesija je istekla.' using errcode='42501'; end if;
  if not exists(select 1 from community_live.admins where user_id=p_uid) then raise exception 'Zabranjeno.' using errcode='42501'; end if;
  if p_action='admin_list' then
   select coalesce(jsonb_agg(to_jsonb(x)),'[]') into v_result from (
    select c.id::text id,c.kind,c.body,c.nickname,c.state,c.created_at,c.removed_at,
      (select coalesce(jsonb_agg(jsonb_build_object('reason',r.reason,'created_at',r.created_at)),'[]') from community_live.reports r where r.content_id=c.id) reports
    from community_live.content c where
     (p_args->>'view'='queue' and c.state='queued') or
     (p_args->>'view'='archive' and c.state='removed') or
     (p_args->>'view'='published' and c.state='published') or
     (p_args->>'view'='reports' and exists(select 1 from community_live.reports r where r.content_id=c.id))
    order by c.created_at,c.id limit 50 offset v_offset
   ) x;
   return jsonb_build_object('items',v_result);
  elsif p_action='admin_remove' then
   v_id=(p_args->>'id')::bigint;
   update community_live.content set state='removed',removed_at=v_now where id=v_id;
   if not found then raise exception 'Sadržaj nije dostupan.'; end if;
   insert into community_live.audit_log(admin_id,content_id,action) values(p_uid,v_id,'remove');
   return '{"success":true}';
  elsif p_action='admin_publisher' then
   -- No manual bulk publishing or reordering: only pause/resume FIFO scheduler.
   update community_live.publisher set paused=(p_args->>'paused')::boolean where singleton;
   return '{"success":true}';
  end if;
  raise exception 'Nepoznata administratorska radnja.';
 end if;
 if p_action='submit' then
  v_kind=p_args->>'kind'; v_body=community_live.trim_text(p_args->>'body'); v_nick=nullif(community_live.trim_text(p_args->>'nickname'),'');
  if v_kind is null or v_kind not in ('confession','comment','reply') or v_body is null or char_length(v_body)<(case when v_kind='confession' then 15 else 1 end)
   or char_length(v_body)>(case when v_kind='confession' then 5000 else 1000 end)
   or char_length(v_nick)>40 then raise exception 'Tekst nije dozvoljene dužine.'; end if;
  if v_body ~* '(https?[:：]|www\.|[[:alnum:]][[:alnum:]._-]*\.[[:alpha:]]{2,}|mailto:|ftp:|tel:)' or v_nick ~* '(https?[:：]|www\.|[[:alnum:]][[:alnum:]._-]*\.[[:alpha:]]{2,}|mailto:|ftp:|tel:)' then raise exception 'Linkovi nisu dozvoljeni.'; end if;
  perform community_live.rate(p_uid,'submit_'||v_kind,case when v_kind='confession' then 3 else 6 end);
  select exists(select 1 from community_live.content where author_id=p_uid and body=v_body and kind=v_kind) into v_duplicate;
  if v_duplicate and coalesce((p_args->>'allow_duplicate')::boolean,false)=false then return '{"duplicate":true}'; end if;
  if v_kind<>'confession' then
   v_conf=(p_args->>'confession_id')::bigint;
   select * into v_row from community_live.content where id=v_conf;
   if v_row.kind is distinct from 'confession' or not community_live.visible(v_conf) then raise exception 'Ispovijest nije dostupna.'; end if;
   if v_kind='reply' then
    v_parent=(p_args->>'parent_id')::bigint;
    select * into v_row from community_live.content where id=v_parent;
    if v_row.kind is distinct from 'comment' or v_row.parent_id is not null or v_row.confession_id is distinct from v_conf or not community_live.visible(v_parent) then raise exception 'Komentar nije dostupan.'; end if;
   end if;
  end if;
  insert into community_live.content(kind,author_id,body,nickname,confession_id,parent_id,state,published_at)
  values(v_kind,p_uid,v_body,v_nick,v_conf,v_parent,case when v_kind='confession' then 'queued' else 'published' end,case when v_kind<>'confession' then v_now end) returning id into v_id;
  return jsonb_build_object('success',true,'id',v_id::text);
 end if;
 if p_action='cards' then
  v_ids=p_args->'ids';
  if jsonb_typeof(v_ids) is distinct from 'array' or jsonb_array_length(v_ids)>20 then raise exception 'Neispravna lista.'; end if;
  v_result='{}';
  for v_entry in select * from jsonb_array_elements(v_ids) loop
   v_id=(v_entry#>>'{}')::bigint;
   if community_live.visible(v_id) then
    v_result=v_result||jsonb_build_object(v_id::text,jsonb_build_object(
      'vote',public.community_live_dispatch(p_uid,'vote_status',jsonb_build_object('id',v_id::text)),
      'context',public.community_live_dispatch(p_uid,'context',jsonb_build_object('id',v_id::text))));
   end if;
  end loop;
  return v_result;
 end if;
 if p_action='list' then
  v_kind=p_args->>'list';
  if v_kind='my_comments' then
   select coalesce(jsonb_agg(to_jsonb(x)),'[]') into v_result from (
    select c.id::text id,c.confession_id::text confession_id,c.body,c.nickname,c.created_at from community_live.content c
    where c.author_id=p_uid and c.kind<>'confession' and community_live.visible(c.id)
    order by c.created_at desc,c.id desc limit 20 offset v_offset) x;
  elsif v_kind in ('favorites','recently_read') then
   select coalesce(jsonb_agg(to_jsonb(x)),'[]') into v_result from (
    select c.id::text id,c.body,c.nickname,c.published_at from community_live.lists l join community_live.content c on c.id=l.content_id
    where l.user_id=p_uid and l.kind=v_kind and community_live.visible(c.id)
    order by l.touched_at desc,c.id desc limit 20 offset v_offset) x;
  else raise exception 'Nepoznata lista.'; end if;
  return jsonb_build_object('items',v_result);
 end if;
 v_id=(p_args->>'id')::bigint;
 if not coalesce(community_live.visible(v_id),false) then raise exception 'Sadržaj nije dostupan.'; end if;
 if p_action='vote' or p_action='vote_status' then
  if p_action='vote' then
   perform community_live.rate(p_uid,'vote',120);
   v_value=(p_args->>'value')::smallint;
   if v_value is null or v_value not in (-1,1) then raise exception 'Neispravan glas.'; end if;
   insert into community_live.votes(content_id,user_id,value) values(v_id,p_uid,v_value)
   on conflict(content_id,user_id) do update set value=excluded.value
   where clock_timestamp() < community_live.votes.first_voted_at + interval '10 minutes';
  end if;
  select * into v_vote from community_live.votes where content_id=v_id and user_id=p_uid;
  v_result=jsonb_build_object('my_vote',v_vote.value,'can_change',case when v_vote.user_id is null then true else not v_vote.change_used and clock_timestamp()<v_vote.first_voted_at+interval '10 minutes' end);
  if v_vote.first_voted_at + interval '10 minutes' <= clock_timestamp() then
   select v_result||jsonb_build_object('likes',count(*) filter(where value=1),'dislikes',count(*) filter(where value=-1)) into v_result from community_live.votes where content_id=v_id;
  end if;
  return v_result;
 elsif p_action='context' then
  select case when exists(select 1 from community_live.content where author_id=p_uid and confession_id=v_id) then
    (select count(*) from community_live.content c where c.confession_id=v_id and community_live.visible(c.id)) end into v_conf;
  return jsonb_build_object('comment_count',v_conf,'favorite',exists(select 1 from community_live.lists where user_id=p_uid and kind='favorites' and content_id=v_id));
 elsif p_action='favorite' or p_action='read' then
  select * into v_row from community_live.content where id=v_id;
  if v_row.kind<>'confession' then raise exception 'Očekivana je ispovijest.'; end if;
  perform community_live.rate(p_uid,'lists',240);
  v_kind=case when p_action='read' then 'recently_read' else 'favorites' end;
  if p_action='favorite' and (p_args->>'enabled')::boolean=false then
   delete from community_live.lists where user_id=p_uid and kind=v_kind and content_id=v_id;
  else
   insert into community_live.lists values(p_uid,v_kind,v_id,v_now) on conflict(user_id,kind,content_id) do update set touched_at=excluded.touched_at;
   if v_kind='recently_read' then
    delete from community_live.lists where user_id=p_uid and kind=v_kind and content_id in
     (select content_id from community_live.lists where user_id=p_uid and kind=v_kind order by touched_at desc,content_id desc offset 100);
   end if;
  end if;
  return '{"success":true}';
 elsif p_action='report' then
  if p_args->>'reason' is null or p_args->>'reason' not in ('abuse','threat','spam','other') then raise exception 'Neispravan razlog prijave.'; end if;
  perform community_live.rate(p_uid,'reports',20);
  insert into community_live.reports(content_id,user_id,reason) values(v_id,p_uid,p_args->>'reason') on conflict do nothing;
  return '{"success":true}';
 end if;
 raise exception 'Nepoznata radnja.';
end $$;
revoke all on all functions in schema community_live from public,anon,authenticated;
grant execute on all functions in schema community_live to service_role;
revoke all on function public.community_live_dispatch(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.community_live_dispatch(uuid,text,jsonb) to service_role;
-- Source: supabase/admin-captcha.sql
alter table community_live.content add column removal_previous_state text check(removal_previous_state in ('queued','published'));
create unique index admins_one_owner on community_live.admins ((true));
create table community_live.security_settings (
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
alter table community_live.security_settings enable row level security;
revoke all on community_live.security_settings from public,anon,authenticated;
grant all on community_live.security_settings to service_role;
insert into community_live.security_settings(singleton) values(true);
create function community_live.assert_admin(p_uid uuid,p_session text) returns void
language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from community_live.admins a where a.user_id=p_uid)
 or not exists(select 1 from auth.sessions s where s.id=p_session::uuid and s.user_id=p_uid and (s.not_after is null or s.not_after>clock_timestamp())) then
  raise exception 'Zabranjena ili istekla administratorska sesija.' using errcode='42501';
 end if;
end $$;
alter function public.community_live_dispatch(uuid,text,jsonb) rename to community_live_dispatch_base;
create function public.community_live_dispatch(p_uid uuid,p_action text,p_args jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_result jsonb;v_id bigint;v_state text;v_previous text;v_kind text;v_at timestamptz;v_offset integer;
begin
 if current_user not in ('service_role','postgres') then raise exception 'Zabranjeno.' using errcode='42501'; end if;
 if p_action like 'admin_%' then
  perform community_live.assert_admin(p_uid,p_args->>'_session_id');
  if p_action='admin_session' then return '{"admin":true}'; end if;
  if p_args->>'_aal' is distinct from 'aal2' then raise exception 'Potrebna je dvofaktorska potvrda.' using errcode='42501'; end if;
  if p_action='admin_remove' then
   perform pg_advisory_xact_lock(73142011);
   v_id=(p_args->>'id')::bigint;select state into v_state from community_live.content where id=v_id for update;
   if not found then raise exception 'Sadržaj nije dostupan.'; end if;
   if v_state='removed' then return '{"success":true}'; end if;
   v_result=public.community_live_dispatch_base(p_uid,p_action,p_args);
   update community_live.content set removal_previous_state=v_state where id=v_id;return v_result;
  elsif p_action='admin_restore' then
   perform pg_advisory_xact_lock(73142011);v_id=(p_args->>'id')::bigint;
   select state,removal_previous_state,kind,published_at into v_state,v_previous,v_kind,v_at from community_live.content where id=v_id for update;
   if not found then raise exception 'Sadržaj nije dostupan.'; end if;
   if v_state<>'removed' then return '{"success":true}'; end if;
   v_previous=coalesce(v_previous,case when v_kind='confession' and v_at is null then 'queued' else 'published' end);
   update community_live.content set state=v_previous,removed_at=null,removal_previous_state=null where id=v_id;
   insert into community_live.audit_log(admin_id,content_id,action) values(p_uid,v_id,'restore');
   return jsonb_build_object('success',true,'state',v_previous,'visible',community_live.visible(v_id));
  elsif p_action='admin_list' then
   v_offset=greatest(0,least(coalesce((p_args->>'offset')::integer,0),1000000));
   if p_args->>'view' not in ('queue','archive','published','reports') then raise exception 'Nepoznat pregled.'; end if;
   select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into v_result from (
    select c.id::text id,c.kind,c.body,c.nickname,c.state,c.created_at,c.removed_at,c.parent_id::text parent_id,c.confession_id::text confession_id,
     community_live.visible(c.id) as publicly_visible,
     (select coalesce(jsonb_agg(jsonb_build_object('reason',r.reason,'created_at',r.created_at) order by r.created_at),'[]'::jsonb) from community_live.reports r where r.content_id=c.id) reports
    from community_live.content c where
     (p_args->>'view'='queue' and c.state='queued') or
     (p_args->>'view'='archive' and (c.state='removed' or (c.state='published' and not community_live.visible(c.id)))) or
     (p_args->>'view'='published' and community_live.visible(c.id)) or
     (p_args->>'view'='reports' and exists(select 1 from community_live.reports r where r.content_id=c.id))
    order by c.created_at,c.id limit 50 offset v_offset) x;
   return jsonb_build_object('items',v_result);
  end if;
 end if;
 return public.community_live_dispatch_base(p_uid,p_action,p_args);
end $$;
create function public.community_live_security(p_uid uuid,p_action text,p_args jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare s community_live.security_settings;v_uid uuid;v_enabled boolean;v_sitekey text;v_cipher text;
begin
 if current_user not in ('service_role','postgres') then raise exception 'Zabranjeno.' using errcode='42501'; end if;
 if p_action='public_config' then
  select * into s from community_live.security_settings where singleton;
  return jsonb_build_object('enabled',s.captcha_enabled,'sitekey',s.captcha_sitekey);
 elsif p_action='runtime_config' then
  select * into s from community_live.security_settings where singleton;
  return jsonb_build_object('enabled',s.captcha_enabled,'sitekey',s.captcha_sitekey,'secret_ciphertext',s.captcha_secret_ciphertext,'hostname',s.captcha_hostname);
 elsif p_action like 'bootstrap_%' then
  select * into s from community_live.security_settings where singleton for update;
  if s.activation_hash is null or s.activation_hash is distinct from p_args->>'hash' or s.activation_expires_at is null or s.activation_expires_at<=clock_timestamp()
   or lower(p_args->>'email') is distinct from s.owner_email or exists(select 1 from community_live.admins) then
   raise exception 'Aktivacija nije dozvoljena ili je istekla.' using errcode='42501';
  end if;
  if p_action='bootstrap_claim' then
   if s.activation_claim_until>clock_timestamp() then raise exception 'Aktivacija je već u toku. Sačekaj dvije minute.'; end if;
   update community_live.security_settings set activation_claim_until=clock_timestamp()+interval '2 minutes' where singleton;
   return '{"claimed":true}';
  elsif p_action='bootstrap_release' then
   update community_live.security_settings set activation_claim_until=null where singleton;return '{"success":true}';
  elsif p_action='bootstrap_finish' then
   v_uid=(p_args->>'user_id')::uuid;
   -- These claims come only from the gateway's verified Auth response, not client arguments.
   -- The admins.user_id foreign key additionally requires a real Auth identity.
   if lower(p_args->>'verified_email') is distinct from s.owner_email or (p_args->>'verified_anonymous')::boolean is distinct from false or nullif(p_args->>'verified_confirmed_at','') is null then
    raise exception 'Nalog nije potvrđen.' using errcode='42501';
   end if;
   insert into community_live.admins(user_id) values(v_uid);
   update community_live.security_settings set activation_hash=null,activation_expires_at=null,activation_claim_until=null,updated_at=clock_timestamp() where singleton;
   return '{"success":true}';
  end if;
 else
  perform community_live.assert_admin(p_uid,p_args->>'_session_id');
  if p_args->>'_aal' is distinct from 'aal2' then raise exception 'Potrebna je dvofaktorska potvrda.' using errcode='42501'; end if;
  if p_action='admin_security_get' then
   select * into s from community_live.security_settings where singleton;
   return jsonb_build_object('enabled',s.captcha_enabled,'sitekey',s.captcha_sitekey,'secret_set',s.captcha_secret_ciphertext is not null,'hostname',s.captcha_hostname);
  elsif p_action='admin_security_set' then
   select * into s from community_live.security_settings where singleton for update;
   v_enabled=coalesce((p_args->>'enabled')::boolean,false);v_sitekey=coalesce(nullif(p_args->>'sitekey',''),s.captcha_sitekey);
   v_cipher=coalesce(nullif(p_args->>'secret_ciphertext',''),s.captcha_secret_ciphertext);
   if length(v_sitekey)>100 or length(v_cipher)>2000 or (v_enabled and (length(v_sitekey)<10 or v_cipher is null)) then raise exception 'Nedostaju ispravni CAPTCHA ključevi.'; end if;
   update community_live.security_settings set captcha_enabled=v_enabled,captcha_sitekey=v_sitekey,captcha_secret_ciphertext=v_cipher,updated_at=clock_timestamp() where singleton;
   return jsonb_build_object('enabled',v_enabled,'sitekey',v_sitekey,'secret_set',v_cipher is not null,'hostname',s.captcha_hostname);
  end if;
 end if;
 raise exception 'Nepoznata sigurnosna radnja.';
end $$;
revoke all on function community_live.assert_admin(uuid,text) from public,anon,authenticated;
grant execute on function community_live.assert_admin(uuid,text) to service_role;
revoke all on function public.community_live_dispatch(uuid,text,jsonb),public.community_live_security(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.community_live_dispatch(uuid,text,jsonb),public.community_live_security(uuid,text,jsonb) to service_role;
notify pgrst, 'reload schema';
-- Source: supabase/admin-email.sql
alter table community_live.security_settings add column admin_auth_method text not null default 'totp' check(admin_auth_method in ('totp','email'));
create table community_live.admin_email_sessions (
 user_id uuid primary key references community_live.admins(user_id),
 session_id uuid not null,
 challenge_hash text not null,
 issued_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null,
 attempts integer not null default 0 check(attempts between 0 and 5),
 verified_until timestamptz,
 verifying_until timestamptz
);
alter table community_live.admin_email_sessions enable row level security;
revoke all on community_live.admin_email_sessions from public,anon,authenticated;
grant all on community_live.admin_email_sessions to service_role;
create function community_live.assert_admin_email(p_uid uuid,p_session text) returns void
language plpgsql security invoker set search_path='' as $$
begin
 perform community_live.assert_admin(p_uid,p_session);
 if not exists(select 1 from community_live.admin_email_sessions where user_id=p_uid and session_id=p_session::uuid and verified_until>clock_timestamp()) then
  raise exception 'Potvrdi pristup kodom sa e-maila.' using errcode='42501';
 end if;
end $$;
create function public.community_live_admin_email(p_uid uuid,p_action text,p_args jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare s community_live.admin_email_sessions;v_email text;
begin
 if current_user not in ('service_role','postgres') then raise exception 'Zabranjeno.' using errcode='42501'; end if;
 perform community_live.assert_admin(p_uid,p_args->>'_session_id');
 select owner_email into v_email from community_live.security_settings where singleton;
 if p_action='status' then
  return jsonb_build_object('verified',exists(select 1 from community_live.admin_email_sessions where user_id=p_uid and session_id=(p_args->>'_session_id')::uuid and verified_until>clock_timestamp()));
 end if;
 -- Serialize all challenges for the sole owner, including requests from other sessions.
 perform pg_advisory_xact_lock(73142012);
 select * into s from community_live.admin_email_sessions where user_id=p_uid for update;
 if p_action='begin' then
  if s.issued_at>clock_timestamp()-interval '60 seconds' then return '{"limited":true}'; end if;
  if length(p_args->>'challenge_hash')<>64 then raise exception 'Neispravan zahtjev.'; end if;
  insert into community_live.admin_email_sessions(user_id,session_id,challenge_hash,expires_at)
  values(p_uid,(p_args->>'_session_id')::uuid,p_args->>'challenge_hash',clock_timestamp()+interval '10 minutes')
  on conflict(user_id) do update set session_id=excluded.session_id,challenge_hash=excluded.challenge_hash,issued_at=excluded.issued_at,expires_at=excluded.expires_at,attempts=0,verified_until=null,verifying_until=null;
  return jsonb_build_object('email',v_email);
 end if;
 if s.user_id is null or s.session_id<>(p_args->>'_session_id')::uuid or s.challenge_hash is distinct from p_args->>'challenge_hash' or s.expires_at<=clock_timestamp() or s.verified_until is not null then
  return '{"denied":true}';
 end if;
 if p_action='attempt' then
  if s.attempts>=5 or s.verifying_until>clock_timestamp() then return '{"denied":true}'; end if;
  update community_live.admin_email_sessions set attempts=attempts+1,verifying_until=clock_timestamp()+interval '30 seconds' where user_id=p_uid;
  return jsonb_build_object('email',v_email);
 elsif p_action='failed' then
  update community_live.admin_email_sessions set verifying_until=null where user_id=p_uid;
  return '{"success":true}';
 elsif p_action='finish' then
  if s.verifying_until is null or s.verifying_until<=clock_timestamp() or p_args->>'verified_uid' is distinct from p_uid::text or lower(p_args->>'verified_email') is distinct from v_email then return '{"denied":true}'; end if;
  update community_live.admin_email_sessions set verified_until=clock_timestamp()+interval '8 hours',expires_at=clock_timestamp(),verifying_until=null where user_id=p_uid;
  update community_live.security_settings set admin_auth_method='email',updated_at=clock_timestamp() where singleton;
  return '{"verified":true}';
 end if;
 raise exception 'Nepoznata radnja.';
end $$;
revoke all on function community_live.assert_admin_email(uuid,text),public.community_live_admin_email(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function community_live.assert_admin_email(uuid,text),public.community_live_admin_email(uuid,text,jsonb) to service_role;
-- Preserve existing TOTP until this owner successfully proves the new e-mail flow.
create function community_live.assert_admin_access(p_uid uuid,p_session text,p_aal text) returns void
language plpgsql security invoker set search_path='' as $$
begin
 perform community_live.assert_admin(p_uid,p_session);
 if (select admin_auth_method from community_live.security_settings where singleton)='totp' and p_aal='aal2' then return; end if;
 perform community_live.assert_admin_email(p_uid,p_session);
end $$;
revoke all on function community_live.assert_admin_access(uuid,text,text) from public,anon,authenticated;
grant execute on function community_live.assert_admin_access(uuid,text,text) to service_role;
create or replace function public.community_live_dispatch(p_uid uuid,p_action text,p_args jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_result jsonb;v_id bigint;v_state text;v_previous text;v_kind text;v_at timestamptz;v_offset integer;
begin
 if current_user not in ('service_role','postgres') then raise exception 'Zabranjeno.' using errcode='42501'; end if;
 if p_action like 'admin_%' then
  perform community_live.assert_admin(p_uid,p_args->>'_session_id');
  if p_action='admin_session' then return '{"admin":true}'; end if;
  perform community_live.assert_admin_access(p_uid,p_args->>'_session_id',p_args->>'_aal');
  if p_action='admin_remove' then
   perform pg_advisory_xact_lock(73142011);
   v_id=(p_args->>'id')::bigint;select state into v_state from community_live.content where id=v_id for update;
   if not found then raise exception 'Sadržaj nije dostupan.'; end if;
   if v_state='removed' then return '{"success":true}'; end if;
   v_result=public.community_live_dispatch_base(p_uid,p_action,p_args);
   update community_live.content set removal_previous_state=v_state where id=v_id;return v_result;
  elsif p_action='admin_restore' then
   perform pg_advisory_xact_lock(73142011);v_id=(p_args->>'id')::bigint;
   select state,removal_previous_state,kind,published_at into v_state,v_previous,v_kind,v_at from community_live.content where id=v_id for update;
   if not found then raise exception 'Sadržaj nije dostupan.'; end if;
   if v_state<>'removed' then return '{"success":true}'; end if;
   v_previous=coalesce(v_previous,case when v_kind='confession' and v_at is null then 'queued' else 'published' end);
   update community_live.content set state=v_previous,removed_at=null,removal_previous_state=null where id=v_id;
   insert into community_live.audit_log(admin_id,content_id,action) values(p_uid,v_id,'restore');
   return jsonb_build_object('success',true,'state',v_previous,'visible',community_live.visible(v_id));
  elsif p_action='admin_list' then
   v_offset=greatest(0,least(coalesce((p_args->>'offset')::integer,0),1000000));
   if p_args->>'view' not in ('queue','archive','published','reports') then raise exception 'Nepoznat pregled.'; end if;
   select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into v_result from (
    select c.id::text id,c.kind,c.body,c.nickname,c.state,c.created_at,c.removed_at,c.parent_id::text parent_id,c.confession_id::text confession_id,
     community_live.visible(c.id) as publicly_visible,
     (select coalesce(jsonb_agg(jsonb_build_object('reason',r.reason,'created_at',r.created_at) order by r.created_at),'[]'::jsonb) from community_live.reports r where r.content_id=c.id) reports
    from community_live.content c where
     (p_args->>'view'='queue' and c.state='queued') or
     (p_args->>'view'='archive' and (c.state='removed' or (c.state='published' and not community_live.visible(c.id)))) or
     (p_args->>'view'='published' and community_live.visible(c.id)) or
     (p_args->>'view'='reports' and exists(select 1 from community_live.reports r where r.content_id=c.id))
    order by c.created_at,c.id limit 50 offset v_offset) x;
   return jsonb_build_object('items',v_result);
  end if;
 end if;
 return public.community_live_dispatch_base(p_uid,p_action,p_args);
end $$;
create or replace function public.community_live_security(p_uid uuid,p_action text,p_args jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare s community_live.security_settings;v_uid uuid;v_enabled boolean;v_sitekey text;v_cipher text;
begin
 if current_user not in ('service_role','postgres') then raise exception 'Zabranjeno.' using errcode='42501'; end if;
 if p_action='public_config' then
  select * into s from community_live.security_settings where singleton;
  return jsonb_build_object('enabled',s.captcha_enabled,'sitekey',s.captcha_sitekey);
 elsif p_action='runtime_config' then
  select * into s from community_live.security_settings where singleton;
  return jsonb_build_object('enabled',s.captcha_enabled,'sitekey',s.captcha_sitekey,'secret_ciphertext',s.captcha_secret_ciphertext,'hostname',s.captcha_hostname);
 elsif p_action like 'bootstrap_%' then
  select * into s from community_live.security_settings where singleton for update;
  if s.activation_hash is null or s.activation_hash is distinct from p_args->>'hash' or s.activation_expires_at is null or s.activation_expires_at<=clock_timestamp()
   or lower(p_args->>'email') is distinct from s.owner_email or exists(select 1 from community_live.admins) then
   raise exception 'Aktivacija nije dozvoljena ili je istekla.' using errcode='42501';
  end if;
  if p_action='bootstrap_claim' then
   if s.activation_claim_until>clock_timestamp() then raise exception 'Aktivacija je već u toku. Sačekaj dvije minute.'; end if;
   update community_live.security_settings set activation_claim_until=clock_timestamp()+interval '2 minutes' where singleton;
   return '{"claimed":true}';
  elsif p_action='bootstrap_release' then
   update community_live.security_settings set activation_claim_until=null where singleton;return '{"success":true}';
  elsif p_action='bootstrap_finish' then
   v_uid=(p_args->>'user_id')::uuid;
   -- These claims come only from the gateway's verified Auth response, not client arguments.
   -- The admins.user_id foreign key additionally requires a real Auth identity.
   if lower(p_args->>'verified_email') is distinct from s.owner_email or (p_args->>'verified_anonymous')::boolean is distinct from false or nullif(p_args->>'verified_confirmed_at','') is null then
    raise exception 'Nalog nije potvrđen.' using errcode='42501';
   end if;
   insert into community_live.admins(user_id) values(v_uid);
   update community_live.security_settings set activation_hash=null,activation_expires_at=null,activation_claim_until=null,updated_at=clock_timestamp() where singleton;
   return '{"success":true}';
  end if;
 else
  perform community_live.assert_admin(p_uid,p_args->>'_session_id');
  perform community_live.assert_admin_access(p_uid,p_args->>'_session_id',p_args->>'_aal');
  if p_action='admin_security_get' then
   select * into s from community_live.security_settings where singleton;
   return jsonb_build_object('enabled',s.captcha_enabled,'sitekey',s.captcha_sitekey,'secret_set',s.captcha_secret_ciphertext is not null,'hostname',s.captcha_hostname);
  elsif p_action='admin_security_set' then
   select * into s from community_live.security_settings where singleton for update;
   v_enabled=coalesce((p_args->>'enabled')::boolean,false);v_sitekey=coalesce(nullif(p_args->>'sitekey',''),s.captcha_sitekey);
   v_cipher=coalesce(nullif(p_args->>'secret_ciphertext',''),s.captcha_secret_ciphertext);
   if length(v_sitekey)>100 or length(v_cipher)>2000 or (v_enabled and (length(v_sitekey)<10 or v_cipher is null)) then raise exception 'Nedostaju ispravni CAPTCHA ključevi.'; end if;
   update community_live.security_settings set captcha_enabled=v_enabled,captcha_sitekey=v_sitekey,captcha_secret_ciphertext=v_cipher,updated_at=clock_timestamp() where singleton;
   return jsonb_build_object('enabled',v_enabled,'sitekey',v_sitekey,'secret_set',v_cipher is not null,'hostname',s.captcha_hostname);
  end if;
 end if;
 raise exception 'Nepoznata sigurnosna radnja.';
end $$;
notify pgrst, 'reload schema';
-- Source: supabase/comments-response.sql
create or replace function public.community_live_dispatch(p_uid uuid,p_action text,p_args jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_item jsonb;v_result jsonb;v_id bigint;v_state text;v_previous text;v_kind text;v_at timestamptz;v_offset integer;
begin
 if current_user not in ('service_role','postgres') then raise exception 'Zabranjeno.' using errcode='42501'; end if;
 if p_action like 'admin_%' then
  perform community_live.assert_admin(p_uid,p_args->>'_session_id');
  if p_action='admin_session' then return '{"admin":true}'; end if;
  perform community_live.assert_admin_access(p_uid,p_args->>'_session_id',p_args->>'_aal');
  if p_action='admin_remove' then
   perform pg_advisory_xact_lock(73142011);
   v_id=(p_args->>'id')::bigint;select state into v_state from community_live.content where id=v_id for update;
   if not found then raise exception 'Sadržaj nije dostupan.'; end if;
   if v_state='removed' then return '{"success":true}'; end if;
   v_result=public.community_live_dispatch_base(p_uid,p_action,p_args);
   update community_live.content set removal_previous_state=v_state where id=v_id;return v_result;
  elsif p_action='admin_restore' then
   perform pg_advisory_xact_lock(73142011);v_id=(p_args->>'id')::bigint;
   select state,removal_previous_state,kind,published_at into v_state,v_previous,v_kind,v_at from community_live.content where id=v_id for update;
   if not found then raise exception 'Sadržaj nije dostupan.'; end if;
   if v_state<>'removed' then return '{"success":true}'; end if;
   v_previous=coalesce(v_previous,case when v_kind='confession' and v_at is null then 'queued' else 'published' end);
   update community_live.content set state=v_previous,removed_at=null,removal_previous_state=null where id=v_id;
   insert into community_live.audit_log(admin_id,content_id,action) values(p_uid,v_id,'restore');
   return jsonb_build_object('success',true,'state',v_previous,'visible',community_live.visible(v_id));
  elsif p_action='admin_list' then
   v_offset=greatest(0,least(coalesce((p_args->>'offset')::integer,0),1000000));
   if p_args->>'view' not in ('queue','archive','published','reports') then raise exception 'Nepoznat pregled.'; end if;
   select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into v_result from (
    select c.id::text id,c.kind,c.body,c.nickname,c.state,c.created_at,c.removed_at,c.parent_id::text parent_id,c.confession_id::text confession_id,
     community_live.visible(c.id) as publicly_visible,
     (select coalesce(jsonb_agg(jsonb_build_object('reason',r.reason,'created_at',r.created_at) order by r.created_at),'[]'::jsonb) from community_live.reports r where r.content_id=c.id) reports
    from community_live.content c where
     (p_args->>'view'='queue' and c.state='queued') or
     (p_args->>'view'='archive' and (c.state='removed' or (c.state='published' and not community_live.visible(c.id)))) or
     (p_args->>'view'='published' and community_live.visible(c.id)) or
     (p_args->>'view'='reports' and exists(select 1 from community_live.reports r where r.content_id=c.id))
    order by c.created_at,c.id limit 50 offset v_offset) x;
   return jsonb_build_object('items',v_result);
  end if;
 end if;
 if p_action='submit' then
  v_result=public.community_live_dispatch_base(p_uid,p_action,p_args);
  if (v_result->>'success')::boolean is true and p_args->>'kind' in ('comment','reply') then
   select jsonb_build_object('id',c.id::text,'body',c.body,'nickname',c.nickname,'created_at',c.created_at,'parent_id',c.parent_id::text,'has_replies',false) into v_item
   from community_live.content c where c.id=(v_result->>'id')::bigint and c.author_id=p_uid and c.state='published' and community_live.visible(c.id);
   if v_item is not null then
    v_result=v_result||jsonb_build_object('item',v_item,'context',public.community_live_dispatch_base(p_uid,'context',jsonb_build_object('id',p_args->>'confession_id')));
   end if;
  end if;
  return v_result;
 end if;
 return public.community_live_dispatch_base(p_uid,p_action,p_args);
end $$;
notify pgrst, 'reload schema';
-- Source: supabase/submission-latency.sql
create table community_live.submission_receipts (
 user_id uuid not null references auth.users(id),
 request_id uuid not null,
 payload jsonb not null,
 result jsonb not null,
 created_at timestamptz not null default clock_timestamp(),
 primary key(user_id,request_id)
);
alter table community_live.submission_receipts enable row level security;
revoke all on community_live.submission_receipts from public,anon,authenticated;
grant select,insert on community_live.submission_receipts to service_role;
create or replace function public.community_live_dispatch(p_uid uuid,p_action text,p_args jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_item jsonb;v_result jsonb;v_id bigint;v_state text;v_previous text;v_kind text;v_at timestamptz;v_offset integer;v_request uuid;v_payload jsonb;v_receipt community_live.submission_receipts%rowtype;
begin
 if current_user not in ('service_role','postgres') then raise exception 'Zabranjeno.' using errcode='42501'; end if;
 if p_action like 'admin_%' then
  perform community_live.assert_admin(p_uid,p_args->>'_session_id');
  if p_action='admin_session' then return '{"admin":true}'; end if;
  perform community_live.assert_admin_access(p_uid,p_args->>'_session_id',p_args->>'_aal');
  if p_action='admin_remove' then
   perform pg_advisory_xact_lock(73142011);
   v_id=(p_args->>'id')::bigint;select state into v_state from community_live.content where id=v_id for update;
   if not found then raise exception 'Sadržaj nije dostupan.'; end if;
   if v_state='removed' then return '{"success":true}'; end if;
   v_result=public.community_live_dispatch_base(p_uid,p_action,p_args);
   update community_live.content set removal_previous_state=v_state where id=v_id;return v_result;
  elsif p_action='admin_restore' then
   perform pg_advisory_xact_lock(73142011);v_id=(p_args->>'id')::bigint;
   select state,removal_previous_state,kind,published_at into v_state,v_previous,v_kind,v_at from community_live.content where id=v_id for update;
   if not found then raise exception 'Sadržaj nije dostupan.'; end if;
   if v_state<>'removed' then return '{"success":true}'; end if;
   v_previous=coalesce(v_previous,case when v_kind='confession' and v_at is null then 'queued' else 'published' end);
   update community_live.content set state=v_previous,removed_at=null,removal_previous_state=null where id=v_id;
   insert into community_live.audit_log(admin_id,content_id,action) values(p_uid,v_id,'restore');
   return jsonb_build_object('success',true,'state',v_previous,'visible',community_live.visible(v_id));
  elsif p_action='admin_list' then
   v_offset=greatest(0,least(coalesce((p_args->>'offset')::integer,0),1000000));
   if p_args->>'view' not in ('queue','archive','published','reports') then raise exception 'Nepoznat pregled.'; end if;
   select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into v_result from (
    select c.id::text id,c.kind,c.body,c.nickname,c.state,c.created_at,c.removed_at,c.parent_id::text parent_id,c.confession_id::text confession_id,
     community_live.visible(c.id) as publicly_visible,
     (select coalesce(jsonb_agg(jsonb_build_object('reason',r.reason,'created_at',r.created_at) order by r.created_at),'[]'::jsonb) from community_live.reports r where r.content_id=c.id) reports
    from community_live.content c where
     (p_args->>'view'='queue' and c.state='queued') or
     (p_args->>'view'='archive' and (c.state='removed' or (c.state='published' and not community_live.visible(c.id)))) or
     (p_args->>'view'='published' and community_live.visible(c.id)) or
     (p_args->>'view'='reports' and exists(select 1 from community_live.reports r where r.content_id=c.id))
    order by c.created_at,c.id limit 50 offset v_offset) x;
   return jsonb_build_object('items',v_result);
  end if;
 end if;
 if p_action='submit' then
  if p_uid is null then raise exception 'Potrebna je anonimna sesija.' using errcode='28000'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_uid::text,73142012));
  v_request=nullif(p_args->>'request_id','')::uuid;
  v_payload=p_args-'request_id'-'captcha_token';
  if v_request is not null then
   select * into v_receipt from community_live.submission_receipts where user_id=p_uid and request_id=v_request;
   if found then
    if v_receipt.payload<>v_payload then raise exception 'Zahtjev za slanje je promijenjen. Pokušaj ponovo.'; end if;
    if v_receipt.result ? 'item' and not community_live.visible((v_receipt.result->>'id')::bigint) then raise exception 'Sadržaj više nije dostupan.'; end if;
    v_result=v_receipt.result||jsonb_build_object('replayed',true);
    if v_result ? 'context' then v_result=v_result||jsonb_build_object('context',public.community_live_dispatch_base(p_uid,'context',jsonb_build_object('id',p_args->>'confession_id'))); end if;
    return v_result;
   end if;
  end if;
  v_result=public.community_live_dispatch_base(p_uid,p_action,p_args);
  if (v_result->>'success')::boolean is true and p_args->>'kind' in ('comment','reply') then
   select jsonb_build_object('id',c.id::text,'body',c.body,'nickname',c.nickname,'created_at',c.created_at,'parent_id',c.parent_id::text,'has_replies',false) into v_item
   from community_live.content c where c.id=(v_result->>'id')::bigint and c.author_id=p_uid and c.state='published' and community_live.visible(c.id);
   if v_item is not null then
    v_result=v_result||jsonb_build_object('item',v_item,'context',public.community_live_dispatch_base(p_uid,'context',jsonb_build_object('id',p_args->>'confession_id')));
   end if;
  end if;
  if v_request is not null and (v_result->>'success')::boolean is true then
   insert into community_live.submission_receipts(user_id,request_id,payload,result) values(p_uid,v_request,v_payload,v_result);
  end if;
  return v_result;
 end if;
 return public.community_live_dispatch_base(p_uid,p_action,p_args);
end $$;
notify pgrst, 'reload schema';
-- Copy the existing owner's identity and encrypted protection settings inside Postgres only.
-- No content, votes, lists, rate limits, proof sessions or Auth credentials are copied.
insert into community_live.admins(user_id) select user_id from community_test.admins;
update community_live.security_settings l set
 captcha_enabled=t.captcha_enabled,captcha_sitekey=t.captcha_sitekey,
 captcha_secret_ciphertext=t.captcha_secret_ciphertext,captcha_hostname=t.captcha_hostname,
 owner_email=t.owner_email,admin_auth_method='email',activation_hash=null,
 activation_expires_at=null,activation_claim_until=null,updated_at=clock_timestamp()
from community_test.security_settings t where l.singleton and t.singleton;
update community_live.publisher set paused=true;
notify pgrst,'reload schema';
commit;

```

## activate-publisher.sql

```sql
-- Apply only in the approved launch operation, after the isolated backend is verified.
begin;
do $approval$ begin if current_setting('ispovesti.launch_approval',true) is distinct from 'production-launch-v1' then raise exception 'Nedostaje odobrenje za glavni sajt.';end if;end $approval$;
select cron.schedule('community-live-publish-hourly','* * * * *','select community_live.publish_one();');
update community_live.publisher set paused=false,last_published_at=clock_timestamp(),started_at=clock_timestamp() where singleton;
commit;

```

## archive-legacy-after-cutover.sql

```sql
-- PENDING SEPARATE OWNER APPROVAL. Never run while the old main site is active.
-- Old rows stay in place as a private archive; no rows/tables are deleted.
begin;
do $$ begin
 if current_setting('ispovesti.archive_approval',true) is distinct from 'archive-legacy-after-cutover-v1' then raise exception 'Arhiviranje čeka posebno odobrenje poslije prelaska glavnog sajta.';end if;
 if current_setting('ispovesti.cutover_verified',true) is distinct from 'live-http-and-admin-verified-v2' then raise exception 'Prvo potvrdi novi HTTP API i stvarnu administratorsku prijavu.';end if;
 if to_regnamespace('community_live') is null then raise exception 'Nova glavna šema ne postoji; stari API ne smije biti ugašen.';end if;
end $$;
revoke all privileges on table public.confessions,public.comments,public.votes,public.private_user_lists,public.submission_limits,public.test_spam from public,anon,authenticated,service_role;
do $$ declare r text;t text;begin
 foreach r in array array['anon','authenticated','service_role'] loop
  foreach t in array array['public.confessions','public.comments','public.votes','public.private_user_lists','public.submission_limits','public.test_spam'] loop
   if has_table_privilege(r,t,'SELECT,INSERT,UPDATE,DELETE') then raise exception 'Stari put nije zatvoren: % %',r,t;end if;
  end loop;
 end loop;
end $$;
notify pgrst,'reload schema';
commit;

```
