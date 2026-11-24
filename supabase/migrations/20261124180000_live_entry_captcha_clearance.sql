-- Production counterpart of the preview's one-time CAPTCHA entry clearance.
-- Prepared only: this migration has NOT been applied to Supabase.
create table if not exists community_live.captcha_clearance (
  user_id uuid primary key references auth.users(id) on delete cascade,
  verified_at timestamptz not null default clock_timestamp()
);

alter table community_live.captcha_clearance enable row level security;
revoke all on community_live.captcha_clearance from public, anon, authenticated;
grant select, insert, update, delete on community_live.captcha_clearance to service_role;

create or replace function public.community_live_captcha_clearance(
  p_uid uuid,
  p_action text,
  p_args jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
set search_path to ''
as $function$
begin
  if current_user not in ('service_role','postgres') then
    raise exception 'Zabranjeno.' using errcode='42501';
  end if;
  if p_uid is null then
    raise exception 'Potrebna je anonimna sesija.' using errcode='28000';
  end if;
  if p_action='get' then
    return jsonb_build_object('verified',exists(
      select 1 from community_live.captcha_clearance where user_id=p_uid
    ));
  elsif p_action='grant' then
    insert into community_live.captcha_clearance(user_id,verified_at)
    values(p_uid,clock_timestamp())
    on conflict(user_id) do update set verified_at=excluded.verified_at;
    return jsonb_build_object('verified',true);
  end if;
  raise exception 'Nepoznata CAPTCHA radnja.';
end
$function$;

revoke all on function public.community_live_captcha_clearance(uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.community_live_captcha_clearance(uuid,text,jsonb) to service_role;

do $migration$
declare
  v_definition text;
begin
  v_definition := pg_get_functiondef('public.community_live_dispatch(uuid,text,jsonb)'::regprocedure);
  v_definition := replace(
    v_definition,
    $old$ if p_action='submit' then$old$,
    $new$ if p_action='submit'
    and exists(select 1 from community_live.security_settings where singleton and captcha_enabled)
    and not exists(select 1 from community_live.captcha_clearance where user_id=p_uid) then
      raise exception 'Prvo završi sigurnosnu provjeru pri ulasku.' using errcode='42501';
  end if;
  if p_action='submit' then$new$
  );
  if position('community_live.captcha_clearance' in v_definition)=0 then
    raise exception 'Nije moguće bezbjedno dodati CAPTCHA clearance provjeru u community_live_dispatch.';
  end if;
  execute v_definition;
end
$migration$;
