-- E3: validates the role checks 0003 replaced NOT VALID, in a transaction of
-- their own. No existing row can fail: the new list is the old five plus
-- EVENT_COORDINATOR_LEAD.
alter table identity.user_roles validate constraint user_roles_role_check;

alter table identity.role_policy validate constraint role_policy_role_check;
