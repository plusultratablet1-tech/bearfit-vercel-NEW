-- BearFit fair no-show and cancellation policy (prospective rollout).
-- Cancellation deadline: 10:00 PM Asia/Manila on the calendar day before the session.
-- No existing bookings, payments, sessions, payroll records or member balances are modified by migration.
create table if not exists public.booking_policy_acceptances (
  booking_id uuid primary key references public.bookings(id) on delete restrict,
  member_id uuid not null references public.members(id) on delete restrict,
  accepted_by uuid not null references auth.users(id),
  accepted_at timestamptz not null default now(),
  cutoff_at timestamptz not null,
  policy_version text not null default 'no-show-v1-2026-11-14'
);
create index if not exists booking_policy_by_member on public.booking_policy_acceptances(member_id,accepted_at desc);
alter table public.booking_policy_acceptances enable row level security;
revoke all on public.booking_policy_acceptances from anon,authenticated;
grant select on public.booking_policy_acceptances to authenticated;
create policy "Member reads own booking term acceptances" on public.booking_policy_acceptances
 for select to authenticated using (exists(select 1 from public.members m where m.id=member_id and m.user_id=(select auth.uid())));
create policy "Admin reads term acceptance evidence" on public.booking_policy_acceptances
 for select to authenticated using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));

create table if not exists public.booking_no_show_cases (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete restrict,
  member_id uuid not null references public.members(id) on delete restrict,
  coach_user_id uuid references auth.users(id),
  report_kind text not null check (report_kind in ('coach_report','staff_report','member_late_cancel')),
  report_notes text not null check(length(btrim(report_notes)) between 8 and 1200),
  reported_by uuid not null references auth.users(id),
  reported_at timestamptz not null default now(),
  status text not null default 'pending_review'
    check (status in ('pending_review','charged','waived','dismissed','disputed','reversed','upheld')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  decision_note text,
  charged_session_log_id uuid unique references public.session_logs(id),
  member_first_seen_at timestamptz,
  member_acknowledged_at timestamptz,
  dispute_at timestamptz,
  dispute_reason text,
  dispute_resolved_at timestamptz,
  dispute_resolved_by uuid references auth.users(id),
  dispute_resolution_note text
);
create index if not exists booking_no_show_member_history on public.booking_no_show_cases(member_id,reported_at desc);
create index if not exists booking_no_show_review_queue on public.booking_no_show_cases(status,reported_at desc);
create index if not exists booking_no_show_coach_reports on public.booking_no_show_cases(coach_user_id,reported_at desc);
alter table public.booking_no_show_cases enable row level security;
revoke all on public.booking_no_show_cases from anon,authenticated;
grant select on public.booking_no_show_cases to authenticated;
create policy "Member reads only own no show cases" on public.booking_no_show_cases
 for select to authenticated using (exists(select 1 from public.members m where m.id=member_id and m.user_id=(select auth.uid())));
-- Coach can submit factual absence reports through a restricted RPC,
-- but member dispute texts are private to the member and Admin.
create policy "Admin reads no show review cases" on public.booking_no_show_cases
 for select to authenticated using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));

create table if not exists public.booking_no_show_restorations (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null unique references public.booking_no_show_cases(id) on delete restrict,
  original_session_log_id uuid not null references public.session_logs(id) on delete restrict,
  member_package_id uuid not null references public.member_package_cycles(id),
  performed_by uuid not null references auth.users(id),
  restored_at timestamptz not null default now(),
  reason text not null check(length(btrim(reason))>=10),
  sessions_left_before integer not null,
  sessions_left_after integer not null
);
alter table public.booking_no_show_restorations enable row level security;
revoke all on public.booking_no_show_restorations from anon,authenticated;
grant select on public.booking_no_show_restorations to authenticated;
create policy "Members see own restored session audit" on public.booking_no_show_restorations
 for select to authenticated using(exists (
   select 1 from public.booking_no_show_cases c join public.members m on m.id=c.member_id
   where c.id=case_id and m.user_id=(select auth.uid())));
create policy "Admin sees restored session audit" on public.booking_no_show_restorations
 for select to authenticated using(exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));

