-- ---------------------------------------------------------------------------
-- Outbox publish order (EN-04.2, implementation.md §3.4).
--
-- The relay publishes each aggregate's messages in the order they were
-- written. created_at cannot give that order: it defaults to now(), the start
-- of the writing transaction, so two rows written in one transaction tie, and
-- a transaction that started earlier but waited for the event's row lock
-- stamps its row before one that committed first. seq is taken when the row
-- is inserted, after that lock, so it follows the order of writes.
-- ---------------------------------------------------------------------------
alter table event.outbox add column seq bigint generated always as identity;

-- The relay's query: unpublished rows in seq order.
create index outbox_pending_seq_idx on event.outbox (seq) where published_at is null;
drop index event.outbox_published_at_idx;
