create or replace function community_test.daily_highlights(p_kind text)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $function$
declare
  v_result jsonb;
begin
  if p_kind not in ('confession','comment') then
    raise exception 'Nepoznata vrsta dnevnog sadržaja.';
  end if;

  with candidates as (
    select
      c.id,
      c.kind,
      c.body,
      c.nickname,
      c.confession_id,
      case when c.kind='confession' then c.published_at else c.created_at end as item_at,
      timezone(
        'Europe/Sarajevo',
        case when c.kind='confession' then c.published_at else c.created_at end
      )::date as local_day,
      count(v.content_id) filter (where v.value=1) as total_likes
    from community_test.content c
    left join community_test.votes v on v.content_id=c.id
    where c.kind=p_kind
      and c.state='published'
      and (case when c.kind='confession' then c.published_at else c.created_at end) <= now()
    group by c.id,c.kind,c.body,c.nickname,c.confession_id,c.published_at,c.created_at
  ),
  ranked as (
    select *,
      row_number() over (
        partition by local_day
        order by total_likes desc,item_at asc,id asc
      ) as daily_rank
    from candidates
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',id::text,
        'kind',kind,
        'body',body,
        'nickname',nickname,
        'confession_id',confession_id::text,
        'published_at',case when kind='confession' then item_at else null end,
        'created_at',case when kind='comment' then item_at else null end,
        'day',local_day
      )
      order by local_day desc,id asc
    ),
    '[]'::jsonb
  )
  into v_result
  from (
    select * from ranked
    where daily_rank=1
    order by local_day desc
    limit 7
  ) winners;

  return jsonb_build_object('items',v_result);
end;
$function$;

revoke all on function community_test.daily_highlights(text) from public,anon,authenticated;
grant execute on function community_test.daily_highlights(text) to service_role;

do $patch$
declare
  v_definition text;
  v_updated text;
begin
  select pg_get_functiondef('public.community_test_dispatch(uuid,text,jsonb)'::regprocedure)
    into v_definition;

  if position('daily_highlights' in v_definition)>0 then
    raise exception 'daily_highlights je već dodat u community_test_dispatch.';
  end if;

  v_updated := replace(
    v_definition,
    'if p_action=''submit'' then',
    'if p_action=''daily_highlights'' then return community_test.daily_highlights(p_args->>''kind''); end if; if p_action=''submit'' then'
  );

  if v_updated=v_definition then
    raise exception 'Nije pronađeno mjesto za bezbjedno proširenje community_test_dispatch.';
  end if;

  execute v_updated;
end;
$patch$;
