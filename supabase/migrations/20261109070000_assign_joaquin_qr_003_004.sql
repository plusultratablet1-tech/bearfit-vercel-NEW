-- Link previously printed permanent QR 003/004 to two VERIFIED real Joaquin
-- clients. No session, payment, payroll, or package changes are made.
-- Assignment is performed at BearFit owner's request through project tooling,
-- not through the coach's signed-in account.
alter table public.coach_permanent_qr_tags
  add column if not exists assignment_source text not null default 'coach_portal';
do $$
declare
 v_coach public.coaches%rowtype;
 v_admin uuid;
 v_ilynne public.members%rowtype;
 v_debbie public.members%rowtype;
 v_tag public.coach_permanent_qr_tags%rowtype;
begin
 select * into strict v_coach from public.coaches
 where username='coach1' and display_name='Joaquin'
 and branch='Malingap Branch' and is_active and not is_demo
 and user_id is not null;
 select id into strict v_admin from public.profiles where role='admin';
 select * into strict v_ilynne from public.members
 where member_code='M0012' and full_name='Ilynne Gonzales'
 and coach_name='Joaquin' and branch=v_coach.branch and not is_demo;
 select * into strict v_debbie from public.members
 where member_code='M0010' and full_name='Debbie Singson'
 and coach_name='Joaquin' and branch=v_coach.branch and not is_demo;
 if v_ilynne.status<>'active' or v_debbie.status<>'active' then
  raise exception 'Client status needs Admin review';
 end if;
 if not exists(select 1 from public.member_package_cycles where member_id=v_ilynne.id and status='active')
 or not exists(select 1 from public.member_package_cycles where member_id=v_debbie.id and status='active')
 then raise exception 'Verified package cycle missing';end if;
 if exists(select 1 from public.coach_permanent_qr_tags
 where member_id in (v_ilynne.id,v_debbie.id) and tag_number not in (3,4))
 then raise exception 'One of these clients already has another permanent tag';end if;
 select * into strict v_tag from public.coach_permanent_qr_tags where tag_number=3 for update;
 if v_tag.coach_id is distinct from v_coach.id or v_tag.reserved_coach_name<>'Joaquin'
 or (v_tag.member_id is not null and v_tag.member_id is distinct from v_ilynne.id)
 then raise exception 'QR 003 is not reserved for Joaquin or has been assigned elsewhere';end if;
 if v_tag.member_id is null then
  update public.coach_permanent_qr_tags
  set member_id=v_ilynne.id,assigned_at=now(),assigned_by=v_admin,
  assignment_source='owner_requested_setup'
  where tag_number=3 and member_id is null;
 end if;
 select * into strict v_tag from public.coach_permanent_qr_tags where tag_number=4 for update;
 if v_tag.coach_id is distinct from v_coach.id or v_tag.reserved_coach_name<>'Joaquin'
 or (v_tag.member_id is not null and v_tag.member_id is distinct from v_debbie.id)
 then raise exception 'QR 004 is not reserved for Joaquin or has been assigned elsewhere';end if;
 if v_tag.member_id is null then
  update public.coach_permanent_qr_tags
  set member_id=v_debbie.id,assigned_at=now(),assigned_by=v_admin,
  assignment_source='owner_requested_setup'
  where tag_number=4 and member_id is null;
 end if;
end;$$;
