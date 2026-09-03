-- BearFit booking-aware attendance and charged no-shows.

alter table public.session_logs
  add column if not exists booking_id uuid references public.bookings(id) on delete set null,
  add column if not exists member_package_id uuid references public.member_package_cycles(id) on delete set null;

create unique index if not exists session_logs_one_booking_usage_uidx
on public.session_logs(booking_id)
where booking_id is not null;

create index if not exists session_logs_member_package_idx on public.session_logs(member_package_id);

create or replace function private.consume_package_session(
  p_member_package_id uuid,
  p_member_id uuid,
  p_staff_user_id uuid,
  p_booking_id uuid,
  p_notes text
)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  v_cycle public.member_package_cycles%rowtype;
  v_definition public.package_definitions%rowtype;
  v_new_left integer;
  v_log_id uuid;
  v_stage record;
begin
  if p_booking_id is not null and exists(select 1 from public.session_logs where booking_id=p_booking_id) then
    select id,sessions_left_after into v_log_id,v_new_left from public.session_logs where booking_id=p_booking_id limit 1;
    return jsonb_build_object('already_consumed',true,'session_log_id',v_log_id,'sessions_left',v_new_left);
  end if;

  select * into v_cycle from public.member_package_cycles where id=p_member_package_id and member_id=p_member_id for update;
  if not found then raise exception 'Package cycle not found'; end if;
  select * into v_definition from public.package_definitions where id=v_cycle.package_id;
  if v_cycle.status<>'active' then raise exception 'Package is not active'; end if;
  if v_cycle.expires_at is not null and v_cycle.expires_at<=now() then raise exception 'Package expired'; end if;
  if v_cycle.sessions_left<=0 then raise exception 'No sessions remaining'; end if;

  v_new_left:=v_cycle.sessions_left-1;
  update public.member_package_cycles
    set sessions_left=sessions_left-1,
        sessions_used=sessions_used+1,
        status=case when sessions_left-1=0 then 'depleted' else status end
  where id=v_cycle.id;

  if v_definition.code='PARTIAL24' then
    for v_stage in
      select s.id from public.package_payment_stages s
      where s.package_id=v_cycle.package_id
        and s.trigger_type='sessions_left'
        and v_new_left<=s.trigger_sessions_left
        and s.active
    loop
      insert into public.member_package_stage_payments(member_package_id,stage_id,status)
      values(v_cycle.id,v_stage.id,'due')
      on conflict(member_package_id,stage_id) do nothing;
    end loop;
  end if;

  if v_definition.service_category='fitness' then
    perform private.sync_member_primary_balance(v_cycle.member_id);
  end if;

  insert into public.session_logs(member_id,staff_user_id,trained_at,notes,sessions_left_after,booking_id,member_package_id)
  values(v_cycle.member_id,p_staff_user_id,now(),nullif(trim(coalesce(p_notes,'')),''),v_new_left,p_booking_id,v_cycle.id)
  returning id into v_log_id;

  return jsonb_build_object('already_consumed',false,'session_log_id',v_log_id,'member_package_id',v_cycle.id,'sessions_left',v_new_left,'sessions_used',v_cycle.sessions_used+1);
end; $$;
revoke all on function private.consume_package_session(uuid,uuid,uuid,uuid,text) from public,anon;
grant execute on function private.consume_package_session(uuid,uuid,uuid,uuid,text) to authenticated,service_role;

-- Replace the old two-argument function with one compatible function that has defaults.
drop function if exists public.staff_qr_checkin(text,text);

