-- Real package pricing guidance and controlled Admin settings.
alter table public.package_definitions
  add column if not exists standard_price numeric(12,2)
  constraint package_definitions_standard_price_nonnegative
  check (standard_price is null or standard_price >= 0);

update public.package_definitions set standard_price=4450.00 where code='PILATES5';
update public.package_definitions set standard_price=8900.00 where code='PILATES10';
update public.package_definitions set standard_price=16400.00 where code='PILATES20';
update public.package_definitions set standard_price=1600.00 where code='PILATES1ON1';
update public.package_definitions set standard_price=null where code='FULL24';
update public.package_definitions set standard_price=null where code='FULL48';
update public.package_definitions set standard_price=null where code='PARTIAL24';
update public.package_definitions set standard_price=null where code='LEGACY_FITNESS';

create or replace function public.staff_package_catalog()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare v_packages jsonb; v_stages jsonb;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not (select private.is_staff_or_admin()) then raise exception 'Staff access required'; end if;
  select coalesce(jsonb_agg(to_jsonb(d) order by d.name),'[]'::jsonb) into v_packages from public.package_definitions d;
  select coalesce(jsonb_agg(to_jsonb(s) order by s.package_id,s.stage_order),'[]'::jsonb) into v_stages from public.package_payment_stages s;
  return jsonb_build_object('packages',v_packages,'stages',v_stages);
end;
$$;

create or replace function public.admin_update_package_settings(
  p_package_id uuid,
  p_standard_price numeric,
  p_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare v_role text; v_code text;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  select role into v_role from public.profiles where id=(select auth.uid());
  if coalesce(v_role,'') <> 'admin' then raise exception 'Admin access required'; end if;
  if p_standard_price is not null and p_standard_price < 0 then raise exception 'Standard price cannot be negative'; end if;
  select code into v_code from public.package_definitions where id=p_package_id for update;
  if not found then raise exception 'Package not found'; end if;
  if v_code='LEGACY_FITNESS' and coalesce(p_active,false) then raise exception 'LEGACY_FITNESS cannot be activated'; end if;
  update public.package_definitions
    set standard_price=p_standard_price, active=coalesce(p_active,false), updated_at=now()
  where id=p_package_id;
  return public.staff_package_catalog();
end;
$$;

revoke all on function public.staff_package_catalog() from public,anon;
revoke all on function public.admin_update_package_settings(uuid,numeric,boolean) from public,anon;
grant execute on function public.staff_package_catalog() to authenticated,service_role;
grant execute on function public.admin_update_package_settings(uuid,numeric,boolean) to authenticated,service_role;
