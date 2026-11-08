-- Six physical, persistent QR tag identifiers will be registered separately
-- using only SHA-256 hashes of their printed payloads. The raw QR payloads
-- are NEVER stored in the repository or database.
-- QR tags remain unassigned until a verified coach selects their own client.
create table if not exists public.coach_permanent_qr_tags(
  tag_number integer primary key check (tag_number between 1 and 999),
  reserved_coach_name text not null check(length(btrim(reserved_coach_name)) between 2 and 100),
  coach_id uuid references public.coaches(id) on delete restrict,
  payload_sha256 text not null unique check(payload_sha256 ~ '^[0-9a-f]{64}$'),
  member_id uuid references public.members(id) on delete restrict,
  assigned_by uuid references auth.users(id),
  assigned_at timestamptz,
  created_at timestamptz not null default now(),
  constraint coach_permanent_qr_tag_assignment_integrity check(
    (member_id is null and assigned_by is null and assigned_at is null) or
    (member_id is not null and assigned_by is not null and assigned_at is not null)
  )
);
create index if not exists coach_permanent_tags_coach_idx on public.coach_permanent_qr_tags(coach_id,tag_number);
alter table public.coach_permanent_qr_tags enable row level security;
revoke all on public.coach_permanent_qr_tags from public,anon,authenticated;

-- Inventory is coach-scoped; no raw secrets or unrelated clients are revealed.
create or replace function public.coach_permanent_qr_inventory()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare c public.coaches%rowtype;v_tags jsonb;v_clients jsonb;
begin
  if (select auth.uid()) is null or not exists(
    select 1 from public.profiles where id=(select auth.uid()) and role='coach')
  then raise exception 'Coach login required';end if;
  select * into c from public.coaches where user_id=(select auth.uid()) and is_active and not is_demo;
  if not found then raise exception 'Active coach record not linked';end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'number',t.tag_number,'assigned',t.member_id is not null,
    'member_code',m.member_code,'member_name',m.full_name,'assigned_at',t.assigned_at
  ) order by t.tag_number),'[]'::jsonb) into v_tags
  from public.coach_permanent_qr_tags t left join public.members m on m.id=t.member_id
  where t.coach_id=c.id or (t.coach_id is null
      and lower(btrim(t.reserved_coach_name))=lower(btrim(c.display_name)));
  select coalesce(jsonb_agg(jsonb_build_object(
    'member_code',m.member_code,'member_name',m.full_name
  ) order by m.full_name),'[]'::jsonb) into v_clients
  from public.members m
  where m.branch=c.branch and not coalesce(m.is_demo,false)
    and lower(btrim(coalesce(m.coach_name,'')))=lower(btrim(c.display_name));
  return jsonb_build_object('tags',v_tags,'clients',v_clients);
end;$$;
revoke all on function public.coach_permanent_qr_inventory() from public,anon;
grant execute on function public.coach_permanent_qr_inventory() to authenticated;

-- Return a member code ONLY for that tag's assigned coach.
-- The client still needs the existing separate coach_qr_session verification and
-- explicit confirm step before any session is deducted.
create or replace function public.coach_resolve_permanent_qr(p_payload text)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare c public.coaches%rowtype;t public.coach_permanent_qr_tags%rowtype;m public.members%rowtype;
 v_number integer;
begin
  if (select auth.uid()) is null or not exists(
    select 1 from public.profiles where id=(select auth.uid()) and role='coach')
  then raise exception 'Coach login required';end if;
  select * into c from public.coaches where user_id=(select auth.uid()) and is_active and not is_demo;
  if not found then raise exception 'Active coach not linked';end if;
  if p_payload is null or p_payload !~ '^BEARFIT-TAG:1:[0-9]{3}:[A-Za-z0-9_-]{32}$'
  then raise exception 'Invalid permanent QR tag';end if;
  v_number:=split_part(p_payload,':',3)::integer;
  select * into t from public.coach_permanent_qr_tags where tag_number=v_number;
  if not found or t.payload_sha256<>
      encode(extensions.digest(p_payload,'sha256'),'hex')
  then raise exception 'QR tag not recognized';end if;
  if (t.coach_id is distinct from c.id and not
      (t.coach_id is null and lower(btrim(t.reserved_coach_name))=lower(btrim(c.display_name))))
  then raise exception 'This QR tag is reserved for another coach';end if;
  if t.member_id is null then return jsonb_build_object('number',t.tag_number,'assigned',false);end if;
  select * into m from public.members where id=t.member_id;
  if not found or m.branch is distinct from c.branch or coalesce(m.is_demo,false)
    or lower(btrim(coalesce(m.coach_name,'')))<>lower(btrim(c.display_name))
  then raise exception 'This QR tag needs Admin review before use';end if;
  return jsonb_build_object('number',t.tag_number,'assigned',true,
      'member_code',m.member_code,'member_name',m.full_name);
end;$$;
revoke all on function public.coach_resolve_permanent_qr(text) from public,anon;
grant execute on function public.coach_resolve_permanent_qr(text) to authenticated;

-- A tag can be assigned only once, after physical scan. The hash is validated
-- server-side and the member must already be assigned to the same coach/branch.
create or replace function public.coach_assign_permanent_qr(
  p_payload text,p_member_code text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare c public.coaches%rowtype;t public.coach_permanent_qr_tags%rowtype;
 m public.members%rowtype;v_number integer;
begin
  if (select auth.uid()) is null or not exists(
    select 1 from public.profiles where id=(select auth.uid()) and role='coach')
  then raise exception 'Coach login required';end if;
  select * into c from public.coaches
   where user_id=(select auth.uid()) and is_active and not is_demo for update;
  if not found then raise exception 'Active coach not linked';end if;
  if p_payload is null or p_payload !~ '^BEARFIT-TAG:1:[0-9]{3}:[A-Za-z0-9_-]{32}$'
  then raise exception 'Invalid permanent QR tag';end if;
  v_number:=split_part(p_payload,':',3)::integer;
  select * into t from public.coach_permanent_qr_tags where tag_number=v_number for update;
  if not found or t.payload_sha256<>
     encode(extensions.digest(p_payload,'sha256'),'hex')
  then raise exception 'QR tag not recognized';end if;
  if (t.coach_id is distinct from c.id and not
      (t.coach_id is null and lower(btrim(t.reserved_coach_name))=lower(btrim(c.display_name))))
  then raise exception 'This QR tag belongs to another coach';end if;
  if t.member_id is not null then raise exception 'QR tag is already assigned. Ask Admin before changing its client';end if;
  select * into m from public.members
    where upper(member_code)=upper(btrim(p_member_code)) for share;
  if not found or m.branch is distinct from c.branch or coalesce(m.is_demo,false)
     or lower(btrim(coalesce(m.coach_name,'')))<>lower(btrim(c.display_name))
  then raise exception 'Client is not assigned to this coach and branch';end if;
  update public.coach_permanent_qr_tags
   set member_id=m.id,coach_id=c.id,assigned_by=(select auth.uid()),assigned_at=now()
   where tag_number=t.tag_number;
  return jsonb_build_object('number',t.tag_number,'member_code',m.member_code,
     'member_name',m.full_name,'assigned',true,
     'note','Tag assigned permanently. No session or payment was recorded.');
end;$$;
revoke all on function public.coach_assign_permanent_qr(text,text) from public,anon;
grant execute on function public.coach_assign_permanent_qr(text,text) to authenticated;
