-- BearFit staff payment + check-in workflow.
-- Sessions are credited only when a payment becomes paid, and only once.

alter table public.payments
  add column if not exists sessions_purchased integer not null default 0 check (sessions_purchased >= 0),
  add column if not exists credit_applied_at timestamptz;

-- Payment writes go through staff RPCs so payment status + session credits stay atomic.
revoke insert, update, delete on table public.payments from authenticated;
grant select on table public.payments to authenticated;

create or replace function public.staff_mark_payment_paid(p_payment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
  v_now timestamptz := now();
  v_sessions_left integer;
  v_total_sessions integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  if not (select private.is_staff_or_admin()) then
    raise exception 'Staff access required';
  end if;

  select * into v_payment
  from public.payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'Payment not found';
  end if;

  if lower(coalesce(v_payment.status, 'pending')) <> 'paid' then
    update public.payments
    set status = 'paid',
        paid_at = coalesce(paid_at, v_now),
        payment_date = coalesce(payment_date, v_now)
    where id = v_payment.id;

    v_payment.status := 'paid';
    v_payment.paid_at := coalesce(v_payment.paid_at, v_now);
  end if;

  -- Idempotency guard: sessions and payment totals are credited at most once.
  if v_payment.credit_applied_at is null then
    update public.members
    set payment_status = 'paid',
        last_paid_at = coalesce(v_payment.paid_at, v_now),
        last_paid_amount = v_payment.amount,
        total_paid = total_paid + coalesce(v_payment.amount, 0),
        package_name = coalesce(nullif(v_payment.package_name, ''), package_name),
        package_type = coalesce(nullif(v_payment.package_name, ''), package_type),
        total_sessions = total_sessions + v_payment.sessions_purchased,
        sessions_left = sessions_left + v_payment.sessions_purchased
    where id = v_payment.member_id
    returning sessions_left, total_sessions
      into v_sessions_left, v_total_sessions;

    if not found then
      raise exception 'Member not found';
    end if;

    update public.payments
    set credit_applied_at = v_now
    where id = v_payment.id;
  else
    select sessions_left, total_sessions
      into v_sessions_left, v_total_sessions
    from public.members
    where id = v_payment.member_id;
  end if;

  return jsonb_build_object(
    'payment_id', v_payment.id,
    'member_id', v_payment.member_id,
    'status', 'paid',
    'sessions_purchased', v_payment.sessions_purchased,
    'sessions_left', v_sessions_left,
    'total_sessions', v_total_sessions,
    'credit_applied', v_payment.credit_applied_at is null
  );
end;
$$;

revoke all on function public.staff_mark_payment_paid(uuid) from public, anon;
grant execute on function public.staff_mark_payment_paid(uuid) to authenticated, service_role;

create or replace function public.staff_record_payment(
  p_member_id uuid,
  p_package_name text,
  p_stage text,
  p_amount numeric,
  p_sessions_purchased integer,
  p_payment_type text default null,
  p_status text default 'pending'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment_id uuid;
  v_status text := lower(trim(coalesce(p_status, 'pending')));
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  if not (select private.is_staff_or_admin()) then
    raise exception 'Staff access required';
  end if;

  if v_status not in ('pending', 'paid') then
    raise exception 'Payment status must be pending or paid';
  end if;

  if coalesce(p_amount, 0) < 0 then
    raise exception 'Amount cannot be negative';
  end if;

  if coalesce(p_sessions_purchased, 0) < 0 then
    raise exception 'Sessions purchased cannot be negative';
  end if;

  if not exists (select 1 from public.members where id = p_member_id) then
    raise exception 'Member not found';
  end if;

  insert into public.payments (
    member_id,
    package_name,
    stage,
    amount,
    sessions_purchased,
    status,
    payment_type,
    created_by
  ) values (
    p_member_id,
    nullif(trim(p_package_name), ''),
    nullif(trim(p_stage), ''),
    coalesce(p_amount, 0),
    coalesce(p_sessions_purchased, 0),
    v_status,
    nullif(trim(coalesce(p_payment_type, '')), ''),
    (select auth.uid())
  )
  returning id into v_payment_id;

  if v_status = 'paid' then
    return public.staff_mark_payment_paid(v_payment_id);
  end if;

  return jsonb_build_object(
    'payment_id', v_payment_id,
    'member_id', p_member_id,
    'status', 'pending',
    'sessions_purchased', coalesce(p_sessions_purchased, 0),
    'credit_applied', false
  );
end;
$$;

revoke all on function public.staff_record_payment(uuid, text, text, numeric, integer, text, text) from public, anon;
grant execute on function public.staff_record_payment(uuid, text, text, numeric, integer, text, text) to authenticated, service_role;

-- Keep QR check-in atomic and reject inactive memberships.
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

  if lower(coalesce(v_member.membership_status, v_member.status, 'inactive')) <> 'active'
     or lower(coalesce(v_member.status, 'inactive')) <> 'active' then
    raise exception 'Membership is not active';
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
  ) values (
    v_member.id,
    (select auth.uid()),
    now(),
    nullif(trim(coalesce(p_notes, '')), ''),
    v_new_sessions_left
  );

  return jsonb_build_object(
    'member_id', v_member.id,
    'member_code', v_member.member_code,
    'member_name', v_member.full_name,
    'new_sessions_left', v_new_sessions_left,
    'sessions_used', v_member.sessions_used + 1
  );
end;
$$;

revoke all on function public.staff_qr_checkin(text, text) from public, anon;
grant execute on function public.staff_qr_checkin(text, text) to authenticated, service_role;
