-- BearFit real progression system: lifetime/season points, streaks, prestige, tiers, redemptions.

create or replace function private.bearforce_season_key(p_at timestamptz default now())
returns text
language sql
stable
set search_path = ''
as $$
  select to_char(p_at at time zone 'Asia/Manila', 'YYYY')
    || '-Q'
    || extract(quarter from (p_at at time zone 'Asia/Manila'))::integer::text;
$$;

create or replace function private.bearforce_season_bounds(p_at timestamptz default now())
returns jsonb
language sql
stable
set search_path = ''
as $$
  with local_time as (
    select date_trunc('quarter', p_at at time zone 'Asia/Manila') as season_local_start
  )
  select jsonb_build_object(
    'season_key', private.bearforce_season_key(p_at),
    'starts_at', season_local_start at time zone 'Asia/Manila',
    'ends_at', (season_local_start + interval '3 months') at time zone 'Asia/Manila'
  )
  from local_time;
$$;

create table if not exists public.bearforce_point_events (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  event_type text not null check (length(trim(event_type)) > 0),
  points integer not null check (points > 0),
  season_key text not null,
  source_type text not null check (length(trim(source_type)) > 0),
  source_id uuid not null,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (member_id, event_type, source_type, source_id)
);

create index if not exists bearforce_point_events_member_time_idx
  on public.bearforce_point_events(member_id, occurred_at desc);
create index if not exists bearforce_point_events_member_season_idx
  on public.bearforce_point_events(member_id, season_key, occurred_at desc);

create table if not exists public.bearforce_redemptions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  season_key text not null,
  reward_label text not null check (length(trim(reward_label)) > 0),
  points_spent integer not null check (points_spent > 0),
  status text not null default 'completed' check (status in ('completed','reversed')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  reversed_by uuid references auth.users(id) on delete set null,
  reversed_at timestamptz
);

create index if not exists bearforce_redemptions_member_season_idx
  on public.bearforce_redemptions(member_id, season_key, created_at desc);

alter table public.bearforce_point_events enable row level security;
alter table public.bearforce_redemptions enable row level security;

revoke all on public.bearforce_point_events from anon, authenticated;
revoke all on public.bearforce_redemptions from anon, authenticated;
grant select on public.bearforce_point_events to authenticated;
grant select on public.bearforce_redemptions to authenticated;

drop policy if exists bearforce_points_member_read on public.bearforce_point_events;
create policy bearforce_points_member_read on public.bearforce_point_events
for select to authenticated
using (
  member_id in (select m.id from public.members m where m.user_id = (select auth.uid()))
  or (select private.is_staff_or_admin())
);

drop policy if exists bearforce_redemptions_member_read on public.bearforce_redemptions;
create policy bearforce_redemptions_member_read on public.bearforce_redemptions
for select to authenticated
using (
  member_id in (select m.id from public.members m where m.user_id = (select auth.uid()))
  or (select private.is_staff_or_admin())
);

