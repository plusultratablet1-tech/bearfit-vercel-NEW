-- Production session labels through scheduling while preserving package service categories.

-- Remove legacy public overloads that accepted raw service categories so clients cannot
-- bypass the production taxonomy. Existing stored rows remain valid and may have NULL labels.
drop function if exists public.staff_create_availability_rule(uuid,text,text,integer,time,time,integer,integer,date,date);
drop function if exists public.staff_create_one_off_slot(uuid,text,text,timestamptz,integer,integer);
drop function if exists public.member_request_custom_session(text,timestamptz,uuid,integer);

create or replace function public.staff_create_availability_rule(
  p_coach_user_id uuid,
  p_branch text,
  p_session_label text,
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
declare v_id uuid; v_session_type text;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not (select private.is_staff_or_admin()) then raise exception 'Staff access required'; end if;
  v_session_type := private.session_label_category(p_session_label);
  if p_weekday not between 0 and 6 then raise exception 'Invalid weekday'; end if;
  if p_local_end_time <= p_local_start_time then raise exception 'End time must be after start time'; end if;
  if p_slot_duration_minutes <= 0 or p_capacity <= 0 then raise exception 'Duration and capacity must be positive'; end if;
  insert into public.availability_rules(
    coach_user_id,branch,session_type,session_label,weekday,local_start_time,local_end_time,
    slot_duration_minutes,capacity,valid_from,valid_until,created_by
  ) values(
    p_coach_user_id,trim(p_branch),v_session_type,trim(p_session_label),p_weekday,p_local_start_time,p_local_end_time,
    p_slot_duration_minutes,p_capacity,p_valid_from,p_valid_until,(select auth.uid())
  ) returning id into v_id;
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
        insert into public.schedule_slots(
          availability_rule_id,coach_user_id,branch,session_type,session_label,start_at,end_at,capacity,status,created_by
        ) values(
          v_rule.id,v_rule.coach_user_id,v_rule.branch,v_rule.session_type,v_rule.session_label,
          v_start,v_end,v_rule.capacity,'open',(select auth.uid())
        )
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
  p_session_label text,
  p_start_at timestamptz,
  p_duration_minutes integer default 60,
  p_capacity integer default 1
)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare v_id uuid; v_session_type text;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not (select private.is_staff_or_admin()) then raise exception 'Staff access required'; end if;
  v_session_type := private.session_label_category(p_session_label);
  if p_duration_minutes <= 0 or p_capacity <= 0 then raise exception 'Duration and capacity must be positive'; end if;
  insert into public.schedule_slots(coach_user_id,branch,session_type,session_label,start_at,end_at,capacity,status,created_by)
  values(p_coach_user_id,trim(p_branch),v_session_type,trim(p_session_label),p_start_at,p_start_at+make_interval(mins=>p_duration_minutes),p_capacity,'open',(select auth.uid()))
  returning id into v_id;
  return v_id;
end; $$;
revoke all on function public.staff_create_one_off_slot(uuid,text,text,timestamptz,integer,integer) from public,anon;
grant execute on function public.staff_create_one_off_slot(uuid,text,text,timestamptz,integer,integer) to authenticated,service_role;

