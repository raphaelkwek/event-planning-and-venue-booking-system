# U1-T14 — Approval is refused while arrangement flags are outstanding

## Specification

| Item | Content |
|---|---|
| Test Case ID | U1-T14 |
| Test Scenario | Approval is refused while arrangement flags are outstanding |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (`npm run migrate:all`, with the CI seed). Authentication is stubbed: the signed-in user is whichever actor a step names.<br>2. Fixture FX-U1 from `tests/U1/README.md`: event E1 in Safety Review (owner ORG, assigned to C1, expected attendance 120, accessibility needs recorded), confirmed booking B1 (venue `U1 Hall`, layout Theatre, capacity 150) and reservation R1 (`U1 Chairs` × 5, placement note recorded).<br>3. R1 is flagged for review by an approved change (S3) while E1 is in Safety Review. |
| Test Steps | 1. As SO, send the decision `APPROVE` for E1.<br>2. As SO, request changes instead.<br>3. Read the event, its latest status history entry, `event.safety_decisions`, the arrangements' flags and the outbox with the queries in `tests/U1/README.md`. |
| Test Data | Actor SO. |
| Expected Result | Approval is HTTP 409 `ARRANGEMENT_FLAGS_OUTSTANDING` naming R1 and its flag, and nothing is written. Requesting changes is still allowed. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

> **Expected results are checked by the PR reviewer** against U1's acceptance criteria before the
> code is merged (implementation.md §11.12).

## Execution record

| Item | Content |
|---|---|
| Actual Result | With R1 flagged, approval returned 409 ARRANGEMENT_FLAGS_OUTSTANDING naming R1 and its flag in details and wrote nothing; a request for changes was still accepted. |
| Status | Pass |
| Remarks | Automated (API level) · Commit: 042f2d5 · Evidence: backend/services/planning-core/tests/change/api/u1Cards.test.ts › U1-T14 approval is refused while arrangement flags are outstanding, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41475757839 · Defect: — (that run's integration job fails only on tests/race/invariants.test.ts L3-T17, a fixed-date test outside U1; every U1 card passed) |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-02 |
