-- Cover Bearforce redemption staff actor foreign keys flagged by Supabase advisor.
create index if not exists bearforce_redemptions_created_by_idx
  on public.bearforce_redemptions(created_by);

create index if not exists bearforce_redemptions_reversed_by_idx
  on public.bearforce_redemptions(reversed_by);
