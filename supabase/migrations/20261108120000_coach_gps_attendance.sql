-- GPS attendance rollout is disabled until Admin configures and enables each branch.
-- Exact coach device coordinates are not retained. Session/credit/payroll logic is unchanged.
create table if not exists public.coach_branch_gps_settings (
  branch text primary key check(branch in ('Malingap Branch','E. Rodriguez Branch','Primark Cainta')),
  latitude double precision not null check(latitude between -90 and 90),
  longitude double precision not null check(longitude between -180 and 180),
  radius_m integer not null default 200 check(radius_m between 100 and 500),
  accuracy_limit_m integer not null default 120 check(accuracy_limit_m between 30 and 200),
  enabled boolean not null default false,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
alter table public.coach_branch_gps_settings enable row level security;
revoke all on public.coach_branch_gps_settings from public,anon,authenticated;

create table if not exists public.coach_gps_attendance_audit (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches(id),
  work_shift_id uuid not null references public.coach_work_shifts(id),
  verified_by uuid not null references auth.users(id),
  branch text not null,
  action text not null check(action in ('in','out')),
  distance_m double precision not null check(distance_m>=0),
  accuracy_m double precision not null check(accuracy_m>=0),
  verified_at timestamptz not null default now()
);
create index if not exists coach_gps_attendance_audit_shift on public.coach_gps_attendance_audit(work_shift_id,verified_at desc);
alter table public.coach_gps_attendance_audit enable row level security;
revoke all on public.coach_gps_attendance_audit from public,anon,authenticated;

create or replace function public.admin_coach_gps_settings()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_data jsonb;
begin
  if not exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin')
  then raise exception 'Admin account required';end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'branch',branch,'latitude',latitude,'longitude',longitude,
    'radius_m',radius_m,'accuracy_limit_m',accuracy_limit_m,
    'enabled',enabled,'updated_at',updated_at
  ) order by branch),'[]'::jsonb) into v_data
  from public.coach_branch_gps_settings;
  return v_data;
end;$$;
revoke all on function public.admin_coach_gps_settings() from public,anon;
grant execute on function public.admin_coach_gps_settings() to authenticated;

create or replace function public.admin_update_coach_gps_settings(
  p_branch text,p_latitude double precision,p_longitude double precision,
  p_radius_m integer default 200,p_enabled boolean default false
) returns jsonb language plpgsql security definer set search_path=''
as $$
begin
  if not exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin')
  then raise exception 'Admin account required';end if;
  if p_branch not in ('Malingap Branch','E. Rodriguez Branch','Primark Cainta')
     or p_latitude is null or p_latitude not between -90 and 90
     or p_longitude is null or p_longitude not between -180 and 180
     or p_radius_m is null or p_radius_m not between 100 and 500
  then raise exception 'Choose a valid branch, coordinates and radius (100-500 metres)';end if;
  insert into public.coach_branch_gps_settings(
    branch,latitude,longitude,radius_m,enabled,updated_by,updated_at)
  values(p_branch,p_latitude,p_longitude,p_radius_m,coalesce(p_enabled,false),(select auth.uid()),now())
  on conflict(branch) do update set latitude=excluded.latitude,longitude=excluded.longitude,
    radius_m=excluded.radius_m,enabled=excluded.enabled,
    updated_by=excluded.updated_by,updated_at=now();
  return jsonb_build_object('branch',p_branch,'enabled',coalesce(p_enabled,false),'radius_m',p_radius_m);
end;$$;
revoke all on function public.admin_update_coach_gps_settings(text,double precision,double precision,integer,boolean) from public,anon;
grant execute on function public.admin_update_coach_gps_settings(text,double precision,double precision,integer,boolean) to authenticated;

create or replace function public.coach_gps_attendance_status()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare c public.coaches%rowtype;cfg public.coach_branch_gps_settings%rowtype;
begin
  if (select auth.uid()) is null or not exists(
     select 1 from public.profiles where id=(select auth.uid()) and role='coach')
  then raise exception 'Coach login required';end if;
  select * into c from public.coaches where user_id=(select auth.uid()) and is_active and not is_demo;
  if not found then raise exception 'Active coach not found';end if;
  select * into cfg from public.coach_branch_gps_settings where branch=c.branch;
  return jsonb_build_object('branch',c.branch,'configured',found,'enabled',coalesce(cfg.enabled,false),
    'radius_m',cfg.radius_m,'accuracy_limit_m',cfg.accuracy_limit_m);
