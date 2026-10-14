-- ---------------------------------------------------------------------------
-- Transactional outbox for the equipment module (implementation.md §3.4).
--
-- O2 tells the event's assigned coordinator when Technical Support changes a
-- line's status. The message is written in the same transaction as the change,
-- and the relay in src/shared/outbox-relay.ts publishes it. Same shape as
-- event.outbox.
-- ---------------------------------------------------------------------------
create table equipment.outbox (
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

create index equipment_outbox_pending_seq_idx on equipment.outbox (seq) where published_at is null;
