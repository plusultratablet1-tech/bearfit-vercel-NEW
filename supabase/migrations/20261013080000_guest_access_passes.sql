-- BearFit Bring a Friend: guest registration, independent authorization,
-- approval gates, and one-time coach-verified guest entry.
-- Neither bookings, member package balances nor coach payroll is touched.
create table public.guest_invites (
 id uuid primary key default gen_random_uuid(),
 host_member_id uuid not null references public.members(id) on delete restrict,
 branch text not null check (branch in ('Malingap Branch','E. Rodriguez Branch')),
 visit_day date not null,
 purpose text not null check(purpose in ('visitor','gym_day','training','trial','xdeal')),
 status text not null default 'invited' check(status in ('invited','pending_payment','pending_approval','active','redeemed','rejected')),
 token_hash text not null unique,
 expires_at timestamptz not null,
 guest_name text,
 guest_phone text,
 guest_email text,
 terms_accepted_at timestamptz,
 registered_at timestamptz,
 decision_by uuid references auth.users(id),
 decided_at timestamptz,
 decision_note text,
 payment_reference text,
 amount_verified numeric(12,2),
 entered_at timestamptz,
 entered_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 check (char_length(coalesce(guest_name,'')) <= 120),
 check (char_length(coalesce(guest_phone,'')) <= 35),
 check (char_length(coalesce(guest_email,'')) <= 180),
 check (status in ('invited','rejected') or (registered_at is not null and terms_accepted_at is not null)),
 check (status <> 'redeemed' or (entered_at is not null and entered_by is not null))
);
create index guest_invites_branch_day_idx on public.guest_invites(branch,visit_day,status);
create index guest_invites_member_idx on public.guest_invites(host_member_id,created_at desc);
create unique index guest_invites_verified_reference_uq on public.guest_invites(lower(payment_reference))
  where payment_reference is not null;

create table public.guest_access_prices (
 branch text not null check(branch in ('Malingap Branch','E. Rodriguez Branch')),
 purpose text not null check(purpose in ('gym_day','training')),
 amount numeric(12,2) not null check(amount > 0 and amount <= 50000),
 updated_by uuid not null references auth.users(id),
 updated_at timestamptz not null default now(),
 primary key(branch,purpose)
);
create table public.guest_invite_events (
 id uuid primary key default gen_random_uuid(),
 invite_id uuid not null references public.guest_invites(id) on delete restrict,
 action text not null,
 actor_id uuid references auth.users(id),
 occurred_at timestamptz not null default now(),
 detail jsonb not null default '{}'::jsonb
);
create index guest_invite_events_idx on public.guest_invite_events(invite_id,occurred_at);
alter table public.guest_invites enable row level security;
alter table public.guest_access_prices enable row level security;
alter table public.guest_invite_events enable row level security;
revoke all on public.guest_invites,public.guest_access_prices,public.guest_invite_events from public,anon,authenticated;
grant select on public.guest_invites,public.guest_access_prices,public.guest_invite_events to authenticated;
create policy guest_invites_admin_read on public.guest_invites for select to authenticated
 using(exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));
create policy guest_prices_admin_read on public.guest_access_prices for select to authenticated
 using(exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));
create policy guest_events_admin_read on public.guest_invite_events for select to authenticated
 using(exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));