create or replace function private.award_bearforce_points(
  p_member_id uuid,
  p_event_type text,
  p_points integer,
  p_source_type text,
  p_source_id uuid,
  p_occurred_at timestamptz default now(),
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_existing public.bearforce_point_events%rowtype;
begin
  if p_member_id is null or not exists(select 1 from public.members where id = p_member_id) then
    raise exception 'Member not found';
  end if;
  if coalesce(p_points,0) <= 0 then raise exception 'Bearforce points must be positive'; end if;
  if p_source_id is null then raise exception 'Bearforce source id is required'; end if;
  if nullif(trim(coalesce(p_event_type,'')),'') is null then raise exception 'Bearforce event type is required'; end if;
  if nullif(trim(coalesce(p_source_type,'')),'') is null then raise exception 'Bearforce source type is required'; end if;

  insert into public.bearforce_point_events(
    member_id,event_type,points,season_key,source_type,source_id,occurred_at,metadata
  ) values (
    p_member_id,trim(p_event_type),p_points,private.bearforce_season_key(coalesce(p_occurred_at,now())),
    trim(p_source_type),p_source_id,coalesce(p_occurred_at,now()),coalesce(p_metadata,'{}'::jsonb)
  )
  on conflict(member_id,event_type,source_type,source_id) do nothing
  returning id into v_event_id;

  if v_event_id is not null then
    return jsonb_build_object('awarded',true,'event_id',v_event_id,'points',p_points);
  end if;

  select * into v_existing
  from public.bearforce_point_events
  where member_id=p_member_id
    and event_type=trim(p_event_type)
    and source_type=trim(p_source_type)
    and source_id=p_source_id
  limit 1;

  return jsonb_build_object('awarded',false,'event_id',v_existing.id,'points',coalesce(v_existing.points,p_points));
end;
$$;

revoke all on function private.award_bearforce_points(uuid,text,integer,text,uuid,timestamptz,jsonb) from public,anon;
grant execute on function private.award_bearforce_points(uuid,text,integer,text,uuid,timestamptz,jsonb) to authenticated,service_role;

create or replace function private.bearforce_fitness_tier(p_lifetime_points integer)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_points integer := greatest(coalesce(p_lifetime_points,0),0);
  v_name text;
  v_next text;
  v_floor integer;
  v_next_threshold integer;
begin
  if v_points >= 25000 then
    v_name := 'Apex Bear'; v_next := null; v_floor := 25000; v_next_threshold := null;
  elsif v_points >= 10000 then
    v_name := 'Titan Bear'; v_next := 'Apex Bear'; v_floor := 10000; v_next_threshold := 25000;
  elsif v_points >= 5000 then
    v_name := 'Kodiak'; v_next := 'Titan Bear'; v_floor := 5000; v_next_threshold := 10000;
  elsif v_points >= 1000 then
    v_name := 'Grizzly'; v_next := 'Kodiak'; v_floor := 1000; v_next_threshold := 5000;
  else
    v_name := 'Bear Cub'; v_next := 'Grizzly'; v_floor := 0; v_next_threshold := 1000;
  end if;

  return jsonb_build_object(
    'name',v_name,
    'next_name',v_next,
    'tier_floor',v_floor,
    'next_threshold',v_next_threshold,
    'points_to_next',case when v_next_threshold is null then 0 else greatest(v_next_threshold-v_points,0) end,
    'progress_percent',case
      when v_next_threshold is null then 100
      else least(100, greatest(0, round(((v_points-v_floor)::numeric / nullif(v_next_threshold-v_floor,0)) * 100)::integer))
    end
  );
end;
$$;

create or replace function private.bearforce_prestige(p_season_points integer)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_points integer := greatest(coalesce(p_season_points,0),0);
  v_name text;
  v_next text;
  v_floor integer;
  v_next_threshold integer;
begin
  if v_points >= 5000 then
    v_name := 'Prestige'; v_next := null; v_floor := 5000; v_next_threshold := null;
  elsif v_points >= 3000 then
    v_name := 'Gold'; v_next := 'Prestige'; v_floor := 3000; v_next_threshold := 5000;
  elsif v_points >= 1500 then
    v_name := 'Silver'; v_next := 'Gold'; v_floor := 1500; v_next_threshold := 3000;
  elsif v_points >= 500 then
    v_name := 'Bronze'; v_next := 'Silver'; v_floor := 500; v_next_threshold := 1500;
  else
    v_name := 'Rookie'; v_next := 'Bronze'; v_floor := 0; v_next_threshold := 500;
  end if;

  return jsonb_build_object(
    'name',v_name,
    'next_name',v_next,
    'rank_floor',v_floor,
    'next_threshold',v_next_threshold,
    'points_to_next',case when v_next_threshold is null then 0 else greatest(v_next_threshold-v_points,0) end,
    'progress_percent',case
      when v_next_threshold is null then 100
      else least(100, greatest(0, round(((v_points-v_floor)::numeric / nullif(v_next_threshold-v_floor,0)) * 100)::integer))
    end
  );
end;
$$;

create or replace function private.bearforce_streak(p_member_id uuid,p_as_of timestamptz default now())
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_current_week_start date := date_trunc('week', p_as_of at time zone 'Asia/Manila')::date;
  v_current_week_sessions integer := 0;
  v_eval_week date;
  v_min_week date;
  v_week date;
  v_week_sessions integer;
  v_misses integer := 0;
  v_streak integer := 0;
  v_first_eval_sessions integer := 0;
  v_grace_week_active boolean := false;
begin
  select count(*)::integer into v_current_week_sessions
  from public.bearforce_point_events e
  where e.member_id=p_member_id
    and e.event_type='session_completed'
    and (e.occurred_at at time zone 'Asia/Manila') >= v_current_week_start::timestamp
    and (e.occurred_at at time zone 'Asia/Manila') < (v_current_week_start + 7)::timestamp;

  v_eval_week := case when v_current_week_sessions >= 3 then v_current_week_start else v_current_week_start - 7 end;

  select min(date_trunc('week', e.occurred_at at time zone 'Asia/Manila')::date)
  into v_min_week
  from public.bearforce_point_events e
  where e.member_id=p_member_id and e.event_type='session_completed';

  if v_min_week is null then
    return jsonb_build_object(
      'weekly_goal',3,
      'current_week_sessions',v_current_week_sessions,
      'weekly_goal_met',v_current_week_sessions>=3,
      'streak_weeks',0,
      'grace_week_active',false
    );
  end if;

  v_week := v_eval_week;
  while v_week >= v_min_week loop
    select count(*)::integer into v_week_sessions
    from public.bearforce_point_events e
    where e.member_id=p_member_id
      and e.event_type='session_completed'
      and (e.occurred_at at time zone 'Asia/Manila') >= v_week::timestamp
      and (e.occurred_at at time zone 'Asia/Manila') < (v_week + 7)::timestamp;

    if v_week = v_eval_week then v_first_eval_sessions := v_week_sessions; end if;

    if v_week_sessions >= 3 then
      v_streak := v_streak + 1;
      v_misses := 0;
    else
      v_misses := v_misses + 1;
      if v_misses >= 2 then exit; end if;
    end if;

    v_week := v_week - 7;
  end loop;

  v_grace_week_active := v_first_eval_sessions < 3 and v_streak > 0 and v_misses < 2;

  return jsonb_build_object(
    'weekly_goal',3,
    'current_week_sessions',v_current_week_sessions,
    'weekly_goal_met',v_current_week_sessions>=3,
    'streak_weeks',v_streak,
    'grace_week_active',v_grace_week_active
  );
end;
$$;

revoke all on function private.bearforce_streak(uuid,timestamptz) from public,anon;
grant execute on function private.bearforce_streak(uuid,timestamptz) to authenticated,service_role;

create or replace function private.bearforce_summary_for_member(p_member_id uuid,p_as_of timestamptz default now())
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_season_key text := private.bearforce_season_key(p_as_of);
  v_lifetime integer := 0;
  v_season_earned integer := 0;
  v_season_spent integer := 0;
  v_season_balance integer := 0;
  v_bounds jsonb := private.bearforce_season_bounds(p_as_of);
  v_streak jsonb;
  v_tier jsonb;
  v_prestige jsonb;
begin
  if not exists(select 1 from public.members where id=p_member_id) then raise exception 'Member not found'; end if;

  select coalesce(sum(points),0)::integer into v_lifetime
  from public.bearforce_point_events where member_id=p_member_id;

  select coalesce(sum(points),0)::integer into v_season_earned
  from public.bearforce_point_events where member_id=p_member_id and season_key=v_season_key;

  select coalesce(sum(points_spent),0)::integer into v_season_spent
  from public.bearforce_redemptions
  where member_id=p_member_id and season_key=v_season_key and status='completed';

  v_season_balance := greatest(v_season_earned-v_season_spent,0);
  v_streak := private.bearforce_streak(p_member_id,p_as_of);
  v_tier := private.bearforce_fitness_tier(v_lifetime);
  v_prestige := private.bearforce_prestige(v_season_earned);

  return jsonb_build_object(
    'lifetime_points',v_lifetime,
    'season_key',v_season_key,
    'season_starts_at',v_bounds->'starts_at',
    'season_ends_at',v_bounds->'ends_at',
    'season_earned',v_season_earned,
    'season_spent',v_season_spent,
    'season_balance',v_season_balance,
    'weekly_goal',coalesce((v_streak->>'weekly_goal')::integer,3),
    'current_week_sessions',coalesce((v_streak->>'current_week_sessions')::integer,0),
    'weekly_goal_met',coalesce((v_streak->>'weekly_goal_met')::boolean,false),
    'streak_weeks',coalesce((v_streak->>'streak_weeks')::integer,0),
    'grace_week_active',coalesce((v_streak->>'grace_week_active')::boolean,false),
    'fitness_tier',v_tier,
    'prestige',v_prestige
  );
end;
$$;

revoke all on function private.bearforce_summary_for_member(uuid,timestamptz) from public,anon;
grant execute on function private.bearforce_summary_for_member(uuid,timestamptz) to authenticated,service_role;

create or replace function public.member_bearforce_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_member_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  select id into v_member_id from public.members where user_id=(select auth.uid());
  if not found then raise exception 'Member profile not found'; end if;
  return private.bearforce_summary_for_member(v_member_id,now());
end;
$$;

revoke all on function public.member_bearforce_summary() from public,anon;
grant execute on function public.member_bearforce_summary() to authenticated,service_role;

create or replace function public.staff_redeem_bearforce_points(
  p_member_id uuid,
  p_points integer,
  p_reward_label text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_summary jsonb;
  v_balance integer;
  v_redemption_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not (select private.is_staff_or_admin()) then raise exception 'Staff access required'; end if;
  if coalesce(p_points,0)<=0 then raise exception 'Redemption points must be positive'; end if;
  if nullif(trim(coalesce(p_reward_label,'')),'') is null then raise exception 'Reward label is required'; end if;

  perform 1 from public.members where id=p_member_id for update;
  if not found then raise exception 'Member not found'; end if;

  v_summary := private.bearforce_summary_for_member(p_member_id,now());
  v_balance := coalesce((v_summary->>'season_balance')::integer,0);
  if p_points > v_balance then raise exception 'Not enough seasonal Bearforce Points'; end if;

  insert into public.bearforce_redemptions(member_id,season_key,reward_label,points_spent,status,created_by)
  values(p_member_id,private.bearforce_season_key(now()),trim(p_reward_label),p_points,'completed',(select auth.uid()))
  returning id into v_redemption_id;

  return jsonb_build_object(
    'redemption_id',v_redemption_id,
    'status','completed',
    'reward_label',trim(p_reward_label),
    'points_spent',p_points,
    'summary',private.bearforce_summary_for_member(p_member_id,now())
  );
end;
$$;

revoke all on function public.staff_redeem_bearforce_points(uuid,integer,text) from public,anon;
grant execute on function public.staff_redeem_bearforce_points(uuid,integer,text) to authenticated,service_role;

create or replace function public.staff_reverse_bearforce_redemption(p_redemption_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_redemption public.bearforce_redemptions%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not (select private.is_staff_or_admin()) then raise exception 'Staff access required'; end if;

  select * into v_redemption from public.bearforce_redemptions where id=p_redemption_id for update;
  if not found then raise exception 'Redemption not found'; end if;

  if v_redemption.status='completed' then
    update public.bearforce_redemptions
    set status='reversed',reversed_by=(select auth.uid()),reversed_at=now()
    where id=v_redemption.id;
  end if;

  return jsonb_build_object(
    'redemption_id',v_redemption.id,
    'status','reversed',
    'summary',private.bearforce_summary_for_member(v_redemption.member_id,now())
  );
end;
$$;

revoke all on function public.staff_reverse_bearforce_redemption(uuid) from public,anon;
grant execute on function public.staff_reverse_bearforce_redemption(uuid) to authenticated,service_role;

-- Backfill real completed session history. Charged no-shows consumed sessions but do not earn workout points.
insert into public.bearforce_point_events(
  member_id,event_type,points,season_key,source_type,source_id,occurred_at,metadata
)
select
  l.member_id,
  'session_completed',
  100,
  private.bearforce_season_key(l.trained_at),
  'session_log',
  l.id,
  l.trained_at,
  jsonb_build_object('backfilled',true,'booking_id',l.booking_id)
from public.session_logs l
left join public.bookings b on b.id=l.booking_id
where not (coalesce(b.status,'')='no_show' and coalesce(b.no_show_charged,false))
on conflict(member_id,event_type,source_type,source_id) do nothing;
