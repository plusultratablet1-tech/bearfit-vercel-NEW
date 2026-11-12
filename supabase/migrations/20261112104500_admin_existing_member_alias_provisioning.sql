-- BearFit: safely provision existing member IDs as reserved Auth username aliases.
-- No member/session/payment rows are created or deleted by this migration.
create table if not exists private.member_signup_authorizations (
 token_hash text primary key,
 member_id uuid not null references public.members(id) on delete cascade,
 member_code text not null,
 issued_by uuid not null references auth.users(id),
 expires_at timestamptz not null,
 used_at timestamptz,
 created_at timestamptz not null default now()
);
create index if not exists member_signup_authorizations_member_idx
 on private.member_signup_authorizations(member_id,expires_at);
revoke all on private.member_signup_authorizations from public,anon,authenticated;
alter table private.member_signup_authorizations enable row level security;

create or replace function public.admin_issue_member_signup_token(p_member_id uuid)
returns text language plpgsql security definer set search_path = ''
as $fn$
declare
 v_member public.members%rowtype;
 v_token text;
begin
 if (select auth.uid()) is null or not exists (
  select 1 from public.profiles
  where id=(select auth.uid()) and role='admin'
 ) then raise exception 'Admin access required'; end if;
 select * into v_member from public.members where id=p_member_id for update;
 if not found or v_member.branch <> 'Malingap Branch'
    or coalesce(v_member.is_demo,false)
    or v_member.user_id is not null
    or v_member.member_code !~ '^M[0-9]{4,6}$'
 then raise exception 'Member is not eligible for login creation'; end if;
 v_token := replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
 delete from private.member_signup_authorizations
  where member_id=p_member_id and used_at is null;
 insert into private.member_signup_authorizations
  (token_hash,member_id,member_code,issued_by,expires_at)
 values (encode(sha256(convert_to(v_token,'UTF8')),'hex'),
         p_member_id,v_member.member_code,(select auth.uid()),now()+interval '5 minutes');
 return v_token;
end;
$fn$;
revoke all on function public.admin_issue_member_signup_token(uuid) from public,anon;
grant execute on function public.admin_issue_member_signup_token(uuid) to authenticated;

-- Keep coach authorization exactly as before. A member alias MUST have
-- a one-time admin-issued token for the specific existing member; public
-- signups cannot claim a public membership ID or create a duplicate record.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $fn$
declare
  v_member_id uuid;
  v_member_code text;
  v_full_name text;
  v_phone text;
  v_branch text;
  v_signup_token text;
  v_authorized_coach uuid;
begin
  v_full_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1), 'Member');
  v_phone := nullif(trim(new.raw_user_meta_data ->> 'phone'), '');

  if lower(split_part(new.email,'@',2)) = 'accounts.bearfit.invalid' then
    v_signup_token := nullif(new.raw_user_meta_data ->> 'bearfit_coach_signup_token','');
    if lower(split_part(new.email,'@',1)) !~ '^coach[1-9][0-9]{0,5}$'
       or v_signup_token is null or length(v_signup_token) <> 64 then
      raise exception 'Reserved coach logins must be provisioned by BearFit Admin';
    end if;
    update private.coach_signup_authorizations a
      set used_at=now()
      where a.token_hash=encode(sha256(convert_to(v_signup_token,'UTF8')),'hex')
        and a.username=lower(split_part(new.email,'@',1))
        and a.used_at is null and a.expires_at>now()
        and exists (
          select 1 from public.coaches c where c.id=a.coach_id
            and c.username=a.username and c.is_active and not c.is_demo
            and c.user_id is null
        )
      returning a.coach_id into v_authorized_coach;
    if v_authorized_coach is null then
      raise exception 'Reserved coach logins must be provisioned by BearFit Admin';
    end if;
    insert into public.profiles(id,role,member_id,full_name,phone)
      values(new.id,'coach',null,v_full_name,v_phone);
    return new;
  end if;

  if lower(split_part(new.email,'@',2)) = 'members.bearfit.invalid' then
    v_signup_token := nullif(new.raw_user_meta_data ->> 'bearfit_member_signup_token','');
    if upper(split_part(new.email,'@',1)) !~ '^M[0-9]{4,6}$'
       or v_signup_token is null or length(v_signup_token) <> 64 then
      raise exception 'Reserved member logins must be provisioned by BearFit Admin';
    end if;

    update private.member_signup_authorizations a
      set used_at=now()
      where a.token_hash=encode(sha256(convert_to(v_signup_token,'UTF8')),'hex')
        and a.member_code=upper(split_part(new.email,'@',1))
        and a.used_at is null and a.expires_at>now()
        and exists (
          select 1 from public.members m where m.id=a.member_id
            and m.member_code=a.member_code and m.branch='Malingap Branch'
            and not coalesce(m.is_demo,false) and m.user_id is null
        )
      returning a.member_id into v_member_id;
    if v_member_id is null then
      raise exception 'Reserved member logins must be provisioned by BearFit Admin';
    end if;

    -- Atomic: this UPDATE and profile creation live inside the Auth INSERT
    -- transaction. If any step fails, the new login is rejected and NO
    -- existing member record is overwritten, renamed or replaced.
    update public.members
      set user_id=new.id
      where id=v_member_id and user_id is null
        and member_code=upper(split_part(new.email,'@',1))
      returning member_code,full_name,phone,branch
      into v_member_code,v_full_name,v_phone,v_branch;
    if v_member_code is null then raise exception 'Existing member link was not available'; end if;

    insert into public.profiles(id,role,member_id,full_name,phone,membership_id,branch)
      values(new.id,'member',v_member_id,v_full_name,v_phone,v_member_code,v_branch);
    return new;
  end if;

  -- Keep normal public email registration unchanged for non-reserved emails.
  insert into public.members(user_id,name,full_name,email,phone)
    values(new.id,v_full_name,v_full_name,coalesce(new.email,''),v_phone)
    returning id,member_code into v_member_id,v_member_code;
  update public.members set membership_id=v_member_code where id=v_member_id;
  insert into public.profiles(id,role,member_id,full_name,phone,membership_id)
    values(new.id,'member',v_member_id,v_full_name,v_phone,v_member_code);
  return new;
end;
$fn$;
