# U1-T6 — Only the assigned coordinator may mark an approved event Confirmed

## Specification

| Item | Content |
|---|---|
| Test Case ID | U1-T6 |
| Test Scenario | Only the assigned coordinator may mark an approved event Confirmed |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (`npm run migrate:all`, with the CI seed). Authentication is stubbed: the signed-in user is whichever actor a step names.<br>2. Fixture FX-U1 from `tests/U1/README.md`: event E1 in Safety Review (owner ORG, assigned to C1, expected attendance 120, accessibility needs recorded), confirmed booking B1 (venue `U1 Hall`, layout Theatre, capacity 150) and reservation R1 (`U1 Chairs` × 5, placement note recorded).<br>3. SO has approved E1. |
| Test Steps | 1. As C2 (an Event Coordinator not assigned to E1), then ORG, VS, TS, ATT and SO, send `POST /api/v1/events/<E1>/mark-confirmed`.<br>2. Read the event, its latest status history entry, `event.safety_decisions`, the arrangements' flags and the outbox with the queries in `tests/U1/README.md`. |
| Test Data | Actors C2, ORG, VS, TS, ATT, SO. |
| Expected Result | C2 receives HTTP 404 `EVENT_NOT_FOUND` with the message "No event with that reference is assigned to you." (A4: another coordinator's event is outside their scope). ORG, VS, TS, ATT and SO each receive HTTP 403 `ROLE_NOT_AUTHORISED`. E1 is still Safety Review and nothing was written. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

> **Expected results are checked by the PR reviewer** against U1's acceptance criteria before the
> code is merged (implementation.md §11.12).

## Execution record

| Item | Content |
|---|---|
| Actual Result | Not yet re-run since the merge of main brought in A4, which changed C2's expected result from 403 to 404. The earlier run (below) recorded 403 for C2, ORG, VS, TS, ATT, LEAD and SO. |
| Status | Not Executed |
| Remarks | Automated (API level) · Commit: 042f2d5 · Evidence: backend/services/planning-core/tests/change/api/u1Cards.test.ts › U1-T6 only the assigned coordinator may mark an approved event Confirmed, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41475757839 · Defect: — (that run's integration job fails only on tests/race/invariants.test.ts L3-T17, a fixed-date test outside U1; every U1 card passed) |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-02 |
