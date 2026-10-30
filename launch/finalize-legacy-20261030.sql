-- Owner approved after main cutover and real password/email login screenshots.
-- Application-data snapshot in the same project; not an external Auth/PITR backup.
begin;
set local lock_timeout = '8s';
set local statement_timeout = '60s';
do $$ begin
 if to_regnamespace('community_live') is null then raise exception 'Missing live schema'; end if;
 if (select count(*) from community_live.admins) <> 1 then raise exception 'Expected one live owner'; end if;
 if not exists(select 1 from community_live.admin_email_sessions) then raise exception 'Missing main email login evidence'; end if;
 if to_regnamespace('legacy_archive_20261030') is not null then raise exception 'Already archived; inspect instead of repeating'; end if;
end $$;
lock table public.confessions,public.comments,public.votes,public.private_user_lists,public.submission_limits,public.test_spam in share row exclusive mode;
create schema legacy_archive_20261030;
revoke all on schema legacy_archive_20261030 from public,anon,authenticated,service_role;
create table legacy_archive_20261030.manifest(table_name text primary key,row_count bigint not null,verified_at timestamptz not null default clock_timestamp());
alter table legacy_archive_20261030.manifest enable row level security;
do $$ declare t text; n bigint; mismatch boolean; begin
 foreach t in array array['confessions','comments','votes','private_user_lists','submission_limits','test_spam'] loop
  execute format('create table legacy_archive_20261030.%I as table public.%I',t,t);
  execute format('alter table legacy_archive_20261030.%I enable row level security',t);
  execute format('select exists((table public.%I except all table legacy_archive_20261030.%I) union all (table legacy_archive_20261030.%I except all table public.%I))',t,t,t,t) into mismatch;
  if mismatch then raise exception 'Archive differs: %',t; end if;
  execute format('select count(*) from public.%I',t) into n;
  insert into legacy_archive_20261030.manifest(table_name,row_count) values(t,n);
 end loop;
end $$;
revoke all on all tables in schema legacy_archive_20261030 from public,anon,authenticated,service_role;
revoke all privileges on table public.confessions,public.comments,public.votes,public.private_user_lists,public.submission_limits,public.test_spam from public,anon,authenticated,service_role;
do $$ declare r text;t text;begin
 foreach r in array array['anon','authenticated','service_role'] loop
  foreach t in array array['confessions','comments','votes','private_user_lists','submission_limits','test_spam'] loop
   if has_table_privilege(r,'public.'||t,'SELECT,INSERT,UPDATE,DELETE') or has_any_column_privilege(r,'public.'||t,'SELECT,INSERT,UPDATE') then raise exception 'Legacy access remains: % %',r,t;end if;
   if has_table_privilege(r,'legacy_archive_20261030.'||t,'SELECT,INSERT,UPDATE,DELETE') then raise exception 'Archive access remains';end if;
  end loop;
 end loop;
end $$;
notify pgrst,'reload schema';
commit;
