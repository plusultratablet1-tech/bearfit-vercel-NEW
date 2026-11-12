-- Expose only the coach's own open clock-in timestamp, without changing attendance or payroll records.
-- Role/coach identity access checks remain enforced. No exact GPS coordinates returned.
CREATE OR REPLACE FUNCTION public.coach_open_gps_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
declare
 c public.coaches%rowtype;
 cfg public.coach_open_gps_week%rowtype;
 v_in timestamptz;
 v_out timestamptz;
 v_blocking_in timestamptz;
begin
 if (select auth.uid()) is null or not exists(
   select 1 from public.profiles
   where id=(select auth.uid()) and role='coach'
 ) then raise exception 'Coach required'; end if;
 select * into c from public.coaches
 where user_id=(select auth.uid()) and is_active and not is_demo;
 if not found then raise exception 'Coach not linked'; end if;
 select s.clock_in_at into v_blocking_in
 from public.coach_shifts s
 where s.coach_id=c.id and s.clock_out_at is null
 order by s.clock_in_at asc limit 1;
 select * into cfg from public.coach_open_gps_week
 where coach_id=c.id and enabled;
 if not found or (now() at time zone 'Asia/Manila')::date
   not between cfg.starts_on and cfg.ends_on
 then return jsonb_build_object('enabled',false,'blocking_clock_in_at',v_blocking_in); end if;
 select s.clock_in_at,s.clock_out_at into v_in,v_out from public.coach_shifts s
 where s.coach_id=c.id and s.work_shift_id is null
 and (s.clock_in_at at time zone 'Asia/Manila')::date=(now() at time zone 'Asia/Manila')::date
 order by s.clock_in_at desc limit 1;
 return jsonb_build_object('enabled',true,'clock_in_at',v_in,
   'clock_out_at',v_out,'blocking_clock_in_at',v_blocking_in,
   'end_date',cfg.ends_on,
   'note','Open GPS attendance — subject to Admin review; not payroll approved');
end;$function$;
