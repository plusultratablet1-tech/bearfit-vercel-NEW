-- BearFit: one proof-backed freeze per package cycle.
-- Does not invent expiration dates or modify any existing member/package row.
create table if not exists public.package_freeze_requests (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id),
  member_package_id uuid not null references public.member_package_cycles(id),
  reason text not null check (reason in ('travel','medical')),
  start_date date not null,
  end_date date not null,
  proof_path text not null,
  details text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  decision_note text,
  approved_days integer,
  original_expires_at timestamptz,
  revised_expires_at timestamptz,
  constraint freeze_date_order check (end_date >= start_date),
  constraint freeze_proof_path_nonempty check (char_length(proof_path) between 5 and 250)
);
create unique index if not exists package_freeze_one_pending
  on public.package_freeze_requests(member_package_id) where status='pending';
create unique index if not exists package_freeze_one_approved
  on public.package_freeze_requests(member_package_id) where status='approved';
create index if not exists package_freeze_member_history
  on public.package_freeze_requests(member_id,requested_at desc);
create index if not exists package_freeze_admin_queue
  on public.package_freeze_requests(status,requested_at desc);
alter table public.package_freeze_requests enable row level security;
revoke all on public.package_freeze_requests from anon, authenticated;
grant select on public.package_freeze_requests to authenticated;
create policy "Member sees only own freeze requests"
  on public.package_freeze_requests for select to authenticated
  using (exists (select 1 from public.members m
                 where m.id=member_id and m.user_id=(select auth.uid())));
create policy "Admin reads freeze requests"
  on public.package_freeze_requests for select to authenticated
  using (exists (select 1 from public.profiles p
                 where p.id=(select auth.uid()) and p.role='admin'));

-- Evidence stays in a PRIVATE bucket. Neither coach nor staff can see it.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('bearfit-freeze-proofs','bearfit-freeze-proofs',false,5242880,
        array['application/pdf','image/jpeg','image/png'])
on conflict (id) do nothing;

create policy "Member uploads their own immutable freeze evidence"
  on storage.objects for insert to authenticated
  with check (
    bucket_id='bearfit-freeze-proofs'
    and (storage.foldername(name))[1]=(select auth.uid()::text)
    and exists (select 1 from public.members m where m.user_id=(select auth.uid()))
  );
create policy "Owner or admin may securely read freeze evidence"
  on storage.objects for select to authenticated
  using (
    bucket_id='bearfit-freeze-proofs'
    and (
      (storage.foldername(name))[1]=(select auth.uid()::text)
      or exists (select 1 from public.profiles p
                 where p.id=(select auth.uid()) and p.role='admin')
    )
  );

-- All writes go through authenticated, permission-checked RPCs.
create or replace function public.member_request_package_freeze(
  p_member_package_id uuid, p_reason text,
  p_start_date date, p_end_date date,
  p_proof_path text, p_details text default null
) returns uuid language plpgsql security definer set search_path='' as $fn$
declare
  v_uid uuid := (select auth.uid());
  v_member uuid;
  v_cycle public.member_package_cycles%rowtype;
  v_validity integer;
  v_days integer;
  v_limit integer;
  v_today date := (now() at time zone 'Asia/Manila')::date;
  v_request uuid;
