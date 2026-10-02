-- Display names for the seeded accounts. Descriptive rather than realistic, so a
-- functional test case that expects "Coordinator One" is readable at a glance.
update identity.users set display_name = v.display_name
from (values
  ('00000000-0000-0000-0000-000000000001'::uuid, 'Organiser One'),
  ('00000000-0000-0000-0000-000000000002'::uuid, 'Coordinator One'),
  ('00000000-0000-0000-0000-000000000003'::uuid, 'Venue Staff One'),
  ('00000000-0000-0000-0000-000000000004'::uuid, 'Tech Support One'),
  ('00000000-0000-0000-0000-000000000005'::uuid, 'Attendee One'),
  ('00000000-0000-0000-0000-000000000006'::uuid, 'Deactivated Organiser'),
  ('00000000-0000-0000-0000-000000000007'::uuid, 'Organiser Two'),
  ('00000000-0000-0000-0000-000000000008'::uuid, 'Coordinator Two')
) as v(id, display_name)
where identity.users.id = v.id;
