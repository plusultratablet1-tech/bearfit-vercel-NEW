-- Coach Schedule is a read/response surface over the existing Admin-managed bookings.
-- Feedback is advisory: it does not approve, cancel, reschedule or deduct sessions.
create table if not exists public.coach_schedule_feedback (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  coach_id uuid not null references public.coaches(id),
  actor_id uuid not null references auth.users(id),
  response text not null check(response in ('available','conflict','cancel_requested')),
  reason text,
  updated_at timestamptz not null default now(),
  unique(coach_id,booking_id)
);
alter table public.coach_schedule_feedback enable row level security;
revoke all on public.coach_schedule_feedback from public,anon,authenticated;
create index if not exists coach_schedule_feedback_updated_at on public.coach_schedule_feedback(updated_at desc);

create or replace function public.coach_schedule_overview()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_coach public.coaches%rowtype; v_bookings jsonb;v_requests jsonb;
begin
 if (select auth.uid()) is null or not exists(
   select 1 from public.profiles where id=(select auth.uid()) and role='coach'
 ) then raise exception 'Coach account required'; end if;
 select * into v_coach from public.coaches
  where user_id=(select auth.uid()) and is_active and not is_demo;
 if not found then raise exception 'Active coach record not linked';end if;
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',v.id,'start_at',v.start_at,'end_at',v.end_at,'status',v.status,
   'member_name',v.member_name,'member_code',v.member_code,'session_label',v.session_label,
   'session_type',v.session_type,'branch',v.branch,
   'coach_response',v.coach_response,'coach_reason',v.coach_reason
 ) order by v.start_at asc),'[]'::jsonb) into v_bookings
 from (
  select b.id,b.start_at,b.end_at,b.status,m.full_name member_name,m.member_code,
   b.session_label,b.session_type,b.branch,
   f.response coach_response,f.reason coach_reason
  from public.bookings b join public.members m on m.id=b.member_id
  left join public.coach_schedule_feedback f on f.booking_id=b.id and f.coach_id=v_coach.id
  where b.assigned_coach_user_id=v_coach.user_id and b.branch=v_coach.branch
    and not coalesce(m.is_demo,false)
    and b.start_at between now()-interval '8 days' and now()+interval '90 days'
  order by b.start_at asc limit 180
 ) v;
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',v.id,'start_at',v.start_at,'status',v.status,'member_name',v.member_name,
   'member_code',v.member_code,'session_label',v.session_label,
   'session_type',v.session_type,'coach_response',v.coach_response,
   'coach_reason',v.coach_reason
 ) order by v.start_at asc),'[]'::jsonb) into v_requests
 from (
  select b.id,coalesce(b.requested_start_at,b.start_at,b.created_at) start_at,
   b.status,m.full_name member_name,m.member_code,
   b.session_label,b.session_type,f.response coach_response,f.reason coach_reason
  from public.bookings b join public.members m on m.id=b.member_id
  left join public.coach_schedule_feedback f on f.booking_id=b.id and f.coach_id=v_coach.id
  where b.status='pending' and b.branch=v_coach.branch
    and not coalesce(m.is_demo,false) and b.created_at>=now()-interval '30 days'
    and (b.requested_coach_user_id=v_coach.user_id or b.assigned_coach_user_id=v_coach.user_id)
  order by start_at asc limit 30
 ) v;
 return jsonb_build_object('bookings',v_bookings,'requests',v_requests);
end;$$;
revoke all on function public.coach_schedule_overview() from public,anon;
grant execute on function public.coach_schedule_overview() to authenticated;

create or replace function public.coach_schedule_respond(
 p_booking_id uuid,p_response text,p_reason text default null)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare c public.coaches%rowtype;b public.bookings%rowtype;f public.coach_schedule_feedback%rowtype;
begin
 if (select auth.uid()) is null or not exists(select 1 from public.profiles
 where id=(select auth.uid()) and role='coach') then raise exception 'Coach account required';end if;
 select * into c from public.coaches where user_id=(select auth.uid()) and is_active and not is_demo;
 if not found then raise exception 'Coach not active';end if;
 if p_response not in ('available','conflict','cancel_requested') or p_response is null then raise exception 'Invalid coach response';end if;
 select * into b from public.bookings where id=p_booking_id for update;
 if not found or b.branch is distinct from c.branch
 or (b.assigned_coach_user_id is distinct from c.user_id
     and b.requested_coach_user_id is distinct from c.user_id)
 then raise exception 'Booking is not assigned or requested for this coach';end if;
 if b.status not in ('pending','confirmed') then raise exception 'Booking is no longer actionable';end if;
 if p_response='cancel_requested' and b.status<>'confirmed' then raise exception 'Only confirmed bookings can be cancellation requests';end if;
 if coalesce(b.start_at,b.requested_start_at)<=now() and p_response='cancel_requested' then
 raise exception 'Past or ongoing session cancellation needs Admin review';end if;
 if p_response in ('conflict','cancel_requested') and length(btrim(coalesce(p_reason,''))) not between 5 and 300
 then raise exception 'Please provide a reason (5-300 characters)';end if;
 insert into public.coach_schedule_feedback(booking_id,coach_id,actor_id,response,reason,updated_at)
 values(p_booking_id,c.id,(select auth.uid()),p_response,
    case when p_response='available' then null else btrim(p_reason) end,now())
 on conflict(coach_id,booking_id) do update
  set response=excluded.response,reason=excluded.reason,actor_id=excluded.actor_id,updated_at=now()
 returning * into f;
 return jsonb_build_object('response',f.response,'booking_id',f.booking_id,
 'message','Saved for Admin review. Official booking status unchanged.');
end;$$;
revoke all on function public.coach_schedule_respond(uuid,text,text) from public,anon;
grant execute on function public.coach_schedule_respond(uuid,text,text) to authenticated;

create or replace function public.staff_coach_schedule_feedback()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_result jsonb;
begin
 if (select auth.uid()) is null or not exists (
  select 1 from public.profiles where id=(select auth.uid()) and role in ('staff','admin')
 ) then raise exception 'Staff access required';end if;
 select coalesce(jsonb_agg(jsonb_build_object(
 'id',z.id,'member_name',z.member_name,'member_code',z.member_code,
 'coach_name',z.coach_name,'response',z.response,'reason',z.reason,
 'booking_status',z.booking_status,'session_at',z.session_at,'branch',z.branch,'updated_at',z.updated_at
 ) order by z.updated_at desc),'[]'::jsonb) into v_result
 from (
  select f.id,m.full_name member_name,m.member_code,c.display_name coach_name,
   f.response,f.reason,b.status booking_status,coalesce(b.start_at,b.requested_start_at) session_at,
   b.branch,f.updated_at
  from public.coach_schedule_feedback f join public.bookings b on b.id=f.booking_id
   join public.coaches c on c.id=f.coach_id join public.members m on m.id=b.member_id
  where f.updated_at>now()-interval '30 days'
  order by f.updated_at desc limit 40
 ) z;
 return v_result;
end;$$;
revoke all on function public.staff_coach_schedule_feedback() from public,anon;
grant execute on function public.staff_coach_schedule_feedback() to authenticated;
