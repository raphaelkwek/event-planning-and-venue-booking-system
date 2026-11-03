-- U1: a Safety Officer for the functional test cases (tests/U1) and for CI's seeded database.
-- `npm run seed:auth` creates the matching Supabase Auth user; CI never runs it.

insert into identity.role_policy (role, description) values
  ('SAFETY_OFFICER', 'Records the operational safety decision on events in Safety Review')
on conflict (role) do nothing;

insert into identity.users (id, supabase_user_id, email, is_active, display_name) values
  ('00000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000010', 'safety@connectsphere.test', true, 'Safety Officer One')
on conflict (id) do nothing;

insert into identity.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-000000000010', 'SAFETY_OFFICER')
on conflict (user_id, role) do nothing;
