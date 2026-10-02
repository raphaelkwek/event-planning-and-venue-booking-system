-- A second active organiser and a second coordinator, for the functional test
-- cases in /tests that need a user who is *not* the owner or the first reviewer:
-- A3 (another organiser's event returns no data), C1/C2/D3/D5 (non-owner access),
-- and D1 (a second coordinator opening a request already under review).

insert into identity.users (id, supabase_user_id, email, is_active) values
  ('00000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000007', 'organiser2@connectsphere.test', true),
  ('00000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000008', 'coordinator2@connectsphere.test', true)
on conflict (id) do nothing;

insert into identity.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-000000000007', 'EVENT_ORGANISER'),
  ('00000000-0000-0000-0000-000000000008', 'EVENT_COORDINATOR')
on conflict (user_id, role) do nothing;
