create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create sequence if not exists public.member_code_seq start with 1 increment by 1;
revoke all on sequence public.member_code_seq from public, anon, authenticated;
grant usage, select on sequence public.member_code_seq to service_role;

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  member_code text not null unique default ('M' || lpad(nextval('public.member_code_seq')::text, 4, '0')),
  membership_id text unique,
  name text not null,
  full_name text not null,
  email text not null,
  phone text,
  branch text not null default 'Malingap Branch',
  branch_id text,
  package_name text not null default 'Starter',
  package_type text not null default 'Starter',
  package_id text,
  status text not null default 'active',
  membership_status text not null default 'active',
  total_sessions integer not null default 0 check (total_sessions >= 0),
  sessions_used integer not null default 0 check (sessions_used >= 0),
  sessions_left integer not null default 0 check (sessions_left >= 0),
  remaining_sessions integer generated always as (sessions_left) stored,
  payment_status text not null default 'pending',
  last_paid_at timestamptz,
  last_paid_amount numeric(12,2),
  total_paid numeric(12,2) not null default 0,
  join_date timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'staff', 'leads', 'admin')),
  member_id uuid unique references public.members(id) on delete set null,
  full_name text not null,
  phone text,
  avatar_url text,
  membership_id text,
  branch text not null default 'Malingap Branch',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  package_name text,
  stage text,
  amount numeric(12,2) not null default 0 check (amount >= 0),
  status text not null default 'pending',
  payment_type text,
  payment_date timestamptz,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  created_by uuid references auth.users(id) on delete set null
);

create table if not exists public.session_logs (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  staff_user_id uuid references auth.users(id) on delete set null,
  trained_at timestamptz not null default now(),
  notes text,
  sessions_left_after integer not null check (sessions_left_after >= 0),
  created_at timestamptz not null default now()
);

create index if not exists members_user_id_idx on public.members(user_id);
create index if not exists members_member_code_idx on public.members(member_code);
create index if not exists profiles_member_id_idx on public.profiles(member_id);
create index if not exists payments_member_id_idx on public.payments(member_id);
create index if not exists payments_status_idx on public.payments(status);
create index if not exists session_logs_member_id_trained_at_idx on public.session_logs(member_id, trained_at desc);

create or replace function private.is_staff_or_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role in ('staff', 'admin')
  );
$$;

revoke all on function private.is_staff_or_admin() from public, anon;
grant execute on function private.is_staff_or_admin() to authenticated, service_role;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;
grant execute on function public.set_updated_at() to service_role;

create trigger members_set_updated_at
before update on public.members
for each row execute function public.set_updated_at();

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid;
  v_member_code text;
  v_full_name text;
  v_phone text;
begin
  v_full_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1), 'Member');
  v_phone := nullif(trim(new.raw_user_meta_data ->> 'phone'), '');

  insert into public.members (
    user_id,
    name,
    full_name,
    email,
    phone
  )
  values (
    new.id,
    v_full_name,
    v_full_name,
    coalesce(new.email, ''),
    v_phone
  )
  returning id, member_code into v_member_id, v_member_code;

  update public.members
  set membership_id = v_member_code
  where id = v_member_id;

  insert into public.profiles (
    id,
    role,
    member_id,
    full_name,
    phone,
    membership_id
  )
  values (
    new.id,
    'member',
    v_member_id,
    v_full_name,
    v_phone,
    v_member_code
  );

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to service_role;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.members enable row level security;
alter table public.profiles enable row level security;
alter table public.payments enable row level security;
alter table public.session_logs enable row level security;

revoke all on table public.members from anon, authenticated;
revoke all on table public.profiles from anon, authenticated;
revoke all on table public.payments from anon, authenticated;
revoke all on table public.session_logs from anon, authenticated;

grant select on table public.members to authenticated;
grant select on table public.profiles to authenticated;
grant update (full_name, phone, avatar_url) on table public.profiles to authenticated;
grant select, insert, update on table public.payments to authenticated;
grant select, insert on table public.session_logs to authenticated;

grant select, insert, update, delete on table public.members to service_role;
grant select, insert, update, delete on table public.profiles to service_role;
grant select, insert, update, delete on table public.payments to service_role;
grant select, insert, update, delete on table public.session_logs to service_role;

create policy "profiles_select_own_or_staff"
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
  or (select private.is_staff_or_admin())
);

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy "members_select_own_or_staff"
on public.members
for select
to authenticated
using (
  user_id = (select auth.uid())
  or (select private.is_staff_or_admin())
);

create policy "members_update_staff_only"
on public.members
for update
to authenticated
using ((select private.is_staff_or_admin()))
with check ((select private.is_staff_or_admin()));

create policy "payments_select_own_or_staff"
on public.payments
for select
to authenticated
using (
  exists (
    select 1
    from public.members m
    where m.id = payments.member_id
      and m.user_id = (select auth.uid())
  )
  or (select private.is_staff_or_admin())
);

create policy "payments_insert_staff_only"
on public.payments
for insert
to authenticated
with check ((select private.is_staff_or_admin()));

create policy "payments_update_staff_only"
on public.payments
for update
to authenticated
using ((select private.is_staff_or_admin()))
with check ((select private.is_staff_or_admin()));

create policy "session_logs_select_own_or_staff"
on public.session_logs
for select
to authenticated
using (
  exists (
    select 1
    from public.members m
    where m.id = session_logs.member_id
      and m.user_id = (select auth.uid())
  )
  or (select private.is_staff_or_admin())
);

create policy "session_logs_insert_staff_only"
on public.session_logs
for insert
to authenticated
with check ((select private.is_staff_or_admin()));

create or replace function public.staff_qr_checkin(
  p_member_code text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_member public.members%rowtype;
  v_new_sessions_left integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  select role into v_role
  from public.profiles
  where id = (select auth.uid());

  if v_role not in ('staff', 'admin') then
    raise exception 'Staff access required';
  end if;

  select * into v_member
  from public.members
  where upper(member_code) = upper(trim(p_member_code))
  for update;

  if not found then
    raise exception 'Member code not found';
  end if;

  if v_member.sessions_left <= 0 then
    raise exception 'No sessions remaining';
  end if;

  v_new_sessions_left := v_member.sessions_left - 1;

  update public.members
  set sessions_left = v_new_sessions_left,
      sessions_used = sessions_used + 1
  where id = v_member.id;

  insert into public.session_logs (
    member_id,
    staff_user_id,
    trained_at,
    notes,
    sessions_left_after
  )
  values (
    v_member.id,
    (select auth.uid()),
    now(),
    p_notes,
    v_new_sessions_left
  );

  return jsonb_build_object(
    'member_id', v_member.id,
    'member_code', v_member.member_code,
    'new_sessions_left', v_new_sessions_left
  );
end;
$$;

revoke all on function public.staff_qr_checkin(text, text) from public, anon;
grant execute on function public.staff_qr_checkin(text, text) to authenticated, service_role;
