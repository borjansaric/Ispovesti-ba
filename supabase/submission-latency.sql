begin;
create table community_test.submission_receipts (
 user_id uuid not null references auth.users(id),
 request_id uuid not null,
 payload jsonb not null,
 result jsonb not null,
 created_at timestamptz not null default clock_timestamp(),
 primary key(user_id,request_id)
);
alter table community_test.submission_receipts enable row level security;
revoke all on community_test.submission_receipts from public,anon,authenticated;
grant select,insert on community_test.submission_receipts to service_role;
create or replace function public.community_test_dispatch(p_uid uuid,p_action text,p_args jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_item jsonb;v_result jsonb;v_id bigint;v_state text;v_previous text;v_kind text;v_at timestamptz;v_offset integer;v_request uuid;v_payload jsonb;v_receipt community_test.submission_receipts%rowtype;
begin
 if current_user not in ('service_role','postgres') then raise exception 'Zabranjeno.' using errcode='42501'; end if;
 if p_action like 'admin_%' then
  perform community_test.assert_admin(p_uid,p_args->>'_session_id');
  if p_action='admin_session' then return '{"admin":true}'; end if;
  perform community_test.assert_admin_access(p_uid,p_args->>'_session_id',p_args->>'_aal');
  if p_action='admin_remove' then
   perform pg_advisory_xact_lock(73142011);
   v_id=(p_args->>'id')::bigint;select state into v_state from community_test.content where id=v_id for update;
   if not found then raise exception 'Sadržaj nije dostupan.'; end if;
   if v_state='removed' then return '{"success":true}'; end if;
   v_result=public.community_test_dispatch_base(p_uid,p_action,p_args);
   update community_test.content set removal_previous_state=v_state where id=v_id;return v_result;
  elsif p_action='admin_restore' then
   perform pg_advisory_xact_lock(73142011);v_id=(p_args->>'id')::bigint;
   select state,removal_previous_state,kind,published_at into v_state,v_previous,v_kind,v_at from community_test.content where id=v_id for update;
   if not found then raise exception 'Sadržaj nije dostupan.'; end if;
   if v_state<>'removed' then return '{"success":true}'; end if;
   v_previous=coalesce(v_previous,case when v_kind='confession' and v_at is null then 'queued' else 'published' end);
   update community_test.content set state=v_previous,removed_at=null,removal_previous_state=null where id=v_id;
   insert into community_test.audit_log(admin_id,content_id,action) values(p_uid,v_id,'restore');
   return jsonb_build_object('success',true,'state',v_previous,'visible',community_test.visible(v_id));
  elsif p_action='admin_list' then
   v_offset=greatest(0,least(coalesce((p_args->>'offset')::integer,0),1000000));
   if p_args->>'view' not in ('queue','archive','published','reports') then raise exception 'Nepoznat pregled.'; end if;
   select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into v_result from (
    select c.id::text id,c.kind,c.body,c.nickname,c.state,c.created_at,c.removed_at,c.parent_id::text parent_id,c.confession_id::text confession_id,
     community_test.visible(c.id) as publicly_visible,
     (select coalesce(jsonb_agg(jsonb_build_object('reason',r.reason,'created_at',r.created_at) order by r.created_at),'[]'::jsonb) from community_test.reports r where r.content_id=c.id) reports
    from community_test.content c where
     (p_args->>'view'='queue' and c.state='queued') or
     (p_args->>'view'='archive' and (c.state='removed' or (c.state='published' and not community_test.visible(c.id)))) or
     (p_args->>'view'='published' and community_test.visible(c.id)) or
     (p_args->>'view'='reports' and exists(select 1 from community_test.reports r where r.content_id=c.id))
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
   select * into v_receipt from community_test.submission_receipts where user_id=p_uid and request_id=v_request;
   if found then
    if v_receipt.payload<>v_payload then raise exception 'Zahtjev za slanje je promijenjen. Pokušaj ponovo.'; end if;
    if v_receipt.result ? 'item' and not community_test.visible((v_receipt.result->>'id')::bigint) then raise exception 'Sadržaj više nije dostupan.'; end if;
    v_result=v_receipt.result||jsonb_build_object('replayed',true);
    if v_result ? 'context' then v_result=v_result||jsonb_build_object('context',public.community_test_dispatch_base(p_uid,'context',jsonb_build_object('id',p_args->>'confession_id'))); end if;
    return v_result;
   end if;
  end if;
  v_result=public.community_test_dispatch_base(p_uid,p_action,p_args);
  if (v_result->>'success')::boolean is true and p_args->>'kind' in ('comment','reply') then
   select jsonb_build_object('id',c.id::text,'body',c.body,'nickname',c.nickname,'created_at',c.created_at,'parent_id',c.parent_id::text,'has_replies',false) into v_item
   from community_test.content c where c.id=(v_result->>'id')::bigint and c.author_id=p_uid and c.state='published' and community_test.visible(c.id);
   if v_item is not null then
    v_result=v_result||jsonb_build_object('item',v_item,'context',public.community_test_dispatch_base(p_uid,'context',jsonb_build_object('id',p_args->>'confession_id')));
   end if;
  end if;
  if v_request is not null and (v_result->>'success')::boolean is true then
   insert into community_test.submission_receipts(user_id,request_id,payload,result) values(p_uid,v_request,v_payload,v_result);
  end if;
  return v_result;
 end if;
 return public.community_test_dispatch_base(p_uid,p_action,p_args);
end $$;
notify pgrst, 'reload schema';
commit;
