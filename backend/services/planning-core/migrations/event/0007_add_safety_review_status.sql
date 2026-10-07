-- CR-06 (Week 7): the Safety Review status, between Planning and Confirmed.
-- F5's confirmation of the arrangements leads to it; the Safety Officer's
-- approval (U1) leads on to Confirmed. The permitted values live in contracts
-- (EVENT_STATUSES), and tests/boundaries/eventValues.test.ts holds this check
-- to exactly that list.
--
-- Added NOT VALID and then validated, so the new check is added without
-- holding a lock that blocks writes while every row is checked.
alter table event.events drop constraint events_status_check;

alter table event.events add constraint events_status_check
  check (status in (
    'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'AWAITING_CLARIFICATION',
    'APPROVED', 'PLANNING', 'SAFETY_REVIEW', 'CONFIRMED', 'COMPLETED',
    'CANCELLED', 'REJECTED'
  )) not valid;

alter table event.events validate constraint events_status_check;
