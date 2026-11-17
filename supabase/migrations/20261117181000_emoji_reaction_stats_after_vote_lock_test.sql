create or replace function community_test.content_reaction(
  p_uid uuid,
  p_action text,
  p_args jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_id bigint;
  v_emoji text;
  v_row community_test.reactions%rowtype;
  v_can_change boolean;
  v_can_view_stats boolean;
  v_vote_at timestamptz;
  v_stats jsonb;
begin
  if p_uid is null then
    raise exception 'Potrebna je anonimna sesija.' using errcode='28000';
  end if;

  v_id := (p_args->>'id')::bigint;
  if not coalesce(community_test.visible(v_id),false) then
    raise exception 'Sadržaj nije dostupan.';
  end if;

  if p_action='reaction' then
    v_emoji := p_args->>'emoji';
    if v_emoji not in ('❤️','😂','😢','😮','🤗','😡') then
      raise exception 'Nepoznata reakcija.';
    end if;

    perform community_test.rate(p_uid,'reaction',120);
    insert into community_test.reactions(content_id,user_id,emoji)
    values(v_id,p_uid,v_emoji)
    on conflict(content_id,user_id) do update
      set emoji=excluded.emoji,updated_at=clock_timestamp()
      where clock_timestamp() < community_test.reactions.first_reacted_at + interval '10 minutes';

    select * into v_row
    from community_test.reactions
    where content_id=v_id and user_id=p_uid;

    if not found then
      raise exception 'Vrijeme za promjenu reakcije je isteklo.';
    end if;
  elsif p_action='reaction_status' then
    select * into v_row
    from community_test.reactions
    where content_id=v_id and user_id=p_uid;
  else
    raise exception 'Nepoznata radnja reakcije.';
  end if;

  v_can_change := v_row.user_id is null
    or clock_timestamp() < v_row.first_reacted_at + interval '10 minutes';

  select first_voted_at into v_vote_at
  from community_test.votes
  where content_id=v_id and user_id=p_uid;

  v_can_view_stats := v_vote_at is not null
    and v_vote_at + interval '10 minutes' <= clock_timestamp();

  if v_can_view_stats then
    select coalesce(jsonb_object_agg(x.emoji,x.total),'{}'::jsonb)
      into v_stats
    from (
      select emoji,count(*) as total
      from community_test.reactions
      where content_id=v_id
      group by emoji
    ) x;
  end if;

  return jsonb_build_object(
    'my_reaction',v_row.emoji,
    'can_change',coalesce(v_can_change,true),
    'stats',case when v_stats is null then null else v_stats end,
    'locked_at',case when v_row.user_id is null then null else v_row.first_reacted_at + interval '10 minutes' end
  );
end;
$function$;