create or replace function public.member_invite_guest(p_branch text,p_visit_day date,p_purpose text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_member public.members%rowtype;v_today date;v_token text;v_id uuid;v_expires timestamptz;
begin
 if not exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='member')
 then raise exception 'Member login required'; end if;
 select * into v_member from public.members where user_id=(select auth.uid()) for update;
 if not found then raise exception 'Linked member not found'; end if;
 if lower(coalesce(v_member.membership_status,v_member.status,'')) <> 'active'
 then raise exception 'Active membership required to invite a guest'; end if;
 if p_branch is distinct from v_member.branch or p_branch not in ('Malingap Branch','E. Rodriguez Branch')
 then raise exception 'Guest must visit your assigned branch'; end if;
 if p_purpose not in ('visitor','gym_day','training','trial','xdeal') or p_purpose is null
 then raise exception 'Invalid guest visit purpose'; end if;
 v_today:=(now() at time zone 'Asia/Manila')::date;
 if p_visit_day is null or p_visit_day<v_today or p_visit_day>v_today+14
 then raise exception 'Choose a visit date within the next 14 days'; end if;
 if (select count(*) from public.guest_invites where host_member_id=v_member.id
     and visit_day=p_visit_day)>=3
 then raise exception 'Maximum three guest invitations per day'; end if;
 v_token:=encode(extensions.gen_random_bytes(16),'hex');
 v_expires:=((p_visit_day+1)::timestamp at time zone 'Asia/Manila');
 insert into public.guest_invites(host_member_id,branch,visit_day,purpose,token_hash,expires_at)
 values(v_member.id,p_branch,p_visit_day,p_purpose,encode(extensions.digest(v_token,'sha256'),'hex'),v_expires)
 returning id into v_id;
 insert into public.guest_invite_events(invite_id,action,actor_id)
 values(v_id,'invited',(select auth.uid()));
 return jsonb_build_object('id',v_id,'token',v_token,'purpose',p_purpose,'branch',p_branch,
     'visit_day',p_visit_day,'status','invited');
end; $$;

create or replace function public.member_guest_invites()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_member uuid;v_result jsonb;
begin
 if not exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='member')
 then raise exception 'Member login required'; end if;
 select id into v_member from public.members where user_id=(select auth.uid());
 if v_member is null then raise exception 'Member record not found'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'guest_name',g.guest_name,'branch',g.branch,
   'visit_day',g.visit_day,'purpose',g.purpose,'status',g.status,'created_at',g.created_at)
 order by g.created_at desc),'[]'::jsonb) into v_result
 from (select * from public.guest_invites where host_member_id=v_member order by created_at desc limit 30) g;
 return v_result;
end; $$;

