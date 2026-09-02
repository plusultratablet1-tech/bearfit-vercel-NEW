create index if not exists payments_created_by_idx on public.payments(created_by);
create index if not exists session_logs_staff_user_id_idx on public.session_logs(staff_user_id);
