-- Coach directory and effective-dated per-member-conduction rates.
-- This migration does not deduct member sessions, generate payroll, or create login accounts.
create table if not exists public.coaches (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (length(btrim(display_name)) between 2 and 120),
  roster_key text generated always as (lower(regexp_replace(btrim(display_name), '\s+', ' ', 'g'))) stored unique,
  branch text not null check (length(btrim(branch)) > 0),
  user_id uuid unique references auth.users(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.coach_rate_history (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches(id) on delete restrict,
  per_conduction_rate numeric(12,2) not null check (per_conduction_rate > 0),
  effective_from date not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint coach_rate_one_change_per_day unique(coach_id, effective_from)
);

create index if not exists coach_rate_history_lookup_idx
  on public.coach_rate_history(coach_id, effective_from desc);

-- Seed unique coach identities only; no rates or user-account links are assumed.
insert into public.coaches(display_name, branch)
select min(btrim(coach_name)), min(branch)
from public.members
where nullif(btrim(coalesce(coach_name,'')),'') is not null
group by lower(regexp_replace(btrim(coach_name), '\s+', ' ', 'g'))
on conflict (roster_key) do nothing;

alter table public.coaches enable row level security;
alter table public.coach_rate_history enable row level security;

-- Staff can view coach identities, but only admins can add or update them.
create policy coaches_read_for_staff on public.coaches for select to authenticated
  using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('staff','admin')));
create policy coaches_insert_by_admin on public.coaches for insert to authenticated
  with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin') and user_id is null);
create policy coaches_update_by_admin on public.coaches for update to authenticated
  using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'))
  with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));

-- Compensation is confidential: staff members cannot read coach rates.
create policy coach_rates_read_by_admin on public.coach_rate_history for select to authenticated
  using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));

revoke all on table public.coaches from anon, authenticated;
grant select, insert on table public.coaches to authenticated;
grant update (branch, is_active) on public.coaches to authenticated;
revoke all on table public.coach_rate_history from anon, authenticated;
grant select on table public.coach_rate_history to authenticated;

-- Append-only rate changes. No overwrite of a historical rate, including same-day rates.
create or replace function public.admin_set_coach_rate(
  p_coach_id uuid,
  p_rate numeric,
  p_effective_from date
) returns uuid
language plpgsql security definer set search_path=''
as $$
declare v_id uuid;
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.profiles where id=(select auth.uid()) and role='admin'
  ) then raise exception 'Admin access required'; end if;
  if p_rate is null or p_rate <= 0 or p_rate > 1000000 or scale(p_rate) > 2 then
    raise exception 'Enter a positive rate with at most two decimals';
  end if;
  if p_effective_from is null or p_effective_from < (now() at time zone 'Asia/Manila')::date then
    raise exception 'Rate changes must take effect today or later';
  end if;
  if not exists(select 1 from public.coaches where id=p_coach_id) then
    raise exception 'Coach not found';
  end if;
  insert into public.coach_rate_history(coach_id,per_conduction_rate,effective_from,created_by)
  values(p_coach_id,p_rate,p_effective_from,(select auth.uid()))
  returning id into v_id;
  return v_id;
end; $$;
revoke all on function public.admin_set_coach_rate(uuid,numeric,date) from public,anon;
grant execute on function public.admin_set_coach_rate(uuid,numeric,date) to authenticated;

-- Never infer identity from a similar coach name. Only an admin can link an
-- authenticated STAFF profile explicitly to a coach after confirming ownership.
create or replace function public.admin_link_coach_account(
  p_coach_id uuid,
  p_user_id uuid
) returns void
language plpgsql security definer set search_path=''
as $$
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.profiles where id=(select auth.uid()) and role='admin'
  ) then raise exception 'Admin access required'; end if;
  if p_user_id is not null and not exists (
    select 1 from public.profiles where id=p_user_id and role='staff'
  ) then raise exception 'Choose an existing staff account';
  end if;
  update public.coaches set user_id=p_user_id, updated_at=now() where id=p_coach_id;
  if not found then raise exception 'Coach not found'; end if;
end; $$;
revoke all on function public.admin_link_coach_account(uuid,uuid) from public,anon;
grant execute on function public.admin_link_coach_account(uuid,uuid) to authenticated;
