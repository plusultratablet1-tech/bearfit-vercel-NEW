-- Register six already printed QR tokens by payload hash only.
-- Isaac is reserved by name pending a verified coach record; no client is assigned.
insert into public.coach_permanent_qr_tags(tag_number,reserved_coach_name,coach_id,payload_sha256)
values
(1,'Hunejin',(select id from public.coaches where lower(display_name)='hunejin' and not is_demo limit 1),'9c0319f08652836d68d8cb9290bd6348e570a392417d4eb434461b25d2528fa9'),
(2,'Hunejin',(select id from public.coaches where lower(display_name)='hunejin' and not is_demo limit 1),'b1046ec690f4630e4f099016eec4ee064756abfd47fab11f4af1453bbe117fb1'),
(3,'Joaquin',(select id from public.coaches where lower(display_name)='joaquin' and not is_demo limit 1),'1e4c9b73f0167fe55a4b3d63b53543be3d800dcd49b037902c584697f488c8ff'),
(4,'Joaquin',(select id from public.coaches where lower(display_name)='joaquin' and not is_demo limit 1),'29944c50bfb12f8320e309612e3828d0c7f6046b5065191465e0d20b289507f7'),
(5,'Isaac',null,'3e0620f504d443537cbd01a7a35b442e6e166258340f2a939f97c2142c9b1b2c'),
(6,'Isaac',null,'e7814d983fee30d3b5c005f92f590fe11d5e58e35c266126fcc5a469c817e76c')
on conflict(tag_number) do nothing;
