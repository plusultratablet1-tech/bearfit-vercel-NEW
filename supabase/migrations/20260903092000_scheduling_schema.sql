-- BearFit scheduling schema: recurring availability, concrete slots, and bookings.

create table public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  coach_user_id uuid not null references auth.users(id) on delete cascade,
  branch text not null,
  session_type text not null check (session_type in ('fitness','pilates_group','pilates_1on1')),
  weekday integer not null check (weekday between 0 and 6),
  local_start_time time not null,
  local_end_time time not null,
  slot_duration_minutes integer not null default 60 check (slot_duration_minutes > 0),
  capacity integer not null default 1 check (capacity > 0),
  valid_from date not null,
  valid_until date,
  active boolean not null default true,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (local_end_time > local_start_time),
  check (valid_until is null or valid_until >= valid_from)
);

create table public.schedule_slots (
  id uuid primary key default gen_random_uuid(),
  availability_rule_id uuid references public.availability_rules(id) on delete set null,
  coach_user_id uuid references auth.users(id) on delete set null,
  branch text not null,
  session_type text not null check (session_type in ('fitness','pilates_group','pilates_1on1')),
  start_at timestamptz not null,
  end_at timestamptz not null,
  capacity integer not null default 1 check (capacity > 0),
  status text not null default 'open' check (status in ('open','closed','cancelled','completed')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at > start_at)
);

create unique index schedule_slots_rule_start_uidx
on public.schedule_slots(availability_rule_id, start_at)
where availability_rule_id is not null;

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  slot_id uuid references public.schedule_slots(id) on delete set null,
  request_kind text not null check (request_kind in ('slot','custom','staff_assignment')),
  status text not null default 'pending' check (status in ('pending','confirmed','rejected','cancelled','completed','no_show')),
  requested_coach_user_id uuid references auth.users(id) on delete set null,
  assigned_coach_user_id uuid references auth.users(id) on delete set null,
  branch text not null,
  session_type text not null check (session_type in ('fitness','pilates_group','pilates_1on1')),
  requested_start_at timestamptz not null,
  requested_duration_minutes integer not null default 60 check (requested_duration_minutes > 0),
  start_at timestamptz,
  end_at timestamptz,
  member_package_id uuid references public.member_package_cycles(id) on delete set null,
  cancelled_at timestamptz,
  cancel_reason text,
  no_show_charged boolean not null default false,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at is null or start_at is not null),
  check (end_at is null or end_at > start_at)
);

create index availability_rules_coach_active_idx on public.availability_rules(coach_user_id, active, valid_from);
create index schedule_slots_branch_status_start_idx on public.schedule_slots(branch, status, start_at);
create index schedule_slots_coach_start_idx on public.schedule_slots(coach_user_id, start_at);
create index bookings_member_status_start_idx on public.bookings(member_id,status,start_at);
create index bookings_slot_status_idx on public.bookings(slot_id,status);
create index bookings_coach_status_start_idx on public.bookings(assigned_coach_user_id,status,start_at);

create trigger availability_rules_set_updated_at before update on public.availability_rules for each row execute function public.set_updated_at();
create trigger schedule_slots_set_updated_at before update on public.schedule_slots for each row execute function public.set_updated_at();
create trigger bookings_set_updated_at before update on public.bookings for each row execute function public.set_updated_at();

alter table public.availability_rules enable row level security;
alter table public.schedule_slots enable row level security;
alter table public.bookings enable row level security;

revoke all on table public.availability_rules from anon, authenticated;
revoke all on table public.schedule_slots from anon, authenticated;
revoke all on table public.bookings from anon, authenticated;
grant select on table public.availability_rules to authenticated;
grant select on table public.schedule_slots to authenticated;
grant select on table public.bookings to authenticated;
grant select,insert,update,delete on table public.availability_rules to service_role;
grant select,insert,update,delete on table public.schedule_slots to service_role;
grant select,insert,update,delete on table public.bookings to service_role;

create policy "availability_rules_select_staff"
on public.availability_rules for select to authenticated
using ((select private.is_staff_or_admin()));

create policy "schedule_slots_select_branch_or_staff"
on public.schedule_slots for select to authenticated
using (
  (select private.is_staff_or_admin())
  or (
    status = 'open'
    and exists (
      select 1 from public.members m
      where m.user_id = (select auth.uid())
        and m.branch = schedule_slots.branch
    )
  )
);

create policy "bookings_select_own_or_staff"
on public.bookings for select to authenticated
using (
  (select private.is_staff_or_admin())
  or exists (
    select 1 from public.members m
    where m.id = bookings.member_id and m.user_id = (select auth.uid())
  )
);

