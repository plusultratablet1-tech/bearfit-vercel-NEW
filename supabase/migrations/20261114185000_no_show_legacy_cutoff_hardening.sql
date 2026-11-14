-- Forward-only hardening for already-deployed BearFit no-show V1.
-- Prevent imposing a previously-expired 10pm deadline on legacy bookings.
-- Keep original four-hour free-cancellation eligibility for legacy bookings.
-- No existing member/package/payment/session data is changed.
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
 -- Do not retroactively replace a member's existing free-cancellation entitlement
 -- with a deadline that has already passed.
 if now()>v_cutoff and not exists(
   select 1 from public.booking_policy_acceptances t where t.booking_id=v_b.id)
 then raise exception 'The 10 PM deadline already passed. Existing booking retains original cancellation rights; contact Admin for late confirmation'; end if;
 insert into public.booking_policy_acceptances(booking_id,member_id,accepted_by,accepted_at,cutoff_at)
 values(v_b.id,v_b.member_id,v_uid,now(),v_cutoff)
 on conflict(booking_id) do update
 set accepted_at=now(),accepted_by=v_uid,cutoff_at=excluded.cutoff_at,policy_version=excluded.policy_version;
 return jsonb_build_object('accepted',true,'cutoff_at',v_cutoff,'policy_version','no-show-v1-2026-11-14');
end $fn$;

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
 if exists(select 1 from public.booking_policy_acceptances t where t.booking_id=v_b.id) then
   v_cutoff:=(((coalesce(v_b.start_at,v_b.requested_start_at) at time zone 'Asia/Manila')::date::timestamp - interval '2 hours') at time zone 'Asia/Manila');
 else
   v_cutoff:=coalesce(v_b.start_at,v_b.requested_start_at)-interval '4 hours';
 end if;
 if now()<=v_cutoff then raise exception 'Free cancellation is still available'; end if;
 if exists(select 1 from public.session_logs where booking_id=v_b.id) then raise exception 'Session already processed'; end if;
 insert into public.booking_no_show_cases(booking_id,member_id,coach_user_id,report_kind,report_notes,reported_by)
 values(v_b.id,v_b.member_id,v_b.assigned_coach_user_id,'member_late_cancel',btrim(p_reason),v_uid)
 on conflict(booking_id) do nothing returning id into v_case;
 if v_case is null then select id into v_case from public.booking_no_show_cases where booking_id=v_b.id; end if;
 return v_case;
end $fn$;
