-- ---------------------------------------------------------------------------
-- Skip the outbox backlog (EN-04.2, team decision 3 Oct 2026).
--
-- No relay existed until EN-04.2, so every row written since 15 Sep 2026 was
-- still waiting (3,345 on the shared database), nearly all of them left by
-- test runs. Rather than publish them all to Kafka on the first relay start,
-- they are marked as handled, with last_error saying why. Rows written after
-- this migration runs are published as normal. On an empty database this
-- changes nothing.
-- ---------------------------------------------------------------------------
update event.outbox
set published_at = now(),
    last_error = 'skipped: written before the outbox relay existed (EN-04.2)'
where published_at is null;
