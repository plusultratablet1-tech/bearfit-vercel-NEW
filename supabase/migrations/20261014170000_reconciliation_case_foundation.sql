-- BearFit Phase 2 PR #27: additive foundation; DO NOT apply to production yet.
-- No source records, session balances, payment credits, guest passes, payroll
-- or financial approvals are changed. Stage 2 write RPCs are NOT provided here.
create table if not exists public.reconciliation_cases (
 id uuid primary key default gen_random_uuid(),
 source_kind text not null check (source_kind in ('payment','attendance','coach','guest')),
 source_table text not null,
 source_id uuid not null,
 case_day date not null, -- Asia/Manila business date
 branch_snapshot text check (branch_snapshot in ('Malingap Branch','E. Rodriguez Branch','Primark Cainta')),
 reason_code text not null check (char_length(btrim(reason_code)) between 3 and 80),
 status text not null default 'open' check (status in ('open','in_review','resolved','escalated')),
 created_by uuid references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check (
  (source_kind='payment' and source_table='payments')
  or (source_kind='attendance' and source_table in ('session_logs','bookings'))
  or (source_kind='coach' and source_table in ('coach_work_shifts','coach_shifts','coach_conductions'))
  or (source_kind='guest' and source_table='guest_invites')
 ),
 unique(source_kind,source_id,case_day,reason_code)
);
create index if not exists reconciliation_cases_review_idx
 on public.reconciliation_cases(case_day,branch_snapshot,status);
create index if not exists reconciliation_cases_source_idx
 on public.reconciliation_cases(source_kind,source_id);

create table if not exists public.reconciliation_case_events (
 id uuid primary key default gen_random_uuid(),
 case_id uuid not null references public.reconciliation_cases(id) on delete restrict,
 action text not null check (action in ('opened','review_started','resolved','escalated','reopened')),
 actor_id uuid references auth.users(id) on delete restrict,
 old_status text check (old_status in ('open','in_review','resolved','escalated')),
 new_status text not null check (new_status in ('open','in_review','resolved','escalated')),
 note text check (note is null or char_length(note)<=2000),
 occurred_at timestamptz not null default now()
);
create index if not exists reconciliation_case_events_history_idx
 on public.reconciliation_case_events(case_id,occurred_at,id);

-- Future Admin correction workflows may append events but never edit history.
create or replace function private.prevent_reconciliation_event_mutation()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 raise exception 'Reconciliation history is append-only; record a new event';
end; $$;
drop trigger if exists reconciliation_case_events_immutable on public.reconciliation_case_events;
create trigger reconciliation_case_events_immutable
 before update or delete on public.reconciliation_case_events
 for each row execute function private.prevent_reconciliation_event_mutation();

alter table public.reconciliation_cases enable row level security;
alter table public.reconciliation_case_events enable row level security;
revoke all on public.reconciliation_cases,public.reconciliation_case_events from public,anon,authenticated;
grant select on public.reconciliation_cases,public.reconciliation_case_events to authenticated;
create policy reconciliation_cases_admin_read on public.reconciliation_cases
 for select to authenticated
 using(exists(select 1 from public.profiles p
  where p.id=(select auth.uid()) and p.role='admin'));
create policy reconciliation_case_events_admin_read on public.reconciliation_case_events
 for select to authenticated
 using(exists(select 1 from public.profiles p
  where p.id=(select auth.uid()) and p.role='admin'));
-- No direct client insert/update/delete grants, policies, or write RPCs.
