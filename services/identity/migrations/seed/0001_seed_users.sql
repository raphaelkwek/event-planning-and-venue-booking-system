insert into identity.role_policy (role, description) values
  ('EVENT_ORGANISER', 'Requests and manages their own events'),
  ('EVENT_COORDINATOR', 'Reviews, plans and coordinates events'),
  ('VENUE_STAFF', 'Manages venues and decides booking requests'),
  ('TECH_SUPPORT_STAFF', 'Manages equipment inventory and reservations'),
  ('ATTENDEE', 'Registers for events open to them')
on conflict (role) do nothing;

insert into identity.users (id, supabase_user_id, email, is_active) values
  ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'organiser@connectsphere.test', true),
  ('00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'coordinator@connectsphere.test', true),
  ('00000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', 'venuestaff@connectsphere.test', true),
  ('00000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000004', 'techsupport@connectsphere.test', true),
  ('00000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000005', 'attendee@connectsphere.test', true),
  ('00000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000006', 'deactivated@connectsphere.test', false)
on conflict (id) do nothing;

insert into identity.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-000000000001', 'EVENT_ORGANISER'),
  ('00000000-0000-0000-0000-000000000002', 'EVENT_COORDINATOR'),
  ('00000000-0000-0000-0000-000000000003', 'VENUE_STAFF'),
  ('00000000-0000-0000-0000-000000000004', 'TECH_SUPPORT_STAFF'),
  ('00000000-0000-0000-0000-000000000005', 'ATTENDEE'),
  ('00000000-0000-0000-0000-000000000006', 'EVENT_ORGANISER')
on conflict (user_id, role) do nothing;
