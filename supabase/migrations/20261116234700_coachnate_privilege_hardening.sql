-- CoachNate privilege hardening.
-- Supabase default privileges on new public objects must not leave anonymous
-- SELECT or DML access, even when row-level security would deny each row.
revoke all privileges on table public.coach_branch_access from public, anon, authenticated;
grant select on table public.coach_branch_access to authenticated;
grant select, insert, delete on table public.coach_branch_access to service_role;

-- Authenticated callers can invoke only after the Admin-role check within
-- the SECURITY DEFINER function. Anonymous callers have no EXECUTE permission.
revoke all on function public.admin_plan_coach_shift(uuid,timestamptz,timestamptz,text)
  from public, anon, authenticated;
grant execute on function public.admin_plan_coach_shift(uuid,timestamptz,timestamptz,text)
  to authenticated;
