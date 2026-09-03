-- Bearforce Rewards Catalog
-- Pending requests reserve current-season points and limited stock.
-- Bearforce points are spent only when staff/admin approves the request.

create table if not exists public.reward_catalog (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  description text not null default '',
  category text not null default 'general' check (length(trim(category)) > 0),
  image_url text,
  points_cost integer not null check (points_cost > 0),
  stock_quantity integer check (stock_quantity is null or stock_quantity >= 0),
  reserved_quantity integer not null default 0 check (reserved_quantity >= 0),
  redeemed_quantity integer not null default 0 check (redeemed_quantity >= 0),
  requires_active_membership boolean not null default true,
  active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (stock_quantity is null or stock_quantity >= reserved_quantity + redeemed_quantity)
);

create table if not exists public.reward_requests (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  reward_id uuid not null references public.reward_catalog(id) on delete restrict,
  season_key text not null,
  points_cost integer not null check (points_cost > 0),
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled','claimed')),
  bearforce_redemption_id uuid references public.bearforce_redemptions(id) on delete set null,
  requested_by uuid not null references auth.users(id) on delete restrict,
  requested_at timestamptz not null default now(),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  claimed_by uuid references auth.users(id) on delete set null,
  claimed_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists reward_requests_one_pending_per_reward_idx
  on public.reward_requests(member_id, reward_id)
  where status = 'pending';
create index if not exists reward_requests_member_status_idx on public.reward_requests(member_id,status,requested_at desc);
create index if not exists reward_requests_reward_status_idx on public.reward_requests(reward_id,status,requested_at desc);
create index if not exists reward_requests_season_idx on public.reward_requests(season_key,status,requested_at desc);
create index if not exists reward_catalog_created_by_idx on public.reward_catalog(created_by);
create index if not exists reward_requests_requested_by_idx on public.reward_requests(requested_by);
create index if not exists reward_requests_decided_by_idx on public.reward_requests(decided_by);
create index if not exists reward_requests_claimed_by_idx on public.reward_requests(claimed_by);
create index if not exists reward_requests_redemption_idx on public.reward_requests(bearforce_redemption_id);

alter table public.reward_catalog enable row level security;
alter table public.reward_requests enable row level security;

revoke all on public.reward_catalog from anon, authenticated;
revoke all on public.reward_requests from anon, authenticated;
grant select on public.reward_catalog to authenticated;
grant select on public.reward_requests to authenticated;

drop policy if exists reward_catalog_read on public.reward_catalog;
create policy reward_catalog_read on public.reward_catalog
for select to authenticated
using (active or (select private.is_staff_or_admin()));

drop policy if exists reward_requests_read on public.reward_requests;
create policy reward_requests_read on public.reward_requests
for select to authenticated
using (
  member_id in (select m.id from public.members m where m.user_id = (select auth.uid()))
  or (select private.is_staff_or_admin())
);

create or replace function public.member_rewards_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_member public.members%rowtype;
  v_summary jsonb;
  v_season_key text;
  v_reserved_points integer := 0;
  v_available_points integer := 0;
  v_catalog jsonb := '[]'::jsonb;
  v_requests jsonb := '[]'::jsonb;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  select * into v_member from public.members where user_id = (select auth.uid());
  if not found then raise exception 'Member profile not found'; end if;

  v_summary := private.bearforce_summary_for_member(v_member.id, now());
  v_season_key := v_summary->>'season_key';

  select coalesce(sum(points_cost),0)::integer into v_reserved_points
  from public.reward_requests
  where member_id = v_member.id and season_key = v_season_key and status = 'pending';

  v_available_points := greatest(coalesce((v_summary->>'season_balance')::integer,0) - v_reserved_points, 0);

  select coalesce(jsonb_agg(item order by item->>'title'), '[]'::jsonb) into v_catalog
  from (
    select jsonb_build_object(
      'id', r.id,
      'title', r.title,
      'description', r.description,
      'category', r.category,
      'image_url', r.image_url,
      'points_cost', r.points_cost,
      'stock_quantity', r.stock_quantity,
      'reserved_quantity', r.reserved_quantity,
      'redeemed_quantity', r.redeemed_quantity,
      'available_stock', case when r.stock_quantity is null then null else greatest(r.stock_quantity-r.reserved_quantity-r.redeemed_quantity,0) end,
      'requires_active_membership', r.requires_active_membership,
      'active', r.active,
      'can_afford', v_available_points >= r.points_cost,
      'membership_eligible', (not r.requires_active_membership) or lower(coalesce(v_member.membership_status,''))='active'
    ) as item
    from public.reward_catalog r
    where r.active
  ) q;

  select coalesce(jsonb_agg(item order by item->>'requested_at' desc), '[]'::jsonb) into v_requests
  from (
    select jsonb_build_object(
      'id', rr.id,
      'reward_id', rr.reward_id,
      'reward_title', rc.title,
      'reward_category', rc.category,
      'image_url', rc.image_url,
      'season_key', rr.season_key,
      'points_cost', rr.points_cost,
      'status', rr.status,
      'requested_at', rr.requested_at,
      'decided_at', rr.decided_at,
      'claimed_at', rr.claimed_at,
      'decision_note', rr.decision_note
    ) as item
    from public.reward_requests rr
    join public.reward_catalog rc on rc.id=rr.reward_id
    where rr.member_id=v_member.id
    order by rr.requested_at desc
    limit 100
  ) q;

  return jsonb_build_object(
    'summary', v_summary,
    'reserved_points', v_reserved_points,
    'available_points', v_available_points,
    'catalog', v_catalog,
    'requests', v_requests
  );
end;
$$;

create or replace function public.member_request_reward(p_reward_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.members%rowtype;
  v_reward public.reward_catalog%rowtype;
  v_summary jsonb;
  v_season_key text;
  v_reserved_points integer := 0;
  v_available_points integer := 0;
  v_request_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;

  select * into v_member from public.members where user_id=(select auth.uid()) for update;
  if not found then raise exception 'Member profile not found'; end if;
  select * into v_reward from public.reward_catalog where id=p_reward_id for update;
  if not found or not v_reward.active then raise exception 'Reward is not available'; end if;

  if v_reward.requires_active_membership and lower(coalesce(v_member.membership_status,'')) <> 'active' then
    raise exception 'An active membership is required for this reward';
  end if;

  if exists(select 1 from public.reward_requests where member_id=v_member.id and reward_id=v_reward.id and status='pending') then
    raise exception 'You already have a pending request for this reward';
  end if;

  v_summary := private.bearforce_summary_for_member(v_member.id,now());
  v_season_key := v_summary->>'season_key';
  select coalesce(sum(points_cost),0)::integer into v_reserved_points
  from public.reward_requests
  where member_id=v_member.id and season_key=v_season_key and status='pending';
  v_available_points := greatest(coalesce((v_summary->>'season_balance')::integer,0)-v_reserved_points,0);

  if v_available_points < v_reward.points_cost then
    raise exception 'Not enough seasonal Bearforce Points';
  end if;

  if v_reward.stock_quantity is not null
     and v_reward.stock_quantity-v_reward.reserved_quantity-v_reward.redeemed_quantity <= 0 then
    raise exception 'Reward is out of stock';
  end if;

  insert into public.reward_requests(member_id,reward_id,season_key,points_cost,status,requested_by)
  values(v_member.id,v_reward.id,v_season_key,v_reward.points_cost,'pending',(select auth.uid()))
  returning id into v_request_id;

  if v_reward.stock_quantity is not null then
    update public.reward_catalog
    set reserved_quantity = reserved_quantity + 1, updated_at=now()
    where id=v_reward.id;
  end if;

  return jsonb_build_object('request_id',v_request_id,'status','pending','snapshot',public.member_rewards_snapshot());
end;
$$;

create or replace function public.member_cancel_reward_request(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.members%rowtype;
  v_request public.reward_requests%rowtype;
  v_reward public.reward_catalog%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  select * into v_member from public.members where user_id=(select auth.uid());
  if not found then raise exception 'Member profile not found'; end if;
  select * into v_request from public.reward_requests where id=p_request_id and member_id=v_member.id for update;
  if not found then raise exception 'Reward request not found'; end if;
  if v_request.status <> 'pending' then raise exception 'Only pending reward requests can be cancelled'; end if;
  select * into v_reward from public.reward_catalog where id=v_request.reward_id for update;

  update public.reward_requests
  set status='cancelled', decided_at=now(), decision_note='Cancelled by member', updated_at=now()
  where id=v_request.id;

  if v_reward.stock_quantity is not null then
    update public.reward_catalog
    set reserved_quantity = greatest(reserved_quantity - 1, 0), updated_at=now()
    where id=v_reward.id;
  end if;

  return jsonb_build_object('request_id',v_request.id,'status','cancelled','snapshot',public.member_rewards_snapshot());
end;
$$;

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
      'id',rr.id,'member_id',rr.member_id,'member_code',m.member_code,'member_name',m.full_name,
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

create or replace function public.staff_create_reward(
  p_title text,
  p_points_cost integer,
  p_description text default '',
  p_category text default 'general',
  p_image_url text default null,
  p_stock_quantity integer default null,
  p_requires_active_membership boolean default true,
  p_active boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not (select private.is_staff_or_admin()) then raise exception 'Staff access required'; end if;
  if nullif(trim(coalesce(p_title,'')),'') is null then raise exception 'Reward title is required'; end if;
  if coalesce(p_points_cost,0)<=0 then raise exception 'Reward points cost must be positive'; end if;
  if p_stock_quantity is not null and p_stock_quantity<0 then raise exception 'Reward stock cannot be negative'; end if;
  insert into public.reward_catalog(title,description,category,image_url,points_cost,stock_quantity,requires_active_membership,active,created_by)
  values(trim(p_title),coalesce(p_description,''),coalesce(nullif(trim(p_category),''),'general'),nullif(trim(coalesce(p_image_url,'')),''),p_points_cost,p_stock_quantity,coalesce(p_requires_active_membership,true),coalesce(p_active,true),(select auth.uid()))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.staff_update_reward(
  p_reward_id uuid,
  p_title text,
  p_description text,
  p_category text,
  p_image_url text,
  p_points_cost integer,
  p_stock_quantity integer,
  p_requires_active_membership boolean,
  p_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_reward public.reward_catalog%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not (select private.is_staff_or_admin()) then raise exception 'Staff access required'; end if;
  select * into v_reward from public.reward_catalog where id=p_reward_id for update;
  if not found then raise exception 'Reward not found'; end if;
  if nullif(trim(coalesce(p_title,'')),'') is null then raise exception 'Reward title is required'; end if;
  if coalesce(p_points_cost,0)<=0 then raise exception 'Reward points cost must be positive'; end if;
  if p_stock_quantity is not null and p_stock_quantity < v_reward.reserved_quantity+v_reward.redeemed_quantity then
    raise exception 'Stock cannot be lower than reserved plus redeemed quantity';
  end if;
  update public.reward_catalog set
    title=trim(p_title), description=coalesce(p_description,''), category=coalesce(nullif(trim(p_category),''),'general'),
    image_url=nullif(trim(coalesce(p_image_url,'')),''), points_cost=p_points_cost, stock_quantity=p_stock_quantity,
    requires_active_membership=coalesce(p_requires_active_membership,true), active=coalesce(p_active,false), updated_at=now()
  where id=p_reward_id;
  return public.staff_reward_snapshot();
end;
$$;

create or replace function public.staff_approve_reward_request(p_request_id uuid,p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.reward_requests%rowtype;
  v_reward public.reward_catalog%rowtype;
  v_member public.members%rowtype;
  v_summary jsonb;
  v_current_season text;
  v_other_reserved integer := 0;
  v_balance integer := 0;
  v_redemption_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not (select private.is_staff_or_admin()) then raise exception 'Staff access required'; end if;

  select * into v_request from public.reward_requests where id=p_request_id for update;
  if not found then raise exception 'Reward request not found'; end if;
  if v_request.status <> 'pending' then raise exception 'Only pending reward requests can be approved'; end if;
  select * into v_member from public.members where id=v_request.member_id for update;
  select * into v_reward from public.reward_catalog where id=v_request.reward_id for update;

  v_current_season := private.bearforce_season_key(now());
  if v_request.season_key <> v_current_season then raise exception 'Reward request season has ended'; end if;

  v_summary := private.bearforce_summary_for_member(v_member.id,now());
  v_balance := coalesce((v_summary->>'season_balance')::integer,0);
  select coalesce(sum(points_cost),0)::integer into v_other_reserved
  from public.reward_requests
  where member_id=v_member.id and season_key=v_current_season and status='pending' and id<>v_request.id;
  if v_balance-v_other_reserved < v_request.points_cost then
    raise exception 'Not enough seasonal Bearforce Points to approve this request';
  end if;

  insert into public.bearforce_redemptions(member_id,season_key,reward_label,points_spent,status,created_by)
  values(v_member.id,v_request.season_key,v_reward.title,v_request.points_cost,'completed',(select auth.uid()))
  returning id into v_redemption_id;

  update public.reward_requests set status='approved',bearforce_redemption_id=v_redemption_id,
    decided_by=(select auth.uid()),decided_at=now(),decision_note=nullif(trim(coalesce(p_note,'')),''),updated_at=now()
  where id=v_request.id;

  if v_reward.stock_quantity is not null then
    update public.reward_catalog
    set reserved_quantity = greatest(reserved_quantity - 1, 0), updated_at=now()
    where id=v_reward.id;
  end if;
  update public.reward_catalog set redeemed_quantity = redeemed_quantity + 1, updated_at=now() where id=v_reward.id;

  return jsonb_build_object('request_id',v_request.id,'status','approved','redemption_id',v_redemption_id,'snapshot',public.staff_reward_snapshot());
end;
$$;

create or replace function public.staff_reject_reward_request(p_request_id uuid,p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_request public.reward_requests%rowtype; v_reward public.reward_catalog%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not (select private.is_staff_or_admin()) then raise exception 'Staff access required'; end if;
  select * into v_request from public.reward_requests where id=p_request_id for update;
  if not found then raise exception 'Reward request not found'; end if;
  if v_request.status <> 'pending' then raise exception 'Only pending reward requests can be rejected'; end if;
  select * into v_reward from public.reward_catalog where id=v_request.reward_id for update;

  update public.reward_requests set status='rejected',decided_by=(select auth.uid()),decided_at=now(),
    decision_note=coalesce(nullif(trim(coalesce(p_note,'')),''),'Rejected by staff'),updated_at=now()
  where id=v_request.id;
  if v_reward.stock_quantity is not null then
    update public.reward_catalog set reserved_quantity = greatest(reserved_quantity - 1, 0), updated_at=now() where id=v_reward.id;
  end if;
  return jsonb_build_object('request_id',v_request.id,'status','rejected','snapshot',public.staff_reward_snapshot());
end;
$$;

create or replace function public.staff_mark_reward_claimed(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_request public.reward_requests%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not (select private.is_staff_or_admin()) then raise exception 'Staff access required'; end if;
  select * into v_request from public.reward_requests where id=p_request_id for update;
  if not found then raise exception 'Reward request not found'; end if;
  if v_request.status <> 'approved' then raise exception 'Only approved rewards can be marked claimed'; end if;
  update public.reward_requests set status='claimed',claimed_by=(select auth.uid()),claimed_at=now(),updated_at=now() where id=v_request.id;
  return jsonb_build_object('request_id',v_request.id,'status','claimed','snapshot',public.staff_reward_snapshot());
end;
$$;

revoke all on function public.member_rewards_snapshot() from public,anon;
revoke all on function public.member_request_reward(uuid) from public,anon;
revoke all on function public.member_cancel_reward_request(uuid) from public,anon;
revoke all on function public.staff_reward_snapshot() from public,anon;
revoke all on function public.staff_create_reward(text,integer,text,text,text,integer,boolean,boolean) from public,anon;
revoke all on function public.staff_update_reward(uuid,text,text,text,text,integer,integer,boolean,boolean) from public,anon;
revoke all on function public.staff_approve_reward_request(uuid,text) from public,anon;
revoke all on function public.staff_reject_reward_request(uuid,text) from public,anon;
revoke all on function public.staff_mark_reward_claimed(uuid) from public,anon;

grant execute on function public.member_rewards_snapshot() to authenticated,service_role;
grant execute on function public.member_request_reward(uuid) to authenticated,service_role;
grant execute on function public.member_cancel_reward_request(uuid) to authenticated,service_role;
grant execute on function public.staff_reward_snapshot() to authenticated,service_role;
grant execute on function public.staff_create_reward(text,integer,text,text,text,integer,boolean,boolean) to authenticated,service_role;
grant execute on function public.staff_update_reward(uuid,text,text,text,text,integer,integer,boolean,boolean) to authenticated,service_role;
grant execute on function public.staff_approve_reward_request(uuid,text) to authenticated,service_role;
grant execute on function public.staff_reject_reward_request(uuid,text) to authenticated,service_role;
grant execute on function public.staff_mark_reward_claimed(uuid) to authenticated,service_role;
