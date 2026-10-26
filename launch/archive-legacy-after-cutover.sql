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