begin
  if v_uid is null then raise exception 'Member sign-in required'; end if;
  select id into v_member from public.members
    where user_id=v_uid and is_demo=false;
  if v_member is null then raise exception 'Member record not found'; end if;
  if p_reason not in ('travel','medical')
    or p_start_date is null or p_end_date is null or p_end_date<p_start_date
    then raise exception 'Invalid freeze reason or dates'; end if;
  if p_details is not null and length(p_details)>1000
    then raise exception 'Explanation must be 1000 characters or less'; end if;
  if p_proof_path is null or
     p_proof_path !~ ('^'||v_uid::text||'/[0-9a-f-]{36}\.(pdf|png|jpg|jpeg)$')
    then raise exception 'Invalid supporting document path'; end if;
  if not exists (
      select 1 from storage.objects o
      where o.bucket_id='bearfit-freeze-proofs' and o.name=p_proof_path
      and coalesce(o.metadata->>'mimetype','') in
          ('application/pdf','image/jpeg','image/png')
  ) then raise exception 'A valid travel ticket or medical certificate must be uploaded'; end if;

  select * into v_cycle from public.member_package_cycles
    where id=p_member_package_id and member_id=v_member for update;
  if not found or v_cycle.status<>'active'
    then raise exception 'This package is not active or does not belong to your account'; end if;
  if v_cycle.starts_at is null or v_cycle.expires_at is null
    then raise exception 'Package start and expiry dates must first be verified by Admin'; end if;
  if (v_cycle.expires_at at time zone 'Asia/Manila')::date < v_today
    then raise exception 'Expired packages cannot be frozen'; end if;

  select coalesce(pd.validity_days,
      (v_cycle.expires_at at time zone 'Asia/Manila')::date -
      (v_cycle.starts_at at time zone 'Asia/Manila')::date)
    into v_validity from public.package_definitions pd where pd.id=v_cycle.package_id;
  if v_validity is null or v_validity<12
    then raise exception 'Package validity must be confirmed by Admin'; end if;
  v_days:=p_end_date-p_start_date+1;
  v_limit:=least(14,v_validity/4,case when p_reason='travel' then 7 else 14 end);
  if v_days<3 or v_days>v_limit then
    raise exception 'Freeze must be 3 to % calendar days for this package', v_limit; end if;
  if p_start_date < (v_cycle.starts_at at time zone 'Asia/Manila')::date
    or p_end_date > (v_cycle.expires_at at time zone 'Asia/Manila')::date
    then raise exception 'Freeze dates must fall within the existing package validity'; end if;
  if p_reason='travel' and p_start_date<v_today+7
    then raise exception 'Travel requests require at least seven days notice'; end if;
  if p_reason='medical' and p_start_date<v_today-3
    then raise exception 'Medical requests must be filed within 72 hours of the first affected day'; end if;
  if exists (select 1 from public.package_freeze_requests f
             where f.member_package_id=p_member_package_id
               and f.status in ('pending','approved'))
    then raise exception 'This package already has a pending or approved freeze'; end if;
  insert into public.package_freeze_requests
    (member_id,member_package_id,reason,start_date,end_date,proof_path,details)
  values (v_member,p_member_package_id,p_reason,p_start_date,p_end_date,
          p_proof_path,nullif(btrim(p_details),''))
  returning id into v_request;
  return v_request;
end $fn$;