create or replace function public.staff_create_availability_rule(
  p_coach_user_id uuid,
  p_branch text,
  p_session_type text,
  p_weekday integer,
  p_local_start_time time,
  p_local_end_time time,
  p_slot_duration_minutes integer default 60,
  p_capacity integer default 1,
  p_valid_from date default current_date,
  p_valid_until date default null
)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare v_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not (select private.is_staff_or_admin()) then raise exception 'Staff access required'; end if;
  if p_session_type not in ('fitness','pilates_group','pilates_1on1') then raise exception 'Invalid session type'; end if;
  if p_weekday not between 0 and 6 then raise exception 'Invalid weekday'; end if;
  if p_local_end_time <= p_local_start_time then raise exception 'End time must be after start time'; end if;
  if p_slot_duration_minutes <= 0 or p_capacity <= 0 then raise exception 'Duration and capacity must be positive'; end if;
  insert into public.availability_rules(coach_user_id,branch,session_type,weekday,local_start_time,local_end_time,slot_duration_minutes,capacity,valid_from,valid_until,created_by)
  values(p_coach_user_id,trim(p_branch),p_session_type,p_weekday,p_local_start_time,p_local_end_time,p_slot_duration_minutes,p_capacity,p_valid_from,p_valid_until,(select auth.uid()))
  returning id into v_id;
  return v_id;
end; $$;
revoke all on function public.staff_create_availability_rule(uuid,text,text,integer,time,time,integer,integer,date,date) from public,anon;
grant execute on function public.staff_create_availability_rule(uuid,text,text,integer,time,time,integer,integer,date,date) to authenticated,service_role;

create or replace function public.staff_generate_slots(p_rule_id uuid, p_through date)
returns integer
language plpgsql security definer set search_path=''
as $$
declare
  v_rule public.availability_rules%rowtype;
  v_date date;
  v_cursor timestamp;
  v_window_end timestamp;
  v_start timestamptz;
  v_end timestamptz;
  v_inserted integer := 0;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not (select private.is_staff_or_admin()) then raise exception 'Staff access required'; end if;
  select * into v_rule from public.availability_rules where id=p_rule_id for update;
  if not found or not v_rule.active then raise exception 'Availability rule not found or inactive'; end if;
  if p_through < greatest(v_rule.valid_from,current_date) then return 0; end if;
  for v_date in select d::date from generate_series(greatest(v_rule.valid_from,current_date), least(p_through,coalesce(v_rule.valid_until,p_through)), interval '1 day') d
  loop
    if extract(dow from v_date)::integer = v_rule.weekday then
      v_cursor := v_date + v_rule.local_start_time;
      v_window_end := v_date + v_rule.local_end_time;
      while v_cursor + make_interval(mins=>v_rule.slot_duration_minutes) <= v_window_end loop
        v_start := v_cursor at time zone 'Asia/Manila';
        v_end := (v_cursor + make_interval(mins=>v_rule.slot_duration_minutes)) at time zone 'Asia/Manila';
        insert into public.schedule_slots(availability_rule_id,coach_user_id,branch,session_type,start_at,end_at,capacity,status,created_by)
        values(v_rule.id,v_rule.coach_user_id,v_rule.branch,v_rule.session_type,v_start,v_end,v_rule.capacity,'open',(select auth.uid()))
        on conflict (availability_rule_id,start_at) where availability_rule_id is not null do nothing;
        if found then v_inserted := v_inserted + 1; end if;
        v_cursor := v_cursor + make_interval(mins=>v_rule.slot_duration_minutes);
      end loop;
    end if;
  end loop;
  return v_inserted;
end; $$;
revoke all on function public.staff_generate_slots(uuid,date) from public,anon;
grant execute on function public.staff_generate_slots(uuid,date) to authenticated,service_role;

create or replace function public.staff_create_one_off_slot(
  p_coach_user_id uuid,
  p_branch text,
  p_session_type text,
  p_start_at timestamptz,
  p_duration_minutes integer default 60,
  p_capacity integer default 1
)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare v_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not (select private.is_staff_or_admin()) then raise exception 'Staff access required'; end if;
  if p_session_type not in ('fitness','pilates_group','pilates_1on1') then raise exception 'Invalid session type'; end if;
  if p_duration_minutes <= 0 or p_capacity <= 0 then raise exception 'Duration and capacity must be positive'; end if;
  insert into public.schedule_slots(coach_user_id,branch,session_type,start_at,end_at,capacity,status,created_by)
  values(p_coach_user_id,trim(p_branch),p_session_type,p_start_at,p_start_at+make_interval(mins=>p_duration_minutes),p_capacity,'open',(select auth.uid()))
  returning id into v_id;
  return v_id;
end; $$;
revoke all on function public.staff_create_one_off_slot(uuid,text,text,timestamptz,integer,integer) from public,anon;
grant execute on function public.staff_create_one_off_slot(uuid,text,text,timestamptz,integer,integer) to authenticated,service_role;

create or replace function public.staff_cancel_slot(p_slot_id uuid)
returns void
language plpgsql security definer set search_path=''
as $$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not (select private.is_staff_or_admin()) then raise exception 'Staff access required'; end if;
  update public.schedule_slots set status='cancelled' where id=p_slot_id;
  if not found then raise exception 'Slot not found'; end if;
end; $$;
revoke all on function public.staff_cancel_slot(uuid) from public,anon;
grant execute on function public.staff_cancel_slot(uuid) to authenticated,service_role;
