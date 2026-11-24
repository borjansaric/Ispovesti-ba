-- Preview feature parity for the isolated live schemas.
-- Prepared only; this migration has NOT been applied to Supabase.
create table if not exists community_live.reactions (
  content_id bigint not null references community_live.content(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (emoji in ('🫂','😢','😮','🤗','🤣')),
  first_reacted_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  change_used boolean not null default false,
  primary key(content_id,user_id)
);
alter table community_live.reactions enable row level security;
revoke all on community_live.reactions from public,anon,authenticated;
grant select,insert,update,delete on community_live.reactions to service_role;
create index if not exists community_live_reactions_content_emoji_idx on community_live.reactions(content_id,emoji);

create table if not exists community_live.visitor_days (
  visitor_hash text not null check (visitor_hash ~ '^[0-9a-f]{64}$'),
  visit_day date not null,
  primary key(visitor_hash,visit_day)
);
alter table community_live.visitor_days enable row level security;
revoke all on community_live.visitor_days from public,anon,authenticated;
grant select,insert,update,delete on community_live.visitor_days to service_role;
create index if not exists community_live_visitor_days_day_idx on community_live.visitor_days(visit_day);
comment on table community_live.visitor_days is 'Pseudonimni dnevni posjeti: samo SHA-256 hash nasumičnog ID-a pregledača sa serverskim tajnim dodatkom i UTC datum; bez Auth UID-a, IP adrese, putanje ili sadržaja. Redovi stariji od 180 dana brišu se pri novom upisu.';

CREATE OR REPLACE FUNCTION public.community_live_admin_read(p_uid uuid, p_action text, p_args jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_limit integer := greatest(1, least(coalesce((p_args->>'limit')::integer, 50), 50));
  v_offset integer := greatest(0, least(coalesce((p_args->>'offset')::integer, 0), 1000000));
  v_query text := nullif(btrim(p_args->>'q'), '');
  v_result jsonb;
  v_confessions jsonb;
  v_comments jsonb;
  v_reactions bigint;
  v_reaction_breakdown jsonb;
  v_votes bigint;
  v_reports bigint;
  v_chat_messages jsonb;
  v_chat_reports bigint;
  v_publisher jsonb;
  v_trend jsonb;
  v_today date;
  v_since date;
  v_days bigint;
  v_unique bigint;
  v_new bigint;
  v_retention jsonb := '[]'::jsonb;
  v_n integer;
  v_cohort bigint;
  v_returned bigint;
begin
  if current_user not in ('service_role','postgres') or p_uid is null then
    raise exception 'Zabranjen pristup.' using errcode='42501';
  end if;
  perform community_live.assert_admin_access(p_uid, p_args->>'_session_id', p_args->>'_aal');

  if p_action = 'admin_dashboard' then
    select jsonb_build_object('total',count(*),'published',count(*) filter(where state='published'),
      'queued',count(*) filter(where state='queued'),'removed',count(*) filter(where state='removed'))
      into v_confessions from community_live.content where kind='confession';
    select jsonb_build_object('comments',count(*) filter(where kind='comment'),'replies',count(*) filter(where kind='reply'),
      'published_comments',count(*) filter(where kind='comment' and state='published'),
      'published_replies',count(*) filter(where kind='reply' and state='published'))
      into v_comments from community_live.content where kind in ('comment','reply');
    select count(*) into v_reactions from community_live.reactions where emoji in ('🫂','😢','😮','🤗','🤣');
    select coalesce(jsonb_object_agg(emoji, n), '{}'::jsonb)
      into v_reaction_breakdown
    from (select emoji, count(*)::bigint n from community_live.reactions where emoji in ('🫂','😢','😮','🤗','🤣') group by emoji) reaction_counts;
    select count(*) into v_votes from community_live.votes;
    select count(*) into v_reports from community_live.reports;
    select jsonb_build_object('total',count(*),'visible',count(*) filter(where not removed),
      'removed',count(*) filter(where removed)) into v_chat_messages from chat_live.messages;
    select count(*) into v_chat_reports from chat_live.reports;
    select jsonb_build_object('paused',paused,'last_published_at',last_published_at,'started_at',started_at)
      into v_publisher from community_live.publisher where singleton;
    select coalesce(jsonb_agg(jsonb_build_object('day',d::date,'content',coalesce(c.n,0),'chat',coalesce(m.n,0)) order by d),'[]'::jsonb)
      into v_trend
    from generate_series(current_date-29,current_date,interval '1 day') d
    left join lateral (select count(*)::bigint n from community_live.content where created_at>=d and created_at<d+interval '1 day') c on true
    left join lateral (select count(*)::bigint n from chat_live.messages where created_at>=d and created_at<d+interval '1 day') m on true;
    return jsonb_build_object('confessions',v_confessions,'community',v_comments,'reactions',v_reactions,'reaction_breakdown',coalesce(v_reaction_breakdown,'{}'::jsonb),'votes',v_votes,
      'reports',v_reports,'chat_messages',v_chat_messages,'chat_reports',v_chat_reports,
      'publisher',coalesce(v_publisher,'{}'::jsonb),'trend_30d',v_trend,'analytics_available',false);
  elsif p_action = 'admin_comments' then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id desc),'[]'::jsonb) into v_result
    from (
      select c.id::text id,c.kind,c.body,c.nickname,c.state,c.created_at,c.removed_at,
        c.parent_id::text parent_id,c.confession_id::text confession_id,
        (select coalesce(jsonb_agg(jsonb_build_object('reason',r.reason,'created_at',r.created_at) order by r.created_at desc),'[]'::jsonb)
         from community_live.reports r where r.content_id=c.id) reports
      from community_live.content c
      where c.kind in ('comment','reply') and
        (v_query is null or position(lower(v_query) in lower(c.body))>0 or
         position(lower(v_query) in lower(coalesce(c.nickname,'')))>0 or c.id::text=v_query)
      order by c.created_at desc,c.id desc limit v_limit offset v_offset
    ) x;
    return jsonb_build_object('items',v_result,'limit',v_limit,'offset',v_offset);
  elsif p_action = 'admin_reports' then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.reported_at desc,x.id desc),'[]'::jsonb) into v_result
    from (
      select * from (
        select ('content:'||r.content_id::text||':'||r.user_id::text) id,'community' source,
          r.content_id::text target_id,c.kind target_kind,c.body,c.nickname,c.state,r.reason,
          r.created_at reported_at,r.user_id::text reporter_id,NULL::text details
        from community_live.reports r join community_live.content c on c.id=r.content_id
        union all
        select ('chat:'||r.message_id::text||':'||r.user_id::text) id,'chat' source,
          r.message_id::text target_id,'chat_message' target_kind,m.body,p.generated_nickname nickname,
          case when m.removed then 'removed' else 'published' end state,r.reason,
          r.created_at reported_at,r.user_id::text reporter_id,r.details
        from chat_live.reports r join chat_live.messages m on m.id=r.message_id
        left join chat_live.profiles p on p.user_id=m.user_id
      ) combined
      where v_query is null or position(lower(v_query) in lower(coalesce(body,'')))>0
        or position(lower(v_query) in lower(coalesce(reason,'')))>0 or target_id=v_query
      order by reported_at desc,id desc limit v_limit offset v_offset
    ) x;
    return jsonb_build_object('items',v_result,'limit',v_limit,'offset',v_offset);
  elsif p_action = 'admin_audit' then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id desc),'[]'::jsonb) into v_result
    from (
      select * from (
        select ('community:'||a.id::text) id,'community' source,a.admin_id::text admin_id,
          a.action,('content:'||coalesce(a.content_id::text,'')) target,a.created_at
        from community_live.audit_log a
        union all
        select ('chat:'||a.id::text) id,'chat' source,a.admin_id::text admin_id,
          a.action,('chat:'||coalesce(a.target,'')) target,a.created_at
        from chat_live.audit a
      ) combined
      where v_query is null or position(lower(v_query) in lower(action))>0
        or position(lower(v_query) in lower(target))>0 or position(lower(v_query) in lower(admin_id))>0
      order by created_at desc,id desc limit v_limit offset v_offset
    ) x;
    return jsonb_build_object('items',v_result,'limit',v_limit,'offset',v_offset);
  elsif p_action = 'admin_analytics' then
    v_today := (clock_timestamp() at time zone 'UTC')::date;
    select min(visit_day), count(distinct visit_day)
      into v_since, v_days
    from community_live.visitor_days;
    select count(distinct visitor_hash)
      into v_unique
    from community_live.visitor_days
    where visit_day >= v_today - 29;
    select count(*)
      into v_new
    from (
      select visitor_hash, min(visit_day) first_day
      from community_live.visitor_days
      group by visitor_hash
    ) firsts
    where first_day >= v_today - 29;
    select coalesce(jsonb_agg(jsonb_build_object(
      'day', x.visit_date, 'visitors', x.visitors, 'new_visitors', x.new_visitors
    ) order by x.visit_date), '[]'::jsonb)
      into v_trend
    from (
      with firsts as (
        select visitor_hash, min(visit_day) first_day
        from community_live.visitor_days
        group by visitor_hash
      )
      select d::date as visit_date,
        count(v.visitor_hash)::bigint visitors,
        count(v.visitor_hash) filter (where f.first_day = v.visit_day)::bigint new_visitors
      from generate_series(v_today - 29, v_today, interval '1 day') d
      left join community_live.visitor_days v on v.visit_day = d::date
      left join firsts f on f.visitor_hash = v.visitor_hash
      group by d
    ) x;
    for v_n in select unnest(array[10,20,30]) loop
      select count(*),
        count(*) filter (where exists (
          select 1 from community_live.visitor_days v
          where v.visitor_hash = firsts.visitor_hash
            and v.visit_day = firsts.first_day + v_n
        ))
      into v_cohort, v_returned
      from (
        select visitor_hash, min(visit_day) first_day
        from community_live.visitor_days
        group by visitor_hash
      ) firsts
      where firsts.first_day between v_today - (v_n + 29) and v_today - v_n;
      v_retention := v_retention || jsonb_build_array(jsonb_build_object(
        'day', v_n,
        'cohort_size', v_cohort,
        'returned', v_returned,
        'percent', case when v_cohort > 0 then round(v_returned * 100.0 / v_cohort, 1) else null end
      ));
    end loop;
    return jsonb_build_object(
      'available', true,
      'unique_30d', v_unique,
      'new_30d', v_new,
      'returning_30d', greatest(v_unique - v_new, 0),
      'data_since', v_since,
      'days_collected', v_days,
      'daily', v_trend,
      'retention', v_retention,
      'retention_definition', 'Tačan povratak na 10, 20. ili 30. dan od prve zabilježene posjete; kohorte obuhvataju 30 dana koje su dovoljno stare za mjerenje.'
    );
  end if;
  raise exception 'Nepoznata administratorska read radnja.';
