-- Coach payment tracker: verified payments and Admin-set payables stay distinct
-- from unverified coach reports. No client credits, payroll or official payment
-- status can be changed by the coach workflows.
create table if not exists public.coach_payment_reports (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id),
  coach_id uuid not null references public.coaches(id),
  recorded_by uuid not null references auth.users(id),
  reported_sender text not null check (char_length(btrim(reported_sender)) between 2 and 120),
  amount numeric(12,2) not null check (amount > 0 and amount <= 10000000),
  channel text not null check(channel in ('GCash','Maya','Bank transfer','Cash','Other')),
  transfer_reference text check (char_length(transfer_reference) <= 120),
  notes text check (char_length(notes) <= 500),
  status text not null default 'pending' check(status in ('pending','reviewed','rejected')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now()
);
create index if not exists coach_payment_reports_coach_idx on public.coach_payment_reports (coach_id,created_at desc);
create index if not exists coach_payment_reports_pending_idx on public.coach_payment_reports (created_at desc) where status='pending';
alter table public.coach_payment_reports enable row level security;
revoke all on public.coach_payment_reports from public,anon,authenticated;

create table if not exists public.coach_client_payables (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id),
  label text not null check (char_length(btrim(label)) between 2 and 140),
  amount_due numeric(12,2) not null check (amount_due > 0 and amount_due <= 10000000),
  due_at timestamptz,
  status text not null default 'open' check(status in ('open','settled','void')),
  admin_note text,
  created_by uuid not null references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists coach_client_payables_member_idx on public.coach_client_payables (member_id,status,due_at);
alter table public.coach_client_payables enable row level security;
revoke all on public.coach_client_payables from public,anon,authenticated;

create or replace function public.coach_payment_tracking_overview()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_coach public.coaches%rowtype; v_clients jsonb;v_receipts jsonb;v_reports jsonb;v_dues jsonb;
begin
 if (select auth.uid()) is null or not exists(
   select 1 from public.profiles where id=(select auth.uid()) and role='coach'
 ) then raise exception 'Coach login required';end if;
 select * into v_coach from public.coaches
 where user_id=(select auth.uid()) and is_active and not is_demo;
 if not found then raise exception 'Active coach not linked';end if;
 -- Admin-set coach_name, assigned booking or verified coach-linked session
 -- proves the member is within this coach's scope. Branch never crosses.
 with linked as (
  select m.id,m.member_code,m.full_name,m.package_name,m.payment_status,m.sessions_left
  from public.members m where m.branch=v_coach.branch and not coalesce(m.is_demo,false)
  and (lower(btrim(coalesce(m.coach_name,'')))=lower(btrim(v_coach.display_name))
   or exists(select 1 from public.coach_historical_session_links l
      join public.session_logs s on s.id=l.session_log_id
      where l.coach_id=v_coach.id and s.member_id=m.id)
   or exists(select 1 from public.bookings b
      where b.member_id=m.id and b.assigned_coach_user_id=v_coach.user_id
      and b.branch=v_coach.branch and b.start_at>now()-interval '90 days'))
 )
 select coalesce(jsonb_agg(jsonb_build_object(
   'member_code',z.member_code,'member_name',z.full_name,'package_name',z.package_name,
   'payment_status',coalesce(z.payment_status,'not recorded'),'sessions_left',z.sessions_left,
   'verified_total',z.verified_total,'open_payable',z.open_payable,
   'payable_count',z.payable_count,'unverified_reports',z.unverified_reports,
   'has_verified_payment',z.has_verified_payment
 ) order by z.full_name),'[]'::jsonb) into v_clients
 from (select l.*,
   (select coalesce(sum(p.amount),0) from public.payments p
      where p.member_id=l.id and lower(p.status)='paid') as verified_total,
   (select coalesce(sum(a.amount_due),0) from public.coach_client_payables a
      where a.member_id=l.id and a.status='open') as open_payable,
   (select count(*) from public.coach_client_payables a
      where a.member_id=l.id and a.status='open') as payable_count,
   (select count(*) from public.coach_payment_reports r
      where r.member_id=l.id and r.coach_id=v_coach.id and r.status='pending') as unverified_reports,
   exists(select 1 from public.payments p
      where p.member_id=l.id and lower(p.status)='paid') as has_verified_payment
 from linked l order by l.full_name limit 100) z;

 with linked as (
  select m.id,m.full_name,m.member_code
  from public.members m where m.branch=v_coach.branch and not coalesce(m.is_demo,false)
  and (lower(btrim(coalesce(m.coach_name,'')))=lower(btrim(v_coach.display_name))
   or exists(select 1 from public.coach_historical_session_links l
      join public.session_logs s on s.id=l.session_log_id
      where l.coach_id=v_coach.id and s.member_id=m.id)
   or exists(select 1 from public.bookings b where b.member_id=m.id
      and b.assigned_coach_user_id=v_coach.user_id and b.branch=v_coach.branch
      and b.start_at>now()-interval '90 days'))
 )
 select coalesce(jsonb_agg(jsonb_build_object(
 'id',v.id,'member_name',v.full_name,'member_code',v.member_code,
 'amount',v.amount,'payment_type',v.payment_type,
 'package_name',v.package_name,'stage',v.stage,'recorded_at',v.recorded_at,
 'status',v.status,'actual_sender_recorded',false
 ) order by v.recorded_at desc),'[]'::jsonb) into v_receipts
 from (select p.id,l.full_name,l.member_code,p.amount,p.payment_type,p.package_name,
 p.stage,p.status,coalesce(p.paid_at,p.payment_date,p.created_at) recorded_at
 from linked l join public.payments p on p.member_id=l.id
 where p.status in ('paid','pending')
 order by recorded_at desc limit 60) v;

 select coalesce(jsonb_agg(jsonb_build_object(
 'id',r.id,'member_name',m.full_name,'member_code',m.member_code,
 'sender',r.reported_sender,'channel',r.channel,'amount',r.amount,
 'transfer_reference',r.transfer_reference,'status',r.status,'created_at',r.created_at
 ) order by r.created_at desc),'[]'::jsonb) into v_reports
 from (select * from public.coach_payment_reports
 where coach_id=v_coach.id order by created_at desc limit 60) r
 join public.members m on m.id=r.member_id;

 with linked as (
  select m.id,m.full_name,m.member_code
  from public.members m where m.branch=v_coach.branch and not coalesce(m.is_demo,false)
  and (lower(btrim(coalesce(m.coach_name,'')))=lower(btrim(v_coach.display_name))
   or exists(select 1 from public.coach_historical_session_links l
      join public.session_logs s on s.id=l.session_log_id
      where l.coach_id=v_coach.id and s.member_id=m.id)
   or exists(select 1 from public.bookings b where b.member_id=m.id
      and b.assigned_coach_user_id=v_coach.user_id and b.branch=v_coach.branch
      and b.start_at>now()-interval '90 days'))
 )
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',a.id,'member_name',l.full_name,'member_code',l.member_code,
   'label',a.label,'amount_due',a.amount_due,'due_at',a.due_at,'status',a.status
 ) order by a.due_at asc nulls last),'[]'::jsonb) into v_dues
 from linked l join public.coach_client_payables a on a.member_id=l.id
 where a.status='open';
 return jsonb_build_object('clients',v_clients,'receipts',v_receipts,
 'reported_transfers',v_reports,'payables',v_dues);
