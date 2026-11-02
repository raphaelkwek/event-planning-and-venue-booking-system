-- EN-19: an organiser can flag an event high-demand. Attendees then have to
-- queue in the registration service's waiting room and register with an
-- admission token, so a rush at the opening cannot flood the seat claim.
--
-- The flag is an event field like the registration window, published on
-- event.listing-changed, so the registration service keeps its own copy
-- (registration migration 0008). It starts false for every existing event.
alter table event.events add column high_demand boolean not null default false;
