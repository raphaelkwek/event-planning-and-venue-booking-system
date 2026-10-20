-- M1, M2: Venue Staff decide a booking request.
--
-- An approval (M1) confirms a booking in venue_slots and points the request at
-- it; a rejection (M2) records the reason and any suggested alternative. Both
-- record who decided and when. A request that is still Pending, or that its
-- coordinator withdrew (L2), has none of these.
--
-- CR-02: approving a request that replaces a disrupted booking releases that
-- booking with the reason "replaced". The booking is kept (§4.3).
--
-- The foreign key and the checks are added NOT VALID and validated in 0008, in
-- a transaction of their own. Every existing row has the new columns null and
-- is Pending or Withdrawn, so validation finds nothing to refuse.

alter table venue.booking_requests
  add column decided_by            uuid,
  add column decided_at            timestamptz,
  add column booking_id            uuid,
  add column rejection_reason      text,
  add column suggested_alternative text;

alter table venue.booking_requests
  add constraint booking_requests_booking_fkey
    foreign key (booking_id) references venue.venue_slots (id) not valid;

alter table venue.booking_requests
  add constraint booking_requests_decision_recorded check (
    (status in ('PENDING', 'WITHDRAWN')
      and decided_by is null and decided_at is null and booking_id is null
      and rejection_reason is null and suggested_alternative is null)
    or (status = 'APPROVED'
      and decided_by is not null and decided_at is not null and booking_id is not null
      and rejection_reason is null and suggested_alternative is null)
    or (status = 'REJECTED'
      and decided_by is not null and decided_at is not null and booking_id is null
      and rejection_reason is not null and length(btrim(rejection_reason)) > 0
      and (suggested_alternative is null or length(btrim(suggested_alternative)) > 0))
  ) not valid;

-- One booking is confirmed by one approval.
create unique index booking_requests_booking_idx
  on venue.booking_requests (booking_id)
  where (booking_id is not null);

alter table venue.venue_slots
  add column release_reason text;

alter table venue.venue_slots
  add constraint venue_slots_release_reason check (
    release_reason is null or (status = 'RELEASED' and length(btrim(release_reason)) > 0)
  ) not valid;
