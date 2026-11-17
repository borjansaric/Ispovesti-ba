alter table community_test.reactions
  add column if not exists change_used boolean not null default false;

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
  v_expired boolean;
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

    select * into v_row
    from community_test.reactions
    where content_id=v_id and user_id=p_uid
    for update;

    if not found then
      insert into community_test.reactions(content_id,user_id,emoji)
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
        update community_test.reactions
        set emoji=v_emoji,updated_at=clock_timestamp(),change_used=true
        where content_id=v_id and user_id=p_uid
        returning * into v_row;
      end if;
    end if;
  elsif p_action='reaction_status' then
    select * into v_row
    from community_test.reactions
    where content_id=v_id and user_id=p_uid;
  else
    raise exception 'Nepoznata radnja reakcije.';
  end if;

  v_expired := v_row.user_id is not null
    and clock_timestamp() >= v_row.first_reacted_at + interval '10 minutes';
  v_can_change := v_row.user_id is null
    or (not v_row.change_used and not v_expired);

  if v_expired then
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
    'can_change',v_can_change,
    'change_used',coalesce(v_row.change_used,false),
    'expired',coalesce(v_expired,false),
    'stats',case when v_stats is null then null else v_stats end,
    'locked_at',case when v_row.user_id is null then null else v_row.first_reacted_at + interval '10 minutes' end
  );
end;
$function$;
