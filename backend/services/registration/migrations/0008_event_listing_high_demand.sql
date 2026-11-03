-- ---------------------------------------------------------------------------
-- EN-19: the registration service's copy of the organiser's high-demand flag
-- (planning-core event migration 0019), carried by event.listing-changed.
-- Registering for a flagged event needs an admission token from the waiting
-- room (migration 0009). A listing built from a message published before the
-- flag existed reads as not high-demand.
-- ---------------------------------------------------------------------------
alter table registration.event_listings add column high_demand boolean not null default false;
