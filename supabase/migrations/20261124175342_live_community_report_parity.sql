-- Align community confession/comment reports with the preview UI contract.
-- The UI sends hate_speech, spam, other and an optional 500-character detail.
-- This changes only live reporting; legacy public tables and test schemas are untouched.

alter table community_live.reports
  add column if not exists details text not null default '';

alter table community_live.reports
  drop constraint if exists reports_reason_check;
alter table community_live.reports
  add constraint reports_reason_check
  check (reason in ('abuse','threat','hate_speech','spam','other'));

alter table community_live.reports
  drop constraint if exists reports_details_length_check;
alter table community_live.reports
  add constraint reports_details_length_check
  check (char_length(details) <= 500);

do $migration$
declare
  v_definition text;
begin
  v_definition := pg_get_functiondef('public.community_live_dispatch_base(uuid,text,jsonb)'::regprocedure);
  v_definition := replace(
    v_definition,
    $old$if p_args->>'reason' is null or p_args->>'reason' not in ('abuse','threat','spam','other') then raise exception 'Neispravan razlog prijave.'; end if;$old$,
    $new$if p_args->>'reason' is null or p_args->>'reason' not in ('abuse','threat','hate_speech','spam','other') then raise exception 'Neispravan razlog prijave.'; end if;
  if char_length(coalesce(p_args->>'details','')) > 500 then raise exception 'Opis prijave je predugačak.'; end if;$new$
  );
  v_definition := replace(
    v_definition,
    $old$insert into community_live.reports(content_id,user_id,reason) values(v_id,p_uid,p_args->>'reason') on conflict do nothing;$old$,
    $new$insert into community_live.reports(content_id,user_id,reason,details) values(v_id,p_uid,p_args->>'reason',coalesce(p_args->>'details','')) on conflict do nothing;$new$
  );
  if position('''hate_speech''' in v_definition)=0
     or position('community_live.reports(content_id,user_id,reason,details)' in v_definition)=0 then
    raise exception 'Nije moguće bezbjedno uskladiti prijave zajednice.';
  end if;
  execute v_definition;
end
$migration$;

do $migration$
declare
  v_definition text;
begin
  v_definition := pg_get_functiondef('public.community_live_admin_read(uuid,text,jsonb)'::regprocedure);
  v_definition := replace(
    v_definition,
    $old$jsonb_build_object('reason',r.reason,'created_at',r.created_at)$old$,
    $new$jsonb_build_object('reason',r.reason,'created_at',r.created_at,'details',r.details)$new$
  );
  v_definition := replace(
    v_definition,
    $old$r.user_id::text reporter_id,NULL::text details$old$,
    $new$r.user_id::text reporter_id,r.details$new$
  );
  if position($check$r.user_id::text reporter_id,r.details$check$ in v_definition)=0
     or position($check$jsonb_build_object('reason',r.reason,'created_at',r.created_at,'details',r.details)$check$ in v_definition)=0 then
    raise exception 'Nije moguće bezbjedno dodati detalje prijava u administratorski pregled.';
  end if;
  execute v_definition;
end
$migration$;
