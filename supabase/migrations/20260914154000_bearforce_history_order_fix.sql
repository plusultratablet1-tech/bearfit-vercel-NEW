-- Fix member Bearforce history ordering/limit so rows are ordered before aggregation.
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
    select occurred_at, item
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
    limit v_limit
  ) limited;

  return v_history;
end;
$$;

revoke all on function public.member_bearforce_history(integer) from public,anon;
grant execute on function public.member_bearforce_history(integer) to authenticated,service_role;
