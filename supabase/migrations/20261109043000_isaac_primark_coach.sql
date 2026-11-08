-- Isaac is a real coach at the canonical Primark Cainta branch.
-- No demo members, sessions, payroll or bookings are copied or manufactured.
insert into public.coaches(display_name,branch,username,is_active,is_demo)
select 'Isaac','Primark Cainta','coach5',true,false
where not exists(select 1 from public.coaches where roster_key='isaac' or lower(btrim(display_name))='isaac')
 and not exists(select 1 from public.coaches where username='coach5');
