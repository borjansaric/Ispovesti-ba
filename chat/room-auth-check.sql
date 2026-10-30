-- Narrow test-only Auth predicate; never grant service_role SELECT on auth.users.
begin;
create function chat_test.is_anonymous_user(p_uid uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users where id=p_uid and is_anonymous);
$$;
revoke all on function chat_test.is_anonymous_user(uuid) from public,anon,authenticated;
grant execute on function chat_test.is_anonymous_user(uuid) to service_role;
do $$ declare definition text; old text:='not exists(select 1 from auth.users where id=p_uid and is_anonymous)'; begin
 definition=pg_get_functiondef('public.chat_test_dispatch_v2(uuid,text,jsonb,text)'::regprocedure);
 if strpos(definition,old)=0 then raise exception 'Unexpected room function; inspect before continuing.';end if;
 execute replace(definition,old,'not chat_test.is_anonymous_user(p_uid)');
end $$;
notify pgrst,'reload schema';
commit;
