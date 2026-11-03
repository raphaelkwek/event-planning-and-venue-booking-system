-- ---------------------------------------------------------------------------
-- R2 to R4: the registration service's transactional outbox (implementation.md
-- §3.4). A registration message exists if and only if its change committed:
-- the row is written in the same transaction, and the service's relay
-- (src/outbox/relay.ts) publishes it to connectsphere.registration.v1, keyed by
-- the registration's id, in seq order.
-- ---------------------------------------------------------------------------
create table registration.outbox (
  id            uuid primary key default gen_random_uuid(),
  seq           bigint generated always as identity,  -- write order; the relay publishes by it
  topic         text        not null,                 -- a KAFKA_TOPICS value
  message_key   text        not null,                 -- the aggregate id = the envelope's subject
  envelope      jsonb       not null,                 -- the CloudEvent, validated by parseCloudEvent
  created_at    timestamptz not null default now(),
  published_at  timestamptz,
  attempts      int         not null default 0,
  last_error    text
);

create index outbox_unpublished_idx on registration.outbox (seq) where published_at is null;
