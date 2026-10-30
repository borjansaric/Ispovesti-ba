-- Pending owner approval. Test schema only; no chat or main-site objects.
begin;
do $$ begin
 if exists(select 1 from community_test.votes where first_voted_at>clock_timestamp()-interval '10 minutes') then
  raise exception 'Sačekaj da prethodni glasovi izađu iz desetominutnog perioda prije primjene.';
 end if;
end $$;
create table community_test.votes_before_one_change_20261026 as table community_test.votes;
alter table community_test.votes_before_one_change_20261026 enable row level security;
revoke all on community_test.votes_before_one_change_20261026 from public,anon,authenticated,service_role;
alter table community_test.votes add column change_used boolean not null default false;

create function community_test.limit_vote_change() returns trigger
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
revoke all on function community_test.limit_vote_change() from public,anon,authenticated;
create trigger enforce_one_vote_change before insert or update on community_test.votes
for each row execute function community_test.limit_vote_change();

do $$ declare definition text; old text:='v_result=jsonb_build_object(''my_vote'',v_vote.value);';
begin
 definition=pg_get_functiondef('public.community_test_dispatch_base(uuid,text,jsonb)'::regprocedure);
 if strpos(definition,old)=0 then raise exception 'Neočekivana verzija funkcije; pregledaj prije nastavka.';end if;
 execute replace(definition,old,
  'v_result=jsonb_build_object(''my_vote'',v_vote.value,''can_change'',case when v_vote.user_id is null then true else not v_vote.change_used and clock_timestamp()<v_vote.first_voted_at+interval ''10 minutes'' end);');
end $$;
notify pgrst,'reload schema';
commit;
