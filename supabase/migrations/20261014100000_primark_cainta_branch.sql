-- Register Primark Cainta as a third branch without changing existing members,
-- guest pricing, sessions, bookings or financial history.
-- Guest prices start UNCONFIGURED; Admin must set actual fees before paid passes.
alter table public.guest_invites drop constraint if exists guest_invites_branch_check;
alter table public.guest_invites add constraint guest_invites_branch_check
 check (branch in ('Malingap Branch','E. Rodriguez Branch','Primark Cainta'));
alter table public.guest_access_prices drop constraint if exists guest_access_prices_branch_check;
alter table public.guest_access_prices add constraint guest_access_prices_branch_check
 check (branch in ('Malingap Branch','E. Rodriguez Branch','Primark Cainta'));

-- Extend the approved-branch validators, preserving the full, existing protected
-- logic inside each SECURITY DEFINER routine (including authorization, eligibility,
-- per-member limits, and audit history). CREATE OR REPLACE retains function grants.
do $$
declare
 target text;
 definition text;
 old_list text := '''Malingap Branch'',''E. Rodriguez Branch''';
 new_list text := '''Malingap Branch'',''E. Rodriguez Branch'',''Primark Cainta''';
begin
 foreach target in array array[
  'admin_edit_member_profile','admin_set_guest_price',
  'member_invite_guest','issue_coach_branch_code'
 ] loop
  select pg_get_functiondef(p.oid) into definition
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname=target and p.prokind='f';
  if definition is null then
   raise exception 'Required function % not found; refusing partial branch setup',target;
  end if;
  if position(old_list in definition)=0 then
   raise exception 'Unexpected branch validator in function %; review before migration',target;
  end if;
  definition:=replace(definition,old_list,new_list);
  execute definition;
 end loop;
end $$;