end
$function$

CREATE OR REPLACE FUNCTION public.community_live_my_confessions(p_uid uuid, p_action text, p_args jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_offset integer := greatest(0, least(coalesce((p_args->>'offset')::integer, 0), 1000000));
  v_items jsonb;
begin
  if current_user not in ('service_role', 'postgres') then
    raise exception 'Zabranjeno.' using errcode = '42501';
  end if;
  if p_action <> 'my_confessions' or p_uid is null then
    raise exception 'Neispravna radnja.' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
    into v_items
  from (
    select
      c.id::text as id,
      c.body,
      c.nickname,
      c.state,
      c.created_at,
      c.published_at
    from community_live.content c
    where c.author_id = p_uid
      and c.kind = 'confession'
    order by c.created_at desc, c.id desc
    limit 20 offset v_offset
  ) x;

  return jsonb_build_object('items', v_items);
end
$function$

CREATE OR REPLACE FUNCTION public.community_live_submit_check(p_uid uuid, p_action text, p_args jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  s community_live.security_settings;
  v_verified boolean;
begin
  if current_user not in ('service_role','postgres') then
    raise exception 'Zabranjeno.' using errcode='42501';
  end if;
  if p_uid is null then
    raise exception 'Potrebna je anonimna sesija.' using errcode='28000';
  end if;
  if p_action <> 'check' then
    raise exception 'Nepoznata sigurnosna radnja.';
  end if;

  select * into s
  from community_live.security_settings
  where singleton;

  if not found then
    raise exception 'Sigurnosna podešavanja nisu dostupna.' using errcode='P0001';
  end if;

  select exists(
    select 1
    from community_live.captcha_clearance
    where user_id = p_uid
  ) into v_verified;

  return jsonb_build_object(
    'enabled', s.captcha_enabled,
    'configured', s.captcha_secret_ciphertext is not null,
    'verified', v_verified
  );
end;
$function$

CREATE OR REPLACE FUNCTION public.community_live_visitor_event(p_uid uuid, p_action text, p_args jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  v_hash text := lower(coalesce(p_args->>'visitor_hash', ''));
  v_today date := (clock_timestamp() at time zone 'UTC')::date;
  v_inserted integer := 0;
BEGIN
  IF current_user NOT IN ('service_role','postgres') OR p_uid IS NOT NULL THEN
    RAISE EXCEPTION 'Zabranjen pristup.' USING errcode='42501';
  END IF;
  IF p_action <> 'record_visit' THEN
    RAISE EXCEPTION 'Nepoznata analitička radnja.';
  END IF;
  IF v_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Neispravan analitički identifikator.';
  END IF;
  INSERT INTO community_live.visitor_days(visitor_hash, visit_day)
  VALUES (v_hash, v_today)
  ON CONFLICT (visitor_hash, visit_day) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF v_inserted > 0 THEN
    DELETE FROM community_live.visitor_days
    WHERE visit_day < v_today - 180;
  END IF;
  RETURN jsonb_build_object('recorded', v_inserted > 0);
END
$function$

CREATE OR REPLACE FUNCTION community_live.content_reaction(p_uid uuid, p_action text, p_args jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_id bigint;
  v_emoji text;
  v_kind text;
  v_row community_live.reactions%rowtype;
  v_can_change boolean;
  v_expired boolean;
  v_stats jsonb;
  v_popular text;
begin
  if p_uid is null then
    raise exception 'Potrebna je anonimna sesija.' using errcode='28000';
  end if;

  v_id := (p_args->>'id')::bigint;
  if not coalesce(community_live.visible(v_id),false) then
    raise exception 'Sadržaj nije dostupan.';
  end if;

  select c.kind into v_kind
  from community_live.content c
  where c.id = v_id;

  if v_kind not in ('comment','reply') then
    raise exception 'Emoji reakcije su dostupne samo na komentarima i odgovorima.';
  end if;

  if p_action='reaction' then
    v_emoji := p_args->>'emoji';
    if v_emoji not in ('🫂','😢','😮','🤗','🤣') then
      raise exception 'Nepoznata reakcija.';
    end if;

    perform community_live.rate(p_uid,'reaction',120);

    select * into v_row
    from community_live.reactions
    where content_id=v_id and user_id=p_uid
    for update;

    if not found then
      insert into community_live.reactions(content_id,user_id,emoji)
      values(v_id,p_uid,v_emoji)
      returning * into v_row;
    else
      if clock_timestamp() >= v_row.first_reacted_at + interval '10 minutes' then
        raise exception 'Isteklo je 10 minuta od prve reakcije.';
      end if;

      if v_emoji <> v_row.emoji then
        if v_row.change_used then
          raise exception 'Već si iskoristio jedinu dozvoljenu promjenu reakcije.';
        end if;

        update community_live.reactions
        set emoji=v_emoji,updated_at=clock_timestamp(),change_used=true
        where content_id=v_id and user_id=p_uid
        returning * into v_row;
      end if;
    end if;
  elsif p_action='reaction_status' then
    select * into v_row
    from community_live.reactions
    where content_id=v_id and user_id=p_uid;
  else
    raise exception 'Nepoznata radnja reakcije.';
  end if;

  v_expired := v_row.user_id is not null
    and clock_timestamp() >= v_row.first_reacted_at + interval '10 minutes';

  v_can_change := v_row.user_id is null
    or (not v_row.change_used and not v_expired);

  select
    coalesce(jsonb_object_agg(x.emoji,x.total),'{}'::jsonb),
    (array_agg(x.emoji order by x.total desc,x.emoji asc))[1]
  into v_stats,v_popular
  from (
    select emoji,count(*)::int as total
    from community_live.reactions
    where content_id=v_id and emoji in ('🫂','😢','😮','🤗','🤣')
    group by emoji
  ) x;

  return jsonb_build_object(
    'my_reaction',v_row.emoji,
    'can_change',v_can_change,
    'change_used',coalesce(v_row.change_used,false),
    'expired',coalesce(v_expired,false),
    'stats',coalesce(v_stats,'{}'::jsonb),
    'popular_emoji',v_popular,
    'locked_at',case when v_row.user_id is null then null else v_row.first_reacted_at + interval '10 minutes' end
  );
end;
$function$


revoke all on function public.community_live_admin_read(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.community_live_admin_read(uuid,text,jsonb) to service_role;
revoke all on function public.community_live_my_confessions(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.community_live_my_confessions(uuid,text,jsonb) to service_role;
revoke all on function public.community_live_submit_check(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.community_live_submit_check(uuid,text,jsonb) to service_role;
revoke all on function public.community_live_visitor_event(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.community_live_visitor_event(uuid,text,jsonb) to service_role;
revoke all on function community_live.content_reaction(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function community_live.content_reaction(uuid,text,jsonb) to service_role;

do $migration$
declare
  v_definition text;
begin
  v_definition := pg_get_functiondef('public.community_live_dispatch(uuid,text,jsonb)'::regprocedure);
  v_definition := replace(
    v_definition,
    $old$ if p_action='daily_highlights' then$old$,
    $new$ if p_action in ('reaction','reaction_status') then
    return community_live.content_reaction(p_uid,p_action,p_args);
  end if;
  if p_action='daily_highlights' then$new$
  );
  v_definition := replace(
    v_definition,
    $old$  v_request=nullif(p_args->>'request_id','')::uuid;$old$,
    $new$  if coalesce(p_args->>'request_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'Nedostaje ili je neispravan ID zahtjeva za slanje.' using errcode='22023';
  end if;
  v_request=(p_args->>'request_id')::uuid;$new$
  );
  if position('community_live.content_reaction' in v_definition)=0
     or position('Nedostaje ili je neispravan ID zahtjeva za slanje.' in v_definition)=0 then
    raise exception 'Nije moguće bezbjedno uskladiti community_live_dispatch.';
  end if;
  execute v_definition;
end
$migration$;