create or replace function public.member_accept_booking_no_show_terms(p_booking_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare v_uid uuid:=(select auth.uid()); v_b public.bookings%rowtype; v_cutoff timestamptz;
begin
 if v_uid is null then raise exception 'Member login required'; end if;
 select b.* into v_b from public.bookings b join public.members m on m.id=b.member_id
   where b.id=p_booking_id and m.user_id=v_uid for update of b;
 if not found then raise exception 'Booking not found in your account'; end if;
 if v_b.status not in ('pending','confirmed') then raise exception 'Only pending or confirmed bookings are eligible'; end if;
 if coalesce(v_b.start_at,v_b.requested_start_at)<=now() then raise exception 'Session already started'; end if;
 v_cutoff:=(((coalesce(v_b.start_at,v_b.requested_start_at) at time zone 'Asia/Manila')::date::timestamp - interval '2 hours') at time zone 'Asia/Manila');
 insert into public.booking_policy_acceptances(booking_id,member_id,accepted_by,accepted_at,cutoff_at)
 values(v_b.id,v_b.member_id,v_uid,now(),v_cutoff)
 on conflict(booking_id) do update
 set accepted_at=now(),accepted_by=v_uid,cutoff_at=excluded.cutoff_at,policy_version=excluded.policy_version;
 return jsonb_build_object('accepted',true,'cutoff_at',v_cutoff,'policy_version','no-show-v1-2026-11-14');
end $fn$;

-- This replaces only the member cancellation cutoff. No new no-show deductions happen here.
create or replace function public.member_cancel_booking(p_booking_id uuid,p_reason text default null)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare v_member uuid;v_booking public.bookings%rowtype;v_start timestamptz;v_cutoff timestamptz;
begin
 if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
 select id into v_member from public.members where user_id=(select auth.uid());
 select * into v_booking from public.bookings where id=p_booking_id and member_id=v_member for update;
 if not found then raise exception 'Booking not found'; end if;
 if v_booking.status not in ('pending','confirmed') then raise exception 'Booking cannot be cancelled'; end if;
 v_start:=coalesce(v_booking.start_at,v_booking.requested_start_at);
 if v_booking.status='confirmed' then
   if exists(select 1 from public.booking_policy_acceptances t where t.booking_id=v_booking.id) then
     v_cutoff:=(((v_start at time zone 'Asia/Manila')::date::timestamp - interval '2 hours') at time zone 'Asia/Manila');
   else
     -- Legacy bookings never opted into stricter terms: retain their original 4h cutoff.
     v_cutoff:=v_start-interval '4 hours';
   end if;
   if now()>v_cutoff then return jsonb_build_object('booking_id',v_booking.id,'status',v_booking.status,
     'staff_contact_required',true,'late_cancellation',true,'cutoff_at',v_cutoff); end if;
 end if;
 update public.bookings set status='cancelled',cancelled_at=now(),
  cancel_reason=nullif(trim(coalesce(p_reason,'')),'') where id=v_booking.id;
 return jsonb_build_object('booking_id',v_booking.id,'status','cancelled',
   'staff_contact_required',false,'cutoff_at',v_cutoff);
end $fn$;

-- A member can report a late cancellation, but can never charge themself or alter session balances.
create or replace function public.member_report_late_cancellation(p_booking_id uuid,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $fn$
declare v_uid uuid:=(select auth.uid());v_b public.bookings%rowtype;v_case uuid;v_cutoff timestamptz;
begin
 if v_uid is null then raise exception 'Member login required'; end if;
 if length(btrim(coalesce(p_reason,''))) not between 8 and 1200
    then raise exception 'Provide a reason (8-1200 characters)'; end if;
 select b.* into v_b from public.bookings b join public.members m on m.id=b.member_id
  where b.id=p_booking_id and m.user_id=v_uid for update of b;
 if not found or v_b.status<>'confirmed' then raise exception 'Only your confirmed bookings can be reported late'; end if;
 v_cutoff:=(((coalesce(v_b.start_at,v_b.requested_start_at) at time zone 'Asia/Manila')::date::timestamp - interval '2 hours') at time zone 'Asia/Manila');
 if now()<=v_cutoff then raise exception 'Free cancellation is still available'; end if;
 if exists(select 1 from public.session_logs where booking_id=v_b.id) then raise exception 'Session already processed'; end if;
 insert into public.booking_no_show_cases(booking_id,member_id,coach_user_id,report_kind,report_notes,reported_by)
 values(v_b.id,v_b.member_id,v_b.assigned_coach_user_id,'member_late_cancel',btrim(p_reason),v_uid)
 on conflict(booking_id) do nothing returning id into v_case;
 if v_case is null then select id into v_case from public.booking_no_show_cases where booking_id=v_b.id; end if;
 return v_case;
end $fn$;

-- Coach may REPORT absence after the scheduled END only; staff/Admin may also file evidence.
create or replace function public.staff_report_no_show(p_booking_id uuid,p_notes text)
returns uuid language plpgsql security definer set search_path='' as $fn$
declare v_uid uuid:=(select auth.uid());v_b public.bookings%rowtype;v_role text;v_case uuid;v_kind text;
begin
 if v_uid is null then raise exception 'Authentication required'; end if;
 select role into v_role from public.profiles where id=v_uid;
 if length(btrim(coalesce(p_notes,''))) not between 8 and 1200 then raise exception 'Evidence note must be 8-1200 characters'; end if;
 select * into v_b from public.bookings where id=p_booking_id for update;
 if not found or v_b.status<>'confirmed' then raise exception 'Only confirmed bookings can be reported'; end if;
 if v_b.end_at is null or v_b.end_at>now() then raise exception 'Report only after scheduled session ends'; end if;
 if v_role='coach' then
   if v_b.assigned_coach_user_id is distinct from v_uid or not exists
    (select 1 from public.coaches c where c.user_id=v_uid and c.is_active and not coalesce(c.is_demo,false))
   then raise exception 'Only the assigned active coach can report absence'; end if;
 elsif v_role not in ('staff','admin') then
   raise exception 'Coach or staff role required';
 end if;
 if exists(select 1 from public.session_logs where booking_id=v_b.id) then raise exception 'Attendance already recorded'; end if;
 v_kind:=case when v_role='coach' then 'coach_report' else 'staff_report' end;
 insert into public.booking_no_show_cases(booking_id,member_id,coach_user_id,report_kind,report_notes,reported_by)
 values(v_b.id,v_b.member_id,v_b.assigned_coach_user_id,v_kind,btrim(p_notes),v_uid)
 on conflict(booking_id) do nothing returning id into v_case;
 if v_case is null then select id into v_case from public.booking_no_show_cases where booking_id=v_b.id; end if;
 return v_case;
end $fn$;

-- Retire the old direct debit RPC. Older UI or scripts cannot bypass Admin case review.
create or replace function public.staff_mark_no_show(p_booking_id uuid,p_charge_session boolean,p_notes text default null)
returns jsonb language plpgsql security definer set search_path='' as $fn$
begin
 raise exception 'Direct no-show deduction is disabled. Create a report and use BearFit Admin review.';
end $fn$;

create or replace function public.admin_decide_no_show_case(p_case_id uuid,p_outcome text,p_note text)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare v_uid uuid:=(select auth.uid());v_c public.booking_no_show_cases%rowtype;
 v_b public.bookings%rowtype;v_terms public.booking_policy_acceptances%rowtype;
 v_cutoff timestamptz;v_charged jsonb;v_log_id uuid;
begin
 if v_uid is null or not exists(select 1 from public.profiles where id=v_uid and role='admin')
   then raise exception 'Admin approval required'; end if;
 if p_outcome not in ('charge','waive','dismiss')
   or length(btrim(coalesce(p_note,''))) not between 10 and 1200
   then raise exception 'Choose charge, waive or dismiss with a detailed decision (10+ characters)'; end if;
 select * into v_c from public.booking_no_show_cases where id=p_case_id for update;
 if not found or v_c.status<>'pending_review' then raise exception 'Case already decided or missing'; end if;
 select * into v_b from public.bookings where id=v_c.booking_id for update;
 if v_b.status<>'confirmed' or v_b.member_id<>v_c.member_id
   then raise exception 'Booking is no longer a confirmed, matching booking'; end if;
 if exists(select 1 from public.session_logs where booking_id=v_b.id)
   then raise exception 'Attendance or previous consumption already exists'; end if;
 if p_outcome='charge' then
   if v_b.end_at is null or now()<v_b.end_at
     then raise exception 'Cannot charge before the scheduled session ends'; end if;
   select * into v_terms from public.booking_policy_acceptances where booking_id=v_b.id;
   if not found or v_terms.member_id<>v_b.member_id
     then raise exception 'No recorded client acceptance of this booking penalty policy; cannot deduct'; end if;
   v_cutoff:=(((v_b.start_at at time zone 'Asia/Manila')::date::timestamp - interval '2 hours') at time zone 'Asia/Manila');
   if v_terms.cutoff_at is distinct from v_cutoff
     then raise exception 'Booking time changed after acceptance; obtain fresh client confirmation'; end if;
   -- If booked/confirmed after the cutoff, client must re-accept after the final confirmation.
   if v_b.updated_at>v_cutoff and v_terms.accepted_at<v_b.updated_at
     then raise exception 'Late-confirmed booking requires acceptance after final confirmation'; end if;
   -- Some legitimate QR/check-in sessions have no booking ID. Block charges if
   -- any overlapping member attendance log could correspond to this slot.
   if exists(select 1 from public.session_logs s
     where s.member_id=v_b.member_id and s.trained_at between
       v_b.start_at-interval '30 minutes' and v_b.end_at+interval '30 minutes')
   then raise exception 'Possible member attendance exists during this slot; investigate instead of charging'; end if;
   if v_b.member_package_id is null then raise exception 'No linked package cycle'; end if;
   v_charged:=private.consume_package_session(v_b.member_package_id,v_b.member_id,v_uid,v_b.id,
     'Admin-verified no-show case '||v_c.id::text||': '||left(btrim(p_note),500));
   if coalesce((v_charged->>'already_consumed')::boolean,false)
     then raise exception 'Booking already consumed; case cannot charge again'; end if;
   v_log_id:=(v_charged->>'session_log_id')::uuid;
   update public.bookings set status='no_show',no_show_charged=true where id=v_b.id;
   update public.booking_no_show_cases set status='charged',reviewed_by=v_uid,reviewed_at=now(),
      decision_note=btrim(p_note),charged_session_log_id=v_log_id where id=v_c.id;
 elsif p_outcome='waive' then
   if v_c.report_kind='member_late_cancel' then
     update public.bookings set status='cancelled',cancelled_at=now(),
       cancel_reason='Admin waived late cancellation case '||v_c.id::text where id=v_b.id;
   else
     if v_b.end_at>now() then raise exception 'Wait until session ends before classifying nonattendance'; end if;
     update public.bookings set status='no_show',no_show_charged=false where id=v_b.id;
   end if;
   update public.booking_no_show_cases set status='waived',reviewed_by=v_uid,reviewed_at=now(),
      decision_note=btrim(p_note) where id=v_c.id;
 else
   update public.booking_no_show_cases set status='dismissed',reviewed_by=v_uid,reviewed_at=now(),
      decision_note=btrim(p_note) where id=v_c.id;
 end if;
 return jsonb_build_object('case_id',v_c.id,'status',case when p_outcome='charge' then 'charged'
      when p_outcome='waive' then 'waived' else 'dismissed' end,
    'session_log_id',v_log_id);
end $fn$;

-- Mark a notice as seen when the member opens their notices. No email/SMS delivery is claimed.
create or replace function public.member_open_no_show_notices()
returns integer language plpgsql security definer set search_path='' as $fn$
declare v_member uuid;v_count integer;
begin
 select id into v_member from public.members where user_id=(select auth.uid());
 if v_member is null then raise exception 'Member login required'; end if;
 update public.booking_no_show_cases set member_first_seen_at=now()
   where member_id=v_member and status in ('charged','disputed','reversed','upheld')
     and member_first_seen_at is null;
 get diagnostics v_count=row_count;
 return v_count;
end $fn$;

create or replace function public.member_respond_no_show_case(p_case_id uuid,p_action text,p_reason text default null)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare v_member uuid;v_c public.booking_no_show_cases%rowtype;v_first timestamptz;
begin
 select id into v_member from public.members where user_id=(select auth.uid());
 if v_member is null then raise exception 'Member login required'; end if;
 if p_action not in ('acknowledge','dispute') then raise exception 'Invalid response'; end if;
 select * into v_c from public.booking_no_show_cases where id=p_case_id and member_id=v_member for update;
 if not found or v_c.status not in ('charged','disputed','reversed','upheld') then raise exception 'Case is not a charge notice'; end if;
 v_first:=coalesce(v_c.member_first_seen_at,now());
 if p_action='acknowledge' then
   update public.booking_no_show_cases set member_first_seen_at=v_first,
      member_acknowledged_at=coalesce(member_acknowledged_at,now()) where id=v_c.id;
 else
   if v_c.status<>'charged' then raise exception 'Case is already disputed or resolved'; end if;
   if length(btrim(coalesce(p_reason,'')))<10 then raise exception 'Explain your dispute in at least ten characters'; end if;
   if now()>v_first+interval '48 hours'
      then raise exception 'The 48-hour response window ended. Contact BearFit Admin for a manual review'; end if;
   update public.booking_no_show_cases set member_first_seen_at=v_first,
      status='disputed',dispute_at=now(),dispute_reason=left(btrim(p_reason),1200) where id=v_c.id;
 end if;
 return jsonb_build_object('case_id',v_c.id,'response',p_action);
end $fn$;

create or replace function public.admin_resolve_no_show_dispute(p_case_id uuid,p_restore boolean,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare v_uid uuid:=(select auth.uid());v_c public.booking_no_show_cases%rowtype;
 v_b public.bookings%rowtype;v_cycle public.member_package_cycles%rowtype;
 v_log public.session_logs%rowtype;v_before integer;v_definition public.package_definitions%rowtype;
begin
 if v_uid is null or not exists(select 1 from public.profiles where id=v_uid and role='admin')
   then raise exception 'Admin review required'; end if;
 if p_restore is null or length(btrim(coalesce(p_reason,'')))<10
   then raise exception 'A decision and a detailed review note are required'; end if;
 select * into v_c from public.booking_no_show_cases where id=p_case_id for update;
 if not found or v_c.status<>'disputed' then raise exception 'Only open disputes can be resolved'; end if;
 select * into v_b from public.bookings where id=v_c.booking_id for update;
 if not p_restore then
   update public.booking_no_show_cases set status='upheld',dispute_resolved_at=now(),
     dispute_resolved_by=v_uid,dispute_resolution_note=btrim(p_reason) where id=v_c.id;
   return jsonb_build_object('case_id',v_c.id,'status','upheld');
 end if;
 if v_b.status<>'no_show' or not coalesce(v_b.no_show_charged,false)
    or v_b.member_package_id is null or v_c.charged_session_log_id is null
    then raise exception 'No charged session is eligible for restoration'; end if;
 select * into v_log from public.session_logs where id=v_c.charged_session_log_id
   and booking_id=v_b.id and member_id=v_c.member_id for update;
 if not found then raise exception 'Original charged log cannot be verified'; end if;
 select * into v_cycle from public.member_package_cycles
   where id=v_b.member_package_id and member_id=v_b.member_id for update;
 if not found or v_cycle.status not in ('active','depleted','expired')
    or v_cycle.sessions_used<=0 or v_cycle.sessions_left>=v_cycle.sessions_total
    then raise exception 'Session credit cannot be restored safely; requires accounting review'; end if;
 v_before:=v_cycle.sessions_left;
 update public.member_package_cycles set sessions_left=sessions_left+1,sessions_used=sessions_used-1,
    status=case when status='depleted' then 'active' else status end,updated_at=now() where id=v_cycle.id;
 select * into v_definition from public.package_definitions where id=v_cycle.package_id;
 if v_definition.service_category='fitness' then perform private.sync_member_primary_balance(v_cycle.member_id); end if;
 insert into public.booking_no_show_restorations(case_id,original_session_log_id,member_package_id,
   performed_by,reason,sessions_left_before,sessions_left_after)
 values(v_c.id,v_log.id,v_cycle.id,v_uid,btrim(p_reason),v_before,v_before+1);
 update public.bookings set no_show_charged=false where id=v_b.id;
 update public.booking_no_show_cases set status='reversed',dispute_resolved_at=now(),
   dispute_resolved_by=v_uid,dispute_resolution_note=btrim(p_reason) where id=v_c.id;
 return jsonb_build_object('case_id',v_c.id,'status','reversed','sessions_restored',1);
end $fn$;

-- Expose only authenticated, independently authorization-checked functions.
revoke all on function public.member_accept_booking_no_show_terms(uuid) from public,anon;
revoke all on function public.member_report_late_cancellation(uuid,text) from public,anon;
revoke all on function public.staff_report_no_show(uuid,text) from public,anon;
revoke all on function public.admin_decide_no_show_case(uuid,text,text) from public,anon;
revoke all on function public.member_open_no_show_notices() from public,anon;
revoke all on function public.member_respond_no_show_case(uuid,text,text) from public,anon;
revoke all on function public.admin_resolve_no_show_dispute(uuid,boolean,text) from public,anon;
revoke all on function public.staff_mark_no_show(uuid,boolean,text) from public,anon;
grant execute on function public.member_accept_booking_no_show_terms(uuid) to authenticated;
grant execute on function public.member_report_late_cancellation(uuid,text) to authenticated;
grant execute on function public.staff_report_no_show(uuid,text) to authenticated;
grant execute on function public.admin_decide_no_show_case(uuid,text,text) to authenticated;
grant execute on function public.member_open_no_show_notices() to authenticated;
grant execute on function public.member_respond_no_show_case(uuid,text,text) to authenticated;
grant execute on function public.admin_resolve_no_show_dispute(uuid,boolean,text) to authenticated;
grant execute on function public.staff_mark_no_show(uuid,boolean,text) to authenticated;