end;$$;
revoke all on function public.coach_gps_attendance_status() from public,anon;
grant execute on function public.coach_gps_attendance_status() to authenticated;

create or replace function public.coach_gps_time_punch(
  p_work_shift_id uuid,p_action text,p_latitude double precision,
  p_longitude double precision,p_accuracy_m double precision,p_observed_at timestamptz
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare c public.coaches%rowtype;w public.coach_work_shifts%rowtype;
 cfg public.coach_branch_gps_settings%rowtype;
 s public.coach_shifts%rowtype;v_now timestamptz:=now();v_distance double precision;
begin
  if (select auth.uid()) is null or not exists(
    select 1 from public.profiles where id=(select auth.uid()) and role='coach')
  then raise exception 'Coach login required';end if;
  select * into c from public.coaches where user_id=(select auth.uid()) and is_active and not is_demo for update;
  if not found then raise exception 'Active coach not found';end if;
  if p_action not in ('in','out') or p_action is null then raise exception 'Invalid attendance action';end if;
  select * into w from public.coach_work_shifts where id=p_work_shift_id and coach_id=c.id for update;
  if not found or w.branch is distinct from c.branch then raise exception 'No assigned shift at this branch';end if;
  if w.response='unavailable' then raise exception 'Shift marked unavailable. Ask Admin to resolve';end if;
  select * into cfg from public.coach_branch_gps_settings where branch=w.branch and enabled;
  if not found then raise exception 'GPS clock-in is not enabled for this branch. Ask Admin to set the gym location';end if;
  if p_latitude is null or p_latitude not between -90 and 90
     or p_longitude is null or p_longitude not between -180 and 180
     or p_accuracy_m is null or p_accuracy_m<=0 or p_accuracy_m>cfg.accuracy_limit_m
  then raise exception 'Location accuracy is insufficient. Turn on precise location and try again';end if;
  if p_observed_at is null or abs(extract(epoch from (v_now-p_observed_at)))>60
  then raise exception 'Location fix expired. Try again';end if;

  v_distance:=2*6371000*asin(sqrt(least(1,
    power(sin(radians(p_latitude-cfg.latitude)/2),2)
    +cos(radians(cfg.latitude))*cos(radians(p_latitude))
    *power(sin(radians(p_longitude-cfg.longitude)/2),2)
  )));
  if v_distance>cfg.radius_m then
    raise exception 'Outside % geofence (%.0f m away). Clock in at your assigned gym',
      w.branch,v_distance;
  end if;
  if p_action='in' then
    if v_now<w.starts_at-interval '2 hours' or v_now>w.ends_at
    then raise exception 'Outside assigned shift clock-in window';end if;
    if exists(select 1 from public.coach_shifts where coach_id=c.id and clock_out_at is null)
    then raise exception 'Already clocked in. Clock out first';end if;
    insert into public.coach_shifts(coach_id,branch,clock_in_at,recorded_by,work_shift_id)
    values(c.id,w.branch,v_now,(select auth.uid()),w.id) returning * into s;
  else
    select * into s from public.coach_shifts where coach_id=c.id and work_shift_id=w.id for update;
    if not found or s.clock_out_at is not null then raise exception 'No open clock-in for this shift';end if;
    if v_now>s.clock_in_at+interval '24 hours' then raise exception 'Shift overdue. Ask Admin to correct';end if;
    update public.coach_shifts set clock_out_at=v_now where id=s.id returning * into s;
  end if;
  insert into public.coach_gps_attendance_audit(coach_id,work_shift_id,verified_by,branch,
    action,distance_m,accuracy_m,verified_at)
  values(c.id,w.id,(select auth.uid()),w.branch,p_action,v_distance,p_accuracy_m,v_now);
  return jsonb_build_object('action',p_action,'branch',w.branch,'clock_in_at',s.clock_in_at,
    'clock_out_at',s.clock_out_at,'verified',true,'method','gps',
    'distance_m',round(v_distance::numeric,0));
end;$$;
revoke all on function public.coach_gps_time_punch(uuid,text,double precision,double precision,double precision,timestamptz) from public,anon;
grant execute on function public.coach_gps_time_punch(uuid,text,double precision,double precision,double precision,timestamptz) to authenticated;
