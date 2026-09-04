-- Transparent member Bearforce history and immutable per-season summaries.

create or replace function public.member_bearforce_history(p_limit integer default 100)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_member_id uuid;
  v_limit integer := least(greatest(coalesce(p_limit,100),1),200);
  v_history jsonb := '[]'::jsonb;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;

  select id into v_member_id
  from public.members
  where user_id = (select auth.uid());

  if not found then raise exception 'Member profile not found'; end if;

  select coalesce(jsonb_agg(item order by occurred_at desc), '[]'::jsonb)
  into v_history
  from (
    select
      e.occurred_at,
      jsonb_build_object(
        'id', e.id,
        'kind', 'earned',
        'label', case e.event_type
          when 'session_completed' then 'Workout completed'
          when 'package_activation_paid' then 'Package activation paid'
          when 'partial_installment_on_time' then 'Installment paid on time'
          when 'early_renewal' then 'Early renewal bonus'
          else initcap(replace(e.event_type,'_',' '))
        end,
        'points_delta', e.points,
        'occurred_at', e.occurred_at,
        'event_type', e.event_type,
        'status', 'completed',
        'source_type', e.source_type,
        'source_id', e.source_id,
        'metadata', e.metadata
      ) as item
    from public.bearforce_point_events e
    where e.member_id = v_member_id

    union all

    select
      r.created_at as occurred_at,
      jsonb_build_object(
        'id', r.id,
        'kind', 'redeemed',
        'label', r.reward_label,
        'points_delta', -r.points_spent,
        'occurred_at', r.created_at,
        'event_type', 'reward_redemption',
        'status', r.status,
        'source_type', 'bearforce_redemption',
        'source_id', r.id,
        'metadata', '{}'::jsonb
      ) as item
    from public.bearforce_redemptions r
    where r.member_id = v_member_id
      and r.status = 'completed'
  ) combined
  order by occurred_at desc
  limit v_limit;

  return v_history;
end;
$$;

create or replace function public.member_bearforce_seasons()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_member_id uuid;
  v_seasons jsonb := '[]'::jsonb;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;

  select id into v_member_id
  from public.members
  where user_id = (select auth.uid());

  if not found then raise exception 'Member profile not found'; end if;

  with keys as (
    select season_key from public.bearforce_point_events where member_id=v_member_id
    union
    select season_key from public.bearforce_redemptions where member_id=v_member_id
  ), earnings as (
    select season_key, coalesce(sum(points),0)::integer as earned
    from public.bearforce_point_events
    where member_id=v_member_id
    group by season_key
  ), spending as (
    select season_key, coalesce(sum(points_spent),0)::integer as spent
    from public.bearforce_redemptions
    where member_id=v_member_id and status='completed'
    group by season_key
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'season_key', k.season_key,
      'earned', coalesce(e.earned,0),
      'spent', coalesce(s.spent,0),
      'balance', greatest(coalesce(e.earned,0)-coalesce(s.spent,0),0),
      'prestige', private.bearforce_prestige(coalesce(e.earned,0))
    ) order by k.season_key desc
  ), '[]'::jsonb)
  into v_seasons
  from keys k
  left join earnings e using(season_key)
  left join spending s using(season_key);

  return v_seasons;
end;
$$;

revoke all on function public.member_bearforce_history(integer) from public,anon;
revoke all on function public.member_bearforce_seasons() from public,anon;
grant execute on function public.member_bearforce_history(integer) to authenticated,service_role;
grant execute on function public.member_bearforce_seasons() to authenticated,service_role;
