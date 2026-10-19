# O2 — Update an equipment request as arrangements are made

Seventeen cases, written from the story on 10 Oct 2026, before the code. T1 to T16 are API-level procedures (HTTP requests
with authentication stubbed, against a migrated throwaway Postgres). T17 is the signed-in browser walk-through, including
the coordinator's notification through Kafka.

| Acceptance criterion | Cases |
|---|---|
| A line status can be set to Under Review, Confirmed, Unavailable or Substituted, and each change records the acting staff member and timestamp | O2-T1, O2-T2, O2-T3, O2-T6, O2-T15, O2-T16, O2-T17 |
| Setting Unavailable requires a reason; without it the status is unchanged and nothing is reserved | O2-T3, O2-T4, O2-T5 |
| Setting Substituted records the original type and quantity with the substitute; originals are not overwritten | O2-T6, O2-T7, O2-T8 |
| The assigned coordinator receives a notification identifying the event, the line and the new status | O2-T9, O2-T17 |
| A failed status change leaves the line status, notes and any reservation unchanged | O2-T4, O2-T7, O2-T10, O2-T12, O2-T13, O2-T14 |

Only Technical Support does O2's updates (O2-T11). Boundaries: reason of 0 (T4) and 1 character (T5); substitute quantity 0 (T7), 1 (T8).

## What O2 does not do

O2 sets a line to Confirmed without reserving anything (O2-T2): reserving, and the line becoming Reserved, is Q1 (Sprint 3).
The story does not say what Technical Support may do to a line that is already Reserved or Removed; the cases (O2-T13) expect a refusal, which a reviewer should confirm.

## Fixture FX-O2 (API level)

As FX-O1 (`tests/O1/README.md`), except the two equipment types are named `O2 Folding Chairs` (CHAIRS, bulk, total 50) and
`O2 Projectors` (PROJECTORS, bulk, total 5), and E2 is a second Approved event, assigned to C1, used by O2-T16.

## Isolated automated setup and execution

As `tests/O1/README.md`, running `tests/equipment/api/o2Cards.test.ts`. The notification half of O2-T9 runs the notification
service's recipient rule on the stored message (`backend/services/notification/tests/domain/recipients.test.ts`); delivery
through Kafka is covered only by the browser case T17.