-- Invitation bearer token is 128 random bits, stored only as a SHA-256 hash.
-- Guest registration is unauthenticated but does NOT create a member account.
create or replace function public.guest_register_invitation(
 p_token text,p_guest_name text,p_guest_phone text,p_guest_email text,p_accept_rules boolean
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare v public.guest_invites%rowtype;v_today date;v_new text;
begin
 if p_token is null or p_token !~ '^[a-f0-9]{32}$' then raise exception 'Invalid invitation'; end if;
 select * into v from public.guest_invites
 where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') for update;
 if not found or now()>v.expires_at then raise exception 'Invitation has expired or is invalid'; end if;
 if v.status<>'invited' then raise exception 'Invitation has already been registered'; end if;
 v_today:=(now() at time zone 'Asia/Manila')::date;
 if v.visit_day<v_today then raise exception 'Visit date has passed'; end if;
 if not coalesce(p_accept_rules,false) then raise exception 'Guest must accept BearFit facility rules and waiver'; end if;
 if length(btrim(coalesce(p_guest_name,''))) not between 2 and 120
   or length(btrim(coalesce(p_guest_phone,''))) not between 7 and 35
   or p_guest_phone !~ '^[+0-9 ()-]{7,35}$'
 then raise exception 'Enter a valid guest name and mobile number'; end if;
 if p_guest_email is not null and btrim(p_guest_email)<>'' and
   (length(p_guest_email)>180 or p_guest_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
 then raise exception 'Invalid email'; end if;
 v_new:=case when v.purpose='visitor' then 'active'
     when v.purpose in ('gym_day','training') then 'pending_payment'
     else 'pending_approval' end;
 update public.guest_invites set
  guest_name=btrim(p_guest_name),guest_phone=btrim(p_guest_phone),
  guest_email=nullif(btrim(coalesce(p_guest_email,'')),''),
  terms_accepted_at=now(),registered_at=now(),status=v_new
 where id=v.id;
 insert into public.guest_invite_events(invite_id,action,detail) values
  (v.id,'registered',jsonb_build_object('purpose',v.purpose,'status',v_new));
 return jsonb_build_object('status',v_new,'purpose',v.purpose,'branch',v.branch,
 'visit_day',v.visit_day,'guest_name',btrim(p_guest_name),'access_allowed',v_new='active');
end; $$;

create or replace function public.guest_invitation_status(p_token text)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v public.guest_invites%rowtype;v_price numeric;
begin
 if p_token is null or p_token !~ '^[a-f0-9]{32}$' then raise exception 'Invalid invitation'; end if;
 select * into v from public.guest_invites
 where token_hash=encode(extensions.digest(p_token,'sha256'),'hex');
 if not found then raise exception 'Invitation not found'; end if;
 select amount into v_price from public.guest_access_prices
 where branch=v.branch and purpose=v.purpose;
 return jsonb_build_object('status',case when now()>v.expires_at and v.status='active' then 'expired' else v.status end,
  'branch',v.branch,'purpose',v.purpose,'visit_day',v.visit_day,
  'guest_name',v.guest_name,'price_php',v_price,
  'registered',v.registered_at is not null,
  'permitted_service',case when v.purpose='visitor' then 'Visitor only — no exercise or personal training'
         when v.purpose='gym_day' then 'Gym use only — no personal training'
         when v.purpose='training' then 'Guest training access; coach conduction must be recorded separately'
         else 'Admin-approved promotional access only' end);
end; $$;

create or replace function public.admin_set_guest_price(p_branch text,p_purpose text,p_amount numeric)
returns void language plpgsql security definer set search_path=''
as $$
begin
 if not exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin')
 then raise exception 'Admin access required'; end if;
 if p_branch not in ('Malingap Branch','E. Rodriguez Branch') or
   p_purpose not in ('gym_day','training') or p_amount is null
   or p_amount<=0 or p_amount>50000 or p_amount<>round(p_amount,2)
 then raise exception 'Select a valid guest fee and branch'; end if;
 insert into public.guest_access_prices(branch,purpose,amount,updated_by)
 values(p_branch,p_purpose,p_amount,(select auth.uid()))
 on conflict(branch,purpose) do update set
 amount=excluded.amount,updated_by=excluded.updated_by,updated_at=now();
end; $$;

create or replace function public.admin_decide_guest(
 p_invite_id uuid,p_action text,p_note text default null,
 p_payment_reference text default null,p_amount numeric default null
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare v public.guest_invites%rowtype;v_fee numeric;v_today date;
begin
 if not exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin')
 then raise exception 'Admin access required'; end if;
 select * into v from public.guest_invites where id=p_invite_id for update;
 if not found then raise exception 'Guest invitation not found'; end if;
 v_today:=(now() at time zone 'Asia/Manila')::date;
 if v.registered_at is null or v.visit_day<v_today or now()>v.expires_at
 then raise exception 'Guest is unregistered or visit is expired'; end if;
 if p_action='verify_payment' then
   if v.status<>'pending_payment' or v.purpose not in ('gym_day','training')
   then raise exception 'This visit does not require guest day-pass payment'; end if;
   select amount into v_fee from public.guest_access_prices
     where branch=v.branch and purpose=v.purpose;
   if v_fee is null then raise exception 'Configure the official guest price first'; end if;
   if p_amount is null or p_amount<v_fee or p_amount<>round(p_amount,2)
      or p_payment_reference is null or length(btrim(p_payment_reference)) not between 6 and 100
   then raise exception 'Verified payment amount and official reference are required'; end if;
   update public.guest_invites set status='active',decided_at=now(),decision_by=(select auth.uid()),
      amount_verified=p_amount,payment_reference=btrim(p_payment_reference),
      decision_note='Admin manually verified payment' where id=v.id;
 elsif p_action='approve_promotion' then
   if v.status<>'pending_approval' or v.purpose not in ('trial','xdeal')
   then raise exception 'Only trial or X-deal requests can receive promotional approval'; end if;
   if length(btrim(coalesce(p_note,'')))<12 then raise exception 'Admin must document why the service is complimentary'; end if;
   -- One approved trial per phone (regardless of branch or invited host).
   if v.purpose='trial' then
     perform pg_advisory_xact_lock(hashtextextended(lower(v.guest_phone),77));
     if exists(select 1 from public.guest_invites where id<>v.id and purpose='trial'
         and lower(guest_phone)=lower(v.guest_phone)
         and status in ('active','redeemed'))
     then raise exception 'Guest already received an approved trial'; end if;
   end if;
   update public.guest_invites set status='active',decided_at=now(),
     decision_by=(select auth.uid()),decision_note=btrim(p_note) where id=v.id;
 elsif p_action='reject' then
   if v.status not in ('pending_payment','pending_approval','invited')
   then raise exception 'Cannot reject issued or used guest access'; end if;
   if length(btrim(coalesce(p_note,'')))<5 then raise exception 'Provide a rejection reason'; end if;
   update public.guest_invites set status='rejected',decided_at=now(),
     decision_by=(select auth.uid()),decision_note=btrim(p_note) where id=v.id;
 else raise exception 'Unsupported guest decision'; end if;
 insert into public.guest_invite_events(invite_id,action,actor_id,detail)
 values(v.id,p_action,(select auth.uid()),jsonb_build_object('reason',p_note,'payment_reference',p_payment_reference,'amount',p_amount));
 return jsonb_build_object('status',case when p_action='reject' then 'rejected' else 'active' end,'id',v.id);
end; $$;

create or replace function public.coach_check_guest_pass(p_token text,p_redeem boolean default false)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v public.guest_invites%rowtype;v_user uuid;v_role text;v_branch text;
begin
 v_user:=(select auth.uid());
 select role,branch into v_role,v_branch from public.profiles where id=v_user;
 if v_role not in ('coach','staff','admin') or v_role is null then raise exception 'Authorized gym login required'; end if;
 if p_token is null or p_token !~ '^[a-f0-9]{32}$' then raise exception 'Invalid guest pass'; end if;
 select * into v from public.guest_invites
 where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') for update;
 if not found then raise exception 'Guest pass not found'; end if;
 if v_role='coach' then
  select c.branch into v_branch from public.coaches c where c.user_id=v_user and c.is_active;
  if v_branch is null then raise exception 'Linked active coach required'; end if;
  if not exists(select 1 from public.coach_shifts s join public.coaches c on s.coach_id=c.id
    where c.user_id=v_user and s.branch=v_branch and s.clock_out_at is null
      and s.clock_in_at>now()-interval '18 hours')
  then raise exception 'Verified clock-in is required to check guest passes'; end if;
 elsif v_role='staff' and v_branch<>v.branch
 then raise exception 'Wrong staff branch'; end if;
 if v_role<>'admin' and v_branch<>v.branch then raise exception 'Guest pass belongs to another branch'; end if;
 if v.status<>'active' or v.visit_day<>(now() at time zone 'Asia/Manila')::date
   or now()>v.expires_at
 then raise exception 'Guest pass is not active for today'; end if;
 if p_redeem then
   update public.guest_invites set status='redeemed',entered_at=now(),entered_by=v_user where id=v.id;
   insert into public.guest_invite_events(invite_id,action,actor_id) values(v.id,'entered',v_user);
 end if;
 return jsonb_build_object('status',case when p_redeem then 'redeemed' else 'active' end,
   'guest_name',v.guest_name,'branch',v.branch,'purpose',v.purpose,'visit_day',v.visit_day,
   'permitted_service',case when v.purpose='visitor' then 'Visitor only — NO workout or personal training'
      when v.purpose='gym_day' then 'Gym facilities only — NO coaching'
      when v.purpose='training' then 'Paid guest training access — conduction separate'
      else 'Approved complimentary promotion' end);
end; $$;

revoke all on function public.member_invite_guest(text,date,text) from public,anon;
revoke all on function public.member_guest_invites() from public,anon;
revoke all on function public.guest_register_invitation(text,text,text,text,boolean) from public,anon,authenticated;
revoke all on function public.guest_invitation_status(text) from public,anon,authenticated;
revoke all on function public.admin_set_guest_price(text,text,numeric) from public,anon;
revoke all on function public.admin_decide_guest(uuid,text,text,text,numeric) from public,anon;
revoke all on function public.coach_check_guest_pass(text,boolean) from public,anon;
grant execute on function public.member_invite_guest(text,date,text) to authenticated;
grant execute on function public.member_guest_invites() to authenticated;
grant execute on function public.guest_register_invitation(text,text,text,text,boolean) to anon,authenticated;
grant execute on function public.guest_invitation_status(text) to anon,authenticated;
grant execute on function public.admin_set_guest_price(text,text,numeric) to authenticated;
grant execute on function public.admin_decide_guest(uuid,text,text,text,numeric) to authenticated;
grant execute on function public.coach_check_guest_pass(text,boolean) to authenticated;