end;$$;
revoke all on function public.coach_payment_tracking_overview() from public,anon;
grant execute on function public.coach_payment_tracking_overview() to authenticated;

create or replace function public.coach_report_client_transfer(
 p_member_code text,p_sender text,p_amount numeric,p_channel text,
 p_transfer_reference text default null,p_notes text default null)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare c public.coaches%rowtype;m public.members%rowtype;v_id uuid;
begin
 if (select auth.uid()) is null or not exists(select 1 from public.profiles
 where id=(select auth.uid()) and role='coach') then raise exception 'Coach required';end if;
 select * into c from public.coaches where user_id=(select auth.uid()) and is_active and not is_demo;
 if not found then raise exception 'Coach account inactive';end if;
 select * into m from public.members where upper(member_code)=upper(btrim(p_member_code));
 if not found or m.branch is distinct from c.branch or m.is_demo
 or not (lower(btrim(coalesce(m.coach_name,'')))=lower(btrim(c.display_name))
  or exists(select 1 from public.coach_historical_session_links l
   join public.session_logs s on s.id=l.session_log_id
   where l.coach_id=c.id and s.member_id=m.id)
  or exists(select 1 from public.bookings b
   where b.member_id=m.id and b.assigned_coach_user_id=c.user_id
   and b.branch=c.branch and b.start_at>now()-interval '90 days'))
 then raise exception 'Member not assigned to coach';end if;
 if p_amount is null or p_amount<=0 or p_amount>10000000
 then raise exception 'Invalid amount';end if;
 if char_length(btrim(coalesce(p_sender,''))) not between 2 and 120
 then raise exception 'Enter sender name (2-120 characters)';end if;
 if p_channel not in ('GCash','Maya','Bank transfer','Cash','Other')
 then raise exception 'Unsupported payment channel';end if;
 if char_length(coalesce(p_transfer_reference,''))>120 or char_length(coalesce(p_notes,''))>500
 then raise exception 'Reference or note too long';end if;
 if nullif(btrim(coalesce(p_transfer_reference,'')),'') is not null and exists (
  select 1 from public.coach_payment_reports r where r.member_id=m.id and r.coach_id=c.id
   and r.channel=p_channel and r.amount=p_amount
   and lower(r.transfer_reference)=lower(btrim(p_transfer_reference))
 ) then raise exception 'A report with this transfer reference already exists';end if;
 insert into public.coach_payment_reports(
  member_id,coach_id,recorded_by,reported_sender,amount,channel,transfer_reference,notes)
 values(m.id,c.id,(select auth.uid()),btrim(p_sender),p_amount,p_channel,
  nullif(btrim(coalesce(p_transfer_reference,'')),''),nullif(btrim(coalesce(p_notes,'')),''))
 returning id into v_id;
 return jsonb_build_object('id',v_id,'status','pending',
 'message','Sent to Admin for verification; no official payment was recorded.');
