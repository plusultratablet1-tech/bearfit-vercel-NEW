-- BearFit owner-directed operational workflow V1.
-- Prospective final client confirmation and immutable booking-change notices.
-- Does not modify session balances, coach rates, payment or payroll ledgers.

alter table public.bookings
  add column if not exists final_schedule_revision integer not null default 0;

create table if not exists public.booking_final_confirmations (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  member_id uuid not null references public.members(id) on delete restrict,
  confirmed_by uuid not null references auth.users(id),
  final_schedule_revision integer not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  coach_user_id uuid not null references auth.users(id),
  slot_id uuid references public.schedule_slots(id),
  branch text not null,
  session_type text not null,
  session_label text,
  terms_acknowledged boolean not null,
  confirmed_at timestamptz not null default now(),
  unique(booking_id,final_schedule_revision),
  check(end_at>start_at)
);
create index if not exists booking_final_confirmations_member_idx
 on public.booking_final_confirmations(member_id,confirmed_at desc);
alter table public.booking_final_confirmations enable row level security;
revoke all on public.booking_final_confirmations from anon,authenticated;
grant select on public.booking_final_confirmations to authenticated;
create policy "Member reads their final booking confirmation" on public.booking_final_confirmations
 for select to authenticated using(exists(select 1 from public.members m
   where m.id=member_id and m.user_id=(select auth.uid())));
create policy "Staff reads final confirmation status" on public.booking_final_confirmations
 for select to authenticated using((select private.is_staff_or_admin()));

create table if not exists public.booking_operational_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  member_id uuid not null references public.members(id) on delete restrict,
  event_type text not null check(event_type in ('confirmed','schedule_changed','cancelled')),
  previous_state jsonb,
  new_state jsonb,
  detail text,
  actor_user_id uuid references auth.users(id),
  event_at timestamptz not null default now()
);
create index if not exists booking_operational_events_member_idx
 on public.booking_operational_events(member_id,event_at desc);
create index if not exists booking_operational_events_booking_idx
 on public.booking_operational_events(booking_id,event_at desc);
alter table public.booking_operational_events enable row level security;
revoke all on public.booking_operational_events from anon,authenticated;
grant select on public.booking_operational_events to authenticated;
create policy "Members see own booking change notices" on public.booking_operational_events
 for select to authenticated using(exists(select 1 from public.members m
    where m.id=member_id and m.user_id=(select auth.uid())));
create policy "Staff reads operational booking events" on public.booking_operational_events
 for select to authenticated using((select private.is_staff_or_admin()));

-- Ensure any final schedule change generates a new confirmation version.
-- Keep this independent of incidental updated_at changes by other RPCs.
create or replace function private.bump_booking_final_schedule_revision()
returns trigger language plpgsql set search_path='' as $fn$
begin
 if new.status='confirmed' and (
      old.status is distinct from new.status
      or old.start_at is distinct from new.start_at
      or old.end_at is distinct from new.end_at
      or old.assigned_coach_user_id is distinct from new.assigned_coach_user_id
      or old.slot_id is distinct from new.slot_id
      or old.branch is distinct from new.branch
      or old.session_type is distinct from new.session_type
      or old.session_label is distinct from new.session_label
 ) then
    new.final_schedule_revision:=old.final_schedule_revision+1;
 else
    new.final_schedule_revision:=old.final_schedule_revision;
 end if;
 return new;
end $fn$;
drop trigger if exists bearfit_final_schedule_revision_guard on public.bookings;
create trigger bearfit_final_schedule_revision_guard before update on public.bookings
 for each row execute function private.bump_booking_final_schedule_revision();

create or replace function private.audit_booking_operational_change()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare v_kind text;
 v_old jsonb;v_new jsonb;
begin
 v_old:=jsonb_build_object('status',old.status,'start_at',old.start_at,'end_at',old.end_at,
       'coach_user_id',old.assigned_coach_user_id,'slot_id',old.slot_id,
       'branch',old.branch,'service',old.session_type,'session_label',old.session_label,
       'schedule_revision',old.final_schedule_revision);
 v_new:=jsonb_build_object('status',new.status,'start_at',new.start_at,'end_at',new.end_at,
       'coach_user_id',new.assigned_coach_user_id,'slot_id',new.slot_id,
       'branch',new.branch,'service',new.session_type,'session_label',new.session_label,
       'schedule_revision',new.final_schedule_revision);
 if new.status='cancelled' and old.status is distinct from new.status then
    v_kind:='cancelled';
 elsif new.status='confirmed' and new.final_schedule_revision<>old.final_schedule_revision then
    v_kind:=case when old.status='pending' and old.final_schedule_revision=0
               then 'confirmed' else 'schedule_changed' end;
 else return new; end if;
 insert into public.booking_operational_events
   (booking_id,member_id,event_type,previous_state,new_state,detail,actor_user_id)
 values(new.id,new.member_id,v_kind,v_old,v_new,
   case when v_kind='cancelled' then coalesce(nullif(btrim(new.cancel_reason),''),'Cancelled: contact Admin for details')
        when v_kind='schedule_changed' then 'Final schedule changed; fresh client confirmation required'
        else 'Admin confirmed your booking; review the final date, time and coach' end,
   (select auth.uid()));
 return new;
end $fn$;
drop trigger if exists bearfit_booking_change_notice on public.bookings;
create trigger bearfit_booking_change_notice after update on public.bookings
 for each row execute function private.audit_booking_operational_change();

