-- Idempotent demo-only Primark Cainta roster; NO auth users, package cycles,
-- payments, sessions, coach rates, shifts, or bookings are created.
alter table public.coaches add column if not exists is_demo boolean not null default false;
-- A demo coach cannot accidentally become a live coach or be linked to an account.
alter table public.coaches drop constraint if exists coaches_demo_safety_check;
alter table public.coaches add constraint coaches_demo_safety_check
 check (not is_demo or (is_active=false and user_id is null and username is null));
insert into public.coaches(display_name,roster_key,branch,is_active,is_demo,user_id,username)
 values
 ('[DEMO] Coach Mira Santos','DEMO_PRIMARK_PILATES','Primark Cainta',false,true,null,null),
 ('[DEMO] Coach Andre Reyes','DEMO_PRIMARK_STRENGTH','Primark Cainta',false,true,null,null)
 on conflict (roster_key) do nothing;

insert into public.members(
 membership_id,name,full_name,email,phone,branch,package_name,package_type,
 status,membership_status,total_sessions,sessions_used,sessions_left,payment_status,
 total_paid,is_demo,coach_name,address,emergency_contact_name,emergency_contact_phone
) values
 ('DEMO-PRIM-001','[DEMO] Sofia Cruz','[DEMO] Sofia Cruz','sofia.primark@example.invalid',null,'Primark Cainta','Pilates Group','Pilates','inactive','inactive',0,0,0,'not_recorded',0,true,'[DEMO] Coach Mira Santos','Sample profile — Primark Cainta',null,null),
 ('DEMO-PRIM-002','[DEMO] Liam Garcia','[DEMO] Liam Garcia','liam.primark@example.invalid',null,'Primark Cainta','Strength & Conditioning','Fitness','inactive','inactive',0,0,0,'not_recorded',0,true,'[DEMO] Coach Andre Reyes','Sample profile — Primark Cainta',null,null),
 ('DEMO-PRIM-003','[DEMO] Ava Dela Cruz','[DEMO] Ava Dela Cruz','ava.primark@example.invalid',null,'Primark Cainta','Pilates 1-on-1','Pilates','inactive','inactive',0,0,0,'not_recorded',0,true,'[DEMO] Coach Mira Santos','Sample profile — Primark Cainta',null,null),
 ('DEMO-PRIM-004','[DEMO] Noah Mendoza','[DEMO] Noah Mendoza','noah.primark@example.invalid',null,'Primark Cainta','Strength & Conditioning','Fitness','inactive','inactive',0,0,0,'not_recorded',0,true,'[DEMO] Coach Andre Reyes','Sample profile — Primark Cainta',null,null)
on conflict (membership_id) do nothing;