create or replace function public.admin_review_package_freeze(
  p_request_id uuid, p_approve boolean, p_note text default null
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare
  v_uid uuid := (select auth.uid());
  v_request public.package_freeze_requests%rowtype;
  v_cycle public.member_package_cycles%rowtype;
  v_validity integer;
  v_days integer;
  v_limit integer;
  v_new_expiry timestamptz;
begin
  if v_uid is null or not exists
     (select 1 from public.profiles where id=v_uid and role='admin')
     then raise exception 'Only BearFit Admin can decide freeze requests'; end if;
  if p_approve is null then raise exception 'Decision is required'; end if;
  if p_note is not null and length(p_note)>1000
    then raise exception 'Decision note is too long'; end if;
  -- Lock member first to serialize approval with booking and check-in guards.
  select * into v_request from public.package_freeze_requests
    where id=p_request_id;
  if not found then raise exception 'Freeze request not found'; end if;
  perform 1 from public.members where id=v_request.member_id for update;
  select * into v_request from public.package_freeze_requests
    where id=p_request_id for update;
  if v_request.status<>'pending' then raise exception 'Request has already been decided'; end if;
  if not p_approve then
    if length(btrim(coalesce(p_note,'')))<5
      then raise exception 'A rejection reason of at least five characters is required'; end if;
    update public.package_freeze_requests
      set status='rejected',reviewed_at=now(),reviewed_by=v_uid,
          decision_note=btrim(p_note) where id=p_request_id;
    return jsonb_build_object('status','rejected');
  end if;
  if not exists (select 1 from storage.objects o
      where o.bucket_id='bearfit-freeze-proofs' and o.name=v_request.proof_path
        and coalesce(o.metadata->>'mimetype','') in
          ('application/pdf','image/jpeg','image/png'))
    then raise exception 'Supporting evidence is missing'; end if;
  select * into v_cycle from public.member_package_cycles
    where id=v_request.member_package_id and member_id=v_request.member_id for update;
  if not found or v_cycle.status<>'active' or v_cycle.starts_at is null
     or v_cycle.expires_at is null then
      raise exception 'Package is not active or its original dates are unverified'; end if;
  select coalesce(pd.validity_days,
       (v_cycle.expires_at at time zone 'Asia/Manila')::date -
       (v_cycle.starts_at at time zone 'Asia/Manila')::date)
    into v_validity from public.package_definitions pd where pd.id=v_cycle.package_id;
  if v_validity is null or v_validity<12
    then raise exception 'Package validity must be verified'; end if;
  v_days:=v_request.end_date-v_request.start_date+1;
  v_limit:=least(14,v_validity/4,case when v_request.reason='travel' then 7 else 14 end);
  if v_days<3 or v_days>v_limit then raise exception 'Freeze exceeds allowed limits'; end if;
  if v_request.start_date<(v_cycle.starts_at at time zone 'Asia/Manila')::date
    or v_request.end_date>(v_cycle.expires_at at time zone 'Asia/Manila')::date
    then raise exception 'Request dates no longer match package validity'; end if;
  if exists (
    select 1 from public.bookings b where b.member_id=v_request.member_id
      and b.status in ('pending','confirmed')
      and (coalesce(b.start_at,b.requested_start_at) at time zone 'Asia/Manila')::date
        between v_request.start_date and v_request.end_date
  ) then raise exception 'Cancel or reschedule conflicting member bookings before approving'; end if;
  if exists (
    select 1 from public.session_logs s where s.member_id=v_request.member_id
      and (s.trained_at at time zone 'Asia/Manila')::date
         between v_request.start_date and v_request.end_date
  ) then raise exception 'Completed sessions already exist within the requested freeze dates'; end if;

  v_new_expiry:=v_cycle.expires_at+make_interval(days=>v_days);
  update public.member_package_cycles
    set expires_at=v_new_expiry,updated_at=now()
    where id=v_cycle.id;
  update public.package_freeze_requests
    set status='approved',approved_days=v_days,
        original_expires_at=v_cycle.expires_at,revised_expires_at=v_new_expiry,
        reviewed_at=now(),reviewed_by=v_uid,
        decision_note=nullif(btrim(p_note),'')
    where id=p_request_id;
  return jsonb_build_object('status','approved','approved_days',v_days,
    'original_expires_at',v_cycle.expires_at,'revised_expires_at',v_new_expiry);
end $fn$;

-- Strictly block bookings and check-ins on any approved frozen date.
-- Existing bookings must be rescheduled before Admin can approve.
create or replace function private.prevent_training_during_approved_freeze()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare
  v_member uuid;
  v_date date;
begin
  v_member:=new.member_id;
  if tg_table_name='bookings' then
    if new.status not in ('pending','confirmed') then return new; end if;
    v_date:=(coalesce(new.start_at,new.requested_start_at) at time zone 'Asia/Manila')::date;
  else
    v_date:=(new.trained_at at time zone 'Asia/Manila')::date;
  end if;
  if v_date is null then return new; end if;
  perform 1 from public.members where id=v_member for update;
  if exists (select 1 from public.package_freeze_requests f
             where f.member_id=v_member and f.status='approved'
               and v_date between f.start_date and f.end_date)
    then raise exception 'Member package is frozen on this date. Training is not allowed'; end if;
  return new;
end $fn$;
drop trigger if exists bearfit_block_frozen_bookings on public.bookings;
create trigger bearfit_block_frozen_bookings before insert or update
  on public.bookings for each row
  execute function private.prevent_training_during_approved_freeze();
drop trigger if exists bearfit_block_frozen_session_logs on public.session_logs;
create trigger bearfit_block_frozen_session_logs before insert
  on public.session_logs for each row
  execute function private.prevent_training_during_approved_freeze();

revoke all on function public.member_request_package_freeze(uuid,text,date,date,text,text) from public,anon;
revoke all on function public.admin_review_package_freeze(uuid,boolean,text) from public,anon;
grant execute on function public.member_request_package_freeze(uuid,text,date,date,text,text) to authenticated;
grant execute on function public.admin_review_package_freeze(uuid,boolean,text) to authenticated;
revoke all on function private.prevent_training_during_approved_freeze() from public,anon,authenticated;
