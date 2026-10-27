-- E3 to E5: an Event Coordinator Lead for the functional test cases (tests/E3).
-- `npm run seed:auth` creates the matching Supabase Auth user.

insert into identity.role_policy (role, description) values
  ('EVENT_COORDINATOR_LEAD', 'Assigns, reassigns and oversees Event Coordinators')
on conflict (role) do nothing;

insert into identity.users (id, supabase_user_id, email, is_active, display_name) values
  ('00000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000009', 'lead@connectsphere.test', true, 'Lead One')
on conflict (id) do nothing;

insert into identity.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-000000000009', 'EVENT_COORDINATOR_LEAD')
on conflict (user_id, role) do nothing;
