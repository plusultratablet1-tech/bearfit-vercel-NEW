-- Coach-led daily/weekly plotting reuses existing bookings and Admin confirmation.
-- Pending plans never consume package sessions or bypass existing confirmation checks.
-- No existing member, payroll, attendance, or confirmed booking records are modified.
create or replace function public.coach_plot_sessions(
  p_member_code text,
  p_session_label text,
  p_start_at timestamptz,
  p_duration_minutes integer default 60,
  p_occurrences integer default 1
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_coach public.coaches%rowtype;
  v_member public.members%rowtype;
  v_type text;
  v_start timestamptz;
  v_end timestamptz;
  v_booking_id uuid;
  v_ids jsonb := '[]'::jsonb;
  v_i integer;
begin
  if (select auth.uid()) is null or not exists(
    select 1 from public.profiles where id=(select auth.uid()) and role='coach'
  ) then raise exception 'Coach login required'; end if;
  select * into v_coach from public.coaches
    where user_id=(select auth.uid()) and is_active and not is_demo;
  if not found then raise exception 'Active coach account not linked'; end if;

  if p_member_code is null or length(btrim(p_member_code)) not between 2 and 20 then
    raise exception 'Choose an assigned client';
  end if;
  if p_start_at is null then raise exception 'Choose a valid start date and time'; end if;
  if p_duration_minutes is null or p_duration_minutes not in (30,45,60,90,120) then
    raise exception 'Choose a supported session duration';
  end if;
  if p_occurrences is null or p_occurrences not between 1 and 8 then
    raise exception 'Weekly repetition must be between 1 and 8 sessions';
  end if;
  if p_start_at <= now() + interval '5 minutes'
    or p_start_at + (p_occurrences - 1) * interval '7 days' > now() + interval '90 days' then
    raise exception 'Choose a future time at least 5 minutes away, within the next 90 days';
  end if;
  -- The current taxonomy includes Strength & Conditioning, while the older\n  -- private helper does not. Keep the workaround scoped to this new RPC.\n  v_type := case when btrim(coalesce(p_session_label,'')) = 'Strength & Conditioning'\n    then 'fitness' else private.session_label_category(p_session_label) end;

  select * into v_member from public.members
    where upper(member_code)=upper(btrim(p_member_code))
      and branch=v_coach.branch and not coalesce(is_demo,false);
  if not found then raise exception 'Client is unavailable at your branch'; end if;
  if not (
    lower(btrim(coalesce(v_member.coach_name,'')))=lower(btrim(v_coach.display_name))
    or exists (
      select 1 from public.coach_historical_session_links h
      join public.session_logs l on l.id=h.session_log_id
      where h.coach_id=v_coach.id and l.member_id=v_member.id
    )
    or exists (
      select 1 from public.bookings b
      where b.member_id=v_member.id and b.branch=v_coach.branch
        and b.assigned_coach_user_id=v_coach.user_id
        and b.start_at>now()-interval '45 days'
    )
  ) then raise exception 'This client is not assigned to your coach account'; end if;

  -- Serialize concurrent plotting requests for this coach and member.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'bearfit-coach-plot-coach:' || v_coach.user_id::text,0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'bearfit-coach-plot-member:' || v_member.id::text,0));

  for v_i in 0..p_occurrences-1 loop
    v_start := p_start_at + v_i * interval '7 days';
    v_end := v_start + pg_catalog.make_interval(mins=>p_duration_minutes);
    if exists (
      select 1 from public.bookings b
      where b.status in ('pending','confirmed')
        and (b.member_id=v_member.id or b.assigned_coach_user_id=v_coach.user_id
             or b.requested_coach_user_id=v_coach.user_id)
        and b.branch=v_coach.branch
        and pg_catalog.tstzrange(
          coalesce(b.start_at,b.requested_start_at),
          coalesce(b.end_at,coalesce(b.start_at,b.requested_start_at)
              + pg_catalog.make_interval(mins=>b.requested_duration_minutes)), '[)'
          ) && pg_catalog.tstzrange(v_start,v_end,'[)')
    ) then
      raise exception 'Overlapping coach or client booking on %',
        pg_catalog.to_char(v_start at time zone 'Asia/Manila','YYYY-MM-DD HH24:MI');
    end if;

    insert into public.bookings(
      member_id,request_kind,status,requested_coach_user_id,assigned_coach_user_id,
      branch,session_type,session_label,requested_start_at,requested_duration_minutes,
      start_at,end_at,created_by
    ) values (
      v_member.id,'custom','pending',v_coach.user_id,v_coach.user_id,
      v_coach.branch,v_type,btrim(p_session_label),v_start,p_duration_minutes,
      v_start,v_end,(select auth.uid())
    ) returning id into v_booking_id;
    v_ids := v_ids || pg_catalog.to_jsonb(v_booking_id);
  end loop;

  return jsonb_build_object('booking_ids',v_ids,'count',p_occurrences,
    'status','pending','message','Sessions plotted for Admin confirmation. No sessions deducted.');
end; $$;

revoke all on function public.coach_plot_sessions(text,text,timestamptz,integer,integer)
  from public,anon;
grant execute on function public.coach_plot_sessions(text,text,timestamptz,integer,integer)
  to authenticated;