create or replace function public.staff_qr_checkin(
  p_member_code text,
  p_notes text default null,
  p_booking_id uuid default null,
  p_member_package_id uuid default null
)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  v_member public.members%rowtype;
  v_booking public.bookings%rowtype;
  v_cycle_id uuid;
  v_usable_count integer;
  v_result jsonb;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not (select private.is_staff_or_admin()) then raise exception 'Staff access required'; end if;
  select * into v_member from public.members where upper(member_code)=upper(trim(p_member_code)) for update;
  if not found then raise exception 'Member code not found'; end if;
  if lower(coalesce(v_member.membership_status,v_member.status,'inactive'))<>'active' or lower(coalesce(v_member.status,'inactive'))<>'active' then raise exception 'Membership is not active'; end if;

  if p_booking_id is not null then
    select * into v_booking from public.bookings where id=p_booking_id and member_id=v_member.id for update;
    if not found then raise exception 'Booking not found for member'; end if;
    if v_booking.status='completed' and exists(select 1 from public.session_logs where booking_id=v_booking.id) then
      return jsonb_build_object('member_id',v_member.id,'member_code',v_member.member_code,'status','completed','already_checked_in',true);
    end if;
    if v_booking.status<>'confirmed' then raise exception 'Booking must be confirmed before check-in'; end if;
    v_cycle_id:=v_booking.member_package_id;
    if v_cycle_id is null then raise exception 'Confirmed booking has no package cycle'; end if;
  elsif p_member_package_id is not null then
    v_cycle_id:=p_member_package_id;
  else
    select count(*),min(c.id) into v_usable_count,v_cycle_id
    from public.member_package_cycles c
    where c.member_id=v_member.id and c.status='active' and c.sessions_left>0 and (c.expires_at is null or c.expires_at>now());
    if v_usable_count=0 then raise exception 'No usable package'; end if;
    if v_usable_count>1 then raise exception 'Package selection required'; end if;
  end if;

  v_result:=private.consume_package_session(v_cycle_id,v_member.id,(select auth.uid()),p_booking_id,p_notes);
  if p_booking_id is not null then
    update public.bookings set status='completed' where id=p_booking_id and status='confirmed';
  end if;

  return v_result || jsonb_build_object('member_id',v_member.id,'member_code',v_member.member_code,'member_name',v_member.full_name,'booking_id',p_booking_id,'status',case when p_booking_id is null then 'checked_in' else 'completed' end);
end; $$;
revoke all on function public.staff_qr_checkin(text,text,uuid,uuid) from public,anon;
grant execute on function public.staff_qr_checkin(text,text,uuid,uuid) to authenticated,service_role;

create or replace function public.staff_mark_no_show(
  p_booking_id uuid,
  p_charge_session boolean,
  p_notes text default null
)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  v_booking public.bookings%rowtype;
  v_result jsonb:=jsonb_build_object();
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not (select private.is_staff_or_admin()) then raise exception 'Staff access required'; end if;
  select * into v_booking from public.bookings where id=p_booking_id for update;
  if not found then raise exception 'Booking not found'; end if;

  if v_booking.status='no_show' then
    return jsonb_build_object('booking_id',v_booking.id,'status','no_show','charged',v_booking.no_show_charged,'already_processed',true);
  end if;
  if v_booking.status<>'confirmed' then raise exception 'Only confirmed bookings can be marked no-show'; end if;

  if p_charge_session then
    if v_booking.member_package_id is null then raise exception 'Booking has no package cycle'; end if;
    v_result:=private.consume_package_session(v_booking.member_package_id,v_booking.member_id,(select auth.uid()),v_booking.id,p_notes);
  end if;

  update public.bookings set status='no_show',no_show_charged=p_charge_session where id=v_booking.id;
  return jsonb_build_object('booking_id',v_booking.id,'status','no_show','charged',p_charge_session,'already_processed',false,'consumption',v_result);
end; $$;
revoke all on function public.staff_mark_no_show(uuid,boolean,text) from public,anon;
grant execute on function public.staff_mark_no_show(uuid,boolean,text) to authenticated,service_role;

create or replace function public.staff_checkin_context(p_member_code text)
returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare
  v_member public.members%rowtype;
  v_bookings jsonb;
  v_packages jsonb;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not (select private.is_staff_or_admin()) then raise exception 'Staff access required'; end if;
  select * into v_member from public.members where upper(member_code)=upper(trim(p_member_code));
  if not found then raise exception 'Member code not found'; end if;

  select coalesce(jsonb_agg(jsonb_build_object('id',b.id,'start_at',b.start_at,'end_at',b.end_at,'session_type',b.session_type,'branch',b.branch,'member_package_id',b.member_package_id) order by abs(extract(epoch from (b.start_at-now())))),'[]'::jsonb)
  into v_bookings from public.bookings b where b.member_id=v_member.id and b.status='confirmed';

  select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'package_name',d.name,'package_code',d.code,'service_category',d.service_category,'sessions_left',c.sessions_left,'sessions_total',c.sessions_total,'expires_at',c.expires_at,'eligibility',private.package_eligibility(v_member.id,d.service_category)) order by c.created_at desc),'[]'::jsonb)
  into v_packages
  from public.member_package_cycles c join public.package_definitions d on d.id=c.package_id
  where c.member_id=v_member.id and c.status='active' and c.sessions_left>0 and (c.expires_at is null or c.expires_at>now());

  return jsonb_build_object('member',jsonb_build_object('id',v_member.id,'member_code',v_member.member_code,'name',v_member.full_name,'branch',v_member.branch),'confirmed_bookings',v_bookings,'packages',v_packages);
end; $$;
revoke all on function public.staff_checkin_context(text) from public,anon;
grant execute on function public.staff_checkin_context(text) to authenticated,service_role;
