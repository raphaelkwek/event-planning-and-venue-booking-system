# U1-T6 — Only the assigned coordinator may mark an approved event Confirmed

## Specification

| Item | Content |
|---|---|
| Test Case ID | U1-T6 |
| Test Scenario | Only the assigned coordinator may mark an approved event Confirmed |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (`npm run migrate:all`, with the CI seed). Authentication is stubbed: the signed-in user is whichever actor a step names.<br>2. Fixture FX-U1 from `tests/U1/README.md`: event E1 in Safety Review (owner ORG, assigned to C1, expected attendance 120, accessibility needs recorded), confirmed booking B1 (venue `U1 Hall`, layout Theatre, capacity 150) and reservation R1 (`U1 Chairs` × 5, placement note recorded).<br>3. SO has approved E1. |
| Test Steps | 1. As C2 (an Event Coordinator not assigned to E1), then ORG, VS, TS, ATT and SO, send `POST /api/v1/events/<E1>/mark-confirmed`.<br>2. Read the event, its latest status history entry, `event.safety_decisions`, the arrangements' flags and the outbox with the queries in `tests/U1/README.md`. |
| Test Data | Actors C2, ORG, VS, TS, ATT, SO. |
| Expected Result | HTTP 403 `ROLE_NOT_AUTHORISED` for every one of them. E1 is still Safety Review and nothing was written. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

> **Expected results are checked by the PR reviewer** against U1's acceptance criteria before the
> code is merged (implementation.md §11.12).

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
