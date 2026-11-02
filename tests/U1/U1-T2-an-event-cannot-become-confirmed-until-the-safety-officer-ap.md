# U1-T2 — An event cannot become Confirmed until the Safety Officer approves

## Specification

| Item | Content |
|---|---|
| Test Case ID | U1-T2 |
| Test Scenario | An event cannot become Confirmed until the Safety Officer approves |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (`npm run migrate:all`, with the CI seed). Authentication is stubbed: the signed-in user is whichever actor a step names.<br>2. Fixture FX-U1 from `tests/U1/README.md`: event E1 in Safety Review (owner ORG, assigned to C1, expected attendance 120, accessibility needs recorded), confirmed booking B1 (venue `U1 Hall`, layout Theatre, capacity 150) and reservation R1 (`U1 Chairs` × 5, placement note recorded). |
| Test Steps | 1. As C1, send `POST /api/v1/events/<E1>/mark-confirmed`.<br>2. Read the event, its latest status history entry, `event.safety_decisions`, the arrangements' flags and the outbox with the queries in `tests/U1/README.md`. |
| Test Data | Actor C1. |
| Expected Result | HTTP 409 `SAFETY_CHECK_NOT_PASSED` saying the safety check has not been passed. E1 is still Safety Review; no history entry, decision or outbox message was written. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

> **Expected results are checked by the PR reviewer** against U1's acceptance criteria before the
> code is merged (implementation.md §11.12).

## Execution record

| Item | Content |
|---|---|
| Actual Result | Mark Confirmed by C1 before any decision was refused with 409 SAFETY_CHECK_NOT_PASSED; the event status, history, decisions, flags, slots, reservations and outbox read exactly as before. |
| Status | Pass |
| Remarks | Automated (API level) · Commit: 042f2d5 · Evidence: backend/services/planning-core/tests/change/api/u1Cards.test.ts › U1-T2 an event cannot become Confirmed until the Safety Officer approves, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41475757839 · Defect: — (that run's integration job fails only on tests/race/invariants.test.ts L3-T17, a fixed-date test outside U1; every U1 card passed) |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-02 |
