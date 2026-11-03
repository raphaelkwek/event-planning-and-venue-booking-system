# EN-03 — Event store and projections (SPM-121)

EN-03 is an enabler, so it has no screen of its own. Its cards check the event store that ADR-0007
describes: the append-only, hash-chained `event.event_stream`, the projections written in the same
transaction, the migration of the existing history, the history reads, and the tamper check. Each
runs as a vitest command, or a CI step, against a database built from every migration. In CI that is
the integration job's throwaway Postgres. None of them touches the team's shared database.

The cases were written from the acceptance criteria in the plan
(`documentation/proposals/2026-10-01-target-architecture-and-jira-plan.md` §5) before the code.

| Acceptance criterion | Cards |
|---|---|
| 1. An append-only `event.event_stream` with `unique(aggregate_id, version)` and a hash chain (`prev_hash`, `hash`). | EN-03-T1, EN-03-T2, EN-03-T3, EN-03-T4 |
| 2. Projections update in the same transaction as the append, together with the outbox row. | EN-03-T5, EN-03-T6, EN-03-T7, EN-03-T8, EN-03-T19 |
| 3. The existing A–E history (`event_history`) is migrated into the stream. | EN-03-T9, EN-03-T10, EN-03-T11 |
| 4. F1's and F2's history reads come from the stream. | EN-03-T12, EN-03-T13 |
| 5. A tamper check detects an edited entry. | EN-03-T14, EN-03-T15, EN-03-T16, EN-03-T17, EN-03-T18 |

| Card | Category | Scenario |
|---|---|---|
| EN-03-T1 | Happy path | Each append takes the next version and links to the previous entry's hash |
| EN-03-T2 | Boundary | The canonical form an entry is hashed over is fixed and documented |
| EN-03-T3 | Negative (concurrency) | Two appends racing for the same version store exactly one |
| EN-03-T4 | Negative | The stream refuses updates, deletes and truncation, and the app role may only insert and read |
| EN-03-T5 | Happy path | A status change writes the stream entry, the projections and the outbox message in one transaction |
| EN-03-T6 | Negative | A transaction that fails after the append stores nothing |
| EN-03-T7 | Happy path | Every writer of an event's history appends to the stream |
| EN-03-T8 | Negative | A history row written without the append function still reaches the stream |
| EN-03-T9 | Happy path | The backfill copies an event's existing history into the stream in time order |
| EN-03-T10 | Negative (idempotency) | Running the backfill again adds nothing |
| EN-03-T11 | Boundary | The backfill handles an event with one entry and entries recorded at the same time |
| EN-03-T12 | Happy path | F2's status history is read from the stream |
| EN-03-T13 | Happy path | F5's confirmation takes the time of the latest status change from the stream |
| EN-03-T14 | Happy path | The tamper check passes on an intact store |
| EN-03-T15 | Negative | An entry whose data was edited is detected |
| EN-03-T16 | Negative | An edit that also rewrites the entry's hash is detected at the next entry |
| EN-03-T17 | Boundary | A removed entry is detected |
| EN-03-T18 | Negative | `npm run event-store:verify` fails on CI's database after a row is edited |
| EN-03-T19 | Negative | A history projection row that disagrees with the stream is reported |

The stories whose behaviour EN-03 must not change (F1, F2, D3, G1, S2, F3, F5 and the rest) keep
their own cards and tests, which run unchanged.

## Latest run

All 19 cards: **Pass**, from CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41610286516 on commit `7f31eca` (2026-11-03). T1–T17 and T19 are integration tests on the CI job's throwaway Postgres; T14 and T18 are also the `Event store tamper check (EN-03)` step, which ran `npm run event-store:verify` on everything the integration suite wrote, edited one entry, and saw the command fail naming it.

**Not covered here:** the shared database has not been migrated or verified (no `.env` was used). Row-level security on the stream is EN-07's.
