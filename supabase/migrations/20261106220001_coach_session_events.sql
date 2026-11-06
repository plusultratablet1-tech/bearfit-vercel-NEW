-- Coach actions are isolated from canonical bookings, member credits and payroll.
create table if not exists public.coach_session_events (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches(id),
  booking_id uuid not null references public.bookings(id),
  event_type text not null check (event_type in ('confirmed','qr_confirmed','in_session','cancel_requested')),
  reason text,
  created_at timestamptz not null default now(),
  actor_id uuid not null references auth.users(id)
);
create unique index if not exists coach_session_event_once on public.coach_session_events(coach_id,booking_id,event_type);
create index if not exists coach_session_event_recent on public.coach_session_events(coach_id,created_at desc);
alter table public.coach_session_events enable row level security;
revoke all on public.coach_session_events from public,anon,authenticated;

create or replace function public.coach_record_session_event(
 p_booking_id uuid,p_event_type text,p_member_code text default null,p_reason text default null
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare v_coach public.coaches%rowtype; v_booking public.bookings%rowtype;
        v_member_code text; v_id uuid;
begin
 if not exists(select 1 from public.profiles where id=(select auth.uid()) and role='coach')
 then raise exception 'Coach login required'; end if;
 select * into v_coach from public.coaches
  where user_id=(select auth.uid()) and is_active and not is_demo;
 if not found then raise exception 'Active coach account not linked'; end if;
 if p_event_type not in ('confirmed','qr_confirmed','in_session','cancel_requested')
 then raise exception 'Invalid coach action'; end if;
 select * into v_booking from public.bookings where id=p_booking_id for update;
 if not found or v_booking.assigned_coach_user_id is distinct from v_coach.user_id
    or v_booking.branch is distinct from v_coach.branch then
    raise exception 'This is not your assigned session'; end if;
 if v_booking.status<>'confirmed' then
    raise exception 'Only active confirmed bookings may be tagged'; end if;
 if p_event_type='cancel_requested' then
   if v_booking.start_at<=now() then raise exception 'Ask Admin to review a past or in-progress booking'; end if;
   if char_length(btrim(coalesce(p_reason,''))) not between 5 and 300
   then raise exception 'Provide a cancellation reason (5-300 characters)'; end if;
 end if;
 if p_event_type in ('qr_confirmed','in_session') then
  select member_code into v_member_code from public.members where id=v_booking.member_id;
  if upper(btrim(coalesce(p_member_code,'')))<>upper(coalesce(v_member_code,''))
  then raise exception 'Member QR does not match the assigned client'; end if;
  if v_booking.start_at is null or v_booking.end_at is null or
     now()<v_booking.start_at-interval '2 hours' or now()>v_booking.end_at+interval '2 hours'
  then raise exception 'QR confirmation is outside this session window'; end if;
 end if;
 insert into public.coach_session_events(coach_id,booking_id,event_type,reason,actor_id)
 values(v_coach.id,p_booking_id,p_event_type,
        case when p_event_type='cancel_requested' then btrim(p_reason) else null end,(select auth.uid()))
 on conflict (coach_id,booking_id,event_type) do nothing
 returning id into v_id;
 if v_id is null then
  select id into v_id from public.coach_session_events
   where coach_id=v_coach.id and booking_id=p_booking_id and event_type=p_event_type;
 end if;
 return jsonb_build_object('event_id',v_id,'event_type',p_event_type);
end; $$;
revoke all on function public.coach_record_session_event(uuid,text,text,text) from public,anon;
grant execute on function public.coach_record_session_event(uuid,text,text,text) to authenticated;
