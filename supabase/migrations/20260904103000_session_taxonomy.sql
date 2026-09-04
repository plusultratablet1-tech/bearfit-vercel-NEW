-- Production-facing session labels while preserving internal package service categories.
alter table public.availability_rules add column if not exists session_label text;
alter table public.schedule_slots add column if not exists session_label text;
alter table public.bookings add column if not exists session_label text;
alter table public.session_logs add column if not exists session_label text;

create or replace function private.session_label_category(p_session_label text)
returns text
language plpgsql
immutable
set search_path=''
as $$
begin
  case trim(coalesce(p_session_label,''))
    when 'Strength Training' then return 'fitness';
    when 'Weight Training' then return 'fitness';
    when 'Boxing' then return 'fitness';
    when 'Conditioning' then return 'fitness';
    when 'Cardio' then return 'fitness';
    when 'Group Fitness' then return 'fitness';
    when 'Pilates Group' then return 'pilates_group';
    when 'Pilates 1-on-1' then return 'pilates_1on1';
    else
      raise exception 'Unknown session label: %', p_session_label;
  end case;
end;
$$;

create or replace function private.assert_session_label_category(p_session_label text,p_session_type text)
returns void
language plpgsql
immutable
set search_path=''
as $$
declare v_category text;
begin
  v_category := private.session_label_category(p_session_label);
  if v_category <> p_session_type then
    raise exception 'Session label % requires service category %, not %', p_session_label, v_category, p_session_type;
  end if;
end;
$$;
