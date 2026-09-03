-- Cover scheduling/package foreign keys reported by the Supabase performance advisor.
create index if not exists availability_rules_created_by_idx on public.availability_rules(created_by);
create index if not exists bookings_created_by_idx on public.bookings(created_by);
create index if not exists bookings_member_package_id_idx on public.bookings(member_package_id);
create index if not exists bookings_requested_coach_user_id_idx on public.bookings(requested_coach_user_id);
create index if not exists member_package_cycles_renewed_from_id_idx on public.member_package_cycles(renewed_from_id);
create index if not exists member_package_stage_payments_stage_id_idx on public.member_package_stage_payments(stage_id);
create index if not exists schedule_slots_created_by_idx on public.schedule_slots(created_by);
