-- Record original package date verification without overwriting existing expiry.
create table if not exists public.package_freeze_date_verifications (
  id uuid primary key default gen_random_uuid(),
  member_package_id uuid not null references public.member_package_cycles(id),
  verified_by uuid not null references auth.users(id),
  verified_at timestamptz not null default now(),
  verified_start_at timestamptz not null,
  verified_expires_at timestamptz not null,
  evidence_reference text not null check (length(btrim(evidence_reference)) between 8 and 500)
);
create unique index if not exists freeze_date_verified_once
  on public.package_freeze_date_verifications(member_package_id);
alter table public.package_freeze_date_verifications enable row level security;
revoke all on public.package_freeze_date_verifications from anon,authenticated;
grant select on public.package_freeze_date_verifications to authenticated;
create policy "Only admins read date-verification audit"
  on public.package_freeze_date_verifications for select to authenticated
  using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));

create or replace function public.admin_verify_package_freeze_dates(
  p_member_package_id uuid,p_start_date date,p_expiry_date date,p_evidence_reference text
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare
  v_uid uuid := (select auth.uid());
  v_cycle public.member_package_cycles%rowtype;
  v_start timestamptz;
  v_expiry timestamptz;
begin
  if v_uid is null or not exists(select 1 from public.profiles p
          where p.id=v_uid and p.role='admin') then
    raise exception 'Only BearFit Admin can verify package dates'; end if;
  if p_start_date is null or p_expiry_date is null or p_start_date>p_expiry_date
     or p_start_date>current_date+365
     or p_expiry_date>current_date+3650
     or length(btrim(coalesce(p_evidence_reference,''))) not between 8 and 500
     then raise exception 'Provide valid dates and a verified contract/reference (8-500 characters)'; end if;
  select * into v_cycle from public.member_package_cycles
    where id=p_member_package_id for update;
  if not found or v_cycle.status<>'active'
    then raise exception 'Only an existing active package cycle can be verified'; end if;
  if v_cycle.expires_at is not null
    then raise exception 'An expiry is already recorded; this function never overwrites it'; end if;
  if v_cycle.starts_at is not null and
     (v_cycle.starts_at at time zone 'Asia/Manila')::date<>p_start_date
    then raise exception 'The package already has a different start date; investigate before changing'; end if;
  if exists(select 1 from public.package_freeze_requests f
        where f.member_package_id=p_member_package_id)
    then raise exception 'Package already has freeze request history; review it manually'; end if;
  v_start:=(p_start_date::timestamp at time zone 'Asia/Manila');
  v_expiry:=((p_expiry_date+1)::timestamp at time zone 'Asia/Manila')-interval '1 second';
  update public.member_package_cycles
    set starts_at=coalesce(starts_at,v_start),
        expires_at=v_expiry,updated_at=now()
    where id=v_cycle.id and expires_at is null;
  insert into public.package_freeze_date_verifications
    (member_package_id,verified_by,verified_start_at,verified_expires_at,evidence_reference)
  values(v_cycle.id,v_uid,coalesce(v_cycle.starts_at,v_start),v_expiry,btrim(p_evidence_reference));
  return jsonb_build_object('verified',true,'member_package_id',v_cycle.id,
         'expires_at',v_expiry);
end $fn$;
revoke all on function public.admin_verify_package_freeze_dates(uuid,date,date,text) from public,anon;
grant execute on function public.admin_verify_package_freeze_dates(uuid,date,date,text) to authenticated;