create or replace function public.member_request_slot(p_slot_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_member public.members%rowtype;
  v_slot public.schedule_slots%rowtype;
  v_elig jsonb;
  v_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  select * into v_member from public.members where user_id=(select auth.uid());
  if not found then raise exception 'Member profile not found'; end if;
  select * into v_slot from public.schedule_slots where id=p_slot_id for share;
  if not found or v_slot.status<>'open' then raise exception 'Slot is not available'; end if;
  if v_slot.start_at < now() + interval '24 hours' then raise exception 'Please contact staff/admin for sessions less than 24 hours away'; end if;
  if v_member.branch <> v_slot.branch then raise exception 'Members can only book at their assigned branch'; end if;
  v_elig := private.package_eligibility(v_member.id,v_slot.session_type);
  if not coalesce((v_elig->>'can_request_booking')::boolean,false) then raise exception '%',coalesce(v_elig->>'blocking_reason','Package is not eligible for booking'); end if;
  insert into public.bookings(
    member_id,slot_id,request_kind,status,requested_coach_user_id,branch,session_type,session_label,
    requested_start_at,requested_duration_minutes,created_by
  ) values(
    v_member.id,v_slot.id,'slot','pending',v_slot.coach_user_id,v_slot.branch,v_slot.session_type,v_slot.session_label,
    v_slot.start_at,greatest(1,extract(epoch from (v_slot.end_at-v_slot.start_at))/60)::integer,(select auth.uid())
  ) returning id into v_id;
  return jsonb_build_object('booking_id',v_id,'status','pending','session_label',v_slot.session_label);
end; $$;
revoke all on function public.member_request_slot(uuid) from public,anon;
grant execute on function public.member_request_slot(uuid) to authenticated,service_role;

create or replace function public.member_request_custom_session(
  p_session_label text,
  p_requested_start_at timestamptz,
  p_requested_coach_user_id uuid default null,
  p_duration_minutes integer default 60
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_member public.members%rowtype; v_elig jsonb; v_id uuid; v_session_type text;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  v_session_type := private.session_label_category(p_session_label);
  if p_requested_start_at < now()+interval '24 hours' then raise exception 'Please contact staff/admin for sessions less than 24 hours away'; end if;
  if p_duration_minutes<=0 then raise exception 'Duration must be positive'; end if;
  select * into v_member from public.members where user_id=(select auth.uid());
  if not found then raise exception 'Member profile not found'; end if;
  v_elig:=private.package_eligibility(v_member.id,v_session_type);
  if not coalesce((v_elig->>'can_request_booking')::boolean,false) then raise exception '%',coalesce(v_elig->>'blocking_reason','Package is not eligible for booking'); end if;
  insert into public.bookings(
    member_id,request_kind,status,requested_coach_user_id,branch,session_type,session_label,
    requested_start_at,requested_duration_minutes,created_by
  ) values(
    v_member.id,'custom','pending',p_requested_coach_user_id,v_member.branch,v_session_type,trim(p_session_label),
    p_requested_start_at,p_duration_minutes,(select auth.uid())
  ) returning id into v_id;
  return jsonb_build_object('booking_id',v_id,'status','pending','session_label',trim(p_session_label));
end; $$;
revoke all on function public.member_request_custom_session(text,timestamptz,uuid,integer) from public,anon;
grant execute on function public.member_request_custom_session(text,timestamptz,uuid,integer) to authenticated,service_role;

create or replace function private.confirm_booking_core(
  p_booking_id uuid,p_slot_id uuid default null,p_assigned_coach_user_id uuid default null,p_require_pending boolean default true
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_booking public.bookings%rowtype;
  v_member public.members%rowtype;
  v_slot public.schedule_slots%rowtype;
  v_slot_id uuid;
  v_coach uuid;
  v_elig jsonb;
  v_member_package uuid;
  v_sessions_left integer;
  v_confirmed_count integer;
  v_future_confirmed integer;
  v_duration integer;
begin
  select * into v_booking from public.bookings where id=p_booking_id for update;
  if not found then raise exception 'Booking not found'; end if;
  if p_require_pending and v_booking.status<>'pending' then raise exception 'Booking is no longer pending'; end if;
  select * into v_member from public.members where id=v_booking.member_id;

  v_slot_id:=coalesce(p_slot_id,v_booking.slot_id);
  if v_slot_id is null then
    v_coach:=coalesce(p_assigned_coach_user_id,v_booking.requested_coach_user_id);
    if v_coach is null then raise exception 'Assign a coach before confirming a custom request'; end if;
    v_duration:=v_booking.requested_duration_minutes;
    insert into public.schedule_slots(coach_user_id,branch,session_type,session_label,start_at,end_at,capacity,status,created_by)
    values(v_coach,v_booking.branch,v_booking.session_type,v_booking.session_label,v_booking.requested_start_at,v_booking.requested_start_at+make_interval(mins=>v_duration),1,'open',(select auth.uid()))
    returning id into v_slot_id;
  end if;

  select * into v_slot from public.schedule_slots where id=v_slot_id for update;
  if not found or v_slot.status<>'open' then raise exception 'Slot is not open'; end if;
  if v_booking.request_kind in ('slot','custom') and v_member.branch<>v_slot.branch then raise exception 'Member branch does not match slot branch'; end if;
  if v_booking.session_type<>v_slot.session_type then raise exception 'Booking/package service does not match slot'; end if;
  if v_booking.session_label is not null and v_slot.session_label is not null and v_booking.session_label<>v_slot.session_label then
    raise exception 'Session label does not match slot';
  end if;

  select count(*) into v_confirmed_count from public.bookings where slot_id=v_slot.id and status='confirmed' and id<>v_booking.id;
  if v_confirmed_count >= v_slot.capacity then raise exception 'Slot capacity is full'; end if;

  v_coach:=coalesce(p_assigned_coach_user_id,v_slot.coach_user_id,v_booking.requested_coach_user_id);
  if v_coach is null then raise exception 'Coach assignment required'; end if;
  if exists(
    select 1 from public.bookings b where b.assigned_coach_user_id=v_coach and b.status='confirmed' and b.id<>v_booking.id
      and tstzrange(b.start_at,b.end_at,'[)') && tstzrange(v_slot.start_at,v_slot.end_at,'[)')
  ) then raise exception 'Coach has an overlapping confirmed booking'; end if;

  v_elig:=private.package_eligibility(v_member.id,v_slot.session_type);
  if not coalesce((v_elig->>'can_confirm_booking')::boolean,false) then raise exception '%',coalesce(v_elig->>'blocking_reason','Package cannot confirm booking'); end if;
  v_member_package:=(v_elig->>'member_package_id')::uuid;
  v_sessions_left:=coalesce((v_elig->>'sessions_left')::integer,0);

  select count(*) into v_future_confirmed from public.bookings
  where member_id=v_member.id and member_package_id=v_member_package and status='confirmed'
    and coalesce(start_at,requested_start_at)>=now() and id<>v_booking.id;
  if v_future_confirmed >= v_sessions_left then raise exception 'Not enough remaining package sessions for another confirmed future booking'; end if;

  update public.bookings set
    status='confirmed',slot_id=v_slot.id,assigned_coach_user_id=v_coach,start_at=v_slot.start_at,end_at=v_slot.end_at,
    member_package_id=v_member_package,session_label=coalesce(v_booking.session_label,v_slot.session_label)
  where id=v_booking.id;
  return jsonb_build_object('booking_id',v_booking.id,'status','confirmed','slot_id',v_slot.id,'member_package_id',v_member_package,'session_label',coalesce(v_booking.session_label,v_slot.session_label));
end; $$;
revoke all on function private.confirm_booking_core(uuid,uuid,uuid,boolean) from public,anon;
grant execute on function private.confirm_booking_core(uuid,uuid,uuid,boolean) to authenticated,service_role;

create or replace function public.staff_confirm_booking(p_booking_id uuid,p_slot_id uuid default null,p_assigned_coach_user_id uuid default null)
returns jsonb language plpgsql security definer set search_path=''
as $$ begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not (select private.is_staff_or_admin()) then raise exception 'Staff access required'; end if;
  return private.confirm_booking_core(p_booking_id,p_slot_id,p_assigned_coach_user_id,true);
end; $$;
revoke all on function public.staff_confirm_booking(uuid,uuid,uuid) from public,anon;
grant execute on function public.staff_confirm_booking(uuid,uuid,uuid) to authenticated,service_role;

create or replace function public.staff_create_assignment(p_member_id uuid,p_slot_id uuid,p_member_package_id uuid default null)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_slot public.schedule_slots%rowtype; v_id uuid; v_result jsonb;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not (select private.is_staff_or_admin()) then raise exception 'Staff access required'; end if;
  select * into v_slot from public.schedule_slots where id=p_slot_id;
  if not found then raise exception 'Slot not found'; end if;
  insert into public.bookings(
    member_id,slot_id,request_kind,status,requested_coach_user_id,branch,session_type,session_label,
    requested_start_at,requested_duration_minutes,member_package_id,created_by
  ) values(
    p_member_id,v_slot.id,'staff_assignment','pending',v_slot.coach_user_id,v_slot.branch,v_slot.session_type,v_slot.session_label,
    v_slot.start_at,greatest(1,extract(epoch from(v_slot.end_at-v_slot.start_at))/60)::integer,p_member_package_id,(select auth.uid())
  ) returning id into v_id;
  v_result:=private.confirm_booking_core(v_id,v_slot.id,v_slot.coach_user_id,true);
  return v_result;
end; $$;
revoke all on function public.staff_create_assignment(uuid,uuid,uuid) from public,anon;
grant execute on function public.staff_create_assignment(uuid,uuid,uuid) to authenticated,service_role;

create or replace function public.staff_reassign_booking(p_booking_id uuid,p_slot_id uuid default null,p_assigned_coach_user_id uuid default null)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_booking public.bookings%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not (select private.is_staff_or_admin()) then raise exception 'Staff access required'; end if;
  select * into v_booking from public.bookings where id=p_booking_id for update;
  if not found or v_booking.status<>'confirmed' then raise exception 'Confirmed booking not found'; end if;
  update public.bookings set status='pending' where id=p_booking_id;
  begin
    return private.confirm_booking_core(p_booking_id,p_slot_id,p_assigned_coach_user_id,true);
  exception when others then
    update public.bookings set status='confirmed' where id=p_booking_id;
    raise;
  end;
end; $$;
revoke all on function public.staff_reassign_booking(uuid,uuid,uuid) from public,anon;
grant execute on function public.staff_reassign_booking(uuid,uuid,uuid) to authenticated,service_role;
