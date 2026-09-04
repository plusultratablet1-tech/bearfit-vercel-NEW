-- Permanent QA/demo marker and safe compatibility presentation for M0001.
alter table public.members
  add column if not exists is_demo boolean not null default false;

update public.members
set is_demo=true,
    package_name='QA Demo Package',
    package_type='QA Demo Package',
    updated_at=now()
where member_code='M0001';

-- Keep LEGACY_FITNESS inactive. It remains only as the historical accounting bridge.
update public.package_definitions set active=false where code='LEGACY_FITNESS';

create or replace function public.staff_reward_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_catalog jsonb := '[]'::jsonb;
  v_requests jsonb := '[]'::jsonb;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not (select private.is_staff_or_admin()) then raise exception 'Staff access required'; end if;

  select coalesce(jsonb_agg(item order by item->>'created_at' desc), '[]'::jsonb) into v_catalog
  from (
    select jsonb_build_object(
      'id',r.id,'title',r.title,'description',r.description,'category',r.category,'image_url',r.image_url,
      'points_cost',r.points_cost,'stock_quantity',r.stock_quantity,'reserved_quantity',r.reserved_quantity,
      'redeemed_quantity',r.redeemed_quantity,
      'available_stock',case when r.stock_quantity is null then null else greatest(r.stock_quantity-r.reserved_quantity-r.redeemed_quantity,0) end,
      'requires_active_membership',r.requires_active_membership,'active',r.active,'created_at',r.created_at,'updated_at',r.updated_at
    ) as item
    from public.reward_catalog r
  ) q;

  select coalesce(jsonb_agg(item order by item->>'requested_at' desc), '[]'::jsonb) into v_requests
  from (
    select jsonb_build_object(
      'id',rr.id,'member_id',rr.member_id,'member_code',m.member_code,'member_name',m.full_name,'member_is_demo',m.is_demo,
      'reward_id',rr.reward_id,'reward_title',rc.title,'reward_category',rc.category,'season_key',rr.season_key,
      'points_cost',rr.points_cost,'status',rr.status,'requested_at',rr.requested_at,'decided_at',rr.decided_at,
      'claimed_at',rr.claimed_at,'decision_note',rr.decision_note,'bearforce_redemption_id',rr.bearforce_redemption_id
    ) as item
    from public.reward_requests rr
    join public.members m on m.id=rr.member_id
    join public.reward_catalog rc on rc.id=rr.reward_id
    order by rr.requested_at desc
    limit 200
  ) q;

  return jsonb_build_object('catalog',v_catalog,'requests',v_requests);
end;
$$;
