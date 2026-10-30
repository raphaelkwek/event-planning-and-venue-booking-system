-- E3 to E5 (CR-05): the Event Coordinator Lead assigns, reassigns and oversees
-- coordinators. The permitted roles live in contracts (ROLES); these checks are
-- widened to match. One role per account (W9-66).
--
-- Each check is replaced NOT VALID here and validated in 0004, so the scan of
-- existing rows runs in its own transaction (migrate.ts applies one file per
-- transaction), as event 0007 and 0008 do. New rows are checked from here on.
alter table identity.user_roles drop constraint user_roles_role_check;

alter table identity.user_roles add constraint user_roles_role_check
  check (role in (
    'EVENT_ORGANISER', 'EVENT_COORDINATOR', 'VENUE_STAFF',
    'TECH_SUPPORT_STAFF', 'ATTENDEE', 'EVENT_COORDINATOR_LEAD'
  )) not valid;

alter table identity.role_policy drop constraint role_policy_role_check;

alter table identity.role_policy add constraint role_policy_role_check
  check (role in (
    'EVENT_ORGANISER', 'EVENT_COORDINATOR', 'VENUE_STAFF',
    'TECH_SUPPORT_STAFF', 'ATTENDEE', 'EVENT_COORDINATOR_LEAD'
  )) not valid;