-- Final booking confirmation is append-only, member-scoped and idempotent by schedule revision.
-- A member cannot retroactively accept the STRICT penalty after that deadline;
-- in that case the booking can still be acknowledged without inventing new penalty consent.
create or replace function public.member_confirm_final_booking(p_booking_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare v_uid uuid:=(select auth.uid());
 v_b public.bookings%rowtype;
 v_terms public.booking_policy_acceptances%rowtype;
 v_cutoff timestamptz;
 v_confirm uuid;
 v_agreed boolean;
begin
 if v_uid is null then raise exception 'Member sign-in required'; end if;
 select b.* into v_b from public.bookings b
 join public.members m on m.id=b.member_id
 where b.id=p_booking_id and m.user_id=v_uid and not coalesce(m.is_demo,false)
 for update of b;
 if not found then raise exception 'This booking is not in your account'; end if;
 if v_b.status<>'confirmed' or v_b.start_at is null or v_b.end_at is null
  or v_b.assigned_coach_user_id is null
  then raise exception 'Admin must assign the final time and coach before client confirmation'; end if;
 if v_b.start_at<=now() then raise exception 'Cannot confirm a session after it has begun'; end if;
 select id into v_confirm from public.booking_final_confirmations
   where booking_id=v_b.id and final_schedule_revision=v_b.final_schedule_revision;
 if v_confirm is not null then
   return jsonb_build_object('booking_id',v_b.id,'confirmation_id',v_confirm,
     'status','already_confirmed','schedule_revision',v_b.final_schedule_revision);
 end if;
 v_cutoff:=(((v_b.start_at at time zone 'Asia/Manila')::date::timestamp
             - interval '2 hours') at time zone 'Asia/Manila');
 select * into v_terms from public.booking_policy_acceptances where booking_id=v_b.id;
 v_agreed:=found;
 if v_agreed or now()<=v_cutoff then
   -- This is an explicit member action: refresh existing accepted terms, or
   -- allow first-time acceptance only while the stricter deadline is still future.
   perform public.member_accept_booking_no_show_terms(v_b.id);
   v_agreed:=true;
 end if;
 insert into public.booking_final_confirmations
 (booking_id,member_id,confirmed_by,final_schedule_revision,start_at,end_at,
  coach_user_id,slot_id,branch,session_type,session_label,terms_acknowledged)
 values(v_b.id,v_b.member_id,v_uid,v_b.final_schedule_revision,v_b.start_at,
   v_b.end_at,v_b.assigned_coach_user_id,v_b.slot_id,v_b.branch,v_b.session_type,
   v_b.session_label,v_agreed)
 returning id into v_confirm;
 return jsonb_build_object('booking_id',v_b.id,'confirmation_id',v_confirm,
   'status','confirmed','schedule_revision',v_b.final_schedule_revision,
   'penalty_terms_acknowledged',v_agreed,
   'message',case when v_agreed then 'Final schedule and applicable terms acknowledged'
       else 'Final schedule acknowledged; original legacy cancellation rights retained' end);
end $fn$;
revoke all on function public.member_confirm_final_booking(uuid) from public,anon;
grant execute on function public.member_confirm_final_booking(uuid) to authenticated;
revoke all on function private.bump_booking_final_schedule_revision() from public,anon,authenticated;
revoke all on function private.audit_booking_operational_change() from public,anon,authenticated;

-- Protect the Admin no-show CHARGE decision using the final client acknowledgment.
-- This trigger executes in the SAME transaction as the charge. A missing/mismatched
-- client confirmation aborts the whole transaction, including the session debit.
create or replace function private.require_final_client_confirmation_for_no_show_charge()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare v_b public.bookings%rowtype;
begin
 if new.status<>'charged' or old.status='charged' then return new; end if;
 select * into v_b from public.bookings where id=new.booking_id;
 if not found or not exists (
   select 1 from public.booking_final_confirmations f where f.booking_id=v_b.id
     and f.member_id=v_b.member_id
     and f.final_schedule_revision=v_b.final_schedule_revision
     and f.start_at is not distinct from v_b.start_at
     and f.end_at is not distinct from v_b.end_at
     and f.coach_user_id is not distinct from v_b.assigned_coach_user_id
     and f.branch is not distinct from v_b.branch
     and f.session_type is not distinct from v_b.session_type
     and f.session_label is not distinct from v_b.session_label
     and f.slot_id is not distinct from v_b.slot_id
 ) then raise exception
   'Client has not acknowledged the final assigned schedule. No-show deduction blocked'; end if;
 return new;
end $fn$;
drop trigger if exists bearfit_charge_requires_final_client_confirmation
 on public.booking_no_show_cases;
create trigger bearfit_charge_requires_final_client_confirmation
 before update of status on public.booking_no_show_cases
 for each row execute function private.require_final_client_confirmation_for_no_show_charge();
revoke all on function private.require_final_client_confirmation_for_no_show_charge()
 from public,anon,authenticated;

-- Require meaningful cancellation evidence for staff-initiated actions.
-- Does not modify historic cancellations or introduce a session penalty.
create or replace function public.staff_cancel_booking(p_booking_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare v_b public.bookings%rowtype;
begin
 if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
 if not (select private.is_staff_or_admin()) then raise exception 'Staff access required'; end if;
 if length(btrim(coalesce(p_reason,''))) not between 8 and 600
   then raise exception 'Record a clear cancellation category and reason (8-600 characters)'; end if;
 select * into v_b from public.bookings where id=p_booking_id for update;
 if not found or v_b.status not in ('pending','confirmed')
   then raise exception 'Only pending or confirmed bookings can be cancelled'; end if;
 update public.bookings set status='cancelled',cancelled_at=now(),
    cancel_reason=btrim(p_reason) where id=p_booking_id;
 return jsonb_build_object('booking_id',p_booking_id,'status','cancelled',
   'member_session_deducted',false,'reason',btrim(p_reason));
end $fn$;
revoke all on function public.staff_cancel_booking(uuid,text) from public,anon;
grant execute on function public.staff_cancel_booking(uuid,text) to authenticated;
