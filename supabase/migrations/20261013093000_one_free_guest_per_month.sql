-- One calendar-month free gym visit for every ACTIVE linked member, one per
-- real guest across both branches. Supabase stores no plaintext invitation token.
-- No session balance, booking, Bearforce, payment or coach payroll mutation.
alter table public.guest_invites drop constraint guest_invites_purpose_check;
alter table public.guest_invites add constraint guest_invites_purpose_check
 check(purpose in ('visitor','gym_day','training','trial','xdeal','free_guest'));
alter table public.guest_invites add column guest_phone_normalized text;
alter table public.guest_invites add column host_confirmed_at timestamptz;
create unique index guest_free_per_member_month_uq on public.guest_invites(
 host_member_id,(date_trunc('month',visit_day::timestamp)))
 where purpose='free_guest' and status<>'rejected';
create unique index guest_first_complimentary_phone_uq on public.guest_invites(guest_phone_normalized)
 where purpose in ('free_guest','trial') and status in ('active','redeemed')
 and guest_phone_normalized is not null;
-- Existing guest phone numbers are not verified by SMS. Coach must confirm identity on site.


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
 if p_purpose not in ('visitor','gym_day','training','trial','xdeal','free_guest') or p_purpose is null
 then raise exception 'Invalid guest visit purpose'; end if;
 v_today:=(now() at time zone 'Asia/Manila')::date;
 if p_visit_day is null or p_visit_day<v_today or p_visit_day>v_today+14
 then raise exception 'Choose a visit date within the next 14 days'; end if;
 if p_purpose='free_guest' and exists(
   select 1 from public.guest_invites g
   where g.host_member_id=v_member.id and g.purpose='free_guest'
     and date_trunc('month',g.visit_day::timestamp)=date_trunc('month',p_visit_day::timestamp)
     and g.status<>'rejected'
 ) then raise exception 'This month''s free guest pass has already been reserved'; end if;
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

