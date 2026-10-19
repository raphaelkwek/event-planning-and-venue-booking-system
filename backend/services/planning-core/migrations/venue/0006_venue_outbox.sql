-- ---------------------------------------------------------------------------
-- Transactional outbox for the venue module (implementation.md §3.4).
--
-- L1 tells the venue's Venue Staff about a new booking request. The message is
-- written in the same transaction as the request, and the relay in
-- src/shared/outbox-relay.ts publishes it to connectsphere.venue-booking.v1.
-- Same shape as event.outbox and equipment.outbox.
-- ---------------------------------------------------------------------------
create table venue.outbox (
  id           uuid primary key default gen_random_uuid(),
  seq          bigint generated always as identity,
  topic        text        not null,
  message_key  text        not null,
  envelope     jsonb       not null,
  created_at   timestamptz not null default now(),
  published_at timestamptz,
  attempts     int         not null default 0,
  last_error   text
);

create index venue_outbox_pending_seq_idx on venue.outbox (seq) where published_at is null;
