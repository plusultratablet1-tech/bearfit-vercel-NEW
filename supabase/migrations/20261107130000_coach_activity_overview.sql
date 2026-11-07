-- Coach read-only activity and payment-attention summary.
-- This does not change any member balance, booking, payment, or payroll record.
create or replace function public.coach_activity_overview()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare
  v_coach public.coaches%rowtype;
  v_sessions jsonb := '[]'::jsonb;
  v_payments jsonb := '[]'::jsonb;
  v_attention jsonb := '[]'::jsonb;
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.profiles
    where id=(select auth.uid()) and role='coach'
  ) then raise exception 'Active coach login required'; end if;
  select * into v_coach from public.coaches
    where user_id=(select auth.uid()) and is_active and not is_demo;
  if not found then raise exception 'Active coach account not linked'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',x.id,'member_name',x.member_name,'member_code',x.member_code,
    'trained_at',x.trained_at,'session_label',x.session_label,
    'sessions_left_after',x.sessions_left_after,'source',x.source
  ) order by x.trained_at desc),'[]'::jsonb) into v_sessions
  from (
    select sl.id, m.full_name member_name,m.member_code,sl.trained_at,
      sl.session_label,sl.sessions_left_after,l.source
    from public.coach_historical_session_links l
    join public.session_logs sl on sl.id=l.session_log_id
    join public.members m on m.id=sl.member_id
    where l.coach_id=v_coach.id and m.branch=v_coach.branch
      and not coalesce(m.is_demo,false)
      and sl.trained_at>=now()-interval '120 days'
    order by sl.trained_at desc,sl.id desc limit 30
  ) x;

  -- A coach may see a limited payment summary ONLY for their own clients;
  -- never expose private proof, contact details, method or payment credentials.
  with linked_clients as (
    select distinct m.id,m.full_name,m.member_code,m.payment_status
    from public.members m
    where m.branch=v_coach.branch and not coalesce(m.is_demo,false)
      and (
        exists(select 1 from public.coach_historical_session_links l
          join public.session_logs sl on sl.id=l.session_log_id
          where l.coach_id=v_coach.id and sl.member_id=m.id)
        or exists(select 1 from public.bookings b
          where b.member_id=m.id and b.assigned_coach_user_id=v_coach.user_id
            and b.branch=v_coach.branch
            and b.start_at between now()-interval '60 days' and now()+interval '40 days')
      )
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',x.id,'member_name',x.full_name,'member_code',x.member_code,
    'amount',x.amount,'package_name',x.package_name,'paid_at',x.paid_at
  ) order by x.paid_at desc),'[]'::jsonb) into v_payments
  from (
    select p.id,lc.full_name,lc.member_code,p.amount,
      coalesce(p.package_name,'Membership payment') as package_name,
      coalesce(p.paid_at,p.payment_date,p.created_at) paid_at
    from linked_clients lc join public.payments p on p.member_id=lc.id
    where lower(p.status)='paid'
      and coalesce(p.paid_at,p.payment_date,p.created_at)>=now()-interval '180 days'
    order by paid_at desc limit 20
  ) x;

  with linked_clients as (
    select distinct m.id,m.full_name,m.member_code,m.payment_status
    from public.members m
    where m.branch=v_coach.branch and not coalesce(m.is_demo,false)
      and (
        exists(select 1 from public.coach_historical_session_links l
          join public.session_logs sl on sl.id=l.session_log_id
          where l.coach_id=v_coach.id and sl.member_id=m.id)
        or exists(select 1 from public.bookings b
          where b.member_id=m.id and b.assigned_coach_user_id=v_coach.user_id
            and b.branch=v_coach.branch
            and b.start_at between now()-interval '60 days' and now()+interval '40 days')
      )
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'member_name',a.full_name,'member_code',a.member_code,
    'reason',a.reason,'payment_status',a.payment_status
  ) order by a.full_name),'[]'::jsonb) into v_attention
  from (
    select lc.full_name,lc.member_code,coalesce(lc.payment_status,'not recorded') payment_status,
      case when exists (
        select 1 from public.member_package_cycles cyc
        join public.member_package_stage_payments st on st.member_package_id=cyc.id
        where cyc.member_id=lc.id and cyc.status='active'
          and lower(st.status) not in ('paid','waived')
      ) then 'Package installment requires Admin review'
      when not exists (
        select 1 from public.payments p
        where p.member_id=lc.id and lower(p.status)='paid'
      ) then 'No verified payment record — confirm with Admin'
      else 'Payment status needs Admin review'
      end as reason
    from linked_clients lc
    where coalesce(lower(lc.payment_status),'not recorded') not in ('paid','verified')
      or exists (
        select 1 from public.member_package_cycles cyc
        join public.member_package_stage_payments st on st.member_package_id=cyc.id
        where cyc.member_id=lc.id and cyc.status='active'
          and lower(st.status) not in ('paid','waived')
      )
    order by lc.full_name limit 20
  ) a;

  return jsonb_build_object('sessions',v_sessions,'payments',v_payments,'payment_attention',v_attention);
end;
$$;
revoke all on function public.coach_activity_overview() from public,anon;
grant execute on function public.coach_activity_overview() to authenticated;
