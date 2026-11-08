-- Isaac is a real coach at the canonical Primark Cainta branch.
-- No demo members, sessions, payroll or bookings are copied or manufactured.
insert into public.coaches(display_name,roster_key,branch,username,is_active,is_demo)
select 'Isaac','isaac','Primark Cainta','coach5',true,false
where not exists(select 1 from public.coaches where roster_key='isaac' or lower(btrim(display_name))='isaac')
 and not exists(select 1 from public.coaches where username='coach5');
