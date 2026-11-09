-- Owner-reported reconciliation 2026-11-09, for two real Hunejin clients.
-- Dates are reported historical sessions, NOT fabricated GPS/verified checkins.
-- Do not insert retroactive session_logs or payments/payroll.
create table if not exists public.coach_owner_reported_session_dates(
  member_id uuid not null references public.members(id) on delete restrict,
  coach_id uuid not null references public.coaches(id) on delete restrict,
  session_date date not null,
  source text not null default 'owner_reported_2026_11_09',
  created_at timestamptz not null default now(),
  primary key (member_id,coach_id,session_date)
);
alter table public.coach_owner_reported_session_dates enable row level security;
revoke all on public.coach_owner_reported_session_dates from public,anon,authenticated;
do $$
declare c public.coaches%rowtype;j public.members%rowtype;d public.members%rowtype;admin_id uuid;
begin
 select * into strict c from public.coaches where username='coach4' and display_name='Hunejin'
 and branch='E. Rodriguez Branch' and is_active and not is_demo and user_id is not null;
 select * into strict j from public.members where member_code='M0112' and full_name='Jensine Orate'
 and branch=c.branch and coach_name=c.display_name and not is_demo and status='active';
 select * into strict d from public.members where member_code='M0104' and full_name='Dulce Zaide'
 and branch=c.branch and coach_name=c.display_name and not is_demo and status='active';
 select id into strict admin_id from public.profiles where role='admin';
 if exists(select 1 from public.coach_permanent_qr_tags
 where member_id in (j.id,d.id) and tag_number not in (1,2))
 then raise exception 'One client already has another permanent QR tag';end if;
 if exists(select 1 from public.member_package_cycles
 where member_id in (j.id,d.id) and status='active')
 then raise exception 'Existing package cycle requires manual reconciliation';end if;
 if exists(select 1 from public.session_logs where member_id in (j.id,d.id))
 then raise exception 'Historical session logs exist; reconcile before changing';end if;
 -- Jensine: 48 paid + 5 free. 15 paid + 5 free left = 20.
 -- Paid used = 33, bonus used = 0. Total 53, used 33, remaining 20.
 update public.members set package_name='Full 48',package_type='Full 48',
  total_sessions=53,sessions_used=33,sessions_left=20,
  updated_at=now() where id=j.id;
 insert into public.member_package_cycles(member_id,package_id,status,sessions_total,sessions_used,sessions_left)
 values(j.id,(select id from public.package_definitions where code='FULL48'),'active',53,33,20);
 -- Dulce: Partial 24, 19 left, therefore 5 used. Payment status untouched.
 update public.members set package_name='Partial 24',package_type='Partial 24',
  total_sessions=24,sessions_used=5,sessions_left=19,
  updated_at=now() where id=d.id;
 insert into public.member_package_cycles(member_id,package_id,status,sessions_total,sessions_used,sessions_left)
 values(d.id,(select id from public.package_definitions where code='PARTIAL24'),'active',24,5,19);
 insert into public.coach_owner_reported_session_dates(member_id,coach_id,session_date)
 values(j.id,c.id,date '2026-11-03'),(j.id,c.id,date '2026-11-04'),
 (j.id,c.id,date '2026-11-05'),(j.id,c.id,date '2026-11-06'),
 (d.id,c.id,date '2026-11-04'),(d.id,c.id,date '2026-11-06')
 on conflict do nothing;
 update public.coach_permanent_qr_tags set member_id=j.id,assigned_by=admin_id,
  assigned_at=now(),assignment_source='owner_requested_setup'
 where tag_number=1 and coach_id=c.id and member_id is null;
 if not found then raise exception 'QR 001 unavailable';end if;
 update public.coach_permanent_qr_tags set member_id=d.id,assigned_by=admin_id,
  assigned_at=now(),assignment_source='owner_requested_setup'
 where tag_number=2 and coach_id=c.id and member_id is null;
 if not found then raise exception 'QR 002 unavailable';end if;
end;$$;
