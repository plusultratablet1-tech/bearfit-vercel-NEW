-- Admin-only audited member profile updates, separate from financial and package flows.
alter table public.members add column if not exists address text;
alter table public.members add column if not exists emergency_contact_name text;
alter table public.members add column if not exists emergency_contact_phone text;
create table if not exists public.member_profile_edit_events(
 id uuid primary key default gen_random_uuid(),
 member_id uuid not null references public.members(id) on delete restrict,
 admin_user_id uuid not null references auth.users(id),
 changed_at timestamptz not null default now(),
 previous_values jsonb not null,
 new_values jsonb not null,
 reason text not null
);
create index if not exists member_profile_edit_events_member_idx on public.member_profile_edit_events(member_id,changed_at desc);
alter table public.member_profile_edit_events enable row level security;
revoke all on public.member_profile_edit_events from public,anon,authenticated;
grant select on public.member_profile_edit_events to authenticated;
create policy member_edit_history_admin_read on public.member_profile_edit_events for select to authenticated
 using(exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));

create or replace function public.admin_edit_member_profile(
 p_member_id uuid,p_expected_updated_at timestamptz,
 p_full_name text,p_email text,p_phone text,p_address text,
 p_emergency_name text,p_emergency_phone text,
 p_branch text,p_coach_name text,p_membership_status text,p_reason text
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 v_old public.members%rowtype;
 v_new public.members%rowtype;
 v_before jsonb;v_after jsonb;v_user uuid;
 v_name text;v_email text;v_phone text;v_addr text;v_ecname text;v_ecphone text;
 v_coach text;v_status text;
begin
 v_user:=(select auth.uid());
 if not exists(select 1 from public.profiles where id=v_user and role='admin')
 then raise exception 'Admin permission required';end if;
 if p_member_id is null or p_expected_updated_at is null
 then raise exception 'Member ID and record version are required';end if;
 v_name:=btrim(coalesce(p_full_name,''));
 v_email:=nullif(lower(btrim(coalesce(p_email,''))),'');
 v_phone:=nullif(btrim(coalesce(p_phone,'')),'');
 v_addr:=nullif(btrim(coalesce(p_address,'')),'');
 v_ecname:=nullif(btrim(coalesce(p_emergency_name,'')),'');
 v_ecphone:=nullif(btrim(coalesce(p_emergency_phone,'')),'');
 v_coach:=nullif(btrim(coalesce(p_coach_name,'')),'');
 v_status:=btrim(coalesce(p_membership_status,''));
 if char_length(v_name) not between 2 and 120 then raise exception 'Name must be 2–120 characters';end if;
 if v_email is not null and (char_length(v_email)>180 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then raise exception 'Invalid email';end if;
 if v_phone is not null and (char_length(v_phone)>35 or v_phone !~ '^[+0-9 ()-]{7,35}$') then raise exception 'Invalid phone';end if;
 if v_ecphone is not null and (char_length(v_ecphone)>35 or v_ecphone !~ '^[+0-9 ()-]{7,35}$') then raise exception 'Invalid emergency phone';end if;
 if v_addr is not null and length(v_addr)>350 then raise exception 'Address too long';end if;
 if v_ecname is not null and length(v_ecname)>120 then raise exception 'Emergency contact name too long';end if;
 if p_branch not in ('Malingap Branch','E. Rodriguez Branch') or p_branch is null
 then raise exception 'Invalid branch';end if;
 if v_status not in ('active','inactive','paused','renewal_due','unknown')
 then raise exception 'Unsupported membership status';end if;
 if length(btrim(coalesce(p_reason,''))) not between 8 and 500
 then raise exception 'Provide an edit reason (8–500 characters)';end if;
 if v_coach is not null and not exists(
   select 1 from public.coaches c where c.branch=p_branch and c.is_active
   and c.display_name=v_coach
 ) then raise exception 'Select an active coach assigned to the selected branch';end if;
 select * into v_old from public.members where id=p_member_id for update;
 if not found then raise exception 'Member not found';end if;
 if v_old.updated_at is distinct from p_expected_updated_at
 then raise exception 'Member profile was modified. Refresh before saving';end if;
 if p_branch is distinct from v_old.branch and (
  exists(select 1 from public.bookings b where b.member_id=p_member_id and b.status in ('pending','confirmed')
    and coalesce(b.start_at,b.requested_start_at)>now())
  or exists(select 1 from public.guest_invites g where g.host_member_id=p_member_id
    and g.status in ('invited','active','pending_payment','pending_approval')
    and g.visit_day >= (now() at time zone 'Asia/Manila')::date)
 ) then raise exception 'Cannot move branches while future bookings or open guest passes exist';end if;
 v_before:=jsonb_build_object('full_name',v_old.full_name,'email',v_old.email,'phone',v_old.phone,
  'address',v_old.address,'emergency_contact_name',v_old.emergency_contact_name,
  'emergency_contact_phone',v_old.emergency_contact_phone,'branch',v_old.branch,
  'coach_name',v_old.coach_name,'membership_status',v_old.membership_status);
 v_after:=jsonb_build_object('full_name',v_name,'email',v_email,'phone',v_phone,
  'address',v_addr,'emergency_contact_name',v_ecname,
  'emergency_contact_phone',v_ecphone,'branch',p_branch,
  'coach_name',v_coach,'membership_status',v_status);
 if v_before=v_after then return jsonb_build_object('changed',false,'message','No fields changed');end if;
 update public.members set
  full_name=v_name,name=v_name,email=v_email,phone=v_phone,address=v_addr,
  emergency_contact_name=v_ecname,emergency_contact_phone=v_ecphone,
  branch=p_branch,coach_name=v_coach,membership_status=v_status,status=v_status,
  updated_at=now()
 where id=p_member_id returning * into v_new;
 -- Preserve identity and login credentials; this only syncs display/branch fields.
 update public.profiles set full_name=v_name,phone=v_phone,branch=p_branch,updated_at=now()
 where member_id=p_member_id and role='member';
 insert into public.member_profile_edit_events(member_id,admin_user_id,previous_values,new_values,reason)
 values(p_member_id,v_user,v_before,v_after,btrim(p_reason));
 return jsonb_build_object('changed',true,'member_id',p_member_id,'updated_at',v_new.updated_at);
end;$$;
revoke all on function public.admin_edit_member_profile(uuid,timestamptz,text,text,text,text,text,text,text,text,text,text) from public,anon;
grant execute on function public.admin_edit_member_profile(uuid,timestamptz,text,text,text,text,text,text,text,text,text,text) to authenticated;