create or replace function public.guest_register_invitation(
 p_token text,p_guest_name text,p_guest_phone text,p_guest_email text,p_accept_rules boolean
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare v public.guest_invites%rowtype;v_today date;v_new text;v_digits text;v_phone text;
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
 -- Complimentary gym access is for first-time guests only, regardless of host.
 -- Normalize Philippine phone numbers, and serialize competing free/trial claims.
 if v.purpose in ('free_guest','trial') then
   v_digits:=regexp_replace(p_guest_phone,'[^0-9]','','g');
   if length(v_digits)=11 and left(v_digits,2)='09' then
     v_digits:=substring(v_digits from 2);
   elsif length(v_digits)=12 and left(v_digits,3)='639' then
     v_digits:=substring(v_digits from 3);
   end if;
   if length(v_digits)<>10 or left(v_digits,1)<>'9'
   then raise exception 'First-time complimentary guests need a valid Philippine mobile number'; end if;
   v_phone:='63'||v_digits;
   perform pg_advisory_xact_lock(hashtextextended(v_phone,101));
   if v.purpose='free_guest' and exists(
     select 1 from public.guest_invites g where
       g.purpose in ('free_guest','trial') and g.status in ('active','redeemed')
       and g.guest_phone_normalized=v_phone
   ) then raise exception 'This guest has already used a complimentary visit or trial'; end if;
 end if;
 v_new:=case when v.purpose in ('visitor','free_guest') then 'active'
     when v.purpose in ('gym_day','training') then 'pending_payment'
     else 'pending_approval' end;
 update public.guest_invites set
  guest_name=btrim(p_guest_name),guest_phone=btrim(p_guest_phone),
  guest_email=nullif(btrim(coalesce(p_guest_email,'')),''),
  terms_accepted_at=now(),registered_at=now(),status=v_new,
  guest_phone_normalized=v_phone
 where id=v.id;
 insert into public.guest_invite_events(invite_id,action,detail) values
  (v.id,'registered',jsonb_build_object('purpose',v.purpose,'status',v_new));
 return jsonb_build_object('status',v_new,'purpose',v.purpose,'branch',v.branch,
 'visit_day',v.visit_day,'guest_name',btrim(p_guest_name),'access_allowed',v_new='active');
end; $$;

create or replace function public.admin_decide_guest(
 p_invite_id uuid,p_action text,p_note text default null,
 p_payment_reference text default null,p_amount numeric default null
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare v public.guest_invites%rowtype;v_fee numeric;v_today date;v_phone text;
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
     v_phone:=v.guest_phone_normalized;
     if v_phone is null then raise exception 'Trial guest phone must be registered'; end if;
     perform pg_advisory_xact_lock(hashtextextended(v_phone,101));
     if exists(select 1 from public.guest_invites where id<>v.id
         and purpose in ('free_guest','trial') and guest_phone_normalized=v_phone
         and status in ('active','redeemed'))
     then raise exception 'Guest already received a complimentary visit or trial'; end if;
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
declare v public.guest_invites%rowtype;v_user uuid;v_role text;v_branch text;v_host_name text;
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
 if v.purpose='free_guest' and p_redeem and (
    v.host_confirmed_at is null or v.host_confirmed_at<now()-interval '10 minutes'
    or v.host_confirmed_at>now()
 ) then raise exception 'Hosting member must confirm arrival in their BearFit account within 10 minutes'; end if;
 if v.purpose='free_guest' then
   select m.full_name into v_host_name from public.members m where m.id=v.host_member_id;
 end if;
 if p_redeem then
   update public.guest_invites set status='redeemed',entered_at=now(),entered_by=v_user where id=v.id;
   insert into public.guest_invite_events(invite_id,action,actor_id) values(v.id,'entered',v_user);
 end if;
 return jsonb_build_object('status',case when p_redeem then 'redeemed' else 'active' end,
   'guest_name',v.guest_name,'branch',v.branch,'purpose',v.purpose,'visit_day',v.visit_day,
   'hosting_member_name',v_host_name,
   'host_arrival_confirmed',v.host_confirmed_at is not null and v.host_confirmed_at>=now()-interval '10 minutes',
   'permitted_service',case when v.purpose='visitor' then 'Visitor only — NO workout or personal training'
      when v.purpose='gym_day' then 'Gym facilities only — NO coaching'
      when v.purpose='free_guest' then 'Free gym-only benefit — NO coaching; hosting member must accompany guest'
      when v.purpose='training' then 'Paid guest training access — conduction separate'
      else 'Approved complimentary promotion' end);
end; $$;


create or replace function public.member_free_guest_quota(p_visit_day date)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_member public.members%rowtype;v_used integer;v_first date;v_today date;
begin
 if not exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='member')
 then raise exception 'Member login required'; end if;
 select * into v_member from public.members where user_id=(select auth.uid());
 if not found then raise exception 'Linked member not found'; end if;
 v_today:=(now() at time zone 'Asia/Manila')::date;
 if p_visit_day is null or p_visit_day<v_today or p_visit_day>v_today+14
 then raise exception 'Visit date is outside the permitted 14-day window'; end if;
 v_first:=date_trunc('month',p_visit_day::timestamp)::date;
 select count(*) into v_used from public.guest_invites
 where host_member_id=v_member.id and purpose='free_guest'
 and visit_day>=v_first and visit_day<(v_first+interval '1 month')::date
 and status<>'rejected';
 return jsonb_build_object('month',to_char(v_first,'YYYY-MM'),'allowance',1,
   'reserved',v_used,'remaining',greatest(1-v_used,0),'carryover',false,
   'active_member',lower(coalesce(v_member.membership_status,v_member.status,''))='active');
end; $$;

-- The host may release an invitation only while it is unused/unregistered.
create or replace function public.member_cancel_unused_guest(p_invite_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_member public.members%rowtype;v_pass public.guest_invites%rowtype;
begin
 if not exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='member')
 then raise exception 'Member login required'; end if;
 select * into v_member from public.members where user_id=(select auth.uid());
 if not found then raise exception 'Member not linked'; end if;
 select * into v_pass from public.guest_invites
 where id=p_invite_id and host_member_id=v_member.id for update;
 if not found or v_pass.status<>'invited' or v_pass.registered_at is not null
 then raise exception 'Only your own unregistered invitations can be cancelled'; end if;
 update public.guest_invites set status='rejected',
   decision_note='Cancelled by inviting member' where id=v_pass.id;
 insert into public.guest_invite_events(invite_id,action,actor_id)
 values(v_pass.id,'host_cancelled',(select auth.uid()));
 return jsonb_build_object('status','rejected','released',v_pass.purpose='free_guest');
end; $$;

-- Confirms authenticated host presence request shortly before an on-site check.
-- Coach must also visually verify that the host and guest are physically present.
create or replace function public.member_confirm_free_guest_arrival(p_invite_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_member public.members%rowtype;v_pass public.guest_invites%rowtype;
begin
 if not exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='member')
 then raise exception 'Member login required'; end if;
 select * into v_member from public.members where user_id=(select auth.uid());
 if not found or lower(coalesce(v_member.membership_status,v_member.status,''))<>'active'
 then raise exception 'Active linked membership required'; end if;
 select * into v_pass from public.guest_invites
 where id=p_invite_id and host_member_id=v_member.id for update;
 if not found or v_pass.purpose<>'free_guest' or v_pass.status<>'active'
   or v_pass.branch<>v_member.branch
   or v_pass.visit_day<>(now() at time zone 'Asia/Manila')::date
   or now()>=v_pass.expires_at
 then raise exception 'No eligible active free guest pass for today'; end if;
 update public.guest_invites set host_confirmed_at=now() where id=v_pass.id;
 insert into public.guest_invite_events(invite_id,action,actor_id)
 values(v_pass.id,'host_arrival_confirmed',(select auth.uid()));
 return jsonb_build_object('confirmed',true,'valid_for_minutes',10,
    'guest_name',v_pass.guest_name,'branch',v_pass.branch);
end; $$;

revoke all on function public.member_free_guest_quota(date) from public,anon;
revoke all on function public.member_cancel_unused_guest(uuid) from public,anon;
revoke all on function public.member_confirm_free_guest_arrival(uuid) from public,anon;
grant execute on function public.member_free_guest_quota(date) to authenticated;
grant execute on function public.member_cancel_unused_guest(uuid) to authenticated;
grant execute on function public.member_confirm_free_guest_arrival(uuid) to authenticated;
