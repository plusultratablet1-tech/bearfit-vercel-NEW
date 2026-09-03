-- Member-safe coach directory. Members can see staff/admin names only at their own branch.
create or replace function public.member_coach_directory()
returns table (
  id uuid,
  full_name text,
  branch text
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.full_name, p.branch
  from public.profiles p
  join public.members m on m.user_id = (select auth.uid())
  where p.role in ('staff','admin')
    and p.branch = m.branch
  order by p.full_name;
$$;

revoke all on function public.member_coach_directory() from public, anon;
grant execute on function public.member_coach_directory() to authenticated, service_role;