end;$$;
revoke all on function public.coach_report_client_transfer(text,text,numeric,text,text,text) from public,anon;
grant execute on function public.coach_report_client_transfer(text,text,numeric,text,text,text) to authenticated;

create or replace function public.admin_coach_payment_inbox()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_reports jsonb;v_payables jsonb;
begin
 if not exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin')
 then raise exception 'Admin required';end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',r.id,'coach_name',c.display_name,'member_code',m.member_code,
  'member_name',m.full_name,'sender',r.reported_sender,'amount',r.amount,
  'channel',r.channel,'reference',r.transfer_reference,'notes',r.notes,
  'status',r.status,'created_at',r.created_at,'review_note',r.review_note
 ) order by r.created_at desc),'[]'::jsonb) into v_reports
 from (select * from public.coach_payment_reports order by created_at desc limit 80) r
 join public.members m on m.id=r.member_id join public.coaches c on c.id=r.coach_id;
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',a.id,'member_name',m.full_name,'member_code',m.member_code,
  'label',a.label,'amount_due',a.amount_due,'due_at',a.due_at,'status',a.status
 ) order by a.created_at desc),'[]'::jsonb) into v_payables
 from public.coach_client_payables a join public.members m on m.id=a.member_id
 where a.status='open';
 return jsonb_build_object('reports',v_reports,'payables',v_payables);
end;$$;
revoke all on function public.admin_coach_payment_inbox() from public,anon;
grant execute on function public.admin_coach_payment_inbox() to authenticated;

create or replace function public.admin_record_client_payable(
 p_member_code text,p_amount numeric,p_label text,p_due_at timestamptz default null)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_member uuid;v_id uuid;
begin
 if not exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin')
 then raise exception 'Admin required';end if;
 select id into v_member from public.members
 where upper(member_code)=upper(btrim(p_member_code)) and not coalesce(is_demo,false);
 if v_member is null then raise exception 'Member not found';end if;
 if p_amount is null or p_amount<=0 or p_amount>10000000
 or char_length(btrim(coalesce(p_label,''))) not between 2 and 140
 then raise exception 'Valid amount and payable label required';end if;
 insert into public.coach_client_payables(member_id,label,amount_due,due_at,created_by)
 values(v_member,btrim(p_label),p_amount,p_due_at,(select auth.uid())) returning id into v_id;
 return v_id;
end;$$;
revoke all on function public.admin_record_client_payable(text,numeric,text,timestamptz) from public,anon;
grant execute on function public.admin_record_client_payable(text,numeric,text,timestamptz) to authenticated;

create or replace function public.admin_review_coach_transfer(
 p_report_id uuid,p_status text,p_note text default null)
returns boolean language plpgsql security definer set search_path=''
as $$
begin
 if not exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin')
 then raise exception 'Admin required';end if;
 if p_status not in ('reviewed','rejected') then raise exception 'Invalid review status';end if;
 update public.coach_payment_reports set status=p_status,review_note=left(p_note,500),
  reviewed_at=now(),reviewed_by=(select auth.uid())
 where id=p_report_id and status='pending';
 if not found then raise exception 'Report already reviewed or missing';end if;
 -- "Reviewed" is NOT a verified receipt; official payment must be entered
 -- separately in the existing Admin Payments module.
 return true;
end;$$;
revoke all on function public.admin_review_coach_transfer(uuid,text,text) from public,anon;
grant execute on function public.admin_review_coach_transfer(uuid,text,text) to authenticated;

create or replace function public.admin_close_client_payable(p_id uuid,p_status text)
returns boolean language plpgsql security definer set search_path=''
as $$
begin
 if not exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin')
 then raise exception 'Admin required';end if;
 if p_status not in ('settled','void') then raise exception 'Invalid payable status';end if;
 update public.coach_client_payables set status=p_status,updated_at=now(),updated_by=(select auth.uid())
 where id=p_id and status='open';
 if not found then raise exception 'Payable is already closed or missing';end if;
 return true;
end;$$;
revoke all on function public.admin_close_client_payable(uuid,text) from public,anon;
grant execute on function public.admin_close_client_payable(uuid,text) to authenticated;
