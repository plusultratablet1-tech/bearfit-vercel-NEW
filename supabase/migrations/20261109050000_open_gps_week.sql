-- Temporary open attendance 9–15 Nov 2026 (Philippine time).
-- No work shift is manufactured. Real GPS punch records are flagged as
-- open-week test attendance for Admin review, not payroll-approved hours.
alter table public.coach_gps_attendance_audit alter column work_shift_id drop not null;
create table if not exists public.coach_open_gps_week (
  coach_id uuid primary key references public.coaches(id),
  starts_on date not null,
  ends_on date not null,
  enabled boolean not null default true,
  constraint open_week_dates check (ends_on>=starts_on)
);
alter table public.coach_open_gps_week enable row level security;
revoke all on public.coach_open_gps_week from public,anon,authenticated;
insert into public.coach_open_gps_week(coach_id,starts_on,ends_on)
select id,date '2026-11-09',date '2026-11-15'
from public.coaches where username in ('coach1','coach4','coach5') and is_active and not is_demo
on conflict(coach_id) do update set starts_on=excluded.starts_on,ends_on=excluded.ends_on,enabled=true;

create or replace function public.coach_open_gps_status()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare c public.coaches%rowtype;cfg public.coach_open_gps_week%rowtype;v_in timestamptz;v_out timestamptz;
begin
 if (select auth.uid()) is null or not exists(select 1 from public.profiles where id=(select auth.uid()) and role='coach')
 then raise exception 'Coach required';end if;
 select * into c from public.coaches where user_id=(select auth.uid()) and is_active and not is_demo;
 if not found then raise exception 'Coach not linked';end if;
 select * into cfg from public.coach_open_gps_week where coach_id=c.id and enabled;
 if not found or (now() at time zone 'Asia/Manila')::date not between cfg.starts_on and cfg.ends_on
 then return jsonb_build_object('enabled',false);end if;
 select s.clock_in_at,s.clock_out_at into v_in,v_out from public.coach_shifts s
 where s.coach_id=c.id and s.work_shift_id is null
 and (s.clock_in_at at time zone 'Asia/Manila')::date=(now() at time zone 'Asia/Manila')::date
 order by s.clock_in_at desc limit 1;
 return jsonb_build_object('enabled',true,'clock_in_at',v_in,'clock_out_at',v_out,
    'end_date',cfg.ends_on,'note','Open GPS attendance — subject to Admin review; not payroll approved');
end;$$;
revoke all on function public.coach_open_gps_status() from public,anon;
grant execute on function public.coach_open_gps_status() to authenticated;

create or replace function public.coach_open_gps_punch(
 p_action text,p_latitude double precision,p_longitude double precision,
 p_accuracy_m double precision,p_observed_at timestamptz)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare c public.coaches%rowtype;cfg public.coach_branch_gps_settings%rowtype;
 wk public.coach_open_gps_week%rowtype;s public.coach_shifts%rowtype;
 v_now timestamptz:=now();v_day date;v_distance double precision;
begin
 if (select auth.uid()) is null or not exists(select 1 from public.profiles where id=(select auth.uid()) and role='coach')
 then raise exception 'Coach required';end if;
 select * into c from public.coaches where user_id=(select auth.uid()) and is_active and not is_demo for update;
 if not found then raise exception 'Coach not linked';end if;
 if p_action not in ('in','out') or p_action is null then raise exception 'Invalid action';end if;
 v_day:=(v_now at time zone 'Asia/Manila')::date;
 select * into wk from public.coach_open_gps_week where coach_id=c.id and enabled
 and v_day between starts_on and ends_on;
 if not found then raise exception 'Open attendance window has ended';end if;
 select * into cfg from public.coach_branch_gps_settings where branch=c.branch and enabled;
 if not found then raise exception 'GPS not enabled for branch';end if;
 if p_latitude is null or p_latitude not between -90 and 90
 or p_longitude is null or p_longitude not between -180 and 180
 or p_accuracy_m is null or p_accuracy_m<=0 or p_accuracy_m>cfg.accuracy_limit_m
 then raise exception 'Location accuracy insufficient';end if;
 if p_observed_at is null or abs(extract(epoch from (v_now-p_observed_at)))>60
 then raise exception 'Location fix expired';end if;
 v_distance:=2*6371000*asin(sqrt(least(1,
 power(sin(radians(p_latitude-cfg.latitude)/2),2)+
 cos(radians(cfg.latitude))*cos(radians(p_latitude))*
 power(sin(radians(p_longitude-cfg.longitude)/2),2))));
 if v_distance>cfg.radius_m then raise exception 'Outside branch GPS boundary (% metres)',round(v_distance::numeric);end if;
 if p_action='in' then
   if exists(select 1 from public.coach_shifts where coach_id=c.id and clock_out_at is null)
   then raise exception 'Already clocked in; clock out first';end if;
   if exists(select 1 from public.coach_shifts where coach_id=c.id and work_shift_id is null
    and (clock_in_at at time zone 'Asia/Manila')::date=v_day)
   then raise exception 'Already recorded open-week attendance today';end if;
   insert into public.coach_shifts(coach_id,branch,clock_in_at,recorded_by,work_shift_id,
      correction_reason)
   values(c.id,c.branch,v_now,(select auth.uid()),null,
      'Open GPS week Nov 9–15 2026; Admin review required, not payroll approved')
   returning * into s;
 else
   select * into s from public.coach_shifts where coach_id=c.id and work_shift_id is null
   and clock_out_at is null and (clock_in_at at time zone 'Asia/Manila')::date=v_day for update;
   if not found then raise exception 'No open-week clock-in to close today';end if;
   if v_now>s.clock_in_at+interval '24 hours' then raise exception 'Overdue clock-out requires Admin';end if;
   update public.coach_shifts set clock_out_at=v_now where id=s.id returning * into s;
 end if;
 insert into public.coach_gps_attendance_audit(coach_id,work_shift_id,verified_by,branch,
 action,distance_m,accuracy_m,verified_at)
 values(c.id,null,(select auth.uid()),c.branch,p_action,v_distance,p_accuracy_m,v_now);
 return jsonb_build_object('clock_in_at',s.clock_in_at,'clock_out_at',s.clock_out_at,
  'method','gps_open_week','requires_admin_review',true,'verified',true);
end;$$;
revoke all on function public.coach_open_gps_punch(text,double precision,double precision,double precision,timestamptz) from public,anon;
grant execute on function public.coach_open_gps_punch(text,double precision,double precision,double precision,timestamptz) to authenticated;
