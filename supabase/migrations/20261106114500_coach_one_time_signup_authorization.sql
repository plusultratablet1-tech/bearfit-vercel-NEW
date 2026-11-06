-- Secure one-time approval for reserved coach accounts. Never grant public or
-- authenticated direct access to the nonce table.
create schema if not exists private;
create table if not exists private.coach_signup_authorizations (
  token_hash text primary key,
  coach_id uuid not null references public.coaches(id) on delete cascade,
  username text not null,
  issued_by uuid not null references auth.users(id),
  expires_at timestamptz not null,
  used_at timestamptz
);
revoke all on private.coach_signup_authorizations from public, anon, authenticated;

create or replace function public.admin_issue_coach_signup_token(p_coach_id uuid)
returns text
language plpgsql security definer set search_path=''
as $$
declare
  v_coach public.coaches%rowtype;
  v_token text;
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.profiles where id=(select auth.uid()) and role='admin'
  ) then raise exception 'Admin access required'; end if;
  select * into v_coach from public.coaches where id=p_coach_id for update;
  if not found or not v_coach.is_active or v_coach.is_demo or v_coach.user_id is not null
    or v_coach.username !~ '^coach[1-9][0-9]{0,5}$' then
    raise exception 'Coach is not eligible for signup';
  end if;
  -- UUIDv4 is cryptographically random in Postgres. Two UUIDs provide 244 bits.
  v_token := replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
  delete from private.coach_signup_authorizations
    where coach_id=p_coach_id and used_at is null;
  insert into private.coach_signup_authorizations(token_hash,coach_id,username,issued_by,expires_at)
    values (encode(sha256(convert_to(v_token,'UTF8')),'hex'),p_coach_id,v_coach.username,
            (select auth.uid()),now()+interval '5 minutes');
  return v_token;
end;
$$;
revoke all on function public.admin_issue_coach_signup_token(uuid) from public, anon;
grant execute on function public.admin_issue_coach_signup_token(uuid) to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path=''
as $$
declare
  v_member_id uuid;
  v_member_code text;
  v_full_name text;
  v_phone text;
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
    -- Atomically consume exactly one authorization for the exact coach username.
    -- The normal signup route cannot issue tokens or bypass this condition.
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

  insert into public.members(user_id,name,full_name,email,phone)
    values(new.id,v_full_name,v_full_name,coalesce(new.email,''),v_phone)
    returning id,member_code into v_member_id,v_member_code;
  update public.members set membership_id=v_member_code where id=v_member_id;
  insert into public.profiles(id,role,member_id,full_name,phone,membership_id)
    values(new.id,'member',v_member_id,v_full_name,v_phone,v_member_code);
  return new;
end;
$$;
