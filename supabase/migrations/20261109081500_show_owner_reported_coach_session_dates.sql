-- Include separate owner-reported dates in coach display without altering verified logs.\nCREATE OR REPLACE FUNCTION public.coach_client_cards()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_coach public.coaches%rowtype; v_cards jsonb;
begin
 if (select auth.uid()) is null or not exists (
   select 1 from public.profiles
   where id=(select auth.uid()) and role='coach'
 ) then raise exception 'Coach login required';end if;
 select * into v_coach from public.coaches
 where user_id=(select auth.uid()) and is_active and not is_demo;
 if not found then raise exception 'Active coach not linked';end if;

 select coalesce(jsonb_agg(jsonb_build_object(
   'member_name',q.full_name,'member_code',q.member_code,
   'package_name',q.package_name,'membership_status',q.membership_status,
   'total_sessions',q.total_sessions,'sessions_used',q.sessions_used,
   'sessions_left',q.sessions_left,'last_sessions',q.last_sessions,
   'balance_verified',q.has_package_cycle,
   'assignment_source',q.assignment_source
 ) order by q.full_name,q.member_code),'[]'::jsonb) into v_cards
 from (
   select m.id,m.full_name,m.member_code,m.package_name,m.membership_status,
     coalesce(m.total_sessions,0) as total_sessions,
     coalesce(m.sessions_used,0) as sessions_used,
     coalesce(m.sessions_left,0) as sessions_left,
     exists(select 1 from public.member_package_cycles cyc
        where cyc.member_id=m.id and cyc.status='active') as has_package_cycle,
     case
       when lower(btrim(coalesce(m.coach_name,'')))=lower(btrim(v_coach.display_name))
         then 'member_coach_assignment'
       when exists(
         select 1 from public.coach_historical_session_links l
         join public.session_logs sl on sl.id=l.session_log_id
         where l.coach_id=v_coach.id and sl.member_id=m.id)
         then 'coach_session_link'
       else 'assigned_booking'
     end as assignment_source,
     (select coalesce(jsonb_agg(h.session_date order by h.session_date desc),'[]'::jsonb)
      from (
        select dates.session_date from (
          select (sl.trained_at at time zone 'Asia/Manila')::date as session_date
          from public.coach_historical_session_links l
          join public.session_logs sl on sl.id=l.session_log_id
          where l.coach_id=v_coach.id and sl.member_id=m.id
          union
          select h.session_date from public.coach_owner_reported_session_dates h
          where h.coach_id=v_coach.id and h.member_id=m.id
        ) dates order by dates.session_date desc limit 6
      ) h) as last_sessions
   from public.members m
   where m.branch=v_coach.branch and not coalesce(m.is_demo,false)
     and (
       lower(btrim(coalesce(m.coach_name,'')))=lower(btrim(v_coach.display_name))
       or exists(
         select 1 from public.coach_historical_session_links l
         join public.session_logs sl on sl.id=l.session_log_id
         where l.coach_id=v_coach.id and sl.member_id=m.id)
       or exists(
         select 1 from public.bookings b
         where b.member_id=m.id and b.branch=v_coach.branch
           and b.assigned_coach_user_id=v_coach.user_id
           and b.start_at>now()-interval '45 days')
     )
   order by m.full_name,m.member_code
   limit 100
 ) q;
 return v_cards;
end;$function$
;\n