-- Simple username aliases for existing BearFit coaches. User accounts are provisioned
-- only by an authenticated admin action, with unique random passwords, never by migration.
alter table public.coaches add column if not exists username text;
alter table public.coaches add constraint coaches_username_format_chk
  check (username is null or username ~ '^coach[1-9][0-9]{0,5}$');
create unique index if not exists coaches_username_unique_idx
  on public.coaches (lower(username)) where username is not null;

-- Deliberate initial mappings from the existing verified member roster.
update public.coaches set username='coach1',updated_at=now()
  where roster_key='amiel' and username is null;
update public.coaches set username='coach2',updated_at=now()
  where roster_key='joaquin' and username is null;
update public.coaches set username='coach3',updated_at=now()
  where roster_key='andrei' and username is null;
update public.coaches set username='coach4',updated_at=now()
  where roster_key='hunejin' and username is null;

-- A coach must NOT inherit broad staff/admin privileges.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('member','staff','leads','admin','coach'));

-- Allow explicit linking to a restricted coach profile as well as staff,
-- without enabling any coach to self-assign to a different coach record.
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
    select 1 from public.profiles where id=p_user_id and role in ('staff','coach')
  ) then raise exception 'Choose a verified coach or staff account';
  end if;
  update public.coaches set user_id=p_user_id, updated_at=now() where id=p_coach_id;
  if not found then raise exception 'Coach not found'; end if;
end; $$;
revoke all on function public.admin_link_coach_account(uuid,uuid) from public,anon;
grant execute on function public.admin_link_coach_account(uuid,uuid) to authenticated;

-- Linked coaches may see only their own coach name, branch and username.
-- They are not permitted to view other coaches' records or any pay rates.
create policy coaches_select_own_login on public.coaches for select to authenticated
  using (user_id=(select auth.uid()));


-- BearFit normally inserts a MEMBER and PROFILE for every auth signup.
-- Restricted coach auth users must receive only a coach PROFILE.
-- The reserved domain is forbidden to public email signup, including
-- direct Auth API callers; only service-role-created coach logins can pass.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path=''
as $$
declare
  v_member_id uuid;
  v_member_code text;
  v_full_name text;
  v_phone text;
begin
  v_full_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1), 'Member');
  v_phone := nullif(trim(new.raw_user_meta_data ->> 'phone'), '');

  if lower(split_part(new.email,'@',2)) = 'accounts.bearfit.invalid' then
    if not coalesce((new.raw_app_meta_data ->> 'bearfit_coach_login')::boolean,false)
       or lower(split_part(new.email,'@',1)) !~ '^coach[1-9][0-9]{0,5}$' then
      raise exception 'Reserved coach logins must be provisioned by BearFit Admin';
    end if;

    insert into public.profiles(id,role,member_id,full_name,phone)
    values(new.id,'coach',null,v_full_name,v_phone);
    return new;
  end if;

  -- Existing member signup remains unchanged for real member emails.
  insert into public.members(user_id,name,full_name,email,phone)
  values(new.id,v_full_name,v_full_name,coalesce(new.email,''),v_phone)
  returning id,member_code into v_member_id,v_member_code;

  update public.members set membership_id=v_member_code where id=v_member_id;

  insert into public.profiles(id,role,member_id,full_name,phone,membership_id)
  values(new.id,'member',v_member_id,v_full_name,v_phone,v_member_code);

  return new;
end; $$;
